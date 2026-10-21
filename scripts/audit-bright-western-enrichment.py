"""Check the frozen 151-target enrichment against hydrated browser records.

Read-only by default. --write records the coverage report and per-target results.
An optional pre-regeneration effective-record snapshot additionally checks every
field, retained source, uncertainty and unrelated object across every catalog.
This is a focused data audit, not the full test suite.
"""

import argparse
import csv
import hashlib
import io
import json
import math
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/bright-western-enrichment-20261021"
FIELDS = ("temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr")
BASELINE = "b23fad878af9907cf350e91531c2bc238987884b"


def read(path):
    return json.loads(path.read_text())


def hydrated_catalogs():
    catalogs = {}
    for path in sorted((ROOT / "src/data/generated/catalogs").glob("*.json")):
        rows = []
        for star in read(path)["stars"]:
            detail = ROOT / f"src/data/generated/catalog-details/catalog-detail-{star['catalog_detail_key']}.json"
            rows.append(star | read(detail))
        catalogs[path.stem] = rows
    return catalogs


def displayed(star):
    values = {field: star.get(field) for field in FIELDS}
    for field in FIELDS:
        if values[field] is None and field not in star.get("withheld_source_fields", []):
            source = next((s for s in star.get("catalog_sources", []) if s["record"].get(field) is not None), None)
            if source:
                values[field] = source["record"][field]
    observations = star.get("stellar_observations") or {}
    for field, alternatives in (
        ("temperature_k", ("atmosphere_temperature", "temperature_range")),
        ("mass_solar", ("mass_range",)), ("radius_solar", ("radius_range",)),
    ):
        if star.get(field) is None:
            observation = next((observations[key] for key in alternatives if observations.get(key)), None)
            if observation:
                values[field] = observation
    return values


def close(actual, expected):
    return isinstance(actual, (int, float)) and math.isclose(actual, expected, rel_tol=1e-8, abs_tol=1e-9)


def audit_snapshot(previous, current, allowed):
    ignored = {"catalog_detail_key", "notes", "catalog_sources", "catalog_flags", "withheld_source_fields"}
    rows, additions = 0, 0
    assert previous.keys() == current.keys(), "Catalog membership changed"
    for catalog, stars in previous.items():
        new = {s["id"]: s for s in current[catalog]}
        assert set(new) == {s["id"] for s in stars}, f"Record membership changed: {catalog}"
        for old in stars:
            star = new[old["id"]]
            rows += 1
            for field, value in old.items():
                if field in ignored:
                    continue
                if value != star.get(field):
                    assert old["id"] in allowed and field in (*FIELDS, "metallicity_kind") and value is None, (
                        f"Existing/unrelated value changed: {catalog}/{old['id']}/{field}"
                    )
                    additions += field in FIELDS
            for source in old.get("catalog_sources", []):
                assert source in star.get("catalog_sources", []), f"Retained source changed: {catalog}/{old['id']}"
            if old["id"] not in allowed:
                for field in ignored - {"catalog_detail_key"}:
                    assert old.get(field) == star.get(field), f"Unrelated metadata changed: {catalog}/{old['id']}/{field}"
    return {"effectiveRecordsCompared": rows, "fieldAdditionsAcrossCatalogOccurrences": additions,
            "existingValuesChanged": 0, "recordsLost": 0, "retainedSourcesLost": 0,
            "unrelatedRecordsChanged": 0}


def audit_sources(base, allowed):
    def git(*args):
        return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout
    paths = git("ls-tree", "-r", "--name-only", base, "src/data").splitlines()
    paths = [p for p in paths if p == "src/data/stars.csv" or p.startswith("src/data/catalogs/") and p.endswith("/stars.csv")]
    count = 0
    for path in paths:
        old = list(csv.DictReader(io.StringIO(git("show", f"{base}:{path}"))))
        new = {s["id"]: s for s in csv.DictReader((ROOT / path).open())}
        assert new.keys() == {s["id"] for s in old}, f"Raw membership changed: {path}"
        for star in old:
            count += 1
            for field, value in star.items():
                if value != new[star["id"]][field]:
                    assert star["id"] in allowed and (field == "notes" or value == "" and field in (*FIELDS, "metallicity_kind")), f"Raw existing/unrelated value changed: {path}/{star['id']}/{field}"
    old_pool = json.loads(git("show", f"{base}:src/data/stellar-companions.json"))["stars"]
    new_pool = {s["id"]: s for s in read(ROOT / "src/data/stellar-companions.json")["stars"]}
    assert new_pool.keys() == {s["id"] for s in old_pool}
    retained = 0
    for old in old_pool:
        star = new_pool[old["id"]]
        for field, value in old.items():
            if field == "catalog_sources":
                for source in value:
                    retained += 1
                    assert source in star.get(field, []), f"Historical component source changed: {old['id']}"
            elif value != star.get(field):
                assert old["id"] in allowed and (field == "notes" or value is None and field in (*FIELDS, "metallicity_kind")), f"Existing component value changed: {old['id']}/{field}"
    def contains(old, new):
        if isinstance(old, dict):
            return isinstance(new, dict) and all(k in new and contains(v, new[k]) for k, v in old.items())
        if isinstance(old, list):
            return isinstance(new, list) and all(v in new for v in old)
        return old == new
    provenance_count = 0
    for path in paths:
        if path == "src/data/stars.csv":
            continue
        provenance_path = str(Path(path).with_name("provenance.json"))
        old = json.loads(git("show", f"{base}:{provenance_path}"))
        new = read(ROOT / provenance_path)
        if "objects" in old:
            assert contains(old["objects"], new["objects"]), f"Existing object provenance changed: {path}"
            provenance_count += len(old["objects"])
    return {"baselineCommit": base, "rawCatalogRecordsCompared": count,
            "componentRecordsCompared": len(old_pool), "historicalComponentSourcesPreserved": retained,
            "objectProvenanceRecordsCompared": provenance_count, "existingValuesChanged": 0,
            "recordsLost": 0, "unrelatedRecordsChanged": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--baseline-effective", type=Path)
    parser.add_argument("--base", default=BASELINE, help="Git baseline used for the frozen scope")
    args = parser.parse_args()
    baseline = read(WORK / "targets.json")["targets"]
    review = read(WORK / "physical-review.json")
    decisions = {o["name"]: o for o in read(WORK / "review-decisions.json")["targets"]}
    assert len(baseline) == len(decisions) == 151
    for path, digest in review["inputSha256"].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest, f"Source drift: {path}"
    current = hydrated_catalogs()
    rows = {(catalog, s["id"]): s for catalog, stars in current.items() for s in stars}
    identities = {alias: (system["id"], component["label"], component["starId"])
                  for system in read(ROOT / "src/data/stellar-system-identities.json")["systems"]
                  for component in system["components"]
                  for alias in [component["starId"], *component.get("alternateStarIds", [])]}
    results = []
    gained = Counter()
    new_scalars = Counter()
    before_missing = Counter()
    after_missing = Counter()
    allowed = {identifier for o in review["catalogObjects"].values() for identifier in o["starViewIds"]}
    allowed.update(alias for alias, (_, _, canonical) in identities.items() if canonical in review["objects"])
    for target in baseline:
        name = target["name"]
        decision = decisions[name]
        component = target["variants"][0]["component"]
        exact = review["objects"].get(component["canonicalId"], {}) if component else review["catalogObjects"].get(decision["simbadId"], {})
        assert decision["adoptedFields"] == exact.get("fields", {}), f"Review decisions drifted: {name}"
        assert len(target["missingDisplayed"]) > 2, f"Outside original scope: {name}"
        available, new_fields = set(), set()
        for variant in target["variants"]:
            star = rows[(variant["catalog"], variant["id"])]
            identity = identities.get(star["id"])
            assert star["type"] == "star" and star["id"] != "sun" and (not identity or identity[1] in {"A", "Aa", "Aa1"})
            if variant["component"]:
                expected = variant["component"]
                assert identity == (expected["system"], expected["label"], expected["canonicalId"])
            visible = displayed(star)
            available.update(field for field in FIELDS if visible[field] is not None)
            for field in FIELDS:
                old = variant["values"][field]
                if old is not None:
                    assert star.get(field) == old, f"Existing measurement changed: {name}/{field}"
                elif star.get(field) is not None:
                    new_fields.add(field)
                    assert field in decision["adoptedFields"], f"Unreviewed addition: {name}/{field}"
            for field, observation in decision["adoptedFields"].items():
                assert close(star.get(field), observation["value"]), f"Review not applied: {name}/{field}"
                assert all(observation.get(k) for k in ("reference", "sourceUrl", "section", "status")), f"Missing provenance: {name}/{field}"
                assert not observation.get("replaces"), f"Replacement outside missing-field scope: {name}/{field}"
                if field == "metallicity_dex":
                    assert observation.get("quantity") in {"[Fe/H]", "[M/H]"}
                error = observation.get("uncertainty")
                assert error is None or (all(v >= 0 for v in error.values()) if isinstance(error, dict) else error >= 0), f"Invalid uncertainty: {name}/{field}"
        missing = [field for field in FIELDS if field not in available]
        assert set(missing) <= set(target["missingDisplayed"]), f"Displayed data lost: {name}"
        filled = sorted(set(target["missingDisplayed"]) - set(missing))
        new_scalars.update(sorted(new_fields))
        gained.update(filled)
        before_missing.update(target["missingDisplayed"])
        after_missing.update(missing)
        results.append({"name": name, "ids": target["ids"], "catalogs": target["catalogs"],
                        "newIndividualFields": sorted(new_fields), "newlyDisplayedFields": filled,
                        "remainingDisplayedGaps": missing,
                        "stillMissingMoreThanTwo": len(missing) > 2,
                        "sourceTablesChecked": decision["checkedSourceTables"], "disposition": decision["disposition"]})
    # Scientific/unit pitfalls encountered in this cohort have explicit guards.
    by_name = {o["name"]: o for o in baseline}
    first = lambda name: rows[(by_name[name]["variants"][0]["catalog"], by_name[name]["variants"][0]["id"])]
    assert first("Eta Sgr")["mass_solar"] == 2.1 and first("Eta Sgr")["radius_solar"] == 66
    assert close(first("Eta Sgr")["luminosity_solar"], 10 ** 2.72)
    assert first("Mu Her Aa")["mass_solar"] == by_name["Mu Her Aa"]["variants"][0]["values"]["mass_solar"]
    assert first("Mu Her Aa")["metallicity_dex"] == .28  # photospheric, not initial grid [Fe/H]
    assert first("Mintaka Aa1")["luminosity_solar"] > 100000  # not dimensionless V light fraction
    assert close(first("Upsilon Gem")["age_gyr"], 10 ** (10.0 - 9))
    assert close(first("Mu Cet A")["age_gyr"], 10 ** (9.08 - 9))
    summary = {"reviewedOn": "2026-10-21", "targetsReviewed": 151,
               "targetsEnriched": sum(bool(o["newIndividualFields"]) for o in results),
               "targetsWithoutAdoptableAdditions": sum(not o["newIndividualFields"] for o in results),
               "newIndividualFields": sum(new_scalars.values()), "newIndividualFieldsByKind": dict(new_scalars),
               "newlyDisplayedFields": sum(gained.values()), "newlyDisplayedFieldsByKind": dict(gained),
               "displayedGapsBefore": dict(before_missing), "displayedGapsAfter": dict(after_missing),
               "targetsStillMissingMoreThanTwoFields": sum(o["stillMissingMoreThanTwo"] for o in results)}
    summary["sourcePreservation"] = audit_sources(args.base, allowed)
    if args.baseline_effective:
        summary["preservation"] = audit_snapshot(read(args.baseline_effective), current, allowed)
    if args.write:
        output = WORK / "results.json"
        output.write_text(json.dumps({"summary": summary, "targets": results}, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
