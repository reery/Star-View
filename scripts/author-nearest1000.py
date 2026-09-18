"""Build the nearest-1000 package from frozen corrected CNS5/TAP snapshots."""

import argparse
import csv
import io
import json
import math
import shutil
from pathlib import Path

import astropy
import astropy.units as units
from astropy.coordinates import SkyCoord, get_constellation
from astropy.time import Time
from astropy.utils import iers

from catalog_sources.adapters import read_cns5, read_gaia_tap, read_simbad_tap
from catalog_sources.filesystem import write_managed_files
from catalog_sources.snapshots import canonical_json, sha256, verify_sha256

iers.conf.auto_download = False
ROOT = Path(__file__).resolve().parents[1]
FROZEN = ROOT / "catalog-work/nearest-1000"
NEAREST100_INPUT = ROOT / "catalog-work/nearest-100/source-input.json"
NEAREST100_CSV = ROOT / "src/data/catalogs/nearest-100/stars.csv"
NEAREST100_PROVENANCE = ROOT / "src/data/catalogs/nearest-100/provenance.json"
DEFAULT_OUTPUT = ROOT / "src/data/catalogs/nearest-1000"
NAME_CORRECTIONS = {"Bo\u00f6tes": "Bootes", "Chamaleon": "Chamaeleon", "Ophiucus": "Ophiuchus", "Pisces Austrinus": "Piscis Austrinus"}
BASE_HEADERS = [
    "type", "id", "name", "spectral_type", "x_pc", "y_pc", "z_pc",
    "vx_kms", "vy_kms", "vz_kms", "temperature_k", "mass_solar",
    "luminosity_solar", "absolute_mag", "epoch", "notes", "constellation",
]
RAW_HEADERS = [
    "ra_deg", "dec_deg", "astrometry_epoch", "parallax_mas", "parallax_error_mas",
    "pm_ra_cosdec_masyr", "pm_ra_error_masyr", "pm_dec_masyr", "pm_dec_error_masyr",
    "radial_velocity_kms", "radial_velocity_error_kms", "astrometry_ref", "radial_velocity_ref",
]
HEADERS = BASE_HEADERS + RAW_HEADERS
SOURCES = [
    {"name": "CNS5, Golovin et al., corrected 2023-12-13; membership and adopted astrometry", "url": "https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/ReadMe"},
    {"name": "SIMBAD TAP snapshot; exact CNS5 identity, classification, spectrum and compiled Johnson V", "url": "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"},
    {"name": "Gaia DR3 TAP snapshot; exact-ID GSP-Phot/FLAME physical estimates", "url": "https://gea.esac.esa.int/tap-server/tap/sync"},
    {"name": "Nearest 100 audited release; higher-curation shared-object overrides", "url": "https://cdsarc.cds.unistra.fr/ftp/J/A+A/650/A201/ReadMe"},
    {"name": f"Astropy {astropy.__version__}, IAU constellations using Roman 1987 boundaries", "url": "https://docs.astropy.org/en/stable/api/astropy.coordinates.get_constellation.html"},
]


def source_manifest():
    manifest = json.loads((FROZEN / "source-manifest.json").read_text())
    for name, digest in manifest["checksumsSha256"].items():
        verify_sha256(FROZEN / name, digest)
    if manifest["bufferSize"] != 1100:
        raise ValueError("Nearest-1000 source buffer must contain 1100 ranked CNS5 candidates")
    return manifest


def shared_rows_and_cns5_map():
    rows = list(csv.DictReader(io.StringIO(NEAREST100_CSV.read_text())))
    provenance = json.loads(NEAREST100_PROVENANCE.read_text())
    frozen = json.loads(NEAREST100_INPUT.read_text())
    sequence_by_id = {item["id"]: item.get("sourceRow") for item in provenance["objects"]}
    cns5_by_sequence = {sequence: match["cns5"] for match in frozen["cns5Matches"] for sequence in match["sequences"]}
    mapping = {}
    for row in rows:
        if row["id"] == "sun":
            continue
        sequence = sequence_by_id[row["id"]]
        cns5_id = cns5_by_sequence.get(sequence)
        if cns5_id:
            mapping.setdefault(cns5_id, []).append(row["id"])
    if len(rows) != 101 or len(mapping) != 89 or sum(map(len, mapping.values())) != 94:
        raise ValueError("Curated nearest-100 identity mapping drifted")
    return rows, mapping


def simbad_by_cns5():
    result = {}
    for record in read_simbad_tap(FROZEN / "simbad.csv"):
        query_id = (record.raw or {}).get("query_id", "")
        if not query_id.startswith("CNS5 ") or query_id.removeprefix("CNS5 ") in result:
            raise ValueError(f"SIMBAD CNS5 identity is missing or ambiguous: {record.identity.source_record_id}")
        result[query_id.removeprefix("CNS5 ")] = record
    return result


def source_type(simbad_type):
    if simbad_type == "WD*":
        return "white_dwarf"
    if simbad_type in {"BD*", "LM*"}:
        return "brown_dwarf"
    return "star"


def normalize(record, simbad, gaia):
    astrometry = record.astrometry
    raw = simbad.raw or {}
    object_type = source_type(raw.get("otype"))
    use_rv = astrometry.radial_velocity_kms is not None and object_type != "white_dwarf"
    motion = {"radial_velocity": astrometry.radial_velocity_kms * units.km / units.s} if use_rv else {}
    original = SkyCoord(
        ra=astrometry.ra_deg * units.deg,
        dec=astrometry.dec_deg * units.deg,
        distance=1000 / astrometry.parallax_mas * units.pc,
        pm_ra_cosdec=astrometry.pm_ra_cosdec_masyr * units.mas / units.yr,
        pm_dec=astrometry.pm_dec_masyr * units.mas / units.yr,
        obstime=Time(astrometry.epoch, format="jyear", scale="tt"),
        frame="icrs",
        **motion,
    )
    shifted = original.apply_space_motion(new_obstime=Time(2000.0, format="jyear", scale="tt"))
    direction = SkyCoord(ra=shifted.ra, dec=shifted.dec, distance=shifted.distance, frame="icrs")
    position = direction.galactic.cartesian.xyz.to_value(units.pc)
    velocity = original.galactic.velocity.d_xyz.to_value(units.km / units.s) if use_rv else None
    identifier = f"cns5-{int(record.identity.source_record_id):04d}"
    name = raw.get("main_id") or next((alias for alias in record.identity.aliases if alias.startswith("GJ ")), identifier)
    row = {header: "" for header in HEADERS}
    row.update({
        "type": object_type,
        "id": identifier,
        "name": name,
        "spectral_type": raw.get("sp_type") or "",
        "x_pc": f"{position[0]:.9f}",
        "y_pc": f"{position[1]:.9f}",
        "z_pc": f"{position[2]:.9f}",
        "epoch": "2000.0",
        "notes": f"Corrected CNS5 {record.identity.source_record_id}; J2000 Sun-relative Galactic position. SIMBAD exact CNS5 identity. {'Full source space motion.' if use_rv else 'Transverse-only source motion; radial velocity unavailable or withheld.'}",
        "constellation": NAME_CORRECTIONS.get(get_constellation(direction, short_name=False, constellation_list="iau").strip(), get_constellation(direction, short_name=False, constellation_list="iau").strip()),
        "ra_deg": str(astrometry.ra_deg),
        "dec_deg": str(astrometry.dec_deg),
        "astrometry_epoch": str(astrometry.epoch),
        "parallax_mas": str(astrometry.parallax_mas),
        "parallax_error_mas": "" if astrometry.parallax_error_mas is None else str(astrometry.parallax_error_mas),
        "pm_ra_cosdec_masyr": str(astrometry.pm_ra_cosdec_masyr),
        "pm_ra_error_masyr": "" if astrometry.pm_ra_error_masyr is None else str(astrometry.pm_ra_error_masyr),
        "pm_dec_masyr": str(astrometry.pm_dec_masyr),
        "pm_dec_error_masyr": "" if astrometry.pm_dec_error_masyr is None else str(astrometry.pm_dec_error_masyr),
        "radial_velocity_kms": str(astrometry.radial_velocity_kms) if use_rv else "",
        "radial_velocity_error_kms": str(astrometry.radial_velocity_error_kms) if use_rv and astrometry.radial_velocity_error_kms is not None else "",
        "astrometry_ref": astrometry.astrometry_ref or "CNS5 corrected 2023-12-13",
        "radial_velocity_ref": astrometry.radial_velocity_ref if use_rv else "",
    })
    if velocity is not None:
        row.update({key: f"{value:.6f}" for key, value in zip(("vx_kms", "vy_kms", "vz_kms"), velocity, strict=True)})
    v_magnitude = raw.get("V")
    if v_magnitude:
        row["absolute_mag"] = f"{float(v_magnitude) - 5 * math.log10(direction.distance.to_value(units.pc) / 10):.6f}"
    physical = []
    if gaia is not None and object_type == "star":
        def eligible_physical(item):
            if not math.isfinite(item.value) or item.value <= 0:
                return False
            if item.field == "temperature_k":
                return True
            flag = item.quality_flags[0] if item.quality_flags else ""
            if len(flag) != 2:
                return False
            if item.field == "mass_solar":
                return flag[0] == "0"
            return item.field == "luminosity_solar" and flag[1] in {"0", "2"}
        by_field = {item.field: item for item in gaia.physical if eligible_physical(item)}
        if "temperature_k" in by_field:
            row["temperature_k"] = str(round(by_field["temperature_k"].value))
        if "mass_solar" in by_field:
            row["mass_solar"] = str(by_field["mass_solar"].value)
        if "luminosity_solar" in by_field:
            row["luminosity_solar"] = str(by_field["luminosity_solar"].value)
        physical = [item.to_dict() for item in by_field.values()]
    provenance = {
        "id": identifier,
        "cns5Id": record.identity.source_record_id,
        "gaiaDr3Id": record.identity.gaia_dr3_id,
        "simbadId": simbad.identity.simbad_id,
        "sourceType": raw.get("otype"),
        "identityMethod": "exact CNS5 identifier; exact Gaia DR3 identifier when present",
        "astrometry": astrometry.to_dict(),
        "physicalObservations": physical,
        "fieldStatus": {
            "temperature_k": "model-derived" if row["temperature_k"] else "unknown",
            "mass_solar": "model-derived" if row["mass_solar"] else "unknown",
            "luminosity_solar": "model-derived" if row["luminosity_solar"] else "unknown",
            "absolute_mag": "derived-from-compiled-Johnson-V" if row["absolute_mag"] else "unknown",
            "radial_velocity_kms": "compiled" if use_rv else "withheld" if astrometry.radial_velocity_kms is not None else "unknown",
        },
    }
    return row, provenance, direction.distance.to_value(units.pc)


def build_package():
    manifest_input = source_manifest()
    shared, shared_mapping = shared_rows_and_cns5_map()
    shared_by_id = {row["id"]: row for row in shared}
    cns5 = [record for record in read_cns5(FROZEN / "cns5.dat") if record.astrometry is not None]
    cns5.sort(key=lambda record: (-record.astrometry.parallax_mas, record.identity.source_record_id))
    cns5 = cns5[:manifest_input["bufferSize"]]
    simbad = simbad_by_cns5()
    gaia = {record.identity.gaia_dr3_id: record for record in read_gaia_tap(FROZEN / "gaia.csv")}
    candidates = []
    audit = []
    replaced_ids = {identifier for identifiers in shared_mapping.values() for identifier in identifiers}
    for row in shared:
        if row["id"] == "sun":
            continue
        distance = math.sqrt(sum(float(row[key]) ** 2 for key in ("x_pc", "y_pc", "z_pc")))
        candidates.append((distance, row["id"], row, {"id": row["id"], "status": "higher-curation nearest-100 override"}))
    for record in cns5:
        cns5_id = record.identity.source_record_id
        if cns5_id in shared_mapping:
            audit.append({"cns5Id": cns5_id, "status": "replaced", "starViewIds": shared_mapping[cns5_id]})
            continue
        source = simbad.get(cns5_id)
        if source is None:
            raise ValueError(f"Missing exact SIMBAD enrichment for CNS5 {cns5_id}")
        source_object_type = (source.raw or {}).get("otype")
        if source_object_type in {"**", "BD?"}:
            audit.append({"cns5Id": cns5_id, "status": "excluded", "reason": "aggregate system" if source_object_type == "**" else "tentative brown-dwarf classification", "simbadType": source_object_type})
            continue
        row, provenance, distance = normalize(record, source, gaia.get(record.identity.gaia_dr3_id))
        candidates.append((distance, row["id"], row, provenance))
    ranked = sorted(candidates, key=lambda item: (item[0], item[1]))
    selected = ranked[:1000]
    if len(selected) != 1000 or not replaced_ids.issubset({item[1] for item in selected}):
        raise ValueError("Nearest-1000 candidate buffer or curated override coverage is insufficient")
    sun = shared_by_id["sun"]
    rows = [sun] + [item[2] for item in selected]
    names = [row["name"] for row in rows]
    if len(set(row["id"] for row in rows)) != 1001 or len(set(names)) != 1001:
        duplicates = sorted(name for name in set(names) if names.count(name) > 1)
        raise ValueError(f"Generated identifiers or names are not unique: {duplicates}")
    cutoff = selected[-1]
    next_candidate = ranked[1000]
    def distance_sigma(candidate):
        astrometry = candidate[3].get("astrometry")
        if not astrometry or astrometry["parallax_error_mas"] is None:
            return None
        return 1000 * astrometry["parallax_error_mas"] / astrometry["parallax_mas"] ** 2
    cutoff_sigma = distance_sigma(cutoff)
    next_sigma = distance_sigma(next_candidate)
    uncertainty_overlap = bool(cutoff_sigma is not None and next_sigma is not None and cutoff[0] + cutoff_sigma >= next_candidate[0] - next_sigma)
    candidate_audit = audit + [{
        "id": item[1],
        "cns5Id": item[3].get("cns5Id"),
        "rank": rank,
        "distancePc": item[0],
        "distanceSigmaPcLinearized": distance_sigma(item),
        "selected": rank <= 1000,
    } for rank, item in enumerate(ranked, 1)]
    manifest = {
        "schemaVersion": 1,
        "id": "nearest-1000",
        "label": "Nearest 1000 objects",
        "description": "1000 individual stellar/substellar objects from corrected CNS5 with exact SIMBAD/Gaia enrichment and curated nearest-100 overrides, plus Sun.",
        "epoch": 2000,
        "objectCount": 1001,
        "sources": SOURCES,
        "cutoffPolicy": f"Exclude SIMBAD aggregate systems (**) and tentative brown-dwarf candidates (BD?); replace mapped CNS5 records with curated nearest-100 components; rank nominal adopted J2000 distance then stable ID. Rank 1000 is {cutoff[2]['name']} ({cutoff[1]}) at {cutoff[0]:.12f} pc; next is {next_candidate[2]['name']} at {next_candidate[0]:.12f} pc. Linearized parallax intervals {'overlap' if uncertainty_overlap else 'do not overlap'}; nominal ranking is retained.",
        "snapshot": "J2000.0; CNS5 corrected 2023-12-13; SIMBAD and Gaia DR3 TAP frozen 2026-09-15; source-defined snapshot, not a 2026 completeness claim.",
    }
    provenance = {
        "schemaVersion": 1,
        "catalogId": "nearest-1000",
        "policyRevision": "cns5-individuals-v1",
        "sourceManifestSha256": sha256(FROZEN / "source-manifest.json"),
        "sources": SOURCES,
        "coverage": {field: sum(bool(row[field]) for row in rows if row["id"] != "sun") for field in ("constellation", "spectral_type", "temperature_k", "mass_solar", "luminosity_solar", "absolute_mag", "radial_velocity_kms")},
        "cutoff": {"rank": 1000, "id": cutoff[1], "name": cutoff[2]["name"], "distancePc": cutoff[0], "distanceSigmaPcLinearized": cutoff_sigma, "nextId": next_candidate[1], "nextDistancePc": next_candidate[0], "nextDistanceSigmaPcLinearized": next_sigma, "oneSigmaIntervalsOverlap": uncertainty_overlap},
        "audit": candidate_audit,
        "objects": [{"id": "sun", "status": "shared override"}] + [item[3] for item in selected],
    }
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=HEADERS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return {"stars.csv": stream.getvalue(), "catalog.json": canonical_json(manifest), "provenance.json": canonical_json(provenance)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("build",))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    if arguments.output.is_symlink():
        raise ValueError("Output directory must not be a symbolic link")
    package = build_package()
    if arguments.check:
        if any(not (arguments.output / name).exists() or (arguments.output / name).read_text() != content for name, content in package.items()):
            raise ValueError("Nearest-1000 output does not reproduce byte for byte")
        print(json.dumps({"reproduced": True, "objects": 1001}, indent=2))
        return
    if arguments.output.exists() and not arguments.force:
        raise FileExistsError("Output exists; use --force for an intentional regeneration")
    write_managed_files(arguments.output, package, arguments.force)
    print(json.dumps(json.loads(package["provenance.json"])["coverage"] | {"objects": 1001}, indent=2))


if __name__ == "__main__":
    main()