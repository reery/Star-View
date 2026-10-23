"""Compare all source/effective catalogs and components with a pre-migration snapshot of a catalog retirement.

Snapshots contain source CSV/provenance files, stellar-companions.json and fully
hydrated generated catalogs, under their original src/data paths.
"""

import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WESTERN = "western-constellation-stars"
# Retired catalogs merged into the constellation catalog. An ID map names the surviving
# record of the same object; its retired name then survives as a designation.
RETIRED = {
    "famous-cluster-stars": {"archive": "catalog-work/famous-cluster-stars/retired-catalog", "provenance": "clusterLandmark",
                             "report": "catalog-work/famous-cluster-stars/consolidation-audit.json", "reviewedOn": "2026-10-20"},
    "bright-stars": {"archive": "catalog-work/bright-stars/retired-catalog", "provenance": "brightStar", "idMap": "src/data/legacy-star-ids.json",
                     "report": "catalog-work/bright-stars/consolidation-audit.json", "reviewedOn": "2026-10-23"},
}


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
    elif old in ("", None):
        return  # A previously unknown value may be enriched.
    else:
        assert old == new, f"Changed {context}: {old!r} -> {new!r}"


def effective(path, hydrate=False):
    stars = read(path)["stars"]
    for star in stars:
        if hydrate and (key := star.get("catalog_detail_key")):
            star.update(read(ROOT / f"src/data/generated/catalog-details/catalog-detail-{key}.json"))
    return {star["id"]: star for star in stars}


def audit(before, retired):
    config = RETIRED[retired]
    maps = read(ROOT / config["idMap"]) if config.get("idMap") else {"ids": {}, "sharedIds": {}}
    id_map = {**maps["ids"], **maps["sharedIds"]}

    def preserved(star, new, context):
        current = new.get(id_map.get(star["id"], star["id"]), {})
        if star["id"] in id_map and current:
            # The surviving record keeps its own ID and preferred name.
            # Designations never repeat a record's own name.
            names = {current["name"].casefold(), *(value.casefold() for value in current.get("designations", []))}
            star = {**star, "id": current["id"], "designations": [value for value in star.get("designations", []) if value.casefold() != current["name"].casefold()]}
            assert star.pop("name").casefold() in names, f"Lost name: {context}"
        assert_preserved(star, current, context)

    # Reviewed components retain their complete retired source record in the companion pool.
    retained_notes = {(source["record"]["id"], source["record"]["notes"]) for star in read(ROOT / "src/data/stellar-companions.json")["stars"]
                      for source in star.get("catalog_sources", []) if source["catalog_id"] == retired}

    comparisons = []
    for path in sorted((before / "src/data").rglob("stars.csv")):
        relative = path.relative_to(before)
        target = ROOT / relative
        if path.parent.name == retired:
            target = ROOT / f"src/data/catalogs/{WESTERN}/stars.csv"
            assert path.read_bytes() == (ROOT / config["archive"] / "stars.csv").read_bytes()
        new = {row["id"]: row for row in csv.DictReader(target.open())}
        old = list(csv.DictReader(path.open()))
        for star in old:
            current = new.get(id_map.get(star["id"], star["id"]) if path.parent.name == retired else star["id"], {})
            if path.parent.name == retired and (star["id"], star["notes"]) in retained_notes:
                # The pool guard verifies these complete snapshots, including differing measurements.
                assert current, f"Missing target: {relative}/{star['id']}"
                continue
            if path.parent.name == retired and star["id"] in id_map:
                # Source rows carry no designations; retired names are checked on effective records.
                star = {key: value for key, value in star.items() if key not in ("id", "name")}
            assert_preserved(star, current, f"{relative}/{current.get('id', '')}")
        provenance_path = path.parent / "provenance.json"
        if provenance_path.exists():
            old_provenance = read(provenance_path)["objects"]
            new_provenance = read(target.parent / "provenance.json")["objects"]
            # Nearest catalogs have list-shaped provenance; only the merged
            # landmark package changes, and its per-object records are keyed.
            if isinstance(old_provenance, dict):
                for identifier, record in old_provenance.items():
                    if path.parent.name == retired:
                        current = new_provenance[id_map.get(identifier, identifier)]
                        current = current.get(config["provenance"], current)
                    else:
                        current = new_provenance[identifier]
                    assert_preserved(record, current, f"{relative}/provenance/{identifier}")
            else:
                assert_preserved(old_provenance, new_provenance, f"{relative}/provenance")
        comparisons.append({"source": str(relative), "target": str(target.relative_to(ROOT)), "recordsCompared": len(old)})
    for path in sorted((before / "src/data/generated/catalogs").glob("*.json")):
        target = ROOT / path.relative_to(before)
        if path.stem == retired:
            target = target.with_name(f"{WESTERN}.json")
        old, new = effective(path), effective(target, hydrate=True)
        for identifier, star in old.items():
            if path.stem == retired:
                preserved(star, new, f"{path.stem}/{identifier}")
            else:
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
    retired_before = effective(before / f"src/data/generated/catalogs/{retired}.json")
    western_after = effective(ROOT / f"src/data/generated/catalogs/{WESTERN}.json")
    return {"reviewedOn": config["reviewedOn"], "retiredCatalogId": retired, "retiredNonSolarRecords": len(retired_before) - 1,
            "mappedToSurvivingIds": len([identifier for identifier in retired_before if identifier in id_map]),
            "previouslyMissingIds": sorted(identifier for identifier in retired_before.keys() - western_before.keys() if identifier not in id_map),
            "constellationNonSolarRecordsBefore": len(western_before) - 1,
            "constellationNonSolarRecordsAfter": len(western_after) - 1,
            "recordOrMeasurementLoss": 0, "comparisons": comparisons}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before-dir", type=Path, required=True)
    parser.add_argument("--catalog", choices=RETIRED, default="famous-cluster-stars")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    report = audit(args.before_dir, args.catalog)
    if args.write:
        (ROOT / RETIRED[args.catalog]["report"]).write_text(json.dumps(report, indent=2) + "\n")
    print(f"Consolidation preservation: {sum(c['recordsCompared'] for c in report['comparisons'])} source/effective/component records; no measurement, uncertainty, photometry or provenance loss.")
