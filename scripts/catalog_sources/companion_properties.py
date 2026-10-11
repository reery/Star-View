"""Reviewed individual literature values for the shared companion pool.

Each adoption requires the exact system, member ID and label. Source tables are
frozen and hashed; an HD/WDS root alone never identifies a hierarchical member.
"""

import hashlib
import json
import math
import re

from .enrichment import FIELDS, derive_physical, estimate_temperature

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
        adopted, retained = {}, {}
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
            if star.get(field) is not None:
                retained[field] = {"value": star[field], "unusedLiterature": observation}
                continue
            # Keep the apparent/absolute pair consistent with existing photometry.
            if field == "apparent_mag" and star.get("absolute_mag") is not None:
                continue
            star[field] = value
            if field == "metallicity_dex":
                star["metallicity_kind"] = observation["quantity"]
            adopted[field] = observation
        if star["absolute_mag"] is None and star.get("apparent_mag") is not None:
            distance = math.hypot(star["x_pc"], star["y_pc"], star["z_pc"])
            if not math.isfinite(distance) or distance <= 0:
                raise ValueError(f"Invalid component photometry distance: {identifier}")
            star["absolute_mag"] = star["apparent_mag"] - 5 * math.log10(distance / 10)
            adopted["absolute_mag"] = {"value": star["absolute_mag"], "status": "derived",
                "method": "Component Johnson V and adopted catalog distance; no extinction correction",
                "inputs": {"apparent_mag": star["apparent_mag"], "distance_pc": distance}}
        evidence = audit["componentRecords"].setdefault(identifier, {})
        evidence["reviewedLiterature"] = {**review, "adopted": adopted, "retained": retained}
        if adopted:
            star["notes"] += " Reviewed individual literature: " + review["note"]
    for identifier, star in pool.items():
        complete_properties(star, audit["componentRecords"].setdefault(identifier, {}))
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
