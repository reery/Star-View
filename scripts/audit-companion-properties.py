"""Report available and missing properties of represented nearest-1000 systems.

Reads frozen catalog/provenance data only. Membership follows the component
cards; a missing field is a research gap, not permission to copy primary data.
"""

import collections
import csv
import hashlib
import json
import re
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
    }
    with paths["catalog"].open(newline="") as handle:
        stars = {row["id"]: row for row in csv.DictReader(handle)}
    provenance = {row["id"]: row for row in json.loads(paths["provenance"].read_text())["objects"]}
    definitions = json.loads(paths["systems"].read_text())
    reviewed = {
        sid: (system["name"], component["label"])
        for system in definitions["systems"] for component in system["components"]
        for sid in [component["starId"], *component.get("alternateStarIds", [])]
    }
    groups = collections.defaultdict(dict)
    for sid, row in stars.items():
        if row["type"] not in {"star", "brown_dwarf", "white_dwarf"}:
            continue
        match = re.fullmatch(r"(.+) ([A-Z][a-z]?)", row["name"])
        association = reviewed.get(sid)
        if sid == "proxima-centauri" and not association:
            association = ("Alpha Centauri", "C")
        if not association and match:
            association = match.groups()
        if association and association[0] != "Theta1 Orionis":
            groups[association[0]][association[1]] = sid
    groups = {name: members for name, members in groups.items() if len(members) > 1}
    members = []
    for name, components in sorted(groups.items()):
        for label, sid in sorted(components.items()):
            row, source = stars[sid], provenance[sid]
            supplement = source.get("reviewedComponentEnrichment", {}).get("adopted", {})
            members.append({
                "starId": sid, "name": row["name"], "system": name, "component": label,
                "missingFields": [field for field in FIELDS if not row[field]],
                "supplementedFields": {field: item["status"] for field, item in supplement.items()},
            })
    report = {
        "schemaVersion": 1,
        "scope": "Represented nearest-1000 component-card members, including primaries. Not a complete companion census or an assertion that all published measurements have been exhausted.",
        "inputSha256": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths.values()},
        "systems": len(groups), "members": len(members),
        "supplementedMembers": sum(bool(row["supplementedFields"]) for row in members),
        "supplementedFieldCount": sum(len(row["supplementedFields"]) for row in members),
        "coverage": {field: {
            "available": sum(bool(stars[row["starId"]][field]) for row in members),
            "missing": sum(not stars[row["starId"]][field] for row in members),
        } for field in FIELDS},
        "records": members,
    }
    OUTPUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({key: report[key] for key in ("systems", "members", "supplementedMembers", "supplementedFieldCount", "coverage")}, indent=2))


if __name__ == "__main__":
    main()
