"""Frozen, explicitly scoped RV approximations for bright-system components."""

import copy
import json
import math
import re

from .snapshots import verify_sha256

PLAN = "catalog-work/bright-stars/gap-motion-review.json"
ROTATION = ((-0.0548755604, -0.8734370902, -0.4838350155),
            (0.4941094279, -0.4448296300, 0.7469822445),
            (-0.8676661490, -0.1980763734, 0.4559837762))


def bulk_vector(raw, radial_velocity):
    """Sun-relative Galactic km/s; require a complete measured motion basis."""
    required = ("ra_deg", "dec_deg", "parallax_mas", "pm_ra_cosdec_masyr", "pm_dec_masyr")
    if any(raw.get(field) is None or not math.isfinite(raw[field]) for field in required):
        raise ValueError("Incomplete reviewed bright-system motion basis")
    if raw["parallax_mas"] <= 0 or not math.isfinite(radial_velocity):
        raise ValueError("Invalid reviewed bright-system parallax/RV")
    ra, dec = math.radians(raw["ra_deg"]), math.radians(raw["dec_deg"])
    direction = (math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec))
    east, north = (-math.sin(ra), math.cos(ra), 0), (-math.sin(dec) * math.cos(ra), -math.sin(dec) * math.sin(ra), math.cos(dec))
    scale = 4.74047 / raw["parallax_mas"]
    velocity = [scale * (raw["pm_ra_cosdec_masyr"] * east[i] + raw["pm_dec_masyr"] * north[i])
                + radial_velocity * direction[i] for i in range(3)]
    return [round(sum(a * b for a, b in zip(axis, velocity)), 6) for axis in ROTATION]


def apply_bright_system_motion(root, systems, pool, audit, hierarchy_reviews=()):
    path = root / PLAN
    manifest = json.loads((root / "catalog-work/shared-enrichment/source-manifest.json").read_text())
    verify_sha256(path, manifest["checksumsSha256"][PLAN])
    plan = json.loads(path.read_text())
    definitions = {system["id"]: system for system in systems}
    for review in plan["systems"]:
        review = copy.deepcopy(review)
        for split in hierarchy_reviews:
            if split["systemId"] != review["systemId"]:
                continue
            if review["expectedComponents"] != split["expectedComponents"]:
                raise ValueError(f"Motion hierarchy mapping drifted: {review['systemId']}")
            parent = split["parentStarId"]
            for member in split["components"]:
                review["expectedComponents"][member["starId"]] = member["label"]
                if parent in review["targetIds"] and member["starId"] not in review["targetIds"]:
                    review["targetIds"].append(member["starId"])
            review["hierarchyMapping"] = split
        system = definitions[review["systemId"]]
        members = {c["starId"]: c["label"] for c in system["components"]}
        if system["name"] != review["expectedName"] or members != review["expectedComponents"]:
            raise ValueError(f"Bright-system membership drifted: {system['id']}")
        if not set(review["targetIds"]).issubset(members) or review["donorStarId"] not in members:
            raise ValueError(f"Unreviewed bright-system RV target: {system['id']}")
        vector = bulk_vector(review["motionInputs"], review["valueKms"])
        for identifier in review["targetIds"]:
            star = pool[identifier]
            raw = star.get("raw_astrometry")
            if raw and raw.get("radial_velocity_kms") is not None:
                continue
            evidence = audit["componentRecords"].setdefault(identifier, {})
            original = {"raw_astrometry": copy.deepcopy(raw),
                        **{field: star.get(field) for field in ("vx_kms", "vy_kms", "vz_kms")},
                        "notes": star["notes"]}
            # The bulk vector has its own explicit donor basis. Retain native
            # component directions, proper motions, errors and epochs intact.
            if raw is None:
                raw = copy.deepcopy(review["motionInputs"])
                star["raw_astrometry"] = raw
                raw["astrometry_ref"] = (raw.get("astrometry_ref") or "") + "; shared system astrometry approximation"
            raw.update(radial_velocity_kms=review["valueKms"],
                       radial_velocity_error_kms=review["uncertaintyKms"],
                       radial_velocity_ref=review["reference"] + "; " + review["status"] + "; shared systemic velocity approximation")
            filled_vector = any(star.get(field) is None for field in ("vx_kms", "vy_kms", "vz_kms"))
            if filled_vector:
                star.update(zip(("vx_kms", "vy_kms", "vz_kms"), vector))
            evidence["brightSystemMotion"] = {"review": review, "retainedOriginal": original,
                "filledBulkVector": filled_vector,
                "vectorScope": "Donor astrometry with shared RV; existing non-null velocity vector retained independently. Native component proper motion need not reproduce the separately adopted bulk vector."}
            for source in review.get("retainedPreviousAdoptions", {}).get(identifier, []):
                if source not in star.get("catalog_sources", []):
                    star.setdefault("catalog_sources", []).append(copy.deepcopy(source))
            star["notes"] = re.sub(r"Individual (?:radial velocity|RV)[^.]*\.",
                                  "Individual orbital velocity remains unknown.", star["notes"])
            star["notes"] += (f" Shared system radial velocity approximation: {review['valueKms']} km/s "
                              f"({review['reference']}; {review['status']}). " + review["scope"])
    return [path]
