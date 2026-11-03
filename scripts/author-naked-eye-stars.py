"""Build the Naked-eye stars catalog: every star with SIMBAD Johnson V <= 6.5 out to 20,000 light-years.

A star already curated by another catalog is copied verbatim with its ID, so the
switch shows the complete naked-eye sky on its own; that catalog remains the
only place where the record is authored. Every other star becomes a new record
from the frozen SIMBAD, Gaia DR3 and Bailer-Jones snapshot, enriched by the
shared exact-identity physical sources.
Run with --check to compare the checked-in files without writing them.
"""

import argparse
import bisect
import csv
import importlib.util
import io
import json
import math
import re
from pathlib import Path

from astropy.coordinates import SkyCoord, get_constellation
import astropy.units as units

from catalog_sources.enrichment import enrich_from_frozen, enrichment_sources, normalized_id, number
from catalog_sources.snapshots import sha256, verify_sha256

ROOT = Path(__file__).resolve().parents[1]


def script_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


landmarks = script_module("author_landmark_stars", "author-landmark-stars.py")
nearest1000 = script_module("author_nearest1000", "author-nearest1000.py")

WORK = ROOT / "catalog-work/naked-eye-stars"
OUTPUT = ROOT / "src/data/catalogs/naked-eye-stars"
EXTENSION = str(WORK.relative_to(ROOT))
SOURCE_CATALOGS = ("nearest-100", "nearest-1000", "nearest-5000", "western-constellation-stars")
DESIGNATIONS = ROOT / "src/data/object-designations.json"
COMPANIONS = ROOT / "src/data/stellar-companions.json"
SYSTEM_IDENTITIES = ROOT / "src/data/stellar-system-identities.json"
LIMIT_V = 6.5
LIGHT_YEARS_PER_PARSEC = 3.261563777
MAX_DISTANCE_PC = 20000 / LIGHT_YEARS_PER_PARSEC
# A star within this radius of a curated record at a consistent distance is that record's object or system.
MATCH_ARCSEC = 20
# Separation is never below the declination difference; the margin covers rounding in the separation test.
MATCH_DEC_WINDOW_DEG = (MATCH_ARCSEC + 1) / 3600
GAIA_DR3_BIBCODE = "2020yCat.1350....0G"
# Against the snapshot's spectroscopic consensus, GSP-Phot Teff misses by over 20 percent for 62% of
# O, 47% of B0-B4 and 37% of M stars, but at most 8% of later classes. FLAME values inherit that Teff.
# GSP-Phot [M/H] misses [Fe/H] by over 0.3 dex for 26-81% of these bright stars in every class.
GAIA_UNSUITABLE_TYPES = r"(?:O|B[0-4]|M)"
GAIA_FIELDS = ("temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "age_gyr")
# FLAME luminosity, and the radius, mass and age built on it, need a well-measured distance.
FLAME_MIN_PARALLAX_SNR = 10
GAIA_WITHHELD = "withheld: GSP-Phot temperature and the FLAME values derived from it are unreliable for O, B0-B4 and M spectral types"
# Survey grid edges and misidentified spectra (B stars at 6000 K) lie far outside their class; giants stay within it.
CLASS_TOLERANCE = 0.35
# Close components often lack a parallax of their own; SIMBAD gives it to their multiple-star record.
SYSTEM_TYPES = {"**", "SB*", "EB*"}
SYSTEM_FIELDS = ("plx_value", "plx_err", "plx_bibcode", "pmra", "pmdec", "pm_bibcode", "rvz_radvel", "rvz_err", "rvz_bibcode")
NON_STELLAR = {"OpC", "GlC", "Cl*", "G", "GiG", "GrG", "AGN", "SN*", "UV", "X"}
# Identifier families that name one object; double-star catalogue numbers can name a whole pair.
IDENTITY_PREFIXES = ("* ", "V* ", "NAME ", "HIP ", "HD ", "HR ", "Gaia DR3 ", "BD", "CD", "CPD", "SAO ", "TYC ", "FK5 ", "GJ ")


def csv_rows(path):
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def aliases(source):
    return [landmarks.compact_spaces(value) for value in [source["main_id"], *(source["ids"] or "").split("|")] if value.strip()]


def identity_key(value):
    return normalized_id(value).casefold()


def separation_arcsec(first, second):
    return landmarks.angular_separation_arcsec(*first, *second)


def snapshot():
    manifest = json.loads((WORK / "source-manifest.json").read_text())
    for name, digest in manifest["checksumsSha256"].items():
        verify_sha256(WORK / name, digest)
    gaia = {row["source_id"]: row for row in csv_rows(WORK / "gaia.csv")}
    distances = {row["source_id"]: row for row in csv_rows(WORK / "distance.csv")}
    parents = {}
    for row in csv_rows(WORK / "parents.csv"):
        if row["otype"] in SYSTEM_TYPES and (number(row["plx_value"]) or 0) > 0:
            parents.setdefault(row["child_id"], []).append(row)
    return manifest, csv_rows(WORK / "simbad.csv"), gaia, distances, {child: rows[0] for child, rows in parents.items() if len(rows) == 1}


def curated_records():
    """Rows of the curated catalogs, an exact identifier index and positions ordered by declination."""
    rows = {}
    for catalog in SOURCE_CATALOGS:
        for row in csv_rows(ROOT / f"src/data/catalogs/{catalog}/stars.csv"):
            if row["id"] != "sun":
                rows.setdefault(row["id"], (catalog, row))
    designations = json.loads(DESIGNATIONS.read_text())["objects"]
    index = {}

    def add(value, identifier):
        if value:
            index.setdefault(identity_key(value), set()).add(identifier)

    for identifier, (_, row) in rows.items():
        entry = designations.get(identifier, {})
        for value in [row["name"], entry.get("simbadId"), *entry.get("designations", [])]:
            add(value and landmarks.compact_spaces(value), identifier)
    # A reviewed companion enters with any curated member of its system.
    members = {}
    for system in json.loads(SYSTEM_IDENTITIES.read_text())["systems"]:
        identifiers = [identifier for component in system["components"] for identifier in [component["starId"], *component.get("alternateStarIds", [])]]
        for identifier in identifiers:
            members[identifier] = [candidate for candidate in identifiers if candidate in rows]
    positions = [(identifier, j2000_direction(row), math.dist((0, 0, 0), (float(row["x_pc"]), float(row["y_pc"]), float(row["z_pc"]))))
                 for identifier, (_, row) in rows.items() if row["ra_deg"] and row["dec_deg"]]
    for star in json.loads(COMPANIONS.read_text())["stars"]:
        for value in [star["name"], *star.get("designations", [])]:
            for identifier in members.get(star["id"], []):
                add(value, identifier)
        raw = star.get("raw_astrometry") or {}
        if raw.get("ra_deg") is not None and raw.get("dec_deg") is not None:
            direction = j2000_direction({"ra_deg": raw["ra_deg"], "dec_deg": raw["dec_deg"], "astrometry_epoch": raw.get("epoch"),
                                         "pm_ra_cosdec_masyr": raw.get("pm_ra_cosdec_masyr"), "pm_dec_masyr": raw.get("pm_dec_masyr")})
            distance = math.dist((0, 0, 0), (star["x_pc"], star["y_pc"], star["z_pc"]))
            positions += [(identifier, direction, distance) for identifier in members.get(star["id"], [])]
    return rows, index, sorted(positions, key=lambda item: item[1][1])


def j2000_direction(row):
    """Curated coordinates moved linearly back to J2000; nearby stars shift by arcminutes since Gaia's epoch."""
    years = (number(row.get("astrometry_epoch")) or 2000) - 2000
    ra, dec = float(row["ra_deg"]), float(row["dec_deg"])
    pm_ra, pm_dec = number(row.get("pm_ra_cosdec_masyr")) or 0, number(row.get("pm_dec_masyr")) or 0
    return ra - pm_ra * years / 3.6e6 / math.cos(math.radians(dec)), dec - pm_dec * years / 3.6e6


def curated_match(source, index, positions, distance):
    identifiers = set()
    for value in aliases(source):
        if value.startswith(IDENTITY_PREFIXES) or value == source["main_id"]:
            identifiers |= index.get(identity_key(value), set())
    if identifiers:
        return sorted(identifiers), "exact identifier"
    if not source["ra"] or not source["dec"]:
        return [], None
    # A component without its own parallax belongs to the curated system at its position.
    direction = (float(source["ra"]), float(source["dec"]))
    band = positions[bisect.bisect_left(positions, direction[1] - MATCH_DEC_WINDOW_DEG, key=lambda item: item[1][1]):
                     bisect.bisect_right(positions, direction[1] + MATCH_DEC_WINDOW_DEG, key=lambda item: item[1][1])]
    nearby = sorted(identifier for identifier, position, curated_distance in band
                    if separation_arcsec(direction, position) <= MATCH_ARCSEC and (distance is None or 2 / 3 <= curated_distance / distance <= 3 / 2))
    method = f"position within {MATCH_ARCSEC} arcsec" + (" at a consistent distance" if distance else "; no parallax of its own")
    return nearby, method if nearby else None


def adopted_distance(source, gaia_id, distances):
    """Bailer-Jones geometric distance where SIMBAD adopts the Gaia parallax; otherwise the inverse SIMBAD parallax."""
    parallax = number(source["plx_value"])
    posterior = distances.get(gaia_id) if gaia_id else None
    if posterior and source["plx_bibcode"] == GAIA_DR3_BIBCODE:
        distance = float(posterior["r_med_geo"])
        return distance, {
            "method": "Bailer-Jones EDR3 geometric posterior median", "distancePc": distance,
            "lowerPc": number(posterior["r_lo_geo"]), "upperPc": number(posterior["r_hi_geo"]),
            "source": "Bailer-Jones et al. 2021", "sourceId": gaia_id,
        }
    error = number(source["plx_err"])
    return 1000 / parallax, {
        "method": "inverse SIMBAD compiled parallax", "distancePc": 1000 / parallax,
        "parallaxSignalToNoise": parallax / error if error else None,
        "source": source["plx_bibcode"], "sourceId": source["main_id"],
    }


def star_id(source):
    for prefix, label in (("HIP ", "hip"), ("HD ", "hd"), ("HR ", "hr")):
        values = [value.removeprefix(prefix) for value in aliases(source) if value.startswith(prefix)]
        if len(values) == 1:
            return f"{label}-" + re.sub(r"[^a-z0-9]+", "-", values[0].casefold()).strip("-")
    return re.sub(r"[^a-z0-9]+", "-", landmarks.display_name(source).casefold()).strip("-")


def new_row(source, identifier, gaia, distance, distance_provenance, retrieved, constellation, system=None):
    ra, dec = math.radians(float(source["ra"])), math.radians(float(source["dec"]))
    radial = (math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec))
    east = (-math.sin(ra), math.cos(ra), 0)
    north = (-math.sin(dec) * math.cos(ra), -math.sin(dec) * math.sin(ra), math.cos(dec))
    position = landmarks.matrix_vector(landmarks.ICRS_TO_GALACTIC, tuple(distance * value for value in radial))
    visual = float(source["v"])
    row = {header: "" for header in landmarks.HEADERS}
    row.update({
        "type": "star", "id": identifier, "name": landmarks.display_name(source), "spectral_type": source["sp_type"],
        "x_pc": f"{position[0]:.9f}", "y_pc": f"{position[1]:.9f}", "z_pc": f"{position[2]:.9f}",
        "absolute_mag": f"{visual - 5 * math.log10(distance / 10):.6f}", "epoch": "2000.0",
        "notes": f"Naked-eye star: SIMBAD compiled Johnson V={source['v']} ({source['v_bibcode']}). SIMBAD identity {source['main_id']}; "
                 f"{distance_provenance['method']} distance; absolute V uses no extinction correction."
                 + (f" Parallax and motion are those of the system {system['parent_id']}; this component has none of its own." if system else ""),
        "constellation": nearest1000.NAME_CORRECTIONS.get(constellation, constellation),
        "ra_deg": source["ra"], "dec_deg": source["dec"], "astrometry_epoch": "2000.0",
        "parallax_mas": source["plx_value"], "parallax_error_mas": source["plx_err"],
        "pm_ra_cosdec_masyr": source["pmra"], "pm_dec_masyr": source["pmdec"],
        "radial_velocity_kms": source["rvz_radvel"], "radial_velocity_error_kms": source["rvz_err"] if source["rvz_radvel"] else "",
        "astrometry_ref": f"SIMBAD TAP snapshot {retrieved}; parallax {source['plx_bibcode']}; proper motion {source['pm_bibcode']}",
        "radial_velocity_ref": source["rvz_bibcode"] if source["rvz_radvel"] else "",
    })
    # SIMBAD gives an error ellipse; exact Gaia DR3 errors apply where SIMBAD adopts that proper motion.
    if gaia and source["pm_bibcode"] == GAIA_DR3_BIBCODE:
        row.update({"pm_ra_error_masyr": gaia["pmra_error"], "pm_dec_error_masyr": gaia["pmdec_error"]})
    if source["rvz_radvel"] and source["pmra"] and source["pmdec"]:
        scale = 4.74047 * distance / 1000
        equatorial = tuple(east[index] * scale * float(source["pmra"]) + north[index] * scale * float(source["pmdec"])
                           + radial[index] * float(source["rvz_radvel"]) for index in range(3))
        velocity = landmarks.matrix_vector(landmarks.ICRS_TO_GALACTIC, equatorial)
        row.update({"vx_kms": f"{velocity[0]:.6f}", "vy_kms": f"{velocity[1]:.6f}", "vz_kms": f"{velocity[2]:.6f}"})
    return row


def build():
    manifest_input, simbad, gaia, distances, parents = snapshot()
    selected = {source["main_id"] for source in simbad}
    retrieved = manifest_input["retrieved"]
    curated, index, positions = curated_records()
    copied, new, audit = {}, [], []
    for source in simbad:
        parallax = number(source["plx_value"])
        system = parents.get(source["main_id"]) if not (parallax and parallax > 0) else None
        if system and system["parent_id"] not in selected:
            source = {**source, **{field: system[field] for field in SYSTEM_FIELDS}}
            parallax = number(source["plx_value"])
        else:
            system = None
        gaia_ids = [value.removeprefix("Gaia DR3 ") for value in aliases(source) if value.startswith("Gaia DR3 ")]
        gaia_id = gaia_ids[0] if len(gaia_ids) == 1 else None
        distance, distance_provenance = adopted_distance(source, gaia_id, distances) if parallax and parallax > 0 else (None, None)
        matches, method = curated_match(source, index, positions, distance)
        if not matches and system:
            matches, method = curated_match({**system, "main_id": system["parent_id"], "ra": "", "dec": ""}, index, positions, distance)
            method = method and f"{method} of its system"
        if matches:
            for identifier in matches:
                copied.setdefault(identifier, {"sharedFrom": curated[identifier][0], "simbadIds": [], "matchedBy": method})["simbadIds"].append(source["main_id"])
            continue
        reason = ("non-stellar SIMBAD type" if source["otype"] in NON_STELLAR else "no positive SIMBAD parallax" if distance is None
                  else "beyond 20,000 light-years" if distance > MAX_DISTANCE_PC else None)
        if reason:
            audit.append({"simbadId": source["main_id"], "otype": source["otype"], "v": source["v"], "status": "excluded", "reason": reason})
            continue
        new.append({"source": source, "gaiaId": gaia_id, "distance": distance, "distanceProvenance": distance_provenance, "system": system})
    # SIMBAD can list a double star both as one ** record and as its components; keep the components.
    components = [item for item in new if item["source"]["otype"] != "**"]
    represented = []
    for item in new:
        source = item["source"]
        if source["otype"] != "**":
            continue
        direction = (float(source["ra"]), float(source["dec"]))
        nearby = [other["source"]["main_id"] for other in components
                  if separation_arcsec(direction, (float(other["source"]["ra"]), float(other["source"]["dec"]))) <= MATCH_ARCSEC]
        if nearby:
            represented.append(item)
            audit.append({"simbadId": source["main_id"], "otype": "**", "v": source["v"], "status": "represented", "reason": f"aggregate of {', '.join(nearby)}"})
    new = [item for item in new if item not in represented]
    # A component without its own parallax is shown by the new system record at its position.
    for entry in audit:
        source = next(row for row in simbad if row["main_id"] == entry["simbadId"])
        if entry["reason"] != "no positive SIMBAD parallax" or not source["ra"]:
            continue
        direction = (float(source["ra"]), float(source["dec"]))
        nearby = [item["source"]["main_id"] for item in new
                  if separation_arcsec(direction, (float(item["source"]["ra"]), float(item["source"]["dec"]))) <= MATCH_ARCSEC]
        if nearby:
            entry.update({"status": "represented", "reason": f"component of {', '.join(nearby)}; no parallax of its own"})
    rows, provenance = [], {"sun": {"origin": "Map origin; not a naked-eye selection."}}
    taken = set(curated)
    # One vectorized lookup; per-star SkyCoord transforms dominate otherwise.
    constellations = get_constellation(SkyCoord(ra=[float(item["source"]["ra"]) for item in new] * units.deg,
                                                dec=[float(item["source"]["dec"]) for item in new] * units.deg, frame="icrs"),
                                       short_name=False, constellation_list="iau") if new else []
    for item, constellation in zip(new, constellations):
        source = item["source"]
        identifier = star_id(source)
        if identifier in taken:
            raise ValueError(f"Naked-eye star ID collides with an existing record: {identifier} ({source['main_id']})")
        taken.add(identifier)
        # Gaia errors describe the component's own source, not its system's motion.
        row = new_row(source, identifier, None if item["system"] else gaia.get(item["gaiaId"]), item["distance"], item["distanceProvenance"], retrieved, str(constellation).strip(), item["system"])
        gaia_suitable = not re.match(GAIA_UNSUITABLE_TYPES, source["sp_type"] or "")
        error = number(source["plx_err"])
        flame_suitable = bool(error) and float(source["plx_value"]) / error >= FLAME_MIN_PARALLAX_SNR
        gaia_fields = (GAIA_FIELDS if flame_suitable else GAIA_FIELDS[:1]) if gaia_suitable else ()
        physical = enrich_from_frozen(row, source["main_id"], aliases(source), extended=EXTENSION,
                                      gaia_fields=gaia_fields, class_tolerance=CLASS_TOLERANCE)
        rows.append(row)
        provenance[identifier] = {
            "simbadId": source["main_id"], "simbadType": source["otype"], "gaiaDr3Id": item["gaiaId"],
            "visualMagnitude": {"value": float(source["v"]), "uncertainty": number(source["v_err"]), "bibcode": source["v_bibcode"]},
            "adoptedDistance": item["distanceProvenance"],
            "radialVelocity": {"status": "simbad-compiled" if source["rvz_radvel"] else "unknown", "bibcode": source["rvz_bibcode"] or None},
            "physicalObservations": physical,
            **({} if gaia_suitable else {"gaiaPhysical": GAIA_WITHHELD}),
            **({"gaiaFlame": f"withheld: parallax signal-to-noise below {FLAME_MIN_PARALLAX_SNR}"} if gaia_suitable and not flame_suitable else {}),
            **({"systemAstrometry": {"simbadId": item["system"]["parent_id"], "simbadType": item["system"]["otype"],
                                     "scope": "SIMBAD hierarchy parent; parallax, proper motion and radial velocity of the unresolved system"}} if item["system"] else {}),
        }
    # A Lacaille letter can equal a variable-star name (* V Pup, V* V Pup); the letter star takes its HD name.
    names = [row["name"] for row in rows]
    for row, item in zip(rows, new):
        if names.count(row["name"]) > 1 and not item["source"]["main_id"].startswith("V* "):
            row["name"] = next(value for value in aliases(item["source"]) if value.startswith("HD "))
    names = [row["name"] for row in rows]
    duplicates = sorted({name for name in names if names.count(name) > 1})
    if duplicates:
        raise ValueError(f"Naked-eye star names are not unique: {duplicates}")
    for identifier, entry in copied.items():
        rows.append(dict(curated[identifier][1]))
        provenance[identifier] = entry
    rows.sort(key=lambda row: (math.hypot(float(row["x_pc"]), float(row["y_pc"]), float(row["z_pc"])), row["id"]))
    shared = len(copied)
    manifest = {
        "schemaVersion": 1,
        "id": "naked-eye-stars",
        "label": "Naked-eye stars",
        "description": f"Every star brighter than V {LIMIT_V}, visible without a telescope from a dark site, out to 20,000 light-years: {len(new)} new records plus {shared} records shared verbatim with the nearby and constellation catalogs, plus the Sun.",
        "epoch": 2000,
        "objectCount": len(rows) + 1,
        "sources": [
            {"name": f"SIMBAD TAP snapshot via the {manifest_input['sources']['simbad']['url'].split('/')[2]} mirror; exact identities, astrometry, classification, compiled Johnson V and mesFe_h spectroscopy", "url": manifest_input["sources"]["simbad"]["url"]},
            {"name": "Gaia DR3 astrometric errors and GSP-Phot/FLAME model parameters; exact Gaia DR3 identifiers", "url": "https://gea.esac.esa.int/tap-server/tap/sync"},
            {"name": "Bailer-Jones et al. 2021 Gaia EDR3 geometric distances; exact Gaia source identifiers", "url": "https://bailer-jones.www3.mpia.de/gedr3_distances.html"},
            {"name": f"Astropy {nearest1000.astropy.__version__}, IAU constellations using Roman 1987 boundaries", "url": "https://docs.astropy.org/en/stable/api/astropy.coordinates.get_constellation.html"},
            *enrichment_sources(),
        ],
        "cutoffPolicy": f"Every SIMBAD object with a compiled Johnson V <= {LIMIT_V}, a positive parallax and an adopted distance within 20,000 light-years. "
                        "Clusters, galaxies, supernovae and other non-stellar types are excluded, as are ** aggregates whose components are listed. "
                        f"Stars curated by the nearby or constellation catalogs, matched by exact identifier or within {MATCH_ARCSEC} arcsec at a consistent distance, keep that record and ID; "
                        "their reviewed companions follow. A component without a parallax of its own uses the parallax and motion of its SIMBAD multiple-star record; "
                        "other stars without a parallax are listed in the provenance audit, not placed. Sun is included only as the map origin.",
        "snapshot": f"SIMBAD, Gaia DR3 and Bailer-Jones snapshots frozen {retrieved}; VizieR was unavailable, so Hipparcos-source model tables apply only where earlier snapshots hold them.",
    }
    payload = {
        "schemaVersion": 1,
        "catalogId": manifest["id"],
        "policy": manifest["cutoffPolicy"],
        "physicalPolicy": "New records use the shared exact-identity enrichment without Gaia DR3 GSP-Phot [M/H]. Gaia DR3 GSP-Phot and FLAME values are withheld for O, B0-B4 and M spectral types, "
                          f"FLAME values for parallax signal-to-noise below {FLAME_MIN_PARALLAX_SNR}, "
                          f"and any temperature more than {CLASS_TOLERANCE:.0%} from the Pecaut-Mamajek temperature of its spectral class is withheld before selection, with the FLAME values derived from it.",
        "sourceManifestSha256": sha256(WORK / "source-manifest.json"),
        "coverage": {field: sum(bool(row[field]) for row in rows if row["id"] not in copied) for field in
                     ("constellation", "spectral_type", "temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr", "radial_velocity_kms", "vx_kms")},
        "audit": sorted(audit, key=lambda item: item["simbadId"]),
        "objects": provenance,
    }
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=landmarks.HEADERS, lineterminator="\n", extrasaction="ignore")
    writer.writeheader()
    writer.writerows([landmarks.sun_row(), *({header: row.get(header, "") for header in landmarks.HEADERS} for row in rows)])
    return {
        "stars.csv": stream.getvalue(),
        "catalog.json": json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        "provenance.json": json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    files = build()
    if args.check:
        stale = [name for name, text in files.items() if not (OUTPUT / name).exists() or (OUTPUT / name).read_text() != text]
        if stale:
            raise SystemExit(f"Naked-eye stars are stale: {', '.join(stale)}. Run python3 scripts/author-naked-eye-stars.py.")
        return
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, text in files.items():
        (OUTPUT / name).write_text(text)
    provenance = json.loads(files["provenance.json"])
    print(json.dumps({"objects": json.loads(files["catalog.json"])["objectCount"], "coverage": provenance["coverage"],
                      "audit": {status: sum(item["status"] == status for item in provenance["audit"]) for status in ("excluded", "represented")}}, indent=2))


if __name__ == "__main__":
    main()
