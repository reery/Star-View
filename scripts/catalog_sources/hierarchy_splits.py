"""Explicit literature splits of catalog nodes that are still unresolved pairs."""

import copy
import hashlib
import json

FIELDS = ("temperature_k", "mass_solar", "luminosity_solar", "radius_solar",
          "metallicity_dex", "metallicity_kind", "age_gyr", "spectral_type",
          "absolute_mag", "apparent_mag", "known_planets")


def apply_hierarchy_splits(root, systems, pool, audit):
    path = root / "catalog-work/star-systems/reviewed-constellation-hierarchies.json"
    plan = json.loads(path.read_text())
    inputs = [path]
    for relative, digest in plan["inputSha256"].items():
        source = root / relative
        if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Hierarchy source drifted: {relative}")
        inputs.append(source)
    definitions = {system["id"]: system for system in systems}
    for review in plan["systems"]:
        system = definitions[review["systemId"]]
        expected = {member["starId"]: member["label"] for member in system["components"]}
        if expected != review["expectedComponents"]:
            raise ValueError(f"Reviewed hierarchy membership drifted: {system['id']}")
        identifier = review["parentStarId"]
        parent = pool[identifier]
        if parent["name"] != review["expectedParentName"]:
            raise ValueError(f"Reviewed hierarchy parent drifted: {identifier}")
        members = review["components"]
        if len(members) != 2 or members[0]["starId"] != identifier or members[1]["starId"] in pool:
            raise ValueError(f"Invalid reviewed binary split: {identifier}")
        source = copy.deepcopy(parent)
        previous_sources = source.pop("catalog_sources", [])
        retained = {"catalog_id": "reviewed-unresolved-parent", "record": source,
                    "scope": review["sourceScope"]}
        source_evidence = copy.deepcopy(audit["componentRecords"][identifier])
        for member in members:
            star = copy.deepcopy(parent)
            star.update(dict.fromkeys(FIELDS))
            star.update(id=member["starId"], name=member["name"], type="star", subtypes=[],
                        designations=list(dict.fromkeys([*(parent["designations"] if member["starId"] == identifier else []),
                                                        *member["designations"]])))
            for key in ("resolved_photometry", "radial_velocity_observation", "stellar_observations", "unresolved_photometry"):
                star.pop(key, None)
            star["catalog_sources"] = copy.deepcopy([*previous_sources, retained])
            if parent.get("apparent_mag") is not None:
                star["unresolved_photometry"] = {
                    "magnitude_v": parent["apparent_mag"], "error_mag": None,
                    "scope": review["sourceScope"], "source": "Retained unresolved parent catalog source",
                    "source_url": review["sourceUrl"],
                }
            star["notes"] = (review["note"] + " " + member["note"]
                             + " Position and bulk-motion inputs are shared from the former unresolved source; no individual orbital phase or velocity is inferred.")
            pool[member["starId"]] = star
            audit["componentRecords"][member["starId"]] = {
                "membership": {"reviewedHierarchy": review, "component": member["label"]},
                "retainedUnresolvedParent": {"record": copy.deepcopy(source), "evidence": copy.deepcopy(source_evidence)},
                "astrometryScope": "Shared unresolved parent astrometry and bulk motion, not a resolved orbital snapshot.",
            }
        index = next(i for i, component in enumerate(system["components"]) if component["starId"] == identifier)
        previous = system["components"][index]
        system["components"][index:index + 1] = [
            {**previous, "label": members[0]["label"]},
            {"starId": members[1]["starId"], "label": members[1]["label"]},
        ]
    return inputs
