"""Author the overlay multiplicity research queue from frozen exact identities."""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/star-systems"


def rows(path):
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def main():
    msc = json.loads((WORK / "msc-20260619-overlay-matches.json").read_text())
    plan = json.loads((WORK / "overlay-companions.json").read_text())
    comp = [list(map(str.strip, line.split("|"))) for line in msc["tables"]["comp.tsv"]]
    by_hip = {int(row[11]): row for row in comp if int(row[11])}
    roots = {row[0]: row for row in comp if row[9] == "0.0"}
    subsystems = {}
    for line in msc["tables"]["sys.tsv"]:
        row = list(map(str.strip, line.split("|")))
        subsystems.setdefault(row[0], []).append(row)
    western_source = rows(ROOT / "catalog-work/western-constellation-stars/simbad.csv")
    hip_by_simbad = {row["main_id"]: int(row["query_id"].removeprefix("HIP ")) for row in western_source}
    results = {}
    paths = [WORK / "msc-20260619-overlay-matches.json", WORK / "overlay-companions.json"]
    for catalog in ("bright-stars", "western-constellation-stars", "famous-cluster-stars"):
        source_path = ROOT / f"catalog-work/{catalog}/simbad.csv"
        csv_path = ROOT / f"src/data/catalogs/{catalog}/stars.csv"
        paths += [source_path, csv_path]
        catalog_rows = rows(csv_path)
        provenance_path = ROOT / f"src/data/catalogs/{catalog}/provenance.json"
        paths.append(provenance_path)
        provenance = json.loads(provenance_path.read_text())["objects"]
        id_by_query = {entry["queryId"]: identifier for identifier, entry in provenance.items() if "queryId" in entry}
        implemented = {item["landmarkId"] for item in plan["catalogs"].get(catalog, [])}
        review = []
        for source in rows(source_path):
            query = source.get("query_id", "")
            hip = int(query.removeprefix("HIP ")) if query.startswith("HIP ") else hip_by_simbad.get(source["main_id"])
            identifier = source.get("id") or id_by_query.get(query) or (f"hip-{hip}" if hip else query)
            record = by_hip.get(hip)
            root = roots.get(record[0]) if record else None
            grade = int(root[20]) if root else None
            flagged = source["otype"] in {"**", "SB*", "EB*"}
            if identifier in implemented or not (flagged or (grade is not None and grade >= 3)):
                continue
            star = next((row for row in catalog_rows if row["id"] == identifier), None)
            hierarchy = subsystems.get(record[0], []) if record else []
            review.append({"starId": identifier, "name": star["name"] if star else source.get("name", source["main_id"]),
                           "simbadId": source["main_id"], "simbadType": source["otype"], "hip": hip,
                           "wds": record[0] if record else None, "mscGrade": grade,
                           "mscComponentCount": int(root[19]) if root else None,
                           "hierarchy": [{"primary": r[1], "secondary": r[2], "parent": r[3], "status": r[4]} for r in hierarchy],
                           "status": "needs-individual-identity-classification-and-measurement-review"})
        review.sort(key=lambda row: row["name"].casefold())
        expansion = plan["catalogs"].get(catalog, [])
        results[catalog] = {"nonSunObjects": len(catalog_rows) - 1, "expandedSystems": len(expansion),
                            "remainingSourceCandidates": len(review), "candidates": review}
    output = {"schemaVersion": 1, "reviewedOn": "2026-10-06",
              "scope": "Frozen source flags plus exact-HIP MSC matches of original overlay landmarks; no positional membership inference. MSC covers triples and higher, not all binaries. SIMBAD flags are leads, not a physical census or proof of an additional classified star. Famous-cluster inner systems are separately held for review.",
              "inputSha256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},
              "catalogs": results}
    (WORK / "overlay-companion-audit.json").write_text(json.dumps(output, indent=2) + "\n")
    for catalog, result in results.items():
        print(f"{catalog}: {result['nonSunObjects']} objects, {result['expandedSystems']} expanded systems, {result['remainingSourceCandidates']} source candidates")


if __name__ == "__main__":
    main()
