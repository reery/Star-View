"""Audit missed component properties without changing adopted catalog values.

Raw CSV blanks are distinguished from effective companion-pool blanks. Exact
Gaia matches are evidence candidates, never automatic permission to enrich.
"""

import argparse
import collections
import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/star-systems"
OUTPUT = WORK / "component-source-gaps.json"
FIELDS = ("temperature_k", "mass_solar", "radius_solar", "luminosity_solar",
          "absolute_mag", "metallicity_dex", "age_gyr", "spectral_type")
SOURCE_FIELDS = {"temperature_k": "Teff", "mass_solar": "Mass",
                 "radius_solar": "Rad", "luminosity_solar": "LBol"}


def read(path):
    return json.loads(path.read_text())


def known(value):
    return value is not None and value not in ("", "--", "---")


def spectrum(value):
    return re.sub(r"\s+", "", value or "").replace(".0", "")


def build():
    paths = [ROOT / "src/data/stars.csv", *sorted((ROOT / "src/data/catalogs").glob("*/stars.csv"))]
    pool_path = ROOT / "src/data/stellar-companions.json"
    identity_path = ROOT / "src/data/stellar-system-identities.json"
    source_path = WORK / "catalog-companions-cifuentes.json"
    literature_path = WORK / "component-gap-literature-review.json"
    inputs = [*paths, pool_path, identity_path, source_path, literature_path]
    pool = read(pool_path)
    stars = {star["id"]: star for star in pool["stars"]}
    members = {c["starId"]: {"systemId": s["id"], "systemName": s["name"], "component": c["label"]}
               for s in pool["systems"] for c in s["components"]}
    aliases = {alias: c["starId"] for s in read(identity_path)["systems"] for c in s["components"]
               for alias in [c["starId"], *c.get("alternateStarIds", [])]}
    catalog_presence = collections.defaultdict(list)
    summaries, raw_gaps = [], []
    for path in paths:
        with path.open(newline="") as handle:
            rows = list(csv.DictReader(handle))
        catalog = "nearest-neighbors" if path.parent == ROOT / "src/data" else path.parent.name
        catalog_gaps = []
        for row in rows:
            identifier = aliases.get(row["id"], row["id"])
            catalog_presence[identifier].append(catalog)
            star = stars.get(identifier)
            if star is None:
                continue
            filled = [field for field in FIELDS if not known(row.get(field)) and known(star.get(field))]
            if filled:
                catalog_gaps.append({"catalogId": catalog, "sourceStarId": row["id"],
                    "starId": identifier, "name": star["name"], **members[identifier],
                    "fieldsAlreadySuppliedByPool": filled,
                    "interpretation": "Raw catalog-file gap; already supplied to the app by completeCatalogCompanions."})
        raw_gaps.extend(catalog_gaps)
        summaries.append({"catalogId": catalog, "sourceRows": len(rows),
            "componentRows": sum(aliases.get(r["id"], r["id"]) in stars for r in rows),
            "rawGapRowsAlreadyCompleted": len(catalog_gaps),
            "rawGapFieldsAlreadyCompleted": sum(len(r["fieldsAlreadySuppliedByPool"]) for r in catalog_gaps)})

    by_gaia = collections.defaultdict(set)
    for star in stars.values():
        for designation in star["designations"]:
            match = re.fullmatch(r"Gaia DR3 (\d+)", designation)
            if match:
                by_gaia[match[1]].add(star["id"])
    candidates, shared_sources, spectra = [], [], []
    for source in read(source_path)["rows"]:
        matched = sorted(by_gaia.get(source["GaiaDR3"], []))
        if not matched:
            continue
        if len(matched) > 1:
            shared_sources.append({"gaiaDr3Id": source["GaiaDR3"], "sourceName": source["Name"],
                "sourceComponent": source["Comp"], "matchedStarIds": matched,
                "decision": "Shared unresolved Gaia identifier; cannot assign source values to individual leaves."})
            continue
        identifier = matched[0]
        star = stars[identifier]
        missing = {field: {"value": float(source[column]),
            "uncertainty": float(source["e_" + column]) if known(source.get("e_" + column)) else None,
            "sourceMethod": source.get("r_" + column)}
            for field, column in SOURCE_FIELDS.items()
            if not known(star.get(field)) and known(source.get(column)) and float(source[column]) > 0}
        source_spectrum = spectrum(source["SpType"])
        adopted_spectrum = spectrum(star["spectral_type"])
        if source_spectrum and (not adopted_spectrum or
                re.fullmatch(r"[OBAFGKM]\d(?:\.\d+)?", adopted_spectrum) and source_spectrum == adopted_spectrum + "V"):
            spectra.append({"starId": identifier, "name": star["name"], **members[identifier],
                "currentSpectrum": star["spectral_type"], "sourceSpectrum": source["SpType"],
                "sourceRecordId": source["IDstar"], "category": source["Category"],
                "decision": "Missing or incomplete classification; review exact component scope before adoption."})
        if not missing:
            continue
        holds = []
        if source["Category"] == "3":
            holds.append("Excluded by generic Category=3 companion-source filter")
        if not re.fullmatch(r"[A-Z][a-z]?", source["Comp"]):
            holds.append("Source component is an aggregate/hierarchy")
        if source["Comp"] != members[identifier]["component"]:
            holds.append("Published component label differs from the internal leaf; hierarchy mapping needs review")
        if source["SB"]:
            holds.append("Source is flagged spectroscopic: " + source["SB"])
        if source["Candidate"] == "T" or source["Type"] != "Multiple":
            holds.append("Source includes candidate multiplicity")
        flags = [key for key in ("crit1", "crit2", "crit3", "crit4", "crit5", "crit6") if source[key] == "T"]
        if flags:
            holds.append("Gaia astrometric/photometric/spectroscopic quality or multiplicity criteria flagged: " + ", ".join(flags))
        if "Withheld individual fields:" in star["notes"] or "Unresolved parent" in star["notes"]:
            holds.append("Existing explicit withholding/split-parent scope")
        if star["type"] == "white_dwarf":
            holds.append("White dwarf: review dedicated literature; M-dwarf calibration does not apply")
        elif star["type"] != "star":
            holds.append("Object type conflicts with an ordinary M-dwarf calibration")
        if source.get("r_Mass") == "This work" and not 7.5 <= float(source["GMAG"]) <= 14:
            holds.append("Outside calibrated absolute-G range 7.5-14")
        if source.get("r_Mass") == "Pec13":
            holds.append("Generic spectral-class mass; not an independent individual mass measurement")
        if adopted_spectrum and source_spectrum and adopted_spectrum != source_spectrum and not source_spectrum.startswith(adopted_spectrum):
            holds.append("Published and adopted spectral classifications differ")
        candidates.append({"starId": identifier, "name": star["name"], **members[identifier],
            "catalogIds": sorted(set(catalog_presence[identifier])), "gaiaDr3Id": source["GaiaDR3"],
            "sourceRecordId": source["IDstar"], "sourceName": source["Name"],
            "sourceComponent": source["Comp"], "sourceCategory": source["Category"],
            "sourceSpectrum": source["SpType"], "sourceAbsoluteG": source["GMAG"],
            "sourceQuality": {key: source.get(key) for key in ("RUWE", "IPDfmp", "crit1", "crit2", "crit3", "crit4", "crit5", "crit6")},
            "missingFieldsWithSourceCandidates": missing, "reviewReasons": holds,
            "decision": "Research candidate only; no automatic adoption. Exact Gaia ID alone does not establish leaf scope."})

    literature = []
    for review in read(literature_path)["objects"]:
        identifier = review["starId"]
        star = stars[identifier]
        if star["name"] != review["expectedName"] or any(members[identifier][k] != review[k] for k in ("systemId", "component")):
            raise ValueError("Literature review component identity drifted: " + identifier)
        missing = [field for field in review["fields"] if not known(star.get(field))]
        if missing:
            literature.append({"starId": identifier, "name": star["name"], **members[identifier],
                "catalogIds": sorted(set(catalog_presence[identifier])),
                "missingFieldsWithPublishedEvidence": missing,
                "evidence": {field: review["fields"][field] for field in missing},
                "caveat": review["caveat"], "adoptionStatus": review["adoptionStatus"]})

    stale = [{"starId": star["id"], "name": star["name"], **members[star["id"]],
        "availableMagnitude": star["absolute_mag"],
        "staleText": "Component-resolved Johnson V not independently established; multi-star system V withheld."}
        for star in stars.values() if known(star.get("absolute_mag")) and "multi-star system V withheld" in star["notes"]]
    return {
        "schemaVersion": 1, "reviewedOn": "2026-10-16", "catalogChangesApplied": False,
        "scope": "All six bundled stellar CSVs and all shared effective component records. Exact-ID frozen Cifuentes source comparison plus a targeted primary-literature review. Not an exhaustive literature search of every stellar object or every nullable field.",
        "policy": "Raw source-file gaps are separated from effective app gaps. Source candidates, source alternatives and hierarchy/type conflicts must be reviewed; no catalog values or memberships are changed by this audit.",
        "inputSha256": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in inputs},
        "summary": {"catalogs": len(paths), "sharedSystems": len(pool["systems"]), "effectiveComponents": len(stars),
            "rawGapRowsAlreadyCompleted": len(raw_gaps),
            "rawGapDistinctComponentsAlreadyCompleted": len({r["starId"] for r in raw_gaps}),
            "rawGapFieldsAlreadyCompleted": sum(len(r["fieldsAlreadySuppliedByPool"]) for r in raw_gaps),
            "frozenSourcePhysicalCandidates": len(candidates),
            "frozenSourcePhysicalCandidateFields": sum(len(r["missingFieldsWithSourceCandidates"]) for r in candidates),
            "category3PhysicalCandidates": sum(r["sourceCategory"] == "3" for r in candidates),
            "missingOrIncompleteSpectraWithSourceCandidates": len(spectra),
            "primaryLiteratureGapComponents": len(literature),
            "primaryLiteratureMissingFields": sum(len(r["missingFieldsWithPublishedEvidence"]) for r in literature),
            "staleWithholdingNotes": len(stale)},
        "catalogs": summaries, "rawCatalogGapsAlreadyCompleted": raw_gaps,
        "primaryLiteratureGaps": literature, "frozenSourcePhysicalCandidates": candidates,
        "missingOrIncompleteSpectra": spectra, "sharedGaiaSourcesNotIndividual": shared_sources,
        "staleWithholdingNotes": stale,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Read-only comparison against the saved audit")
    args = parser.parse_args()
    payload = build()
    content = json.dumps(payload, indent=2) + "\n"
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            raise SystemExit("Component source-gap audit is stale; regenerate and review it.")
    else:
        OUTPUT.write_text(content)
    print(json.dumps(payload["summary"], indent=2))


if __name__ == "__main__":
    main()
