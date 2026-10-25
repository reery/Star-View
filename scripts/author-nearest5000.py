"""Extend nearest-1000 to the nearest-5000 objects from the same corrected CNS5 release.

The package lists only objects absent from nearest-1000 and declares `extends`;
loaders compose both, so no shared row is stored twice. An object already
curated in another catalog keeps that exact record and ID. CNS5 multiple
systems are registered in star-systems.json; their new members share one
systemic space velocity.
"""

import argparse
import csv
import importlib.util
import io
import json
import math
import re
from pathlib import Path

from catalog_sources.adapters import read_cns5, read_gaia_tap, read_simbad_tap
from catalog_sources.component_enrichment import component_sources, enrich_component
from catalog_sources.enrichment import enrichment_sources
from catalog_sources.filesystem import write_managed_files
from catalog_sources.mdwarf import load_supplements
from catalog_sources.shared_objects import adopt_shared_object
from catalog_sources.snapshots import canonical_json, sha256, verify_sha256

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("author_nearest1000", ROOT / "scripts/author-nearest1000.py")
nearest1000 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nearest1000)

BASE_ID = "nearest-1000"
BASE = ROOT / "src/data/catalogs/nearest-1000"
FROZEN = ROOT / "catalog-work/nearest-5000"
CNS5 = nearest1000.FROZEN / "cns5.dat"
SYSTEMS = ROOT / "src/data/star-systems.json"
IDENTITIES = ROOT / "src/data/stellar-system-identities.json"
COMPANIONS = ROOT / "src/data/stellar-companions.json"
DESIGNATIONS = ROOT / "src/data/object-designations.json"
OTHER_CATALOGS = ("western-constellation-stars",)
DEFAULT_OUTPUT = ROOT / "src/data/catalogs/nearest-5000"
ADDITIONS = 4000
MOTION_FIELDS = ("vx_kms", "vy_kms", "vz_kms")
SOURCES = [
    {"name": "CNS5, Golovin et al., corrected 2023-12-13; membership, adopted astrometry and multiple-system components", "url": "https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/ReadMe"},
    {"name": "SIMBAD TAP snapshot; exact CNS5 identity, classification, spectrum, Johnson V and mesFe_h spectroscopy", "url": "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"},
    {"name": "Gaia DR3 TAP snapshot; exact-ID radial velocities and GSP-Phot/FLAME physical estimates", "url": "https://gea.esac.esa.int/tap-server/tap/sync"},
    {"name": "2MASS All-Sky Point Source Catalog Ks photometry (VizieR II/246)", "url": "https://cdsarc.cds.unistra.fr/viz-bin/cat/II/246"},
    {"name": "Nearest 1000 audited release; every shared row and its curation", "url": "https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/ReadMe"},
]


def csv_rows(path):
    return list(csv.DictReader(io.StringIO(path.read_text())))


def source_manifest():
    manifest = json.loads((FROZEN / "source-manifest.json").read_text())
    for name, digest in manifest["checksumsSha256"].items():
        verify_sha256(FROZEN / name, digest)
    if manifest["sources"]["cns5"]["sha256"] != sha256(CNS5):
        raise ValueError("Nearest-5000 snapshot was not taken from the frozen CNS5 release")
    return manifest


def simbad_by_cns5():
    result = {}
    for path in (nearest1000.FROZEN / "simbad.csv", FROZEN / "simbad.csv"):
        for record in read_simbad_tap(path):
            query_id = (record.raw or {}).get("query_id", "")
            if not query_id.startswith("CNS5 ") or query_id.removeprefix("CNS5 ") in result:
                raise ValueError(f"SIMBAD CNS5 identity is missing or ambiguous: {record.identity.source_record_id}")
            result[query_id.removeprefix("CNS5 ")] = record
    return result


def cns5_systems():
    """CNS5 component labels keyed by system: the primary's GJ number for wide members."""
    systems = {}
    for line in CNS5.read_text().splitlines():
        value = lambda start, end: line[start - 1:end].strip()
        if value(18, 18) in {"", "-"} or not value(13, 16):
            continue
        key = value(22, 26).rstrip(".") or value(6, 11)
        systems[value(1, 4)] = {"key": key, "label": value(13, 16), "primary": value(20, 20) == "1"}
    return systems


def overlap_rows(simbad_ids):
    """Rows curated by other catalogs, keyed by exact SIMBAD identity and by ID."""
    rows, by_id = {}, {}
    for catalog in OTHER_CATALOGS:
        for row in csv_rows(ROOT / f"src/data/catalogs/{catalog}/stars.csv"):
            by_id.setdefault(row["id"], (catalog, row))
            identity = simbad_ids.get(row["id"])
            if identity:
                rows.setdefault(" ".join(identity.split()), (catalog, row))
    return rows, by_id


def companion_records():
    """Shared companion-pool records by exact designation, and each record's system members."""
    pool = json.loads(COMPANIONS.read_text())
    by_designation = {}
    for star in pool["stars"]:
        for designation in star.get("designations", []):
            by_designation.setdefault(" ".join(designation.split()), set()).add(star["id"])
    members = {}
    for system in json.loads(IDENTITIES.read_text())["systems"]:
        identifiers = {identifier for component in system["components"] for identifier in [component["starId"], *component.get("alternateStarIds", [])]}
        for identifier in identifiers:
            members[identifier] = identifiers
    return {key: next(iter(ids)) for key, ids in by_designation.items() if len(ids) == 1}, members


def distance(row):
    return math.sqrt(sum(float(row[key]) ** 2 for key in ("x_pc", "y_pc", "z_pc")))


def system_definitions(selected, base_rows, systems_by_cns5, base_cns5):
    """Author CNS5-sourced systems; never alter a curated base or overlap row."""
    authored = json.loads(SYSTEMS.read_text())
    reviewed = {identifier for system in json.loads(IDENTITIES.read_text())["systems"] for component in system["components"]
                for identifier in [component["starId"], *component.get("alternateStarIds", [])]}
    owned = [system for system in authored["systems"] if system.get("authoredBy") == "nearest-5000"]
    reviewed -= {component["starId"] for system in owned for component in system["components"]}
    members = {}
    for cns5_id, star_id in [*base_cns5.items(), *((item["cns5Id"], item["id"]) for item in selected)]:
        if cns5_id in systems_by_cns5:
            system = systems_by_cns5[cns5_id]
            members.setdefault(system["key"], []).append({"starId": star_id, "cns5Id": cns5_id, **system})
    new_ids = {item["id"] for item in selected if not item.get("adoptedFrom")}
    rows = {**base_rows, **{item["id"]: item["row"] for item in selected}}
    definitions, audit = [], []
    for key, components in sorted(members.items(), key=lambda item: int(re.sub(r"\D", "", item[0]) or 0)):
        if len(components) < 2 or not new_ids & {item["starId"] for item in components}:
            continue
        labels = [item["label"] for item in components]
        if len(set(labels)) != len(labels):
            audit.append({"system": f"GJ {key}", "status": "withheld", "reason": "duplicate CNS5 component labels"})
            continue
        if reviewed & {item["starId"] for item in components}:
            audit.append({"system": f"GJ {key}", "status": "withheld", "reason": "member already belongs to a reviewed system"})
            continue
        components.sort(key=lambda item: (not item["primary"], item["label"]))
        primary = rows[components[0]["starId"]]["name"]
        name = re.sub(rf"(?<=[\s\d])\s*{re.escape(components[0]['label'])}$", "", primary)
        definitions.append({
            "id": f"cns5-gj-{key}", "name": name, "sourceRef": "cns5-2023", "sourceSystemId": f"GJ {key}", "authoredBy": "nearest-5000",
            "components": [{"starId": item["starId"], "label": item["label"], "cns5Id": item["cns5Id"]} for item in components],
            "note": "Components associated by the corrected CNS5 system number. New members share one systemic space velocity; individual orbital motion is not modelled.",
        })
    authored["systems"] = [system for system in authored["systems"] if system.get("authoredBy") != "nearest-5000"] + definitions
    return authored, definitions, audit


def share_system_motion(definitions, selected, base_rows):
    """Give every new member one systemic velocity, preferring a curated or primary member."""
    by_id = {item["id"]: item for item in selected}
    for system in definitions:
        members = [(component["starId"], by_id.get(component["starId"])) for component in system["components"]]
        rows = [(star_id, item["row"] if item else base_rows[star_id], item) for star_id, item in members]
        moving = [entry for entry in rows if all(entry[1][field] for field in MOTION_FIELDS)]
        with_motion = [entry for entry in moving if entry[2] is None or entry[2].get("adoptedFrom")] or moving
        if not with_motion:
            continue
        error = lambda entry: float(entry[1]["radial_velocity_error_kms"] or math.inf)
        source_id, source, _ = min(with_motion, key=lambda entry: (entry[0] != system["components"][0]["starId"], error(entry)))
        for star_id, row, item in rows:
            if item is None or item.get("adoptedFrom") or star_id == source_id:
                continue
            original = {field: row[field] or None for field in MOTION_FIELDS}
            row.update({field: source[field] for field in MOTION_FIELDS})
            row["notes"] += f" Systemic space velocity of {system['name']} adopted from {source['name']} ({source_id}); individual orbital motion is not modelled."
            item["provenance"]["systemMotion"] = {"system": system["id"], "sourceStarId": source_id, "originalVelocity": original,
                                                  "scope": "Shared CNS5 system bulk motion; raw astrometry and radial velocity remain this component's source measurements."}


def build_package():
    manifest_input = source_manifest()
    base_rows = {row["id"]: row for row in csv_rows(BASE / "stars.csv")}
    base_provenance = json.loads((BASE / "provenance.json").read_text())
    base_cns5 = {item["cns5Id"]: item["id"] for item in base_provenance["objects"] if item.get("cns5Id") and item["id"] in base_rows}
    base_cns5.update({item["cns5Id"]: item["starViewIds"][0] for item in base_provenance["audit"] if len(item.get("starViewIds", [])) == 1})
    decided = {item["cns5Id"] for item in base_provenance["audit"] if item.get("status") in {"replaced", "excluded"}}
    exclusions = {item["cns5Id"] for item in json.loads(nearest1000.MEMBERSHIP_EXCLUSIONS.read_text())["objects"]}
    designations = json.loads(DESIGNATIONS.read_text())["objects"]
    simbad_ids = {identifier: entry["simbadId"] for identifier, entry in designations.items() if entry.get("simbadId")}
    base_simbad = {" ".join(simbad_ids[identifier].split()) for identifier in base_rows if identifier in simbad_ids}
    overlaps, other_rows = overlap_rows(simbad_ids)
    companions, system_members = companion_records()
    simbad = simbad_by_cns5()
    gaia = {record.identity.gaia_dr3_id: record for path in (nearest1000.FROZEN / "gaia.csv", FROZEN / "gaia.csv") for record in read_gaia_tap(path)}
    supplements = load_supplements(nearest1000.SUPPLEMENTS, CNS5, FROZEN)
    records = [record for record in read_cns5(CNS5) if record.astrometry is not None]
    records.sort(key=lambda record: (-record.astrometry.parallax_mas, record.identity.source_record_id))
    candidates, audit, represented, adopted_ids = [], [], {}, set()
    for record in records:
        cns5_id = record.identity.source_record_id
        if cns5_id in base_cns5 or cns5_id in decided or cns5_id in exclusions:
            continue
        source = simbad.get(cns5_id)
        if source is None:
            audit.append({"cns5Id": cns5_id, "status": "excluded", "reason": "no exact SIMBAD CNS5 identity"})
            continue
        main_id = " ".join(source.identity.simbad_id.split())
        if main_id in base_simbad:
            audit.append({"cns5Id": cns5_id, "status": "represented", "reason": f"{BASE_ID} already contains SIMBAD {main_id}"})
            continue
        # Several CNS5 components can resolve to one unresolved SIMBAD record;
        # the nearest CNS5 row represents it, so the record is stored once.
        if main_id in represented:
            audit.append({"cns5Id": cns5_id, "status": "represented", "reason": f"SIMBAD {main_id} is the unresolved record of CNS5 {represented[main_id]}"})
            continue
        represented[main_id] = cns5_id
        companion = companions.get(main_id)
        if companion == f"cns5-{int(cns5_id):04d}":
            companion = None
        if companion in other_rows and main_id not in overlaps:
            overlaps[main_id] = other_rows[companion]
        # Keep one record per object: the curated row, its ID and its values.
        # A curated component also stands in for a CNS5 aggregate it resolves.
        if main_id in overlaps and overlaps[main_id][1]["id"] not in adopted_ids:
            catalog, adopted = overlaps[main_id]
            adopted_ids.add(adopted["id"])
            candidates.append({"id": adopted["id"], "cns5Id": cns5_id, "distance": distance(adopted), "row": dict(adopted), "adoptedFrom": catalog,
                               "provenance": {"id": adopted["id"], "cns5Id": cns5_id, "status": f"shared {catalog} record", "simbadId": main_id}})
            continue
        source_type = (source.raw or {}).get("otype")
        if source_type in {"BD?", "**"} or main_id in overlaps:
            reason = "curated record already adopted" if main_id in overlaps else "aggregate system" if source_type == "**" else "tentative brown-dwarf classification"
            audit.append({"cns5Id": cns5_id, "status": "excluded", "reason": reason, "simbadType": source_type})
            continue
        row, provenance, nominal = nearest1000.normalize(record, source, gaia.get(record.identity.gaia_dr3_id), supplements, extended=True)
        enrich_component(row, provenance)
        adopt_shared_object(row, provenance)
        candidates.append({"id": row["id"], "cns5Id": cns5_id, "distance": nominal, "row": row, "provenance": provenance, "companion": companion})
    candidates.sort(key=lambda item: (item["distance"], item["id"]))
    # A shared companion record is added with any member of its system; a CNS5
    # copy of it would duplicate that object. Skip it once the system is present.
    present = set(base_rows) | {item["id"] for item in candidates[:ADDITIONS]}
    represented_companions = [item for item in candidates if item.get("companion") and system_members.get(item["companion"], set()) & (present - {item["id"]})]
    audit += [{"id": item["id"], "cns5Id": item["cns5Id"], "status": "represented", "reason": f"shared companion record {item['companion']}"} for item in represented_companions]
    skipped = {item["id"] for item in represented_companions}
    candidates = [item for item in candidates if item["id"] not in skipped]
    selected, remainder = candidates[:ADDITIONS], candidates[ADDITIONS:]
    if len(selected) != ADDITIONS:
        raise ValueError("The CNS5 source cannot supply the requested additions")
    systems, definitions, system_audit = system_definitions(selected, base_rows, cns5_systems(), base_cns5)
    share_system_motion(definitions, selected, base_rows)
    rows = [item["row"] for item in selected]
    names = [row["name"] for row in [*base_rows.values(), *rows]]
    ids = [row["id"] for row in [*base_rows.values(), *rows]]
    if len(set(ids)) != len(ids) or len(set(names)) != len(names):
        duplicates = sorted({name for name in names if names.count(name) > 1})
        raise ValueError(f"Composed identifiers or names are not unique: {duplicates}")
    cutoff, following = selected[-1], remainder[0]
    object_count = len(base_rows) + len(rows)
    manifest = {
        "schemaVersion": 1,
        "id": "nearest-5000",
        "extends": BASE_ID,
        "label": "Nearest 5000 + companions",
        "description": f"Nearest-1000 release plus the next {ADDITIONS} individual stellar/substellar objects from corrected CNS5 with exact SIMBAD, Gaia DR3, 2MASS and literature enrichment.",
        "epoch": 2000,
        "objectCount": object_count,
        "sources": SOURCES + enrichment_sources() + component_sources(),
        "cutoffPolicy": f"Extends {BASE_ID} unchanged and stores only additional rows. Applies its exclusions (SIMBAD ** aggregates, BD? candidates, reviewed membership exclusions) and ranks the remaining corrected CNS5 objects by nominal J2000 distance then stable ID. Objects curated by another catalog keep that record and ID. Rank {ADDITIONS} is {cutoff['row']['name']} at {cutoff['distance']:.12f} pc; next is {following['row']['name']} at {following['distance']:.12f} pc.",
        "snapshot": f"J2000.0; CNS5 corrected 2023-12-13; SIMBAD, Gaia DR3, 2MASS and VizieR TAP frozen {manifest_input['retrieved']}; source-defined snapshot, not a completeness claim.",
    }
    provenance = {
        "schemaVersion": 1,
        "catalogId": "nearest-5000",
        "extends": BASE_ID,
        "baseStarsSha256": sha256(BASE / "stars.csv"),
        "sourceManifestSha256": sha256(FROZEN / "source-manifest.json"),
        "sources": manifest["sources"],
        "radialVelocityPolicy": base_provenance["radialVelocityPolicy"] | {"systems": "New members of CNS5 multiple systems share one systemic velocity, preferring a curated member, then the primary, then the smallest radial-velocity uncertainty."},
        "coverage": {field: sum(bool(row.get(field)) for row in rows) for field in ("constellation", "spectral_type", "temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr", "absolute_mag", "radial_velocity_kms", "vx_kms")},
        "cutoff": {"rank": ADDITIONS, "id": cutoff["id"], "distancePc": cutoff["distance"], "nextId": following["id"], "nextDistancePc": following["distance"]},
        "systems": [system["id"] for system in definitions],
        "audit": audit + system_audit + [{"id": item["id"], "cns5Id": item["cns5Id"], "distancePc": item["distance"], "selected": False} for item in remainder],
        "objects": [item["provenance"] for item in selected],
    }
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=nearest1000.HEADERS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    package = {"stars.csv": stream.getvalue(), "catalog.json": canonical_json(manifest), "provenance.json": canonical_json(provenance)}
    return package, json.dumps(systems, indent=2, ensure_ascii=False) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("build",))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    if arguments.output.is_symlink():
        raise ValueError("Output directory must not be a symbolic link")
    package, systems = build_package()
    if arguments.check:
        if SYSTEMS.read_text() != systems or any(not (arguments.output / name).exists() or (arguments.output / name).read_text() != content for name, content in package.items()):
            raise ValueError("Nearest-5000 output does not reproduce byte for byte")
        print(json.dumps({"reproduced": True, "objects": json.loads(package["catalog.json"])["objectCount"]}, indent=2))
        return
    if arguments.output.exists() and not arguments.force:
        raise FileExistsError("Output exists; use --force for an intentional regeneration")
    write_managed_files(arguments.output, package, arguments.force)
    SYSTEMS.write_text(systems)
    provenance = json.loads(package["provenance.json"])
    print(json.dumps(provenance["coverage"] | {"objects": json.loads(package["catalog.json"])["objectCount"], "systems": len(provenance["systems"]),
                     "shared": sum(1 for item in provenance["objects"] if item.get("status", "").startswith("shared"))}, indent=2))


if __name__ == "__main__":
    main()
