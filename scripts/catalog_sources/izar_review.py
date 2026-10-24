"""Exact-identity Izar repair; common distance is an explicit geometry assumption."""
import copy
import hashlib
import json
import math

from .bright_system_motion import bulk_vector
from .cluster_astrometry import position_at_j2000
from .precision import calculated_float
from .preservation import retain_frozen_source

PLAN = "catalog-work/star-systems/izar-review.json"


def apply_izar_review(root, systems, pool, audit):
    path = root / PLAN
    review = json.loads(path.read_text())
    inputs = [path]
    for relative, digest in review["inputSha256"].items():
        source = root / relative
        if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Izar source drifted: {relative}")
        inputs.append(source)
    sources = json.loads(inputs[1].read_text())
    system = next(s for s in systems if s["id"] == review["systemId"])
    if system["name"] != review["expectedName"] or {
            c["starId"]: c["label"] for c in system["components"]} != review["expectedComponents"]:
        raise ValueError("Izar component membership drifted")
    distance = 1000 / review["distance"]["parallaxMas"]
    gaia = {row["source_id"]: row for row in sources["gaia"]["records"]}
    common = None
    for identifier, case in review["objects"].items():
        star = pool[identifier]
        previous = case["retainedPreviousEffective"]
        if star["name"] != case["expectedName"] or any(
                star.get(k) != previous.get(k) for k in (
                    "temperature_k", "mass_solar", "luminosity_solar", "radius_solar",
                    "metallicity_dex", "apparent_mag", "raw_astrometry", "x_pc", "y_pc", "z_pc")):
            raise ValueError(f"Izar adoption input drifted: {identifier}")
        retained = star.setdefault("catalog_sources", [])
        # Preserve the previous complete effective record and every native source,
        # including errors and earlier shared-motion provenance, verbatim.
        for entry in previous.get("catalog_sources", []):
            retain_frozen_source(retained, entry)
        retained.append({"catalog_id": "izar-before-20261020",
            "scope": "Superseded Izar effective adoption; full physical, photometric, astrometric and uncertainty values retained. " + case["physicalScope"],
            "record": {k: copy.deepcopy(v) for k, v in previous.items() if k != "catalog_sources"}})
        raw = copy.deepcopy(star["raw_astrometry"])
        gaia_id = {"bright-izar": "1279798794197267072",
                   "msc-14450+2704-d": "1279752168030730496"}.get(identifier)
        if gaia_id:
            native = gaia[gaia_id]
            raw.update(ra_deg=float(native["ra"]), dec_deg=float(native["dec"]), epoch=2016,
                pm_ra_cosdec_masyr=float(native["pmra"]), pm_ra_error_masyr=float(native["pmra_error"]),
                pm_dec_masyr=float(native["pmdec"]), pm_dec_error_masyr=float(native["pmdec_error"]))
            star["designations"] = list(dict.fromkeys([*star["designations"], "Gaia DR3 " + gaia_id]))
        else:
            # Exact B coordinates, not the inherited A reference position.
            raw.update(ra_deg=221.24645736371372, dec_deg=27.07498558868861, epoch=2000,
                pm_ra_cosdec_masyr=-43.525, pm_ra_error_masyr=.728,
                pm_dec_masyr=22.499, pm_dec_error_masyr=1.164)
            if "Gaia DR3 1279798789901591168" not in star["designations"]:
                raise ValueError("Izar B exact Gaia identity drifted")
        raw.update(parallax_mas=review["distance"]["parallaxMas"],
            parallax_error_mas=review["distance"]["parallaxErrorMas"],
            astrometry_ref="Measured component direction/proper motion (Gaia DR3 A/D, Gaia DR2 B); shared Hipparcos HIP 72105 parallax, approximate common-distance geometry; native solutions retained separately")
        star["raw_astrometry"] = raw
        star.update(zip(("x_pc", "y_pc", "z_pc"), position_at_j2000(raw)))
        star.update(case.get("physical", {}))
        if identifier.endswith("-b"):
            star["withheld_source_fields"] = ["metallicity_dex"]
        if identifier == "bright-izar":
            common = bulk_vector(raw, raw["radial_velocity_kms"])
        if identifier.endswith("-d"):
            star.update(type="brown_dwarf", apparent_mag=None, absolute_mag=None,
                        vx_kms=None, vy_kms=None, vz_kms=None)
            star["withheld_source_fields"] = ["apparent_mag", "absolute_mag", "vx_kms", "vy_kms", "vz_kms"]
            raw.update(radial_velocity_kms=None, radial_velocity_error_kms=None, radial_velocity_ref=None)
        else:
            star.update(zip(("vx_kms", "vy_kms", "vz_kms"), common))
            star["absolute_mag"] = calculated_float(star["apparent_mag"] - 5 * math.log10(distance / 10))
        # Earlier notes explicitly refer to superseded distance/motion decisions.
        # Their complete text remains in the retained effective/source records.
        star["notes"] = ("Reviewed Izar component: " + case["physicalScope"] + " "
            + review["distance"]["scope"]
            + (" A and B use one compiled-primary RV bulk-motion approximation; orbital velocities are not modeled."
               if not identifier.endswith("-d") else " Candidate membership and substellar classification remain provisional; no full space velocity or orbit adopted."))
        audit["componentRecords"].setdefault(identifier, {})["izarReview"] = {
            "reviewPath": PLAN, "physicalScope": case["physicalScope"],
            "sharedDistance": review["distance"], "nativeGaia": gaia.get(gaia_id),
            "outerCandidateDecision": review["outerCandidateDecision"]}
    return inputs
