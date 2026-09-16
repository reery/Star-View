"""Normalized, JSON-serializable records for offline catalog authoring."""

from dataclasses import asdict, dataclass
from typing import Any, Literal

FieldStatus = Literal[
    "measured",
    "model-derived",
    "estimated",
    "inherited",
    "withheld",
    "conflicting",
    "unknown",
]
MatchMethod = Literal[
    "star-view-id",
    "gaia-dr3-id",
    "simbad-id",
    "reviewed-alias",
    "position-candidate",
]


def _require_identifier(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty string")


class JsonRecord:
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class NormalizedSourceRecord(JsonRecord):
    identity: "IdentityRecord"
    astrometry: "AstrometryObservation | None" = None
    physical: tuple["PhysicalObservation", ...] = ()
    raw: dict[str, Any] | None = None


@dataclass(frozen=True)
class SourceSnapshot(JsonRecord):
    source_id: str
    release: str
    retrieved: str
    sha256: str
    query: str | None = None
    source_url: str | None = None

    def __post_init__(self) -> None:
        _require_identifier(self.source_id, "source_id")
        if len(self.sha256) != 64 or any(character not in "0123456789abcdef" for character in self.sha256):
            raise ValueError("sha256 must be a lowercase hexadecimal SHA-256 digest")


@dataclass(frozen=True)
class IdentityRecord(JsonRecord):
    source_id: str
    source_record_id: str
    star_view_id: str | None = None
    gaia_dr3_id: str | None = None
    simbad_id: str | None = None
    aliases: tuple[str, ...] = ()
    component: str | None = None
    system_role: str | None = None

    def __post_init__(self) -> None:
        _require_identifier(self.source_id, "source_id")
        _require_identifier(self.source_record_id, "source_record_id")
        for field, value in (("star_view_id", self.star_view_id), ("gaia_dr3_id", self.gaia_dr3_id), ("simbad_id", self.simbad_id)):
            if value is not None:
                _require_identifier(value, field)


@dataclass(frozen=True)
class AstrometryObservation(JsonRecord):
    source_id: str
    source_record_id: str
    ra_deg: float
    dec_deg: float
    epoch: float
    parallax_mas: float
    pm_ra_cosdec_masyr: float
    pm_dec_masyr: float
    parallax_error_mas: float | None = None
    pm_ra_error_masyr: float | None = None
    pm_dec_error_masyr: float | None = None
    radial_velocity_kms: float | None = None
    radial_velocity_error_kms: float | None = None
    astrometry_ref: str | None = None
    radial_velocity_ref: str | None = None
    quality_flags: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _require_identifier(self.source_id, "source_id")
        _require_identifier(self.source_record_id, "source_record_id")
        if not 0 <= self.ra_deg < 360 or not -90 <= self.dec_deg <= 90:
            raise ValueError("astrometry coordinates are outside ICRS bounds")
        if self.parallax_mas <= 0:
            raise ValueError("parallax_mas must be positive")
        errors = (self.parallax_error_mas, self.pm_ra_error_masyr, self.pm_dec_error_masyr, self.radial_velocity_error_kms)
        if any(value is not None and value < 0 for value in errors):
            raise ValueError("astrometry uncertainties must be non-negative")
        if self.radial_velocity_kms is None and (self.radial_velocity_error_kms is not None or self.radial_velocity_ref is not None):
            raise ValueError("radial-velocity metadata requires a radial velocity")


@dataclass(frozen=True)
class PhysicalObservation(JsonRecord):
    source_id: str
    source_record_id: str
    field: Literal["mass_solar", "temperature_k", "luminosity_solar"]
    value: float
    uncertainty: float | None
    status: FieldStatus
    reference: str
    quality_flags: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _require_identifier(self.source_id, "source_id")
        _require_identifier(self.source_record_id, "source_record_id")
        _require_identifier(self.reference, "reference")
        if self.value <= 0 or self.uncertainty is not None and self.uncertainty < 0:
            raise ValueError("physical values must be positive and uncertainties non-negative")


@dataclass(frozen=True)
class IdentityCandidate(JsonRecord):
    source_id: str
    source_record_id: str
    method: MatchMethod
    accepted: bool
    separation_arcsec: float | None = None
    reason: str | None = None


@dataclass(frozen=True)
class FieldDecision(JsonRecord):
    field: str
    status: FieldStatus
    selected_source_id: str | None
    selected_source_record_id: str | None
    reason: str
    competing_observations: tuple[dict[str, Any], ...] = ()