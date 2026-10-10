"""Apply scoped, exact-identity literature radial velocities to existing astrometry."""

import json
import math
from functools import cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


@cache
def reviewed_velocities():
    return json.loads((ROOT / "catalog-work/shared-enrichment/reviewed-ultracool.json").read_text())["radialVelocities"]


def enrich_reviewed_motion(row, main_id=None):
    from .enrichment import normalized_id, source_index
    _, identities, *_ = source_index()
    key = normalized_id(main_id or identities.get(row["id"]))
    review = reviewed_velocities().get(key)
    if review is None or row.get("radial_velocity_kms") or any(row.get(field) for field in ("vx_kms", "vy_kms", "vz_kms")) or row["type"] not in {"star", "brown_dwarf", "sub_brown_dwarf"}:
        return None
    if row["id"] not in review["starViewIds"]:
        raise ValueError(f"Reviewed radial velocity identity drifted: {key}")
    required = ("ra_deg", "dec_deg", "parallax_mas", "pm_ra_cosdec_masyr", "pm_dec_masyr")
    if any(not row.get(field) or not math.isfinite(float(row[field])) for field in required):
        return None
    if float(row["parallax_mas"]) <= 0:
        return None
    # Keep the frozen J2000 marker/membership. Velocities use the adopted raw
    # ICRS direction, distance and proper motion, as in the existing authoring.
    import astropy.units as units
    from astropy.coordinates import SkyCoord
    direction = SkyCoord(ra=float(row["ra_deg"]) * units.deg, dec=float(row["dec_deg"]) * units.deg,
                         distance=1000 / float(row["parallax_mas"]) * units.pc,
                         pm_ra_cosdec=float(row["pm_ra_cosdec_masyr"]) * units.mas / units.yr,
                         pm_dec=float(row["pm_dec_masyr"]) * units.mas / units.yr,
                         radial_velocity=review["value"] * units.km / units.s, frame="icrs")
    velocity = direction.galactic.velocity.d_xyz.to_value(units.km / units.s)
    for field, value in zip(("vx_kms", "vy_kms", "vz_kms"), velocity):
        row[field] = f"{value:.6f}"
    row.update(radial_velocity_kms=str(review["value"]), radial_velocity_error_kms=str(review["uncertainty"]), radial_velocity_ref=review["reference"])
    row["notes"] = row["notes"].replace("Transverse-only source motion; radial velocity unavailable or withheld.", "Full space motion using exact-object literature radial velocity.")
    row["notes"] += f" Reviewed radial velocity from {review['reference']} ({review['sourceRecordId']}); Galactic velocity uses retained source astrometry. Frozen J2000 position retained; static linear motion, no orbital model."
    return {**review, "status": "measured", "identity": key, "velocityKms": dict(zip(("vx_kms", "vy_kms", "vz_kms"), map(float, velocity))),
            "inputs": {field: float(row[field]) for field in required}, "positionPolicy": "Frozen J2000 marker retained"}
