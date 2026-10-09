"""Reproduce the scoped 2MASS physical/motion review from frozen author tables."""

import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path

from catalog_sources.snapshots import canonical_json, verify_sha256

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "catalog-work/shared-enrichment/ultracool"
OUTPUT = SOURCES.parent / "reviewed-ultracool.json"
# IAU 2015 nominal Jupiter equatorial radius and mass-parameter conversions.
RADIUS_RATIO = 71492 / 695700
MASS_RATIO = 1.2668653e17 / 1.3271244e20


def finite(value):
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def normalized(value):
    return " ".join(value.split())


def build_review():
    manifest = json.loads((SOURCES / "source-manifest.json").read_text())
    for filename, digest in manifest["checksumsSha256"].items():
        verify_sha256(SOURCES / filename, digest)
    targets = json.loads((SOURCES / "targets.json").read_text())
    aliases = defaultdict(set)
    for key, target in targets.items():
        for alias in target["aliases"]:
            aliases[normalized(alias)].add(key)

    def identity(names):
        matches = set().union(*(aliases[normalized(name)] for name in names))
        return next(iter(matches)) if len(matches) == 1 else None

    def table(filename):
        with (SOURCES / filename).open(newline="") as handle:
            return list(csv.DictReader(handle))

    def indexed(filename):
        result = defaultdict(list)
        for record in table(filename):
            key = identity(record.get(field, "") for field in ("name", "name_simbadable", "name_simbad", "designation_2mass"))
            if key:
                result[key].append(record)
        return result

    main, fundamental = indexed("ucs-main.csv"), indexed("ucs-fundamental.csv")
    references = {record["code_ref"]: record for record in table("ucs-references.csv")}
    older_values = {line[:11].strip(): line for line in (SOURCES / "table9.dat").read_text().splitlines()}
    older = {}
    for line in (SOURCES / "table1.dat").read_text().splitlines():
        key = identity([line[24:51].strip()])
        if key:
            older[key] = (line[80:91].strip(), older_values[line[80:91].strip()])
    objects, velocities, audit = {}, {}, {}
    for key, target in sorted(targets.items()):
        decision = audit[key] = {"id": target["starViewId"], "name": target["displayName"]}
        candidates = main.get(key, [])
        if len(candidates) != 1:
            decision.update(physical="No unique exact-identity UltracoolSheet record", velocity="No unique exact-identity UltracoolSheet record")
            continue
        record = candidates[0]
        decision["sourceRecordId"] = record["name"]
        flags = record["literature_flag"].lower()
        multiple = record["multiplesystem_unresolved_in_this_table"] != "N" or any(flag in flags for flag in ("binary", "triple", "specblend", "over-l"))
        decision["sourceFlags"] = record["literature_flag"]
        decision["unresolvedMultiple"] = record["multiplesystem_unresolved_in_this_table"]
        if multiple:
            decision.update(physical="Withheld: unresolved or suspected multiplicity/overluminosity", velocity="Withheld: component/system motion ambiguous")
            continue

        # Source-backed heliocentric/barycentric line-of-sight velocities only.
        rv, error = finite(record["rv_formula"]), finite(record["rverr_formula"])
        ref = references.get(record["ref_rv_formula"])
        if rv is not None and error is not None and 0 < error <= 10 and ref and ref["ADSkey_ref"]:
            if record["ref_rv_lit"] == record["ref_rv_formula"]:
                rv, error = finite(record["rv_lit"]), finite(record["rverr_lit"])
            if rv is not None and error is not None and 0 < error <= 10:
                velocities[key] = {"starViewIds": target["starViewIds"], "value": rv, "uncertainty": error,
                                   "reference": ref["ADSkey_ref"], "sourceRecordId": record["name"],
                                   "url": "https://ui.adsabs.harvard.edu/abs/" + ref["ADSkey_ref"],
                                   "sourceUrl": "https://zenodo.org/records/15802304",
                                   "scope": "Exact catalogued object; static linear space-motion approximation, no orbital trajectory."}
        decision["velocity"] = "Reviewed literature available; fill missing RV only" if key in velocities else "No finite referenced RV with positive uncertainty <=10 km/s"

        values = fundamental.get(key, [])
        fields = {}
        if len(values) == 1:
            value = values[0]
            if value["lbol_flag"].upper() != "FALSE" or "plx-discrep" in flags or "subd" in flags:
                decision["physical"] = "Withheld: flagged SED fit, parallax discrepancy or subdwarf"
                continue
            ref, url, section = "2023ApJ...959...63S", "https://zenodo.org/records/15802304", "Table of Ultracool Fundamental Properties, sections 5-7"
            inputs = {"ageCategory": value["age_category"], "ageJustification": value["age_category_justification"],
                      "evolutionaryModel": value["evo_model_name"], "sourceParallaxMas": finite(value["plx_formula"]),
                      "log_luminosity_solar": finite(value["log_lbol_lsun"])}
            for field, column, conversion in (("temperature_k", "teff_evo", 1), ("radius_solar", "radius_evo", RADIUS_RATIO), ("mass_solar", "mass_evo", MASS_RATIO)):
                number, uncertainty = finite(value[column]), finite(value[column + "_err"])
                # Tentative group membership is not a firm age constraint.
                if "?" not in value["age_category"] and number is not None and number > 0 and uncertainty is not None and uncertainty >= 0:
                    fields[field] = {"value": number * conversion, "uncertainty": uncertainty * conversion,
                                     "status": "model-derived", "inputs": {**inputs, "publishedColumn": column, "unitConversion": conversion},
                                     "caveat": "Evolutionary-model estimate conditional on the authors' age distribution, not a direct measurement; uncertainty can be large. Published distance and model inputs retained."}
            log_lum, error_lum = finite(value["log_lbol_lsun"]), finite(value["log_lbol_lsun_err"])
        elif not values and key in older:
            source_id, value = older[key]
            # Known unresolved binaries have blank model parameters in Table 9.
            if finite(value[73:77]) is None:
                decision["physical"] = "Withheld: no individual parameters in Filippazzo Table 9"
                continue
            ref, url, section = "2015ApJ...810..158F", "https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/810/158", "Table 9"
            inputs = {"sourceRecordId": source_id, "sourceParallaxMas": finite(value[12:18]),
                      "ageLowerGyr": finite(value[40:45]), "ageUpperGyr": finite(value[46:52]),
                      "sourceTemperatureK": finite(value[73:77])}
            for field, number, error, conversion in (("temperature_k", value[73:77], value[78:81], 1), ("radius_solar", value[53:57], value[58:62], RADIUS_RATIO), ("mass_solar", value[82:88], value[89:94], MASS_RATIO)):
                if finite(number) is not None and finite(error) is not None:
                    fields[field] = {"value": float(number) * conversion, "uncertainty": float(error) * conversion,
                                     "status": "model-derived", "inputs": {**inputs, "unitConversion": conversion},
                                     "caveat": "Published evolutionary/SED estimate conditional on the adopted age range; not a dynamical measurement. Published source distance retained."}
            log_lum, error_lum = finite(value[29:34]), finite(value[35:39])
        else:
            decision["physical"] = "No unique physical record in the reviewed tables"
            continue
        if log_lum is not None and error_lum is not None and error_lum >= 0:
            lum = 10 ** log_lum
            fields["luminosity_solar"] = {"value": lum, "uncertainty": {"lower": lum - 10 ** (log_lum - error_lum), "upper": 10 ** (log_lum + error_lum) - lum},
                                          "status": "derived", "inputs": {**inputs, "log_luminosity_solar": log_lum, "log_luminosity_error_dex": error_lum},
                                          "caveat": "Bolometric SED luminosity, including modeled missing flux; converted from published log10(L/Lsun), retained at the paper's distance."}
        for field, observation in fields.items():
            observation.update(section=section, sourceRecordId=record["name"] if ref.startswith("2023") else inputs["sourceRecordId"])
            if field == "temperature_k":
                observation["replaceSpectralTypeEstimate"] = True
        if fields:
            objects[key] = {"label": target["displayName"], "starViewIds": target["starViewIds"], "objectType": target["objectType"],
                            "component": "individual catalogued object", "scope": "Exact-identity individual ultracool object; no unresolved binary totals.",
                            "reference": ref, "url": url, "fields": fields,
                            "note": "SED luminosity and conditional evolutionary-model estimates with published uncertainties. Generic field/gravity age priors are not object-specific age measurements; scalar age and metallicity are not supplied."}
        decision["physical"] = {"reference": ref, "fields": sorted(fields)}
    return {"schemaVersion": 1, "reviewed": "2026-10-09", "policy": "90 frozen 2MASS-named nearby objects; unique exact aliases only; Sanghi 2023 first, Filippazzo 2015 only when absent; withhold flagged fits/multiplicity; fill blanks and explicitly supersede only class-estimated temperatures; no generic age or metallicity; RV uncertainty <=10 km/s, existing RV wins.", "objects": objects, "radialVelocities": velocities, "audit": audit}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    review = build_review()
    content = canonical_json(review)
    if args.write:
        OUTPUT.write_text(content)
    elif OUTPUT.read_text() != content:
        raise ValueError("Ultracool review does not reproduce")
    print(json.dumps({"audited": len(review["audit"]), "physicalRecords": len(review["objects"]), "velocityRecords": len(review["radialVelocities"])}))
