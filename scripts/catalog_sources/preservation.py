"""Additive-data guards shared by authoring and baseline review."""

import copy
import json
import math

from .classification import prune_subtypes
from .precision import calculated_float


def retain_frozen_source(sources, frozen):
    """Keep a frozen snapshot verbatim without duplicating rounded magnitudes."""
    def comparable(source):
        record = source["record"].copy()
        for field in ("absolute_mag", "apparent_mag"):
            if record.get(field) is not None:
                record[field] = calculated_float(record[field])
        return {**source, "record": record}

    for index, previous in enumerate(sources):
        if comparable(previous) == comparable(frozen):
            sources[index] = copy.deepcopy(frozen)
            break
    else:
        sources.append(copy.deepcopy(frozen))


def known(value):
    return value is not None and value != "" and value != [] and value != {}


def lost_fields(previous, current, retained=(), prefix=""):
    """A retained record is an alternative scope, never an individual value."""
    missing = []
    for field, value in previous.items():
        if field in {"catalog_sources", "unresolved_photometry"} or not known(value):
            continue
        adopted = current.get(field)
        alternatives = [record.get(field) for record in retained]
        if isinstance(value, dict):
            missing.extend(lost_fields(value, adopted if isinstance(adopted, dict) else {},
                [entry for entry in alternatives if isinstance(entry, dict)], f"{prefix}{field}."))
        elif isinstance(value, list):
            kept = [entry for entry in [adopted, *alternatives] if isinstance(entry, list)]
            # A subtype implied by a more specific retained label is redundant, not lost.
            if not all(any(item in entry or field == "subtypes" and item not in prune_subtypes([*entry, item])
                           for entry in kept) for item in value):
                missing.append(f"{prefix}{field}")
        elif not known(adopted) and not any(known(entry) for entry in alternatives):
            missing.append(f"{prefix}{field}")
    return missing


def catalog_withheld(root):
    """Per catalog and record, valid source values a catalog withheld for a more accurate one, with their reasons."""
    withheld = {}
    for path in (root / "src/data/catalogs").glob("*/provenance.json"):
        objects = json.loads(path.read_text()).get("objects")
        if isinstance(objects, dict):
            withheld[path.parent.name] = {identifier: entry["withheldSourceValues"] for identifier, entry in objects.items()
                                          if isinstance(entry, dict) and entry.get("withheldSourceValues")}
    return withheld


def unretained(fields, previous, withheld):
    """Lost fields whose previous value is not kept, with a reason, among the record's withheld source values."""
    return [field for field in fields if not (field in withheld and withheld[field].get("reason")
            and math.isclose(float(previous[field]), withheld[field]["value"], rel_tol=1e-9))]


def field_value(record, field):
    """A record field, or a "catalog_sources.<catalog>.<field>" value of that retained source record."""
    if field.startswith("catalog_sources."):
        _, catalog, name = field.split(".", 2)
        sources = [source["record"] for source in record.get("catalog_sources", []) if source["catalog_id"] == catalog]
        return sources[0].get(name) if sources else None
    return record.get(field)


def reviewed_fields(path, identifier, old, new, missing, retirements):
    return [field for field in missing if not any(entry["path"] == path and entry["id"] == identifier
        and entry["field"] == field and entry["expectedPrevious"] == field_value(old, field)
        and entry["expectedCurrent"] == field_value(new, field) and entry.get("reason") for entry in retirements)]


def reviewed_record_removal(path, previous, retirements, load_review):
    """Permit a membership correction only while its complete old row survives."""
    for entry in retirements:
        if entry["path"] != path or entry["id"] != previous["id"] or not entry.get("reason"):
            continue
        review = load_review(entry["reviewPath"])
        for item in review["objects"]:
            if (item["id"] == previous["id"] and item.get("status") == "excluded-background-object"
                and item.get("reason") and item.get("references")
                and {"path": path, "record": previous} in item.get("previousCatalogRecords", [])):
                return True
    return False


def pool_losses(previous, proposed, retirements, withheld=None):
    path = "src/data/stellar-companions.json"
    current = {star["id"]: star for star in proposed["stars"]}
    errors = []
    for star in previous["stars"]:
        identifier = star["id"]
        adopted = current.get(identifier)
        if adopted is None:
            # A merged duplicate may retire only while its complete record and
            # native sources survive, scoped, on one remaining record.
            record = {key: value for key, value in star.items() if key != "catalog_sources"}
            if not any(any(source["record"] == record and source.get("scope") for source in other.get("catalog_sources", []))
                       and all(source in other["catalog_sources"] for source in star.get("catalog_sources", []))
                       for other in proposed["stars"]):
                errors.append(f"{identifier}: missing component record")
            continue
        sources = [source["record"] for source in adopted.get("catalog_sources", [])]
        missing = lost_fields(star, adopted, sources)
        observation = star.get("unresolved_photometry")
        if observation:
            missing += lost_fields(observation, adopted.get("unresolved_photometry", {}),
                [observation] if adopted.get("apparent_mag") is not None else [], "unresolved_photometry.")
        for source in star.get("catalog_sources", []):
            same_source = [entry["record"] for entry in adopted.get("catalog_sources", [])
                if entry["catalog_id"] == source["catalog_id"] and entry["record"]["id"] == source["record"]["id"]]
            lost = lost_fields(source["record"], same_source[0] if same_source else {}, same_source[1:])
            lost = unretained(lost, source["record"], (withheld or {}).get(source["catalog_id"], {}).get(source["record"]["id"], {}))
            missing += [f"catalog_sources.{source['catalog_id']}.{field}" for field in lost]
        missing = reviewed_fields(path, identifier, star, adopted, missing, retirements)
        if missing:
            errors.append(f"{identifier}: {', '.join(missing)}")
    return errors
