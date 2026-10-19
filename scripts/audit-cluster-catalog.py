"""Census every effective Famous cluster star and compare the review baseline."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

from catalog_sources.preservation import lost_fields, pool_losses

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/famous-cluster-stars"
FIELDS = ("spectral_type", "temperature_k", "mass_solar", "luminosity_solar", "radius_solar",
          "metallicity_dex", "age_gyr", "apparent_mag", "absolute_mag")
ASTROMETRY = ("parallax_mas", "parallax_error_mas", "pm_ra_cosdec_masyr", "pm_ra_error_masyr",
              "pm_dec_masyr", "pm_dec_error_masyr", "radial_velocity_kms", "radial_velocity_error_kms")
MEASUREMENTS = (*FIELDS, "type", "metallicity_kind", "epoch", "x_pc", "y_pc", "z_pc",
                "vx_kms", "vy_kms", "vz_kms", "raw_astrometry", "resolved_photometry")


def read(path):
    return json.loads(path.read_text())


def value(star, field):
    return (star.get("raw_astrometry") or {}).get(field) if field in ASTROMETRY else star.get(field)


def hydrate(star):
    if key := star.get("catalog_detail_key"):
        return {**star, **read(ROOT / f"src/data/generated/catalog-details/catalog-detail-{key}.json")}
    return star


def equal(a, b):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
    return a == b


def changes(before, after):
    return [field for field in MEASUREMENTS if not equal(before.get(field), after.get(field))]


def retained(before, after):
    sources = [s["record"] for s in after.get("catalog_sources", [])]
    for field in MEASUREMENTS:
        old = before.get(field)
        if old is None or old == [] or equal(old, after.get(field)):
            continue
        if isinstance(old, dict):
            for key, entry in old.items():
                if entry is not None and not equal(entry, (after.get(field) or {}).get(key)) and not any(
                        equal(entry, (source.get(field) or {}).get(key)) for source in sources):
                    raise ValueError(f"Unretained original measurement: {before['id']}:{field}.{key}")
        elif not any(equal(old, source.get(field)) for source in sources):
            raise ValueError(f"Unretained original measurement: {before['id']}:{field}")
    if lost_fields(before, after, sources):
        raise ValueError(f"Effective component fields lost: {before['id']}")
    for source in before.get("catalog_sources", []):
        candidates = [s["record"] for s in after.get("catalog_sources", [])
                      if s["catalog_id"] == source["catalog_id"] and s["record"]["id"] == source["record"]["id"]]
        if not candidates or lost_fields(source["record"], candidates[0], candidates[1:]):
            raise ValueError(f"Retained source lost: {before['id']}:{source['catalog_id']}")


def render(before_dir=None):
    baseline = read(WORK / "gap-baseline.json")["records"]
    current = {s["id"]: hydrate(s) for s in read(ROOT / "src/data/generated/catalogs/famous-cluster-stars.json")["stars"] if s["id"] != "sun"}
    if current.keys() != baseline.keys() or len(current) != 62:
        raise ValueError("Effective cluster membership changed")
    physical = read(WORK / "physical-review.json")
    motion = read(WORK / "motion-review.json")
    astrometry = read(WORK / "astrometry-review.json")
    allowed = set(physical["objects"]) | {i for o in physical["catalogObjects"].values() for i in o["starViewIds"]}
    allowed |= set(astrometry["expectedInputs"]) | {i for s in motion["systems"] for i in s["expectedInputs"]}
    allowed |= {i for s in astrometry.get("relatedSystems", []) for i in s["expectedInputs"]}
    audit = read(ROOT / "catalog-work/star-systems/catalog-companions-audit.json")["componentRecords"]
    coverage = {f: {"before": sum(value(s, f) is not None for s in baseline.values()),
                    "after": sum(value(s, f) is not None for s in current.values()),
                    "filled": sum(value(baseline[i], f) is None and value(s, f) is not None for i, s in current.items())}
                for f in (*FIELDS, *ASTROMETRY)}
    rows = []
    for identifier, star in sorted(current.items()):
        old = baseline[identifier]
        retained(old, star)
        changed = changes(old, star)
        if changed and identifier not in allowed:
            raise ValueError(f"Unreviewed effective change: {identifier}:{changed}")
        missing = [f for f in (*FIELDS, *ASTROMETRY) if value(star, f) is None]
        reasons = {}
        for field in missing:
            if field == "age_gyr":
                reason = "No adopted absolute age for this exact component. Fractional lifetimes, upper bounds, fixed model assumptions and an unverified common cluster age are not point measurements."
            elif field == "metallicity_dex":
                reason = "No adopted individual [Fe/H] or [M/H]. Fixed solar composition, total metal mass fraction, CNO anomalies and log element/Ntot are not substituted."
            elif field == "mass_solar":
                reason = "No eligible exact-component dynamical/evolutionary mass in the reviewed sources. MSC magnitude masses, minimum masses, subsystem totals and a generic mass-luminosity relation are withheld."
            elif field in ASTROMETRY:
                reason = "No matching native uncertainty/measurement or accepted systemic solution. Errors from another epoch/source and individual orbital RVs are not attached to the adopted motion."
            elif field in {"apparent_mag", "absolute_mag"}:
                reason = "No independently established individual Johnson V; another passband or the unresolved total is not relabelled as individual V."
            else:
                reason = "No additional exact-component value justified by the frozen SIMBAD/Gaia/MSC sources and targeted component literature; blended parent fits and comparison-star parameters remain separate."
            if identifier == "msc-12349+2238-c" and field in {"mass_solar", "age_gyr"}:
                reason = "Exact Gaia source has FLAME flags=20 and null mass/age. Its radius/luminosity are eligible, but no mass or age is fabricated."
            if identifier == "hip-61394" and field in physical["objects"][identifier]["withheldFields"]:
                reason = physical["objects"][identifier]["withheldFields"][field]["reason"]
            reasons[field] = reason
        review = physical["objects"].get(identifier) or next((o for o in physical["catalogObjects"].values() if identifier in o["starViewIds"]), None)
        if review:
            for field, observation in review["fields"].items():
                if not equal(star.get(field), observation["value"]):
                    raise ValueError(f"Reviewed value did not reach the effective catalog: {identifier}:{field}")
        rows.append({"id": identifier, "name": star["name"], "values": {f: value(star, f) for f in (*FIELDS, *ASTROMETRY)},
                     "filled": {f: value(star, f) for f in (*FIELDS, *ASTROMETRY) if value(old, f) is None and value(star, f) is not None},
                     "changedMeasurementFields": changed, "missing": missing, "remainingGapReasons": reasons,
                     "sourcesChecked": ["Exact-identity frozen SIMBAD basic/mesFe_H and Gaia DR3 exports where a counterpart exists", "Frozen MSC component hierarchy and orbital rows for represented systems", "Existing shared/catalog/component literature reviews", *(["Targeted published tables recorded in physical-review.json"] if review else [])],
                     "physicalReview": review, "componentEvidence": f"catalog-work/star-systems/catalog-companions-audit.json#/componentRecords/{identifier}" if identifier in audit else None,
                     "retainedSourceCount": len(star.get("catalog_sources", [])), "radialVelocityReference": (star.get("raw_astrometry") or {}).get("radial_velocity_ref")})
    comparisons = []
    orbit_changes = []
    if before_dir:
        for path in sorted((before_dir / "src/data").rglob("stars.csv")):
            relative = path.relative_to(before_dir)
            old = {r["id"]: r for r in csv.DictReader(path.open())}
            new = {r["id"]: r for r in csv.DictReader((ROOT / relative).open())}
            if old.keys() != new.keys() or any(lost_fields(s, new[i]) for i, s in old.items()):
                raise ValueError(f"Catalog row/field loss: {relative}")
            modified = {i: [k for k in s if s[k] != new[i].get(k)] for i, s in old.items() if s != new[i]}
            if modified.keys() - allowed:
                raise ValueError(f"Unrelated raw catalog changes: {relative}:{modified.keys() - allowed}")
            comparisons.append({"path": str(relative), "records": len(old), "changedRecords": modified, "recordOrKnownFieldLoss": 0})
        for path in sorted((before_dir / "src/data/generated/catalogs").glob("*.json")):
            relative = path.relative_to(before_dir)
            old = {s["id"]: s for s in read(path)["stars"]}
            new = {s["id"]: hydrate(s) for s in read(ROOT / relative)["stars"]}
            if old.keys() != new.keys():
                raise ValueError(f"Effective catalog record loss: {relative}")
            modified = {}
            for i, star in old.items():
                retained(star, new[i])
                if fields := changes(star, new[i]):
                    if i not in allowed:
                        raise ValueError(f"Unrelated effective catalog change: {relative}:{i}")
                    modified[i] = fields
            comparisons.append({"path": str(relative), "records": len(old), "changedRecords": modified, "recordOrKnownFieldLoss": 0})
        old_pool = read(before_dir / "src/data/stellar-companions.json")
        new_pool = read(ROOT / "src/data/stellar-companions.json")
        if errors := pool_losses(old_pool, new_pool, []):
            raise ValueError(f"Component/source preservation failed: {errors}")
        by_id = {s["id"]: s for s in new_pool["stars"]}
        modified = {}
        for star in old_pool["stars"]:
            retained(star, by_id[star["id"]])
            if fields := changes(star, by_id[star["id"]]):
                if star["id"] not in allowed:
                    raise ValueError(f"Unrelated pool change: {star['id']}")
                modified[star["id"]] = fields
        comparisons.append({"path": "src/data/stellar-companions.json", "records": len(old_pool["stars"]), "changedRecords": modified, "recordOrKnownFieldLoss": 0})
        orbit_before = before_dir / "stellar-orbits.json"
        if orbit_before.exists():
            old_orbits = {(s["systemId"], o["id"]): o for s in read(orbit_before)["systems"] for o in s["orbits"]}
            new_orbits = {(s["systemId"], o["id"]): o for s in read(ROOT / "src/data/stellar-orbits.json")["systems"] for o in s["orbits"]}
            if old_orbits.keys() != new_orbits.keys():
                raise ValueError("Orbital solution membership changed")
            allowed_systems = {astrometry["systemId"], *(s["systemId"] for s in astrometry.get("relatedSystems", []))}
            for (system, identifier), old in old_orbits.items():
                new = new_orbits[system, identifier]
                fields = [f for f in old if not equal(old[f], new.get(f))]
                if fields:
                    if system not in allowed_systems or set(fields) - {"semiMajorAxisAu", "axisDerivation"}:
                        raise ValueError(f"Unreviewed orbital change: {identifier}:{fields}")
                    axis = new["axisDerivation"]
                    if not equal(new["semiMajorAxisAu"], axis["angularAxisArcsec"] * 1000 / axis["parallaxMas"]):
                        raise ValueError(f"Inconsistent orbital distance conversion: {identifier}")
                    orbit_changes.append({"systemId": system, "id": identifier, "changedFields": fields,
                        "beforeSemiMajorAxisAu": old["semiMajorAxisAu"], "afterSemiMajorAxisAu": new["semiMajorAxisAu"],
                        "scope": "Same measured angular orbit; physical axis recalculated with the reviewed adopted parallax. All other orbital measurements/metadata and solution identities retained."})
    return {"schemaVersion": 1, "reviewedOn": "2026-10-19", "nonSolarObjects": len(current),
            "scope": "All 42 source landmarks and all 20 runtime companions; physical, spectral, Johnson V, astrometric, uncertainty, RV and provenance availability audited. Membership is preserved.",
            "researchBoundary": "Every object checked against the listed frozen source families, with targeted primary-literature checks for recoverable gaps. This is not an exhaustive literature search or a certification of every pre-existing parameter. Nulls mean no justified adoption here. Parallax-consistent landmark selection alone does not establish coeval cluster membership; no cluster age/abundance blanket was applied.",
            "coverage": coverage, "objectsChanged": sum(bool(r["changedMeasurementFields"]) for r in rows),
            "withheldButRetained": {"hip-61394": list(physical["objects"]["hip-61394"]["withheldFields"])},
            "catalogComparisons": comparisons, "orbitalDistanceConversions": orbit_changes, "records": rows,
            "inputSha256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [WORK / "gap-baseline.json", WORK / "physical-review.json", WORK / "astrometry-review.json", WORK / "motion-review.json"]}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before-dir", type=Path, help="Frozen pre-edit catalog and effective-payload snapshots")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    result = render(args.before_dir)
    if args.write:
        (WORK / "gap-coverage-audit.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"objects": result["nonSolarObjects"], "objectsChanged": result["objectsChanged"], "coverage": result["coverage"], "catalogComparisons": len(result["catalogComparisons"])}))
