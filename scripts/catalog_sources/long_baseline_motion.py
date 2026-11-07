"""Long-baseline proper motions for system members, which take their motion from the companion pool."""
import json

PLAN = "src/data/long-baseline-motion.json"


def apply_long_baseline_motion(root, systems, pool, audit):
    plan = json.loads((root / PLAN).read_text())
    adopted = plan["objects"]
    applied = []
    for system in systems:
        members = [pool[component["starId"]] for component in system["components"] if component["starId"] in pool]
        records = audit["componentRecords"]
        # Reviewed common motion already carries its own reviewed proper motion.
        if any("SystemMotion" in key for star in members for key in records.get(star["id"], {})):
            continue
        for star in members:
            entry = adopted.get(star["id"])
            raw = star.get("raw_astrometry")
            if not entry or not raw or [raw["pm_ra_cosdec_masyr"], raw["pm_dec_masyr"]] != entry["previous"]:
                continue
            # Members that share one velocity vector move together, so all of them take the change.
            shared = [other for other in members if star["vx_kms"] is not None and other["vx_kms"] == star["vx_kms"]] or [star]
            for member in shared:
                if (member.get("raw_astrometry") or {}).get("pm_ra_cosdec_masyr") != entry["previous"][0]:
                    continue
                retain_and_update(member, entry)
                applied.append(member["id"])
    audit["longBaselineMotion"] = {"applied": sorted(applied), "policy": plan["policy"]}
    return [root / PLAN]


def retain_and_update(star, entry):
    raw = star["raw_astrometry"]
    previous = [raw["pm_ra_cosdec_masyr"], raw["pm_dec_masyr"]]
    # Retained source records share this dictionary, so they must keep the old values.
    star["raw_astrometry"] = {**raw, "pm_ra_cosdec_masyr": entry["pm_ra_cosdec_masyr"], "pm_ra_error_masyr": entry["pm_ra_error_masyr"],
                              "pm_dec_masyr": entry["pm_dec_masyr"], "pm_dec_error_masyr": entry["pm_dec_error_masyr"],
                              "astrometry_ref": f"{raw.get('astrometry_ref') or ''}; proper motion 2021ApJS..254...42B (Hipparcos-Gaia long baseline)"}
    if star["vx_kms"] is not None:
        star["vx_kms"], star["vy_kms"], star["vz_kms"] = (round(star[axis] + delta, 6) for axis, delta in zip(("vx_kms", "vy_kms", "vz_kms"), entry["delta_velocity_kms"]))
    star["notes"] += f" Proper motion is the Hipparcos-Gaia long-baseline value (Brandt 2021), replacing the catalog's {previous[0]}, {previous[1]} mas/yr."
