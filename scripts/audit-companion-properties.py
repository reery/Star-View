"""Report available and missing properties of represented nearest-1000 systems.

Reads frozen catalog/provenance data and the effective component pool. Membership
follows the app's reviewed systems; raw CSV blanks are not effective app gaps.
"""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "catalog-work/star-systems/companion-property-coverage.json"
FIELDS = (
    "absolute_mag", "radial_velocity_kms", "temperature_k", "mass_solar",
    "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr", "spectral_type",
)


def main():
    paths = {
        "catalog": ROOT / "src/data/catalogs/nearest-1000/stars.csv",
        "provenance": ROOT / "src/data/catalogs/nearest-1000/provenance.json",
        "systems": ROOT / "src/data/star-systems.json",
        "review": ROOT / "catalog-work/star-systems/reviewed-component-properties.json",
        "components": ROOT / "src/data/stellar-companions.json",
        "componentAudit": ROOT / "catalog-work/star-systems/catalog-companions-audit.json",
    }
    with paths["catalog"].open(newline="") as handle:
        raw_stars = {row["id"]: row for row in csv.DictReader(handle)}
    provenance = {row["id"]: row for row in json.loads(paths["provenance"].read_text())["objects"]}
    definitions = json.loads(paths["components"].read_text())
    component_stars = {row["id"]: row for row in definitions["stars"]}
    component_audit = json.loads(paths["componentAudit"].read_text())["componentRecords"]
    observations = {row["id"]: row["radial_velocity_observation"]
                    for row in json.loads(paths["components"].read_text())["stars"]
                    if row.get("radial_velocity_observation")}
    groups = {system["name"]: {c["label"]: c["starId"] for c in system["components"]}
              for system in definitions["systems"]
              if any(sid in raw_stars for c in system["components"]
                     for sid in [c["starId"], *c.get("alternateStarIds", [])])}
    stars = {sid: {**component_stars[sid],
                  "radial_velocity_kms": (component_stars[sid].get("raw_astrometry") or {}).get("radial_velocity_kms")}
             for components in groups.values() for sid in components.values()}
    available = lambda row, field: row.get(field) is not None and row.get(field) != ""
    members = []
    for name, components in sorted(groups.items()):
        for label, sid in sorted(components.items()):
            row, source = stars[sid], provenance.get(sid, {})
            supplement = {**source.get("reviewedComponentEnrichment", {}).get("adopted", {}),
                          **component_audit.get(sid, {}).get("reviewedLiterature", {}).get("adopted", {})}
            members.append({
                "starId": sid, "name": row["name"], "system": name, "component": label,
                "missingFields": [field for field in FIELDS if not available(row, field)],
                "rawCatalogMissingFields": [field for field in FIELDS if not available(raw_stars.get(sid, {}), field)],
                "supplementedFields": {field: item["status"] for field, item in supplement.items()},
            })
    report = {
        "schemaVersion": 1,
        "scope": "Effective component records for every reviewed system represented in nearest-1000, including companion-pool additions. Raw catalog gaps are reported separately. Not an exhaustive literature search.",
        "radialVelocityPolicy": "radial_velocity_kms counts RVs adopted with the catalog motion astrometry. Separately dated component spectroscopic measurements remain in radialVelocityObservations; they do not imply a systemic velocity or a complete bulk motion vector.",
        "radialVelocityObservations": {row["starId"]: observations[row["starId"]]
                                       for row in members if row["starId"] in observations},
        "inputSha256": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths.values()},
        "systems": len(groups), "members": len(members),
        "supplementedMembers": sum(bool(row["supplementedFields"]) for row in members),
        "supplementedFieldCount": sum(len(row["supplementedFields"]) for row in members),
        "coverage": {field: {
            "available": sum(available(stars[row["starId"]], field) for row in members),
            "missing": sum(not available(stars[row["starId"]], field) for row in members),
        } for field in FIELDS},
        "records": members,
    }
    OUTPUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({key: report[key] for key in ("systems", "members", "supplementedMembers", "supplementedFieldCount", "coverage")}, indent=2))


if __name__ == "__main__":
    main()
