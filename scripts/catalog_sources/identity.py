"""Identifier-first identity resolution with review-only positional candidates."""

from dataclasses import dataclass

from .models import IdentityCandidate, IdentityRecord, NormalizedSourceRecord


@dataclass(frozen=True)
class IdentityResolution:
    accepted: NormalizedSourceRecord | None
    candidates: tuple[IdentityCandidate, ...]


def resolve_identity(target: IdentityRecord, records: list[NormalizedSourceRecord], reviewed_aliases: set[tuple[str, str]] | None = None) -> IdentityResolution:
    reviewed_aliases = reviewed_aliases or set()
    levels = (
        ("star-view-id", lambda record: target.star_view_id is not None and record.identity.star_view_id == target.star_view_id),
        ("gaia-dr3-id", lambda record: target.gaia_dr3_id is not None and record.identity.gaia_dr3_id == target.gaia_dr3_id),
        ("simbad-id", lambda record: target.simbad_id is not None and record.identity.simbad_id == target.simbad_id),
        ("reviewed-alias", lambda record: any((target.source_record_id, alias) in reviewed_aliases for alias in record.identity.aliases)),
    )
    rejected = []
    for method, matches in levels:
        matched = [record for record in records if matches(record)]
        if len(matched) == 1:
            selected = matched[0]
            rejected.append(IdentityCandidate(selected.identity.source_id, selected.identity.source_record_id, method, True, reason="unique identifier match"))
            return IdentityResolution(selected, tuple(rejected))
        if len(matched) > 1:
            rejected.extend(IdentityCandidate(record.identity.source_id, record.identity.source_record_id, method, False, reason="ambiguous identifier match") for record in matched)
            return IdentityResolution(None, tuple(rejected))
    return IdentityResolution(None, tuple(rejected))


def positional_candidate(record: NormalizedSourceRecord, separation_arcsec: float) -> IdentityCandidate:
    return IdentityCandidate(record.identity.source_id, record.identity.source_record_id, "position-candidate", False, separation_arcsec, "manual review required")