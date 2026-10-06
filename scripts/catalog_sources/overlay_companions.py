"""Reuse reviewed individual components for explicitly matched overlay landmarks."""

import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "catalog-work/star-systems/overlay-companions.json"
DEFINITIONS = ROOT / "src/data/star-systems.json"
CATALOG = ROOT / "src/data/catalogs/nearest-1000/stars.csv"
PROVENANCE = ROOT / "src/data/catalogs/nearest-1000/provenance.json"
INDIVIDUAL = ROOT / "catalog-work/star-systems/overlay-individual-components.json"


def individual_row(component, parent):
    row = dict.fromkeys(parent, "")
    ra, dec = math.radians(component["raDeg"]), math.radians(component["decDeg"])
    distance = 1000 / float(parent["parallax_mas"])
    direction = (math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec))
    rotation = ((-0.0548755604, -0.8734370902, -0.4838350155),
                (0.4941094279, -0.4448296300, 0.7469822445),
                (-0.8676661490, -0.1980763734, 0.4559837762))
    position = [distance * sum(a * b for a, b in zip(axis, direction)) for axis in rotation]
    row.update({"id": component["starId"], "name": component["name"], "type": component["type"],
                "spectral_type": component["spectralType"], "epoch": parent["epoch"],
                "constellation": parent["constellation"], "notes": component["note"],
                **dict(zip(("x_pc", "y_pc", "z_pc"), (f"{v:.9f}" for v in position)))})
    for field in ("astrometry_epoch", "parallax_mas", "parallax_error_mas", "pm_ra_cosdec_masyr",
                  "pm_ra_error_masyr", "pm_dec_masyr", "pm_dec_error_masyr"):
        row[field] = parent[field]
    row.update(ra_deg=str(component["raDeg"]), dec_deg=str(component["decDeg"]),
               astrometry_ref="MSC 2026-06-19 BC direction; shared primary parallax/proper motion (approximate)")
    if component["visualMagnitude"] is not None:
        row["absolute_mag"] = f"{component['visualMagnitude'] - 5 * math.log10(distance / 10):.6f}"
    return row


def expand_overlay(catalog_id, rows, provenance):
    plan = json.loads(PLAN.read_text())
    selections = plan["catalogs"].get(catalog_id, [])
    definitions = json.loads(DEFINITIONS.read_text())
    systems = {s["id"]: s for s in definitions["systems"]}
    with CATALOG.open(newline="") as handle:
        reviewed = {r["id"]: r for r in csv.DictReader(handle)}
    reviews = {r["id"]: r for r in json.loads(PROVENANCE.read_text())["objects"]}
    originals = {r["id"]: r for r in rows}
    individual = {c["starId"]: c for c in json.loads(INDIVIDUAL.read_text())["components"]}
    additions = []
    associations = []
    for selection in selections:
        system = systems[selection["systemId"]]
        members = {c["starId"]: c for c in system["components"]}
        if set(selection["memberIds"]) != set(members):
            raise ValueError(f"Overlay component plan drifted: {system['name']}")
        landmark_id, primary_id = selection["landmarkId"], selection["primaryId"]
        original = originals[landmark_id]
        primary = members[primary_id]
        if landmark_id not in [primary_id, *primary.get("alternateStarIds", [])]:
            raise ValueError(f"Unreviewed overlay identity: {landmark_id}")
        original_provenance = provenance[landmark_id]
        original_simbad = original_provenance.get("simbadId", original_provenance.get("queryId"))
        if selection["simbadId"] and original_simbad != selection["simbadId"]:
            raise ValueError(f"Frozen overlay identity drifted: {landmark_id}")
        for member_id in selection["memberIds"]:
            component = members[member_id]
            external = individual.get(member_id)
            if external:
                source = individual_row(external, original)
                source_provenance = {"individualComponentReview": external,
                                     "astrometryScope": "Shared BC direction; primary distance/proper motion approximation; no individual orbital motion.",
                                     "physicalStatus": "Unknown; catalogue estimated masses and blended photometry withheld."}
            elif member_id in reviewed:
                source, source_provenance = reviewed[member_id], reviews[member_id]
            elif member_id == primary_id:
                source, source_provenance = original, original_provenance
            else:
                raise ValueError(f"Missing reviewed individual record: {member_id}")
            target_id = landmark_id if member_id == primary_id else member_id
            replacement = member_id == primary_id and "individualComponentReview" in source_provenance
            existing = originals.get(target_id)
            if existing is not None and not replacement:
                row = existing
            else:
                # Replacing an aggregate must use the complete reviewed individual
                # row: copying blended spectrum, flux or RV would undo the review.
                row = dict(source, id=target_id)
                if replacement:
                    row["designations"] = "|".join(dict.fromkeys(filter(
                        lambda name: name and name != row["name"],
                        [*source.get("designations", "").split("|"), original["name"]],
                    )))
                    original.clear()
                    original.update(row)
                    row = original
                elif target_id not in originals:
                    additions.append(row)
                    originals[target_id] = row
                else:
                    raise ValueError(f"Companion already has an overlay landmark: {target_id}")
            association = {
                "systemId": system["id"], "systemName": system["name"],
                "component": component["label"], "canonicalStarId": member_id,
                "sourceCatalog": "reviewed-overlay-components" if external else ("nearest-1000" if member_id in reviewed else catalog_id), "sourceRef": system["sourceRef"],
                "identityEvidence": selection["identityEvidence"],
                "role": "primary-landmark" if member_id == primary_id else "reviewed-companion",
            }
            if member_id != primary_id or replacement:
                association["individualRecordProvenance"] = source_provenance
                row["notes"] += f" Reviewed companion expansion of {catalog_id}: {system['name']} {component['label']}; adopted {association['sourceCatalog']}:{member_id}."
            inherited_provenance = provenance.get(target_id, {})
            if replacement:
                inherited_provenance = {"landmarkSelection": inherited_provenance,
                                        **{key: inherited_provenance[key] for key in ("hip", "figureConstellations", "simbadId") if key in inherited_provenance}}
            provenance[target_id] = {**inherited_provenance, "componentAssociation": association}
        associations.append({"systemId": system["id"], "name": system["name"], "landmarkId": landmark_id,
                             "members": selection["memberIds"], "sourceRef": system["sourceRef"]})
    sources = [definitions["sources"][systems[s["systemId"]]["sourceRef"]] for s in selections]
    sources.append(definitions["sources"]["cns5-2023"])
    return [*rows, *additions], {
        "reviewedOn": plan["reviewedOn"], "policy": plan["policy"],
        "addedCompanions": len(additions), "systems": associations,
        "inputSha256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                        for p in (PLAN, DEFINITIONS, CATALOG, PROVENANCE, INDIVIDUAL,
                                  ROOT / "catalog-work/star-systems/msc-20260619-rigel.json",
                                  ROOT / "catalog-work/star-systems/msc-20260619.Readme")},
    }, [{"name": s["label"], "url": s["url"]} for s in sources]
