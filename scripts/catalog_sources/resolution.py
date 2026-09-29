"""Per-field source selection that retains all competing observations."""

from .models import FieldDecision, PhysicalObservation

SOURCE_PRIORITY = {
    "existing": 0,
    "primary-paper": 1,
    "cifuentes-2020": 2,
    "mann-2019": 2,
    "mann-2015": 2,
    "gaia-dr3": 4,
    "spectral-estimate": 5,
}
FIELD_SOURCE_PRIORITY = {
    "mass_solar": {"mann-2019": 2, "cifuentes-2020": 3},
    "radius_solar": {"cifuentes-2020": 2, "mann-2015": 3},
}


def source_priority(field: str, source_id: str) -> int:
    return FIELD_SOURCE_PRIORITY.get(field, {}).get(source_id, SOURCE_PRIORITY.get(source_id, 99))


def resolve_physical_field(field: str, observations: list[PhysicalObservation]) -> tuple[PhysicalObservation | None, FieldDecision]:
    eligible = [item for item in observations if item.field == field and "outside-validity" not in item.quality_flags]
    competing = tuple(item.to_dict() for item in observations if item.field == field)
    if not eligible:
        return None, FieldDecision(field, "unknown", None, None, "No eligible observation", competing)
    eligible.sort(key=lambda item: (source_priority(field, item.source_id), item.source_record_id))
    selected = eligible[0]
    same_priority = [item for item in eligible if source_priority(field, item.source_id) == source_priority(field, selected.source_id)]
    if any(item.value != selected.value for item in same_priority[1:]):
        return None, FieldDecision(field, "conflicting", None, None, "Conflicting observations at the highest source priority", competing)
    return selected, FieldDecision(field, selected.status, selected.source_id, selected.source_record_id, "Selected by physical-property source priority", competing)