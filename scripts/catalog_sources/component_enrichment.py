"""Reviewed resolved-component supplements, applied after aggregate splitting.

The frozen plan identifies individuals by stable ID and, for the compilation,
exact Gaia DR3 ID. Systemic RVs supply approximate bulk motion, never an orbit.
"""

import json
import math
import re
from functools import cache
from pathlib import Path

import astropy.units as units
from astropy.coordinates import SkyCoord

from .enrichment import FIELDS, derive_physical, estimate_temperature
from .snapshots import sha256, verify_sha256
from .metallicity import metallicity_kind

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "catalog-work/star-systems/reviewed-component-properties.json"
PHYSICAL_FIELDS = (*FIELDS, "absolute_mag")


@cache
def component_plan():
    plan = json.loads(PLAN.read_text())
    for path, digest in plan["inputSha256"].items():
        verify_sha256(ROOT / path, digest)
    return plan


def component_sources():
    return component_plan()["sources"]


def component_plan_sha256():
    component_plan()
    return sha256(PLAN)


def enrich_component(row, provenance):
    review = component_plan()["objects"].get(row["id"])
    if not review:
        return
    if row["name"] != review["expectedName"]:
        raise ValueError(f"Reviewed component identity drifted: {row['id']}")
    if review.get("gaiaDr3Id") and provenance.get("gaiaDr3Id") != review["gaiaDr3Id"]:
        raise ValueError(f"Reviewed component Gaia identity drifted: {row['id']}")
    adopted = {}
    replaced = {}
    if review.get("spectralType") and not row["spectral_type"]:
        row["spectral_type"] = review["spectralType"]
        adopted["spectral_type"] = {"value": row["spectral_type"], **review["spectralTypeSource"]}
    for field, observation in review["fields"].items():
        if field not in PHYSICAL_FIELDS:
            raise ValueError(f"Unsupported component field: {field}")
        previous = row.get(field)
        replacement = observation.get("replaces")
        if replacement:
            if not previous or not math.isclose(float(previous), replacement["value"], rel_tol=0, abs_tol=1e-9):
                raise ValueError(f"Reviewed replacement input drifted: {row['id']}:{field}")
            if replacement.get("kind") and row.get("metallicity_kind") != replacement["kind"]:
                raise ValueError(f"Reviewed replacement quantity drifted: {row['id']}:{field}")
            replaced[field] = {"value": float(previous), "kind": row.get("metallicity_kind") if field == "metallicity_dex" else None}
            shared = provenance.get("sharedPhysicalEnrichment", {})
            if field in shared:
                replaced[field]["observation"] = shared.pop(field)
        elif previous:
            continue
        value = observation["value"]
        if not math.isfinite(value) or (field not in {"metallicity_dex", "absolute_mag"} and value <= 0):
            raise ValueError(f"Invalid reviewed component value: {row['id']}:{field}")
        row[field] = str(round(value)) if field == "temperature_k" else format(value, ".12g")
        if field == "metallicity_dex":
            row["metallicity_kind"] = metallicity_kind(observation.get("quantity"))
        adopted[field] = {"field": field, **observation}
    motion = review.get("systemicVelocity")
    if motion and not row.get("radial_velocity_kms"):
        row["radial_velocity_kms"] = str(motion["value"])
        row["radial_velocity_error_kms"] = str(motion["uncertainty"]) if motion.get("uncertainty") is not None else ""
        row["radial_velocity_ref"] = motion["reference"] + "; shared systemic velocity approximation"
        coordinate = SkyCoord(
            ra=float(row["ra_deg"]) * units.deg, dec=float(row["dec_deg"]) * units.deg,
            distance=1000 / float(row["parallax_mas"]) * units.pc,
            pm_ra_cosdec=float(row["pm_ra_cosdec_masyr"]) * units.mas / units.yr,
            pm_dec=float(row["pm_dec_masyr"]) * units.mas / units.yr,
            radial_velocity=motion["value"] * units.km / units.s,
        )
        for field, value in zip(("vx_kms", "vy_kms", "vz_kms"), coordinate.galactic.velocity.d_xyz.to_value(units.km / units.s), strict=True):
            row[field] = f"{value:.6f}"
        adopted["radial_velocity_kms"] = {"field": "radial_velocity_kms", "status": "systemic-approximation", **motion}
        row["notes"] = re.sub(r"Individual (?:radial velocity|RV)[^.]*\.", "Individual orbital velocity remains unknown; a shared systemic velocity is adopted below.", row["notes"])
        provenance["radialVelocity"] = {**adopted["radial_velocity_kms"], "sourceAlternative": provenance.get("radialVelocity")}
        provenance["astrometryScope"] = "Existing positional/proper-motion snapshot with a reviewed shared systemic radial velocity; approximate bulk space motion, without individual orbital velocity or orbital phase."
    # Only explicitly reviewed individual rows reach these derived fallbacks.
    if review.get("completeStefanBoltzmann"):
        adopted.update(estimate_temperature(row))
        adopted.update(derive_physical(row))
    if not adopted:
        return
    statuses = provenance.setdefault("fieldStatus", {})
    provenance["reviewedComponentEnrichment"] = {
        "review": review, "adopted": adopted,
        **({"replaced": replaced} if replaced else {}),
        "supersededFieldStatus": {field: statuses.get(field, "unknown") for field in adopted},
    }
    statuses.update({field: observation["status"] for field, observation in adopted.items()})
    if replaced:
        for observation in provenance.get("physicalObservations", []):
            if observation["field"] in replaced:
                observation["supersededBy"] = "reviewedComponentEnrichment"
        # Old generic supplement notes must not present replaced values as current.
        row["notes"] = re.sub(r" Shared exact-identity physical supplements \(([^)]+)\)\.",
                              lambda match: " Earlier shared physical supplements superseded for " + ", ".join(replaced) + ".", row["notes"])
    # Earlier withholding describes the aggregate inputs; superseding resolved
    # observations must not leave a current note saying the field is absent.
    def remaining_withheld(match):
        fields = [field for field in match.group(1).split(", ") if not row.get(field)]
        return " Withheld individual fields: " + ", ".join(fields) + "." if fields else ""
    row["notes"] = re.sub(r" Withheld individual fields: ([\w, ]+)\.", remaining_withheld, row["notes"])
    row["notes"] += " Reviewed component supplement: " + review["note"]
    row["notes"] += " Adopted fields: " + "; ".join(
        f"{field}: {item['reference']} ({item['status']})" for field, item in adopted.items()
    ) + "."
