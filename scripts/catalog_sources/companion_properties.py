"""Reviewed individual literature values for the shared companion pool.

Each adoption requires the exact system, member ID and label. Source tables are
frozen and hashed; an HD/WDS root alone never identifies a hierarchical member.
"""

import hashlib
import json
import math
import re
import copy

from .enrichment import FIELDS, derive_physical, estimate_temperature
from .precision import calculated_float

PROPERTY_FIELDS = ("spectral_type", *FIELDS, "absolute_mag")


def complete_properties(star, evidence):
    """Run existing nullable-field derivations after the last reviewed adoption."""
    match = re.search(r"Withheld individual fields: ([a-z_, ]+)\.", star["notes"])
    withheld = set(match[1].split(", ")) if match else set()
    row = {**star, "spectral_type": star["spectral_type"] or ""}
    for method in (estimate_temperature, derive_physical):
        previous_notes = row["notes"]
        adopted = False
        for field, observation in method(row).items():
            if star[field] is None and field not in withheld:
                star[field] = float(row[field])
                evidence[field] = observation
                adopted = True
            else:
                # A withheld input must not feed a later derivation.
                row[field] = star[field]
        if not adopted:
            row["notes"] = previous_notes
    star["notes"] = row["notes"]


def reconcile_component_notes(star, evidence):
    """Retain superseded source statements without presenting them as current."""
    superseded = []
    for field, statement in (
        ("absolute_mag", "Component-resolved Johnson V not independently established; multi-star system V withheld."),
        ("temperature_k", "No appropriate object-specific temperature adopted; dwarf sequence not applied."),
    ):
        if star.get(field) is not None and statement in star["notes"]:
            star["notes"] = star["notes"].replace(statement, "")
            superseded.append({"text": statement, "reason": f"Individual {field} is now available."})
    def remaining(match):
        original = match.group(0)
        fields = [field for field in match.group(1).split(", ") if star.get(field) is None]
        replacement = "Withheld individual fields: " + ", ".join(fields) + "." if fields else ""
        if replacement != original:
            superseded.append({"text": original, "reason": "Later reviewed individual values supersede part of this source withholding."})
        return replacement
    star["notes"] = re.sub(r"Withheld individual fields: ([a-z_, ]+)\.", remaining, star["notes"])
    if superseded:
        star["notes"] = re.sub(r" {2,}", " ", star["notes"]).strip()
        evidence.setdefault("supersededNotes", []).extend(superseded)


def apply_literature(root, path, systems, pool, audit):
    plan = json.loads(path.read_text())
    inputs = [path]
    for relative, digest in plan["inputSha256"].items():
        source = root / relative
        if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Component literature source drifted: {relative}")
        inputs.append(source)
    members = {(system["id"], member["starId"]): member["label"]
               for system in systems for member in system["components"]}
    for identifier, review in plan["objects"].items():
        star = pool.get(identifier)
        if not star or star["name"] != review["expectedName"] or members.get(
                (review["systemId"], identifier)) != review["component"]:
            raise ValueError(f"Reviewed literature component identity drifted: {identifier}")
        if review.get("expectedType") and star["type"] != review["expectedType"]:
            raise ValueError(f"Reviewed literature object type drifted: {identifier}")
        if review.get("gaiaDr3Id"):
            designation = "Gaia DR3 " + review["gaiaDr3Id"]
            matches = {sid for sid, candidate in pool.items() if designation in candidate.get("designations", [])}
            if matches != {identifier}:
                raise ValueError(f"Reviewed literature Gaia identity is not a unique component: {identifier}")
        evidence = audit["componentRecords"].setdefault(identifier, {})
        original_record = {key: copy.deepcopy(value) for key, value in star.items()
                           if key not in {"catalog_sources", "unresolved_photometry"}}
        previous_review = copy.deepcopy(evidence.get("reviewedLiterature"))
        adopted, retained, replaced = {}, {}, {}
        withheld = {}
        for field, observation in review.get("withheldFields", {}).items():
            if field not in PROPERTY_FIELDS or star.get(field) != observation.get("expectedPrevious") or not observation.get("reason"):
                raise ValueError(f"Reviewed component withholding drifted: {identifier}:{field}")
            withheld[field] = {**observation, "sourceEvidence": copy.deepcopy(evidence.get(field))}
            star[field] = None
            if field == "metallicity_dex":
                star["metallicity_kind"] = None
        if withheld:
            if not review.get("retainPreviousRecord"):
                raise ValueError(f"Component withholding requires retained source: {identifier}")
            star["notes"] += " Withheld individual fields: " + ", ".join(withheld) + "."
        for field, observation in review["fields"].items():
            if any(not observation.get(key) for key in ("status", "reference", "sourceUrl", "section")):
                raise ValueError(f"Missing component literature provenance: {identifier}:{field}")
            if field not in (*PROPERTY_FIELDS, "apparent_mag"):
                raise ValueError(f"Unsupported component literature field: {field}")
            value = observation["value"]
            if field == "spectral_type":
                if not isinstance(value, str) or not value.strip():
                    raise ValueError(f"Invalid component spectrum: {identifier}")
            elif isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or (
                    field not in {"metallicity_dex", "absolute_mag", "apparent_mag"} and value <= 0):
                raise ValueError(f"Invalid component literature value: {identifier}:{field}")
            if field == "metallicity_dex" and observation.get("quantity") not in {"[Fe/H]", "[M/H]"}:
                raise ValueError(f"Missing component abundance quantity: {identifier}")
            replacement = observation.get("replaces")
            if replacement is not None:
                previous, expected = star.get(field), replacement["value"]
                # Older reviews froze unrounded distance-modulus results.
                # Compare those guards at the same precision as new outputs.
                if field == "absolute_mag" and previous is not None:
                    previous, expected = calculated_float(previous), calculated_float(expected)
                if previous != expected:
                    raise ValueError(f"Reviewed literature replacement input drifted: {identifier}:{field}")
                replaced[field] = {"value": star[field], "sourceEvidence": copy.deepcopy(
                    (previous_review or {}).get("adopted", {}).get(field) or evidence.get(field))}
            elif star.get(field) is not None:
                retained[field] = {"value": star[field], "unusedLiterature": observation}
                continue
            # Keep the apparent/absolute pair consistent with existing photometry.
            if field == "apparent_mag" and star.get("absolute_mag") is not None and "absolute_mag" not in adopted:
                continue
            star[field] = value
            if field == "metallicity_dex":
                star["metallicity_kind"] = observation["quantity"]
            adopted[field] = observation
        if star["absolute_mag"] is None and star.get("apparent_mag") is not None:
            distance = math.hypot(star["x_pc"], star["y_pc"], star["z_pc"])
            if not math.isfinite(distance) or distance <= 0:
                raise ValueError(f"Invalid component photometry distance: {identifier}")
            star["absolute_mag"] = calculated_float(star["apparent_mag"] - 5 * math.log10(distance / 10))
            adopted["absolute_mag"] = {"value": star["absolute_mag"], "status": "derived",
                "method": "Component Johnson V and adopted catalog distance; no extinction correction",
                "inputs": {"apparent_mag": star["apparent_mag"], "distance_pc": calculated_float(distance)}}
        evidence["reviewedLiterature"] = {**review, "adopted": adopted, "retained": retained,
            **({"replaced": replaced} if replaced else {}),
            **({"withheld": withheld} if withheld else {}),
            **({"previousReview": previous_review} if previous_review else {})}
        if adopted or withheld:
            if review.get("retainPreviousRecord"):
                star.setdefault("catalog_sources", []).append({
                    "catalog_id": plan.get("retainedCatalogId", "constellation-literature-before-20261019"),
                    "scope": "Previous component adoption before the exact-component literature review. Retained original values, photometry, astrometry, uncertainties and provenance; superseded values are not the current adoption.",
                    "record": original_record,
                })
            star["notes"] += " Reviewed individual literature: " + review["note"]
    for identifier, star in pool.items():
        evidence = audit["componentRecords"].setdefault(identifier, {})
        complete_properties(star, evidence)
        reconcile_component_notes(star, evidence)
    return inputs


def property_coverage(pool):
    gaps = {identifier: [field for field in PROPERTY_FIELDS if star.get(field) is None]
            for identifier, star in pool.items()}
    return {"fields": list(PROPERTY_FIELDS),
        "available": {field: sum(star.get(field) is not None for star in pool.values())
                      for field in PROPERTY_FIELDS},
        "withoutProperties": [identifier for identifier, missing in gaps.items()
                              if len(missing) == len(PROPERTY_FIELDS)],
        "missingByComponent": {identifier: missing for identifier, missing in gaps.items() if missing}}
