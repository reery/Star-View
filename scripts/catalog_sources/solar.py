"""Shared, reviewed solar reference values for offline catalog authoring."""

import hashlib
import json
from functools import cache
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[2] / "catalog-work/solar-reference/adopted.json"


@cache
def solar_reference():
    reference = json.loads(SOURCE.read_text())
    assert reference["schemaVersion"] == 1 and reference["id"] == "sun"
    return reference


def adopt_solar_reference(row):
    assert row["id"] == "sun"
    for field, observation in solar_reference()["fields"].items():
        row[field] = observation["value"]
    note = solar_reference()["note"]
    if note not in row.get("notes", ""):
        row["notes"] = f"{row.get('notes', '')} {note}".strip()
    return row


def solar_provenance():
    return {
        "id": "sun",
        "status": "adopted solar reference",
        "sourceFile": "catalog-work/solar-reference/adopted.json",
        "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "fields": solar_reference()["fields"],
    }
