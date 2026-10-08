"""Apply frozen, component-scoped adopted details to every containing catalog.

Catalog membership, stable IDs and display names remain catalog-specific. Source
measurements are retained in provenance; the shared review controls adopted data.
"""

import json
from functools import cache
from pathlib import Path

from .snapshots import sha256, verify_sha256

ROOT = Path(__file__).resolve().parents[2]
REVIEW = ROOT / "catalog-work/shared-enrichment/reviewed-objects.json"


@cache
def reviewed_objects():
    manifest = json.loads((REVIEW.parent / "source-manifest.json").read_text())
    verify_sha256(REVIEW, manifest["checksumsSha256"][str(REVIEW.relative_to(ROOT))])
    payload = json.loads(REVIEW.read_text())
    index = {}
    for key, review in payload["objects"].items():
        for identifier in review["starIds"]:
            if identifier in index:
                raise ValueError(f"Ambiguous shared object identity: {identifier}")
            index[identifier] = (key, review)
    return index


def adopt_shared_object(row, provenance=None):
    match = reviewed_objects().get(row["id"])
    if match is None:
        return
    key, review = match
    row.update(review["values"])
    row["notes"] = review["notes"]
    if provenance is None:
        return
    provenance["sharedObjectAdoption"] = {
        "recordId": key,
        "reviewSha256": sha256(REVIEW),
        "scope": review["scope"],
        "fields": list(review["values"]),
        "sourceSelections": review["sourceSelections"],
        "sourceEvidence": "Original measurements and catalog-specific provenance are retained; the shared adopted record supersedes them for these fields.",
    }
    for field in review["values"]:
        if "fields" in provenance:
            original = provenance["fields"].get(field)
            if original and original.get("sourceRefs") != [f"shared-object:{key}:{field}"]:
                provenance.setdefault("sourceFieldProvenance", {})[field] = original
            provenance["fields"][field] = {
                "status": "adopted" if review["values"][field] else "unknown",
                "sourceRefs": [f"shared-object:{key}:{field}"],
            }
        if "fieldStatus" in provenance:
            provenance["fieldStatus"][field] = "adopted" if review["values"][field] else "unknown"


def adopt_shared_objects(rows, provenance):
    entries = ({item["id"]: item for item in provenance}
               if isinstance(provenance, list) else provenance)
    for row in rows:
        adopt_shared_object(row, entries.get(row["id"]))
