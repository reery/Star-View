"""Build the Notable distant stars catalog and the compact-system identities and orbits.

The catalog holds reviewed stars beyond the nearby catalogs that belong to a
notable system: the measured stellar companions of pulsars and the luminous
stars of dormant black-hole and neutron-star systems, plus single stars that
survived a historical supernova, extreme giants, the most massive known stars,
Wolf–Rayet binaries and hypervelocity stars. A companion shares its compact host's plotted
position and system astrometry; every physical value is the star's own
published measurement.
Run with --check to compare the checked-in files without writing them.
"""

import argparse
import csv
import io
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/notable-distant-stars"
GALACTIC_CENTER = WORK / "galactic-center-stars.json"
COMPANION_FILES = [WORK / "pulsar-companions.json", WORK / "gaia-companions.json", WORK / "binary-companions.json", GALACTIC_CENTER]
STANDALONE = WORK / "standalone-stars.json"
MASSIVE = WORK / "massive-stars.json"
HYPERVELOCITY = WORK / "hypervelocity-stars.json"
NEUTRON_STARS = ROOT / "catalog-work/compact-remnants/pulsar-binaries.json"
COMPACT = ROOT / "src/data/overlays/compact-remnants/objects.json"
WESTERN = ROOT / "src/data/catalogs/western-constellation-stars/stars.csv"
OUTPUT = ROOT / "src/data/catalogs/notable-distant-stars"
IDENTITIES = ROOT / "src/data/compact-system-identities.json"
PREFERRED_NAMES = ROOT / "catalog-work/object-designations/preferred-names.json"
ORBITS = ROOT / "src/data/compact-system-orbits.json"
DAYS_PER_YEAR = 365.25
AU_PER_PC = 206264.806
SOLAR_TEMPERATURE_K = 5772
ATNF_URL = "https://www.atnf.csiro.au/research/pulsar/psrcat/psrcat_help.html"


def number(value):
    return "" if value is None else repr(value)


def companion_id(source):
    """Named stars of a cluster around one host carry their own IDs; a single companion is the host's B."""
    return source.get("id", f"{source['host']}-{source.get('component', 'B').lower()}")


def companion_row(source, host, header):
    # Catalog astrometry needs a parallax; a host without one, such as Sagittarius A*, lends only its position.
    astrometry = host["raw_astrometry"] if (host["raw_astrometry"] or {}).get("parallax_mas") is not None else {}
    mass = source.get("mass_source")
    component = source.get("component", "B")
    period = host["compact"]["orbital_period_days"]
    # A wider outer star or an unmeasured orbit has no inner-binary period to quote.
    in_orbit = f" in its {period:.4g}-day orbit" if period is not None and component == "B" else ""
    notes = [f"Companion of {host['name']}{in_orbit}. {source['note']}"]
    if mass:
        uncertainty = f"{source['mass_solar']} ± {source['mass_error_solar']}" if source.get("mass_error_solar") is not None else f"about {source['mass_solar']}"
        notes.append(f"Mass {uncertainty} M_sun: {mass['label']}, {mass['url']}.")
    luminosity = source.get("luminosity_solar")
    atmosphere = source.get("atmosphere_source")
    if source.get("temperature_k") is not None:
        temperature = source.get("temperature_source", atmosphere)
        uncertainty = f" ± {source['temperature_error_k']}" if source.get("temperature_error_k") is not None else ""
        notes.append(f"Effective temperature {source['temperature_k']}{uncertainty} K: {temperature['label']}, {temperature['url']}.")
    if source.get("radius_solar") is not None:
        notes.append(f"Radius {source['radius_note']}: {atmosphere['label']}, {atmosphere['url']}.")
    if luminosity is not None:
        notes.append(f"Luminosity {source['luminosity_note']}: {atmosphere['label']}, {atmosphere['url']}.")
    elif source.get("radius_solar") is not None and source.get("temperature_k") is not None:
        # Stefan-Boltzmann luminosity from the companion's own radius and temperature.
        luminosity = float(f"{source['radius_solar'] ** 2 * (source['temperature_k'] / SOLAR_TEMPERATURE_K) ** 4:.3g}")
        notes.append("Luminosity is derived from that radius and temperature.")
    for field in ("metallicity", "age"):
        if source.get(f"{field}_note"):
            notes.append(f"{field.capitalize()} {source[f'{field}_note']}: {atmosphere['label']}, {atmosphere['url']}.")
    if host["type"] != "pulsar" and astrometry.get("radial_velocity_kms") is None:
        notes.append(f"Position{' and motion are' if astrometry else ' is'} the unresolved system's: {astrometry.get('astrometry_ref') or host['compact']['position_source']}. No radial velocity is adopted.")
    elif astrometry.get("radial_velocity_kms") is None:
        notes.append(f"Position, parallax and proper motion are the pulsar system's: {host['notes'].split(' Mass ')[0]} No radial velocity is adopted.")
    else:
        notes.append(f"Position and motion are the unresolved system's: {astrometry['astrometry_ref']}; {astrometry['radial_velocity_ref']}.")
    values = {
        "type": source["type"],
        "id": companion_id(source),
        "name": source.get("name", f"{host['name']} {component}"),
        "designations": "|".join(source.get("designations", [])),
        "spectral_type": source["spectral_type"] or "",
        "x_pc": number(host["x_pc"]),
        "y_pc": number(host["y_pc"]),
        "z_pc": number(host["z_pc"]),
        "temperature_k": number(source.get("temperature_k")),
        "metallicity_dex": number(source.get("metallicity_dex")),
        "metallicity_kind": "[Fe/H]" if source.get("metallicity_dex") is not None else "",
        "age_gyr": number(source.get("age_gyr")),
        "mass_solar": number(source.get("mass_solar")),
        "luminosity_solar": number(luminosity),
        "radius_solar": number(source.get("radius_solar")),
        "epoch": "2000.0",
        "notes": " ".join(notes),
        "constellation": host["constellation"],
        "ra_deg": number(astrometry.get("ra_deg")),
        "dec_deg": number(astrometry.get("dec_deg")),
        "astrometry_epoch": number(astrometry.get("epoch")),
        "parallax_mas": number(astrometry.get("parallax_mas")),
        "parallax_error_mas": number(astrometry.get("parallax_error_mas")),
        "pm_ra_cosdec_masyr": number(astrometry.get("pm_ra_cosdec_masyr")),
        "pm_ra_error_masyr": number(astrometry.get("pm_ra_error_masyr")),
        "pm_dec_masyr": number(astrometry.get("pm_dec_masyr")),
        "pm_dec_error_masyr": number(astrometry.get("pm_dec_error_masyr")),
        "radial_velocity_kms": number(astrometry.get("radial_velocity_kms")),
        "radial_velocity_error_kms": number(astrometry.get("radial_velocity_error_kms")),
        "astrometry_ref": astrometry.get("astrometry_ref") or "",
        "radial_velocity_ref": astrometry.get("radial_velocity_ref") or "",
    }
    return [values.get(field, "") for field in header]


def standalone_row(source, header):
    """A single star at its own Gaia distance, with its own astrometry."""
    from astropy.coordinates import SkyCoord
    import astropy.units as units
    astrometry = source["astrometry"]
    measured = astrometry["parallax_mas"] is not None
    galactic = SkyCoord(ra=astrometry["ra_deg"] * units.deg, dec=astrometry["dec_deg"] * units.deg, distance=source["distance_pc"] * units.pc, frame="icrs").galactic.cartesian
    atmosphere = source["atmosphere_source"]
    notes = [source["note"], f"Distance {source['distance_note']}.",
             *([f"Effective temperature {source['temperature_k']} K: {source['temperature_note']}, {atmosphere['label']}, {atmosphere['url']}."] if "temperature_note" in source else []),
             *([f"Luminosity {source['luminosity_note']}."] if "luminosity_note" in source else []),
             *([f"{source['radius_note']} {atmosphere['label']}, {atmosphere['url']}."] if "radius_note" in source else []),
             *([f"Mass {source['mass_note']}: {atmosphere['label']}, {atmosphere['url']}."] if "mass_note" in source else []),
             *([f"Metallicity {source['metallicity_note']}: {atmosphere['label']}, {atmosphere['url']}."] if "metallicity_note" in source else []),
             *([] if measured else [f"Position RA {astrometry['ra_deg']}°, Dec {astrometry['dec_deg']}° (ICRS, J{astrometry['epoch']:g}): {astrometry['astrometry_ref']}." + (f" Radial velocity {astrometry['radial_velocity_kms']} ± {astrometry['radial_velocity_error_kms']} km/s: {astrometry['radial_velocity_ref']}." if astrometry["radial_velocity_kms"] is not None else "")]),
             *([] if astrometry["radial_velocity_kms"] is not None else ["No radial velocity is adopted."])]
    values = {
        "type": source["type"], "id": source["id"], "name": source["name"], "designations": "|".join(source["designations"]),
        "spectral_type": source["spectral_type"] or "",
        "x_pc": number(round(float(galactic.x.value), 6)), "y_pc": number(round(float(galactic.y.value), 6)), "z_pc": number(round(float(galactic.z.value), 6)),
        "temperature_k": number(source.get("temperature_k")), "luminosity_solar": number(source.get("luminosity_solar")),
        "radius_solar": number(source.get("radius_solar")), "mass_solar": number(source.get("mass_solar")), "age_gyr": number(source.get("age_gyr")),
        "metallicity_dex": number(source.get("metallicity_dex")), "metallicity_kind": source.get("metallicity_kind") or "",
        "epoch": "2000.0", "notes": " ".join(notes), "constellation": source["constellation"],
        # Catalog astrometry needs a parallax; without one, the position and radial velocity stay in the notes.
        **({"astrometry_epoch": number(astrometry["epoch"]), "astrometry_ref": astrometry["astrometry_ref"], "radial_velocity_ref": astrometry["radial_velocity_ref"] or "",
            **{key: number(astrometry[key]) for key in ("ra_deg", "dec_deg", "parallax_mas", "parallax_error_mas", "pm_ra_cosdec_masyr", "pm_ra_error_masyr",
                                                         "pm_dec_masyr", "pm_dec_error_masyr", "radial_velocity_kms", "radial_velocity_error_kms")}} if measured else {}),
    }
    return [values.get(field, "") for field in header]


def orbit(pulsar, companion_mass, range_years=None):
    """Pulsar timing or published binary orbit; Kepler's law with both measured masses gives the relative axis."""
    details = pulsar["compact"]
    timing = pulsar["type"] == "pulsar"
    # A published range with no timing orbit is stored at its midpoint, and the scope says so.
    period_years = sum(range_years) / 2 if range_years else details["orbital_period_days"] / DAYS_PER_YEAR
    measured = pulsar["mass_solar"] is not None and companion_mass is not None
    axis = float(f"{((pulsar['mass_solar'] + companion_mass) * period_years ** 2) ** (1 / 3):.4g}") if measured else None
    derivation = "the relative semi-major axis follows from Kepler's third law with both measured masses." if measured else "the semi-major axis is not adopted because a component mass is unmeasured."
    return {"systemId": f"{pulsar['id']}-system", "name": pulsar["name"], "orbits": [{
        "id": f"{pulsar['id']}-system-0",
        "primary": "A",
        "secondary": "B",
        "primaryIds": [pulsar["id"]],
        "secondaryIds": [f"{pulsar['id']}-b"],
        "periodYears": period_years,
        "semiMajorAxisAu": axis,
        "eccentricity": details["eccentricity"],
        "inclinationDeg": None,
        "nodeDeg": None,
        "argumentDeg": None,
        "periastronEpoch": None,
        "epochKind": None,
        "grade": None,
        "catalog": "ATNF Pulsar Catalogue v2.9.0" if timing else "Reviewed literature",
        "reference": "Pulsar timing orbit" if timing else details["source_label"],
        "sourceUrl": ATNF_URL if timing else details["source_url"],
        "nodeAmbiguous": True,
        "argumentComponent": None,
        "scope": f"{f'Period is the midpoint of the published {range_years[0]:,}-{range_years[1]:,} year range; ' if range_years else ''}Period and eccentricity from {'pulsar timing' if timing and not range_years else 'the published orbit'}; {derivation} The orbit's orientation on the sky is not adopted.",
        "axisDerivation": None,
    }]}


def published_orbit(host, source, index):
    """A star's full published orbit around its host; the secondary's argument of periastron."""
    elements = source["orbit"]
    if "angular_axis_arcsec" in elements:
        distance = elements["distance_pc"]
        axis = elements["angular_axis_arcsec"] * distance
        # The paper's own mass and distance: Kepler's third law gives the period it implies.
        period = (axis ** 3 / host["mass_solar"]) ** 0.5
        axis_source = {"angularAxisMas": round(elements["angular_axis_arcsec"] * 1000, 6), "angularAxisErrorMas": round(elements["angular_axis_error_arcsec"] * 1000, 6),
                       "adoptedDistancePc": distance, "scope": f"Converted from the published angular axis at the fitted distance of {elements['source']['label'].split(',')[0]}."}
    else:
        axis = elements["axis_mpc"] * 1e-3 * AU_PER_PC
        period = elements["period_years"]
        axis_source = None
    return {
        "id": f"{host['id']}-system-{index}",
        "primary": elements["primary_label"],
        "secondary": source["component"],
        "primaryIds": [host["id"]],
        "secondaryIds": [companion_id(source)],
        "periodYears": float(f"{period:.6g}"),
        "semiMajorAxisAu": float(f"{axis:.6g}"),
        "eccentricity": elements["eccentricity"],
        "inclinationDeg": elements["inclination_deg"],
        "nodeDeg": elements["node_deg"],
        "argumentDeg": elements["argument_deg"],
        "periastronEpoch": elements["periastron_year"],
        "epochKind": "Decimal year",
        "grade": None,
        "catalog": "Reviewed literature",
        "reference": elements["source"]["label"],
        "sourceUrl": elements["source"]["url"],
        "nodeAmbiguous": False,
        "argumentComponent": source["component"],
        "uncertainties": {key: elements[f"{field}_error{unit}"] for key, field, unit in (
            ("eccentricity", "eccentricity", ""), ("inclinationDeg", "inclination", "_deg"), ("nodeDeg", "node", "_deg"),
            ("argumentDeg", "argument", "_deg"), ("periastronEpochYears", "periastron", "_year"))},
        **({"axisSource": axis_source} if axis_source else {}),
        "scope": elements["scope"],
        "axisDerivation": None,
    }


def binary_orbit(system, masses):
    """A Wolf–Rayet binary's published orbit; a missing axis follows from Kepler's third law with both masses."""
    elements = system["orbit"]
    period = elements["period_days"] / DAYS_PER_YEAR
    if "angular_axis_mas" in elements:
        axis = elements["angular_axis_mas"] * 1e-3 * system["distance_pc"]
        axis_source = {"angularAxisMas": elements["angular_axis_mas"], "angularAxisErrorMas": elements["angular_axis_error_mas"],
                       "adoptedDistancePc": system["distance_pc"], "scope": "Converted from the published angular axis at the adopted distance."}
    else:
        axis = (sum(masses) * period ** 2) ** (1 / 3)
        axis_source = None
    full = "node_deg" in elements
    labels = [component["component"] for component in system["components"]]
    return {
        "id": f"{system['id']}-system-0",
        "primary": labels[0],
        "secondary": labels[1],
        "primaryIds": [system["components"][0]["id"]],
        "secondaryIds": [system["components"][1]["id"]],
        "periodYears": float(f"{period:.6g}"),
        "semiMajorAxisAu": float(f"{axis:.4g}"),
        "eccentricity": elements.get("eccentricity"),
        "inclinationDeg": elements.get("inclination_deg"),
        "nodeDeg": elements.get("node_deg"),
        "argumentDeg": elements.get("argument_deg"),
        "periastronEpoch": elements.get("periastron_year"),
        "epochKind": "Decimal year" if full else None,
        "grade": None,
        "catalog": "Reviewed literature",
        "reference": elements["source"]["label"],
        "sourceUrl": elements["source"]["url"],
        "nodeAmbiguous": not full,
        "argumentComponent": elements.get("argument_component"),
        **({"uncertainties": {key: elements[f"{field}_error{unit}"] for key, field, unit in (
            ("eccentricity", "eccentricity", ""), ("inclinationDeg", "inclination", "_deg"), ("nodeDeg", "node", "_deg"),
            ("argumentDeg", "argument", "_deg"), ("periastronEpochYears", "periastron", "_year"))}} if full else {}),
        **({"axisSource": axis_source} if axis_source else {}),
        "scope": elements["scope"],
        "axisDerivation": None,
    }


def build():
    reviewed_files = [json.loads(path.read_text()) for path in COMPANION_FILES]
    companions = [source for reviewed in reviewed_files for source in reviewed["companions"]]
    neutron_stars = json.loads(NEUTRON_STARS.read_text())["neutronStarCompanions"]
    compact = {item["id"]: item for item in json.loads(COMPACT.read_text())["objects"]}
    with WESTERN.open(newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        sun = next(row for row in reader if row[header.index("id")] == "sun")
    standalone = json.loads(STANDALONE.read_text())
    massive = json.loads(MASSIVE.read_text())
    hypervelocity = json.loads(HYPERVELOCITY.read_text())
    # Binary components share their system's position, distance and astrometry.
    shared = ("constellation", "distance_pc", "distance_note", "astrometry")
    binaries = [{**{key: system[key] for key in shared}, **component} for system in massive["systems"] for component in system["components"]]
    single_stars = [*standalone["stars"], *json.loads(GALACTIC_CENTER.read_text())["stars"], *massive["stars"], *binaries, *hypervelocity["stars"]]
    rows = [sun, *(companion_row(source, compact[source["host"]], header) for source in companions),
            *(standalone_row(source, header) for source in single_stars)]
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(header)
    writer.writerows(rows)
    sources = {(source["mass_source"]["label"], source["mass_source"]["url"]) for source in companions if "mass_source" in source}
    sources |= {(source[key]["label"], source[key]["url"]) for source in companions for key in ("temperature_source", "atmosphere_source") if key in source}
    sources |= {(source["atmosphere_source"]["label"], source["atmosphere_source"]["url"]) for source in single_stars}
    sources |= {(source["orbit"]["source"]["label"], source["orbit"]["source"]["url"]) for source in companions if "orbit" in source}
    sources |= {("Gaia DR3; astrometry of single stars", "https://arxiv.org/abs/2208.00211"), ("Bailer-Jones et al. 2021; Gaia geometric distances", "https://ui.adsabs.harvard.edu/abs/2021AJ....161..147B")}
    manifest = {
        "schemaVersion": 1,
        "id": "notable-distant-stars",
        "label": "Notable distant stars",
        "description": "Reviewed stars beyond the nearby catalogs that belong to notable systems: measured stellar companions of pulsars, the luminous stars of dormant black-hole and neutron-star systems, stars that survived historical supernovae, stars around the Galactic Center black hole, extreme giants, the most massive known stars, Wolf–Rayet binaries and hypervelocity stars leaving the Milky Way, plus the Sun.",
        "epoch": 2000,
        "objectCount": len(rows),
        "sources": [{"name": "ATNF Pulsar Catalogue v2.9.0; host pulsar positions and system astrometry", "url": ATNF_URL},
                    *({"name": f"{label}; system orbit and astrometry", "url": url} for label, url in dict.fromkeys(
                        (host["compact"]["source_label"], host["compact"]["source_url"]) for host in (compact[source["host"]] for source in companions) if host["type"] != "pulsar")),
                    *({"name": label, "url": url} for label, url in sorted(sources))],
        "cutoffPolicy": "Explicitly reviewed members of notable systems only; no magnitude or distance cutoff. Luminous companions of compact objects are included with whichever individual values are published. Single stars that survived a historical supernova are included at their own Gaia distance. The S-stars that weigh Sagittarius A* share its position; GCIRS 7 is placed at its distance. Extreme giants, the most massive known stars and Wolf–Rayet binaries are placed at the distance of their adopted values. Hypervelocity stars are placed at their spectroscopic distances. Sun is included only as the map origin.",
        "snapshot": f"J2000 map positions from the compact-remnant overlay, and from Gaia DR3 for supernova survivors; measurements reviewed {max(reviewed['reviewed'] for reviewed in [*reviewed_files, standalone, massive, hypervelocity])}.",
    }
    provenance = {
        "schemaVersion": 1,
        "catalogId": "notable-distant-stars",
        "policy": " ".join(reviewed["policy"] for reviewed in [*reviewed_files, standalone, massive, hypervelocity]),
        "objects": {**{companion_id(source): {"hostId": source["host"], **source} for source in companions},
                    **{source["id"]: source for source in single_stars}},
    }
    # Runtime system identities: each compact object is component A, its measured companion B, then any others.
    inner = [source for source in companions if source.get("component", "B") == "B"]
    members = {}
    for source in companions:
        members.setdefault(source["host"], []).append(source)
    pairs = sorted([*members, *(f"psr-{source['pulsar'].lower().replace('+', 'p').replace('-', 'm')}" for source in neutron_stars)])
    preferred = json.loads(PREFERRED_NAMES.read_text())
    # A cluster of named stars labels its host by a short name, so each orbit reads "Sgr A*–S2".
    host_label = lambda pulsar: next((source["orbit"]["primary_label"] for source in members.get(pulsar, []) if "orbit" in source), "A")
    identities = {"systems": [
        {"id": f"{pulsar}-system", "name": preferred.get(pulsar, {}).get("name", compact[pulsar]["name"]), "components": [
            {"starId": pulsar, "label": host_label(pulsar)},
            *({"starId": companion_id(source), "label": source.get("component", "B")}
              for source in sorted(members.get(pulsar, [{"host": pulsar}]), key=lambda source: source.get("component", "B") != "B"))]}
        for pulsar in pairs] + [
        {"id": f"{system['id']}-system", "name": system["name"], "components": [
            {"starId": component["id"], "label": component["component"]} for component in system["components"]]}
        for system in massive["systems"]]}
    companion_masses = {source["host"]: source.get("mass_solar") for source in inner}
    period_ranges = {source["host"]: source["orbit_period_range_years"] for source in inner if "orbit_period_range_years" in source}
    companion_masses.update({f"psr-{source['pulsar'].lower().replace('+', 'p').replace('-', 'm')}": source["mass_solar"] for source in neutron_stars})
    orbits = {"schemaVersion": 1, "systems": [
        {"systemId": f"{pulsar}-system", "name": compact[pulsar]["name"],
         "orbits": [published_orbit(compact[pulsar], source, index) for index, source in enumerate(members[pulsar])]}
        if host_label(pulsar) != "A" else orbit(compact[pulsar], companion_masses[pulsar], period_ranges.get(pulsar)) for pulsar in pairs] + [
        {"systemId": f"{system['id']}-system", "name": system["name"],
         "orbits": [binary_orbit(system, [component["mass_solar"] for component in system["components"]])]}
        for system in massive["systems"]]}
    return {
        OUTPUT / "stars.csv": buffer.getvalue(),
        ORBITS: json.dumps(orbits, indent=2) + "\n",
        OUTPUT / "catalog.json": json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        OUTPUT / "provenance.json": json.dumps(provenance, indent=2, ensure_ascii=False) + "\n",
        IDENTITIES: json.dumps(identities, indent=2) + "\n",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    files = build()
    if args.check:
        stale = [str(path.relative_to(ROOT)) for path, text in files.items() if not path.exists() or path.read_text() != text]
        if stale:
            raise SystemExit(f"Notable distant stars are stale: {', '.join(stale)}. Run python3 scripts/author-notable-distant-stars.py.")
        return
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for path, text in files.items():
        path.write_text(text)
    print(f"{len(files) - 1} catalog files; {sum(1 for _ in files[OUTPUT / 'stars.csv'].splitlines()) - 2} stars besides the Sun")


if __name__ == "__main__":
    main()
