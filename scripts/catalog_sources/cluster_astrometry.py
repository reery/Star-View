"""Exact-identity distance review for the Phyllon Kissinou hierarchy."""
import copy
import hashlib
import json
import math

from .bright_system_motion import ROTATION, bulk_vector
from .precision import calculated_float

PLAN = "catalog-work/famous-cluster-stars/astrometry-review.json"


def position_at_j2000(raw):
    ra, dec = math.radians(raw["ra_deg"]), math.radians(raw["dec_deg"])
    direction = (math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec))
    east = (-math.sin(ra), math.cos(ra), 0)
    north = (-math.sin(dec) * math.cos(ra), -math.sin(dec) * math.sin(ra), math.cos(dec))
    years = 2000 - raw["epoch"]
    position = [1000 / raw["parallax_mas"] * (direction[i] + years / 206264806.247 * (
        raw["pm_ra_cosdec_masyr"] * east[i] + raw["pm_dec_masyr"] * north[i])) for i in range(3)]
    return [round(sum(a * b for a, b in zip(axis, position)), 9) for axis in ROTATION]


def apply_related_astrometry(review, systems, pool, audit):
    definitions = {s["id"]: s for s in systems}
    reference_inputs = {i: copy.deepcopy(star.get("raw_astrometry")) for i, star in pool.items()}
    for case in review.get("relatedSystems", []):
        system = definitions[case["systemId"]]
        if system["name"] != case["expectedName"] or {
                c["starId"]: c["label"] for c in system["components"]} != case["expectedComponents"]:
            raise ValueError(f"Related cluster hierarchy drifted: {system['id']}")
        for identifier, expected in case["expectedInputs"].items():
            star = pool[identifier]
            if (star["name"] != expected["name"] or star.get("raw_astrometry") != expected["rawAstrometry"]
                    or any(star[k] != value for k, value in expected["positionPc"].items())):
                raise ValueError(f"Related cluster astrometry input drifted: {identifier}")
            original = {k: copy.deepcopy(v) for k, v in star.items() if k != "catalog_sources"}
            if case["kind"] == "published-orbital-distance":
                source = case["source"]
                distance = source["distancePc"]
                previous_distance = math.hypot(*(star[k] for k in ("x_pc", "y_pc", "z_pc")))
                star.update({k: round(star[k] * distance / previous_distance, 9) for k in ("x_pc", "y_pc", "z_pc")})
                raw = star["raw_astrometry"]
                raw.update(parallax_mas=source["parallaxMas"], parallax_error_mas=source["parallaxErrorMas"],
                    pm_ra_cosdec_masyr=source["properMotionRaMasYr"], pm_ra_error_masyr=source["properMotionRaErrorMasYr"],
                    pm_dec_masyr=source["properMotionDecMasYr"], pm_dec_error_masyr=source["properMotionDecErrorMasYr"],
                    radial_velocity_kms=source["systemicRadialVelocityKms"], radial_velocity_error_kms=source["systemicRadialVelocityErrorKms"],
                    astrometry_ref="Torres et al. 2025, Table 6 joint orbital solution; shared system parallax/proper motion; retained J2000 reference direction; not independent component astrometry",
                    radial_velocity_ref="Torres et al. 2025, Table 6; published-systemic; shared systemic velocity approximation")
                star.update(zip(("vx_kms", "vy_kms", "vz_kms"), bulk_vector(raw, raw["radial_velocity_kms"])))
                for_record = case.get("previousEffectiveAdoptions", {}).get(identifier)
                if for_record:
                    star.setdefault("catalog_sources", []).append({"catalog_id": "cluster-previous-effective-motion-20261019",
                        "scope": "Previous effective component adoption, including the superseded compiled RV proxy and its complete native astrometry/uncertainties. Superseded by the published orbital solution.",
                        "record": copy.deepcopy(for_record)})
                scope = "Atlas uses the published 2025 orbital distance 136.2 +/-1.4 pc, instead of inherited old Hipparcos/MSC distance. Both members share the joint orbital proper motion and systemic RV; source errors belong to the system solution."
            elif case["kind"] == "preferred-member-distance":
                source = case["source"]
                distance = 1000 / source["nativeAstrometry"]["parallax_mas"]
                donor = case["sourceStarId"]
                if "Gaia DR3 " + source["gaiaDr3Id"] not in pool[donor]["designations"]:
                    raise ValueError(f"Preferred distance donor identity drifted: {donor}")
                raw = star["raw_astrometry"]
                if identifier in [donor, *case.get("sharedReferenceIds", [])]:
                    native = copy.deepcopy(source["nativeAstrometry"])
                    if native.get("radial_velocity_kms") is None:
                        native.update({k: raw[k] for k in ("radial_velocity_kms", "radial_velocity_error_kms", "radial_velocity_ref")})
                    raw = native
                    star["raw_astrometry"] = raw
                    star.update(zip(("x_pc", "y_pc", "z_pc"), position_at_j2000(raw)))
                else:
                    old_distance = math.hypot(*(star[k] for k in ("x_pc", "y_pc", "z_pc")))
                    star.update({k: round(star[k] * distance / old_distance, 9) for k in ("x_pc", "y_pc", "z_pc")})
                    raw.update(parallax_mas=source["nativeAstrometry"]["parallax_mas"],
                        parallax_error_mas=source["nativeAstrometry"]["parallax_error_mas"],
                        astrometry_ref=(raw.get("astrometry_ref") or "") + "; preferred shared member parallax from Gaia DR3 " + source["gaiaDr3Id"])
                if raw.get("radial_velocity_kms") is not None:
                    star.update(zip(("vx_kms", "vy_kms", "vz_kms"), bulk_vector(raw, raw["radial_velocity_kms"])))
                scope = source["scope"]
            elif case["kind"] == "unresolved-pair-reference-position":
                parent = pool[case["referenceStarId"]]
                if reference_inputs[case["referenceStarId"]] != case["expectedReferenceAstrometry"]:
                    raise ValueError("HD 74560 BC reference astrometry drifted")
                distance = math.hypot(*(parent[k] for k in ("x_pc", "y_pc", "z_pc")))
                star.update({k: parent[k] for k in ("x_pc", "y_pc", "z_pc")})
                star["raw_astrometry"] = copy.deepcopy(parent["raw_astrometry"])
                star["raw_astrometry"].update(radial_velocity_kms=None, radial_velocity_error_kms=None, radial_velocity_ref=None,
                    astrometry_ref="Unresolved HD 74560 BC reference: measured B direction/distance/proper motion shared approximately with C; not an independent C astrometric solution")
                scope = "HD 74560 C belongs to the 0.6-arcsecond BC visual pair. Its approximate reference position is B, not the Aa,Ab pair 76 arcseconds away. No individual C direction, orbital phase, radial velocity or bulk vector is invented."
            else:
                raise ValueError(f"Unknown reviewed cluster astrometry method: {case['kind']}")
            if star.get("apparent_mag") is not None:
                star["absolute_mag"] = calculated_float(star["apparent_mag"] - 5 * math.log10(distance / 10))
            star.setdefault("catalog_sources", []).append({"catalog_id": "cluster-related-astrometry-before-20261019",
                "scope": "Original component astrometry, photometry, physical fields, motion and uncertainties before the reviewed distance/reference-position correction. " + scope,
                "record": original})
            audit["componentRecords"].setdefault(identifier, {})["relatedClusterAstrometry"] = {
                "review": case, "distancePc": calculated_float(distance), "scope": scope}
            star["notes"] += " Reviewed cluster astrometry: " + scope


def apply_cluster_astrometry(root, systems, pool, audit):
    path = root / PLAN
    review = json.loads(path.read_text())
    inputs = [path]
    for relative, digest in review["inputSha256"].items():
        source = root / relative
        if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Cluster astrometry source drifted: {relative}")
        inputs.append(source)
    system = next((s for s in systems if s["id"] == review["systemId"]), None)
    if not system or system["name"] != review["expectedName"] or {
            c["starId"]: c["label"] for c in system["components"]} != review["expectedComponents"]:
        raise ValueError("Phyllon Kissinou astrometry hierarchy drifted")
    source_id = review["distanceSourceStarId"]
    distance = 1000 / review["parallaxMas"]
    for identifier, expected in review["expectedInputs"].items():
        star = pool[identifier]
        if star["name"] != expected["name"] or star.get("raw_astrometry") != expected["rawAstrometry"]:
            raise ValueError(f"Cluster component astrometry input drifted: {identifier}")
        original = {k: copy.deepcopy(v) for k, v in star.items() if k != "catalog_sources"}
        old_distance = math.hypot(*(star[k] for k in ("x_pc", "y_pc", "z_pc")))
        raw = star["raw_astrometry"]
        if identifier == source_id:
            raw = copy.deepcopy(review["sourceAstrometry"])
            star["raw_astrometry"] = raw
            star.update(zip(("x_pc", "y_pc", "z_pc"), position_at_j2000(raw)))
            star["designations"] = list(dict.fromkeys([*star["designations"], *review["sourceDesignations"]]))
        else:
            # The AB sky direction is retained. Only its adopted line-of-sight
            # distance changes; no orbital phase or resolved AB orbit is invented.
            star.update({k: round(star[k] * distance / old_distance, 9) for k in ("x_pc", "y_pc", "z_pc")})
            raw.update(parallax_mas=review["parallaxMas"], parallax_error_mas=review["parallaxErrorMas"],
                       astrometry_ref=(raw.get("astrometry_ref") or "")
                       + "; adopted shared C parallax; Gaia DR3 3958707782341673216; native AB astrometry retained as source")
        photometry = review.get("componentPhotometry", {}).get(identifier)
        if photometry:
            if star.get("apparent_mag") != photometry["expectedPrevious"]:
                raise ValueError(f"Cluster component photometry drifted: {identifier}")
            star["apparent_mag"] = photometry["magnitudeV"]
        if star.get("apparent_mag") is not None:
            star["absolute_mag"] = calculated_float(star["apparent_mag"] - 5 * math.log10(distance / 10))
        # Rescale only values explicitly tied to the former adopted distance.
        # Independently sourced model parameters keep their own source scope.
        rescaled = {}
        for field, exponent in review["distanceDependentFields"].get(identifier, {}).items():
            if star.get(field) is None:
                raise ValueError(f"Missing distance-dependent adoption: {identifier}:{field}")
            star[field] = calculated_float(star[field] * (distance / old_distance) ** exponent)
            rescaled[field] = {"before": original[field], "after": star[field], "distanceExponent": exponent}
        if raw.get("radial_velocity_kms") is not None:
            star.update(zip(("vx_kms", "vy_kms", "vz_kms"), bulk_vector(raw, raw["radial_velocity_kms"])))
        star.setdefault("catalog_sources", []).append({
            "catalog_id": "cluster-astrometry-before-20261019",
            "scope": ("Previous astrometry, photometry, physical values and velocity before the shared-distance review. Native measurements and their uncertainties are retained; previous geometry is not the adopted system distance."
                      + (" The six physical parameters are the unresolved WDS AB SED/Gaia fit, not individual A measurements; AB photometry and source identifiers retain their original scope." if identifier == "hip-61394" else "")),
            "record": original,
        })
        audit["componentRecords"].setdefault(identifier, {})["clusterAstrometry"] = {
            "review": review, "distancePc": calculated_float(distance), "rescaledFields": rescaled,
            "scope": "Measured C astrometry" if identifier == source_id else "Native AB direction/proper motion; C parallax adopted as an approximate shared system distance. Parallax error belongs to C, not an independent AB solution.",
        }
        star["notes"] += " Reviewed Phyllon Kissinou distance: C's exact 2MASS/Gaia crossmatch supplies the adopted parallax; A's flagged solution is retained as a source. RUWE(C)=1.523 is elevated, so this is a preferred shared-distance approximation, not uncertainty-free astrometry. " + review["scope"]
    return inputs
