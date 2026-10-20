"""Compare all source/effective catalogs and components with a pre-migration snapshot.

Snapshots contain source CSV/provenance files, stellar-companions.json and fully
hydrated generated catalogs, under their original src/data paths.
"""

import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WESTERN = "western-constellation-stars"
CLUSTER = "famous-cluster-stars"


def read(path):
    return json.loads(path.read_text())


def assert_preserved(old, new, context):
    if isinstance(old, dict):
        for field, value in old.items():
            if field == "catalog_detail_key":
                continue
            assert field in new, f"Missing {context}.{field}"
            assert_preserved(value, new[field], f"{context}.{field}")
    elif isinstance(old, list):
        for value in old:
            for candidate in new:
                try:
                    assert_preserved(value, candidate, context)
                    break
                except (AssertionError, TypeError):
                    continue
            else:
                raise AssertionError(f"Lost list entry: {context}")
    elif context.endswith(".notes"):
        assert old in new, f"Lost notes: {context}"
    else:
        assert old == new, f"Changed {context}: {old!r} -> {new!r}"


def effective(path, hydrate=False):
    stars = read(path)["stars"]
    for star in stars:
        if hydrate and (key := star.get("catalog_detail_key")):
            star.update(read(ROOT / f"src/data/generated/catalog-details/catalog-detail-{key}.json"))
    return {star["id"]: star for star in stars}


def audit(before):
    comparisons = []
    for path in sorted((before / "src/data").rglob("stars.csv")):
        relative = path.relative_to(before)
        target = ROOT / relative
        if path.parent.name == CLUSTER:
            target = ROOT / f"src/data/catalogs/{WESTERN}/stars.csv"
            assert path.read_bytes() == (ROOT / "catalog-work/famous-cluster-stars/retired-catalog/stars.csv").read_bytes()
        new = {row["id"]: row for row in csv.DictReader(target.open())}
        old = list(csv.DictReader(path.open()))
        for star in old:
            assert_preserved(star, new.get(star["id"], {}), f"{relative}/{star['id']}")
        provenance_path = path.parent / "provenance.json"
        if provenance_path.exists():
            old_provenance = read(provenance_path)["objects"]
            new_provenance = read(target.parent / "provenance.json")["objects"]
            # Nearest catalogs have list-shaped provenance; only the merged
            # landmark package changes, and its per-object records are keyed.
            if isinstance(old_provenance, dict):
                for identifier, record in old_provenance.items():
                    current = new_provenance[identifier]
                    if path.parent.name == CLUSTER:
                        current = current.get("clusterLandmark", current)
                    assert_preserved(record, current, f"{relative}/provenance/{identifier}")
            else:
                assert_preserved(old_provenance, new_provenance, f"{relative}/provenance")
        comparisons.append({"source": str(relative), "target": str(target.relative_to(ROOT)), "recordsCompared": len(old)})
    for path in sorted((before / "src/data/generated/catalogs").glob("*.json")):
        target = ROOT / path.relative_to(before)
        if path.stem == CLUSTER:
            target = target.with_name(f"{WESTERN}.json")
        old, new = effective(path), effective(target, hydrate=True)
        for identifier, star in old.items():
            assert_preserved(star, new.get(identifier, {}), f"{path.stem}/{identifier}")
        comparisons.append({"source": str(path.relative_to(before)), "target": str(target.relative_to(ROOT)), "recordsCompared": len(old)})
    pool = "src/data/stellar-companions.json"
    old_pool, new_pool = read(before / pool), read(ROOT / pool)
    current = {star["id"]: star for star in new_pool["stars"]}
    for star in old_pool["stars"]:
        assert_preserved(star, current.get(star["id"], {}), f"components/{star['id']}")
    assert_preserved(old_pool["systems"], new_pool["systems"], "component systems")
    comparisons.append({"source": pool, "target": pool, "recordsCompared": len(old_pool["stars"])})
    western_before = effective(before / f"src/data/generated/catalogs/{WESTERN}.json")
    cluster_before = effective(before / f"src/data/generated/catalogs/{CLUSTER}.json")
    western_after = effective(ROOT / f"src/data/generated/catalogs/{WESTERN}.json")
    return {"reviewedOn": "2026-10-20", "clusterNonSolarRecords": len(cluster_before) - 1,
            "previouslyMissingClusterIds": sorted(cluster_before.keys() - western_before.keys()),
            "constellationNonSolarRecordsBefore": len(western_before) - 1,
            "constellationNonSolarRecordsAfter": len(western_after) - 1,
            "recordOrMeasurementLoss": 0, "comparisons": comparisons}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before-dir", type=Path, required=True)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    report = audit(args.before_dir)
    if args.write:
        (ROOT / "catalog-work/famous-cluster-stars/consolidation-audit.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"Consolidation preservation: {sum(c['recordsCompared'] for c in report['comparisons'])} source/effective/component records; no measurement, uncertainty, photometry or provenance loss.")
