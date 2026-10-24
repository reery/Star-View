"""Explicit shared motion for reviewed constellation systems.

The adopted vector is a rendering/linear-propagation approximation. Original
component RVs, astrometry, errors and velocities remain separate source records.
"""
import copy
import hashlib
import json
import math

from .bright_system_motion import bulk_vector
from .preservation import retain_frozen_source

PLAN = "catalog-work/star-systems/reviewed-constellation-motion.json"
VELOCITY = ("vx_kms", "vy_kms", "vz_kms")


def motion_input(star):
    return {field: copy.deepcopy(star.get(field)) for field in ("raw_astrometry", *VELOCITY)}


def apply_constellation_motion(root, systems, pool, audit, plan_path=PLAN, audit_key="constellationMotion"):
    path = root / plan_path
    plan = json.loads(path.read_text())
    inputs = [path]
    for relative, digest in plan["inputSha256"].items():
        source = root / relative
        if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Constellation motion source drifted: {relative}")
        inputs.append(source)
    definitions = {system["id"]: system for system in systems}
    seen = set()
    for review in plan["systems"]:
        system = definitions.get(review["systemId"])
        members = {c["starId"]: c["label"] for c in system["components"]} if system else {}
        if not system or system["name"] != review["expectedName"] or members != review["expectedComponents"]:
            raise ValueError(f"Constellation motion membership drifted: {review['systemId']}")
        primary = review["primaryStarId"]
        if primary != system["components"][0]["starId"]:
            raise ValueError(f"Constellation motion primary drifted: {review['systemId']}")
        donor = review.get("motionSourceStarId", primary)
        if donor not in members:
            raise ValueError(f"System motion donor identity drifted: {review['systemId']}")
        excluded = review.get("excludedComponents", {})
        if set(review["expectedInputs"]) | set(excluded) != set(members) or not all(excluded.values()):
            raise ValueError(f"Unreviewed constellation motion target: {review['systemId']}")
        if set(review["expectedInputs"]) & set(excluded):
            raise ValueError(f"Excluded constellation motion target: {review['systemId']}")
        rv = review["radialVelocity"]
        if not math.isfinite(rv["valueKms"]) or rv["status"] not in {
                "published-systemic", "compiled-primary-proxy", "published-subsystem-proxy", "measured-wide-companion-proxy"}:
            raise ValueError(f"Invalid constellation RV: {review['systemId']}")
        if rv["uncertaintyKms"] is not None and (
                rv.get("uncertaintyKind") != "1-sigma" or rv["uncertaintyKms"] <= 0):
            raise ValueError(f"Invalid constellation RV uncertainty: {review['systemId']}")
        if not rv.get("reference") or not rv.get("sourceUrl") or not rv.get("scope"):
            raise ValueError(f"Missing constellation RV provenance: {review['systemId']}")
        # Always calculate the adopted vector from one common astrometric basis.
        # Component-specific proper motions cannot pull members apart over time.
        vector = bulk_vector(review["motionInputs"], rv["valueKms"])
        reference = f"{rv['reference']}; {rv['status']}; shared systemic velocity approximation"
        for identifier, expected in review["expectedInputs"].items():
            if identifier in seen or motion_input(pool[identifier]) != expected:
                raise ValueError(f"Constellation component motion input drifted: {identifier}")
            seen.add(identifier)
            star = pool[identifier]
            original = {key: copy.deepcopy(value) for key, value in star.items()
                        if key not in {"catalog_sources", "unresolved_photometry"}}
            raw = star.get("raw_astrometry")
            if raw is None:
                raw = copy.deepcopy(review["motionInputs"])
                star["raw_astrometry"] = raw
                raw["astrometry_ref"] += "; shared primary astrometry approximation"
            raw.update(radial_velocity_kms=rv["valueKms"],
                       radial_velocity_error_kms=rv["uncertaintyKms"], radial_velocity_ref=reference)
            star.update(zip(VELOCITY, vector))
            star.setdefault("catalog_sources", []).append({
                "catalog_id": plan.get("retainedCatalogId", "constellation-motion-before-20261019"),
                "scope": "Original component observations and adopted velocity before shared system propagation. Individual/source RVs include their original scope and may contain orbital motion; not the adopted common bulk velocity.",
                "record": original,
            })
            for source in plan.get("retainedPreviousAdoptions", {}).get(identifier, []):
                retain_frozen_source(star["catalog_sources"], source)
            evidence = audit["componentRecords"].setdefault(identifier, {})
            evidence["constellationSystemMotion"] = {
                "systemId": system["id"], "primaryStarId": primary, "radialVelocity": rv,
                "motionInputs": review["motionInputs"], "adoptedVectorKms": vector,
                "retainedOriginal": motion_input(original), "scope": review["scope"],
                **({"motionSourceStarId": donor} if donor != primary else {}),
            }
            star["notes"] += (f" Adopted common system motion from {pool[donor]['name']}: "
                f"RV {rv['valueKms']} km/s ({rv['reference']}; {rv['status']}). "
                "All adopted members use the same Galactic velocity vector for linear propagation; "
                "component orbital velocities are not modeled. Native positions, proper motions, "
                "parallaxes and their uncertainties are retained. Previous RVs, errors and vectors "
                "are retained as source observations. This adoption supersedes earlier motion "
                "assumptions in the source notes. " + review["scope"])
    audit[audit_key] = {"systems": len(plan["systems"]), "components": len(seen),
        "excludedComponents": {identifier: reason for review in plan["systems"]
            for identifier, reason in review.get("excludedComponents", {}).items()},
        "policy": plan["policy"]}
    return inputs
