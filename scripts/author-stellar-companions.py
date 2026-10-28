"""Author the shared, component-scoped companion pool for every catalog.

Membership comes from explicit reviewed definitions, physical MSC hierarchies,
or the individual-component CARMENES compilation. Never match sky proximity.
Selection limits apply to the landmark, not its companions. Frozen measurements
and the fields withheld from unresolved sources are retained in the audit.
"""

import argparse
import collections
import copy
import csv
import hashlib
import json
import math
import re
from pathlib import Path
from statistics import median
from urllib.parse import urlencode

from catalog_sources.adapters import eligible_gaia_physical, read_gaia_tap
from catalog_sources.enrichment import GAIA_REPUBLICATIONS, estimate_temperature, derive_physical, flame_withheld
from catalog_sources.ordinary_binaries import orbit_pairs, matching_members
from catalog_sources.companion_properties import apply_literature, property_coverage
from catalog_sources.classification import prune_subtypes, spectral_labels
from catalog_sources.preservation import pool_losses, retain_frozen_source
from catalog_sources.shared_objects import REVIEW as SHARED_OBJECT_REVIEW, reviewed_objects
from catalog_sources.bright_system_motion import apply_bright_system_motion
from catalog_sources.constellation_motion import apply_constellation_motion
from catalog_sources.hierarchy_splits import apply_hierarchy_splits
from catalog_sources.cluster_astrometry import apply_cluster_astrometry, apply_related_astrometry
from catalog_sources.precision import calculated_float
from catalog_sources.izar_review import apply_izar_review

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/star-systems"
OUTPUT = ROOT / "src/data/stellar-companions.json"
IDENTITIES = ROOT / "src/data/stellar-system-identities.json"
FIELDS = ("temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr")
COMPOSITE = re.compile(r"\+\s*(?:[OBAFGKM](?:\d|:|$)|D[A-Z]|W[CN])", re.I)


def read_json(path):
    return json.loads(path.read_text())


def read_csv(path):
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def number(value):
    if value is None or str(value).strip() in {"", "--", "---"}:
        return None
    result = float(value)
    return result if math.isfinite(result) else None


def unique(values):
    return list(dict.fromkeys(value for value in values if value))


def retained_measurement(original, adopted):
    if isinstance(original, (int, float)) and isinstance(adopted, (int, float)):
        return math.isclose(original, adopted, rel_tol=1e-9, abs_tol=1e-9)
    if isinstance(original, dict) and isinstance(adopted, dict):
        return all(value is None or retained_measurement(value, adopted.get(key)) for key, value in original.items())
    if isinstance(original, list) and isinstance(adopted, list):
        return all(value in adopted for value in original)
    return original == adopted


def spectrum(value):
    return re.sub(r"\s+", "", value or "") or None


def csv_star(row, identities, stats):
    identity = identities.get(row["id"], {})
    star = {field: number(row.get(field)) for field in (*FIELDS, "absolute_mag", "epoch", "x_pc", "y_pc", "z_pc", "vx_kms", "vy_kms", "vz_kms")}
    star.update({field: row.get(field) or None for field in ("type", "id", "name", "spectral_type", "constellation", "metallicity_kind")})
    star["name"] = identity.get("sourceName", identity.get("name", star["name"]))
    preferred_alias = [identity["name"]] if identity.get("sourceName") else []
    star["designations"] = unique([*identity.get("designations", []), *preferred_alias, row["name"], *row.get("designations", "").split("|")])
    star["notes"] = row.get("notes", "")
    star["raw_astrometry"] = None
    if row.get("ra_deg"):
        star["raw_astrometry"] = {field: number(row.get(field)) for field in ("ra_deg", "dec_deg", "parallax_mas", "parallax_error_mas", "pm_ra_cosdec_masyr", "pm_ra_error_masyr", "pm_dec_masyr", "pm_dec_error_masyr", "radial_velocity_kms", "radial_velocity_error_kms")}
        star["raw_astrometry"].update(epoch=number(row["astrometry_epoch"]), astrometry_ref=row["astrometry_ref"], radial_velocity_ref=row.get("radial_velocity_ref") or None)
    adopted_stats = stats.get(row["id"], {})
    star.update(subtypes=unique(row.get("subtypes", "").split("|")) or adopted_stats.get("subtypes", []),
                known_planets=number(row.get("known_planets")) if row.get("known_planets") else adopted_stats.get("known_planets"))
    star["apparent_mag"] = number(row.get("apparent_mag"))
    if star["apparent_mag"] is None:
        star["apparent_mag"] = -26.74 if star["id"] == "sun" else calculated_float(star["absolute_mag"] + 5 * math.log10(math.hypot(star["x_pc"], star["y_pc"], star["z_pc"]) / 10)) if star["absolute_mag"] is not None else None
    return star


def place(star, ra, dec, parallax, pmra, pmdec, epoch, reference):
    if parallax is None or parallax <= 0 or ra is None or dec is None:
        return
    distance = 1000 / parallax
    alpha, delta = math.radians(ra), math.radians(dec)
    direction = (math.cos(delta) * math.cos(alpha), math.cos(delta) * math.sin(alpha), math.sin(delta))
    east = (-math.sin(alpha), math.cos(alpha), 0)
    north = (-math.sin(delta) * math.cos(alpha), -math.sin(delta) * math.sin(alpha), math.cos(delta))
    # Linear transverse propagation to J2000, with no assumed radial/orbital motion.
    position = [distance * (direction[i] + (2000 - epoch) / 206264806.247 * ((pmra or 0) * east[i] + (pmdec or 0) * north[i])) for i in range(3)]
    rotation = ((-0.0548755604, -0.8734370902, -0.4838350155),
                (0.4941094279, -0.4448296300, 0.7469822445),
                (-0.8676661490, -0.1980763734, 0.4559837762))
    star.update(zip(("x_pc", "y_pc", "z_pc"), (round(sum(a * b for a, b in zip(axis, position)), 9) for axis in rotation)))
    if pmra is not None and pmdec is not None:
        star["raw_astrometry"] = dict(ra_deg=ra, dec_deg=dec, epoch=epoch, parallax_mas=parallax,
            parallax_error_mas=None, pm_ra_cosdec_masyr=pmra, pm_ra_error_masyr=None,
            pm_dec_masyr=pmdec, pm_dec_error_masyr=None, radial_velocity_kms=None,
            radial_velocity_error_kms=None, astrometry_ref=reference, radial_velocity_ref=None)


def blank_component(identifier, name, parent):
    star = {field: None for field in (*FIELDS, "metallicity_kind", "absolute_mag", "apparent_mag", "vx_kms", "vy_kms", "vz_kms", "raw_astrometry", "spectral_type", "known_planets")}
    star.update({field: parent[field] for field in ("x_pc", "y_pc", "z_pc", "epoch", "constellation")})
    star.update(id=identifier, name=name, type="star", designations=[], subtypes=[], notes="")
    return star


def retain_unresolved_photometry(star, parent, identities, evidence):
    """Keep the observed catalog-source flux separate from individual fields.

    The source aperture/companion contribution is not deblended. This value
    must never feed individual absolute magnitude or physical derivations.
    """
    if parent["apparent_mag"] is None:
        return
    main = identities.get(parent["id"], {}).get("simbadId")
    photometry = {"magnitude_v": round(parent["apparent_mag"], 6), "error_mag": None,
                  "scope": f"{parent['name']} catalog source; unresolved component contributions",
                  "source": "Reviewed parent catalog Johnson V; inverse of its adopted distance modulus",
                  "source_url": "https://simbad.cds.unistra.fr/simbad/sim-id?" + urlencode({"Ident": main}) if main else None}
    star["unresolved_photometry"] = photometry
    evidence["unresolvedPhotometry"] = {**photometry, "sourceStarId": parent["id"],
        "sourceAbsoluteMagnitude": parent["absolute_mag"],
        "sourceDistancePc": calculated_float(math.hypot(parent["x_pc"], parent["y_pc"], parent["z_pc"])),
        "sourceNotes": parent["notes"],
        "policy": "Observed catalog-source photometry only; no individual component flux inferred."}


def build():
    inputs = [ROOT / "src/data/star-systems.json", ROOT / "src/data/object-designations.json", ROOT / "src/data/object-stats.json"]
    original = read_json(inputs[0])
    identities, stats = (read_json(path)["objects"] for path in inputs[1:])
    definitions = copy.deepcopy(original["systems"])
    aliases = {identifier: c["starId"] for s in definitions for c in s["components"] for identifier in [c["starId"], *c.get("alternateStarIds", [])]}
    stars = {}
    catalog_sources = []
    sources = [*sorted((ROOT / "src/data/catalogs").glob("*/stars.csv")),
               ROOT / "catalog-work/famous-cluster-stars/retired-catalog/stars.csv",
               ROOT / "catalog-work/bright-stars/retired-catalog/stars.csv"]
    for path in [*sorted(sources, key=lambda p: read_json(p.parent / "catalog.json")["id"]), ROOT / "src/data/stars.csv"]:
        inputs.append(path)
        catalog_id = read_json(path.parent / "catalog.json")["id"] if path.parent != ROOT / "src/data" else "nearest-neighbors"
        for row in read_csv(path):
            star = csv_star(row, identities, stats)
            catalog_sources.append({"catalog_id": catalog_id, "record": copy.deepcopy(star)})
            canonical = aliases.get(star["id"], star["id"])
            # Reviewed nearby individual records outrank legacy overlay copies.
            if canonical not in stars or star["id"] == canonical:
                star["id"] = canonical
                stars[canonical] = star
    identity_ids = collections.defaultdict(set)
    for identifier, star in stars.items():
        for name in star["designations"]:
            identity_ids[" ".join(name.split())].add(identifier)

    files = [WORK / f"catalog-companions-{name}.{suffix}" for name, suffix in
             [("msc", "json"), ("cifuentes", "json"), ("simbad", "csv"), ("atmospheres", "csv"), ("gaia", "csv"), ("overrides", "json")]]
    inputs += files
    msc, cifuentes = read_json(files[0]), read_json(files[1])
    hierarchy_path = WORK / "reviewed-regor.json"
    hierarchy_review = read_json(hierarchy_path)
    inputs.append(hierarchy_path)
    simbad_rows, atmosphere_rows = read_csv(files[2]), read_csv(files[3])
    gaia = {r.identity.gaia_dr3_id: r for r in read_gaia_tap(files[4])}
    simbad = {" ".join(r["query_id"].split()): r for r in simbad_rows}
    atmospheres = collections.defaultdict(list)
    for row in atmosphere_rows:
        atmospheres[row["oidref"]].append(row)
    gaia_oids = collections.defaultdict(set)
    for row in simbad_rows:
        for name in row["ids"].split("|"):
            if name.startswith("Gaia DR3 "):
                gaia_oids[name.split()[-1]].add(row["oid"])
    audit = {"sources": {}, "withheldHierarchies": [], "componentRecords": {}, "remainingCompositeRecords": []}
    pool = {}

    def enrich(star, source, evidence):
        withheld_match = re.search(r"Withheld individual fields: ([a-z_, ]+)\.", star["notes"])
        withheld = set(withheld_match[1].split(", ")) if withheld_match else set()
        if source and not COMPOSITE.search(source["sp_type"]) and not source["sp_type"].endswith("+"):
            star["type"] = "white_dwarf" if source["otype"] == "WD*" or source["sp_type"].startswith("D") else "brown_dwarf" if source["otype"] in {"BD*", "LM*"} else star["type"]
            star["spectral_type"] = spectrum(source["sp_type"]) or star["spectral_type"]
            star["designations"] = unique([*star["designations"], source["main_id"], *source["ids"].split("|")])
            evidence["simbad"] = {"queryId": source["query_id"], "mainId": source["main_id"], "oid": source["oid"], "spectralBibcode": source["sp_bibcode"]}
            observations = atmospheres[source["oid"]]
            for field, source_field in [("temperature_k", "teff"), ("metallicity_dex", "fe_h")]:
                valid = [r for r in observations if number(r[source_field]) is not None and (field != "temperature_k" or number(r[source_field]) > 0)
                         and r["bibcode"] not in GAIA_REPUBLICATIONS]
                if star[field] is None and field not in withheld and valid:
                    star[field] = median(number(r[source_field]) for r in valid)
                    if field == "temperature_k":
                        star[field] = round(star[field])
                    else:
                        star["metallicity_kind"] = "[Fe/H]"
                    evidence[field] = {"method": "median of published individual-object measurements in SIMBAD", "measurements": valid}
            for name in source["ids"].split("|"):
                if not name.startswith("Gaia DR3 ") or len(gaia_oids[name.split()[-1]]) != 1:
                    continue
                physical = eligible_gaia_physical(gaia.get(name.split()[-1]))
                gaia_temperature = physical["temperature_k"].value if "temperature_k" in physical else None
                invalid = flame_withheld(gaia_temperature, star["temperature_k"],
                                         star["metallicity_dex"] if star["metallicity_kind"] == "[Fe/H]" else None,
                                         physical["metallicity_dex"].value if "metallicity_dex" in physical else None)
                for field, observation in physical.items():
                    if star[field] is None and field not in withheld | invalid and star["type"] == "star":
                        star[field] = observation.value
                        if field == "metallicity_dex":
                            star["metallicity_kind"] = "[M/H]"
                        evidence[field] = observation.to_dict()
            # Use an individual V measurement; shared distance is approximate for close binaries.
            if star["absolute_mag"] is None and "absolute_mag" not in withheld and number(source["V"]) is not None:
                star["apparent_mag"] = number(source["V"])
                distance = math.hypot(star["x_pc"], star["y_pc"], star["z_pc"])
                star["absolute_mag"] = calculated_float(star["apparent_mag"] - 5 * math.log10(distance / 10))
                evidence["absolute_mag"] = {"method": "individual SIMBAD Johnson V and adopted component distance; no extinction correction", "V": star["apparent_mag"]}
        row = {"id": star["id"], "type": star["type"], "notes": star["notes"], "spectral_type": star["spectral_type"] or "", **{field: star[field] for field in FIELDS}}
        for method in (estimate_temperature, derive_physical):
            adopted = method(row)
            for field, observation in adopted.items():
                if star[field] is None and field not in withheld:
                    star[field] = number(row[field])
                    evidence[field] = observation
        star["notes"] = row["notes"] + " Component-scoped catalog measurements/estimates; details in catalog-work/star-systems/catalog-companions-audit.json."
        audit["componentRecords"][star["id"]] = evidence
        pool[star["id"]] = star

    # Every already reviewed system is available from any represented member.
    for system in definitions:
        for component in system["components"]:
            if component["starId"] not in stars:
                raise ValueError(f"Missing reviewed component {component['starId']}")
            pool[component["starId"]] = copy.deepcopy(stars[component["starId"]])

    # Explicit source-reviewed pairs also cover ordinary binaries absent from
    # MSC (three or more stars) and single-primary spectral classifications.
    reviewed_path = WORK / "catalog-companions-reviewed.json"
    reviewed = read_json(reviewed_path)
    inputs += [reviewed_path, *(ROOT / path for path in reviewed["frozenInputs"])]
    for review in reviewed["systems"]:
        parent = stars[review["parentStarId"]]
        system = {key: review[key] for key in ("id", "name", "sourceRef", "sourceUrl")}
        system["components"] = []
        # A reviewed hierarchy can complete a catalog-authored system in place,
        # keeping its stable ID while relabelling and adding exact members.
        extended = next((s for s in definitions if s["id"] == review["id"]), None)
        if extended:
            if {c["starId"] for c in extended["components"]} - {m["starId"] for m in review["components"]}:
                raise ValueError(f"Reviewed extension drops a component: {review['id']}")
            definitions.remove(extended)
            system = {**extended, **system, "components": []}
        for member in review["components"]:
            identifier, label = member["starId"], member["label"]
            if identifier in pool and not (extended and any(c["starId"] == identifier for c in extended["components"])):
                raise ValueError(f"Reviewed addition duplicates a component: {identifier}")
            star = pool.get(identifier) or (copy.deepcopy(stars[identifier]) if identifier in stars else blank_component(identifier, f"{review['name']} {label}", parent))
            star["name"] = f"{review['name']} {label}"
            star["type"] = member.get("type", star["type"])
            star["designations"] = unique([*star["designations"], *member["designations"]])
            if astrometry := member.get("astrometry"):
                place(star, astrometry["ra_deg"], astrometry["dec_deg"], astrometry["parallax_mas"],
                      astrometry["pm_ra_cosdec_masyr"], astrometry["pm_dec_masyr"], astrometry["epoch"], astrometry["astrometry_ref"])
                star["raw_astrometry"].update(astrometry)
            star["notes"] += " " + member["note"]
            pool[identifier] = star
            audit["componentRecords"][identifier] = {"membership": review["evidence"],
                "component": label, "astrometryScope": member["note"]}
            previous = next((c for c in extended["components"] if c["starId"] == identifier), {}) if extended else {}
            component = {**previous, **{key: member[key] for key in ("starId", "label", "alternateStarIds") if key in member}}
            system["components"].append(component)
        definitions.append(system)

    reviewed_ids = set(pool) | {alias for s in reviewed["systems"] for c in s["components"] for alias in c.get("alternateStarIds", [])}
    comp = collections.defaultdict(dict)
    for line in msc["tables"]["comp.tsv"]:
        row = list(map(str.strip, line.split("|")))
        comp[row[0]][row[8]] = row
    subsystems = collections.defaultdict(list)
    for line in msc["tables"]["sys.tsv"]:
        row = list(map(str.strip, line.split("|")))
        subsystems[row[0]].append(row)

    for wds, records in comp.items():
        matches = {}
        for label, row in records.items():
            matches[label] = sorted(set(identifier for key in [f"HIP {int(row[11])}", f"WDS J{wds}{label}"] for identifier in identity_ids.get(key, []) if int(row[11]) or key.startswith("WDS")), key=lambda identifier: (identifier.startswith("hip-"), identifier))
        matches = {label: ids for label, ids in matches.items() if ids}
        if not matches:
            continue
        # Existing literature-reviewed hierarchies have precedence over automatic MSC authoring.
        if any(identifier in reviewed_ids for ids in matches.values() for identifier in ids):
            continue
        trees = {}
        for row in subsystems[wds]:
            status = row[4]
            root = records.get("A", next(iter(records.values())))
            physical = "X" not in status and "?" not in status and (bool(re.search(r"(?:^|,)(?:V|v|S[123]|E|o)(?:,|$)", status)) or status.startswith("C") and int(root[20]) >= 3)
            if not physical:
                audit["withheldHierarchies"].append({"wds": wds, "primary": row[1], "secondary": row[2], "status": status})
                continue
            # A minimum substellar mass without a directly seen spectrum is not a classified star.
            if re.fullmatch(r"(?:S1|A)(?:,(?:S1|A|a))*", status) and not row[13] and not float(row[12]) and row[17] == "m" and float(row[16]) < 0.075:
                continue
            trees[row[3]] = row
        roots = [label for label in trees if label == "*" or not any(label in (r[1], r[2]) for r in trees.values())]
        if not roots:
            continue
        # Select the connected physical hierarchy containing the catalog landmark.
        def leaves(label, inherited=None):
            if label not in trees:
                return [(label, inherited)]
            row = trees[label]
            return [*leaves(row[1], (row, 0)), *leaves(row[2], (row, 1))]
        choices = [leaves(root) for root in roots]
        members = next((values for values in choices if any(label.startswith(matched) for label, _ in values for matched in matches)), [])
        # Regor's uncertain Aab-Ac link disconnects the confirmed Aa-Ab pair,
        # while two outer rows share the same MSC parent label. Reconcile only
        # the exact reviewed branches, without accepting the uncertain Ac star.
        if wds == hierarchy_review["wdsId"]:
            if [label for label, _ in members] != hierarchy_review["expectedAutomaticComponents"]:
                raise ValueError("Reviewed Regor automatic hierarchy drifted")
            members = []
            for member in hierarchy_review["components"]:
                branches = [row for row in subsystems[wds] if row[1:4] == member["branch"]]
                if len(branches) != 1 or member["label"] not in branches[0][1:3]:
                    raise ValueError(f"Reviewed Regor source branch drifted: {member['label']}")
                branch = branches[0]
                members.append((member["label"], (branch, branch[1:3].index(member["label"]))))
        if len(members) < 2:
            continue
        primary_label = next((label for label, _ in members if any(label.startswith(key) for key in matches)), members[0][0])
        original_label = max((key for key in matches if primary_label.startswith(key)), key=len)
        primary_ids = matches[original_label]
        parent = stars[primary_ids[0]]
        name = re.sub(r" [A-Z][a-z]?$", "", parent["name"])
        system = {"id": f"msc-{wds}", "name": name, "sourceRef": "catalog-companions-msc", "sourceUrl": msc["url"], "components": []}
        for label, ancestry in members:
            same_source = matches.get(label, [])
            ids = primary_ids if label == primary_label else same_source
            identifier = ids[0] if ids else f"msc-{wds}-{label.lower()}"
            # An unresolved subsystem record (Zubenelgenubi B) is the same catalog
            # object as its first leaf (Ba); alias it rather than leave a duplicate.
            branch = next((key for key in matches if key not in (label, original_label) and label.startswith(key)), None)
            alternates = matches[branch] if not ids and branch and label == next(leaf for leaf, _ in members if leaf.startswith(branch)) else []
            existing = stars.get(identifier)
            source_label = next((key for key in sorted(records, key=len, reverse=True) if label.startswith(key)), original_label)
            record = records[source_label]
            source = simbad.get(f"WDS J{wds}{label}")
            if source is None and label == source_label and int(record[12]):
                source = simbad.get(f"HD {int(record[12])}")
            unresolved = label != source_label or existing and COMPOSITE.search(existing["spectral_type"] or "")
            star = blank_component(identifier, f"{name} {label}", parent) if unresolved or existing is None else copy.deepcopy(existing)
            star["name"] = f"{name} {label}"
            star["designations"] = unique([*star["designations"], *(existing["designations"] if existing and label == primary_label else []), f"WDS J{wds}{label}", *(ids if ids else [])])
            evidence = {"membership": {"source": "MSC 2026-06-19", "wds": wds, "component": label, "subsystem": ancestry[0] if ancestry else None}, "astrometryScope": "Individual source direction when available; shared system distance/motion for unresolved close members; no orbital phase or individual radial velocity inferred."}
            if unresolved:
                evidence["withheldIntegratedFields"] = {field: existing[field] for field in (*FIELDS, "absolute_mag") if existing and existing[field] is not None}
                if existing:
                    retain_unresolved_photometry(star, existing, identities, evidence)
            inherited_spectrum = record[10] if label == source_label and "+" not in record[10] else None
            if not existing or unresolved:
                place(star, float(record[1]), float(record[2]), number(record[3]) or (parent["raw_astrometry"] or {}).get("parallax_mas"), number(record[5]), number(record[6]), 2000, "MSC 2026-06-19; shared parent astrometry for unresolved members (approximate)")
            if ancestry:
                branch, side = ancestry
                inherited_spectrum = branch[11 + side * 2] or inherited_spectrum
                visual = number(branch[10 + side * 2])
                # An unresolved parent's unchanged magnitude plus an unknown
                # secondary flux does not establish individual primary photometry.
                photometry_blended = label != source_label and side == 0 and not number(branch[12])
                if visual and not photometry_blended:
                    star["apparent_mag"] = visual
                    distance = math.hypot(star["x_pc"], star["y_pc"], star["z_pc"])
                    star["absolute_mag"] = calculated_float(visual - 5 * math.log10(distance / 10))
                    evidence["photometry"] = {"source": "MSC individual subsystem magnitude", "V": visual,
                        "distancePc": calculated_float(distance), "method": "Individual V and adopted component distance; no extinction correction"}
                elif visual:
                    evidence["withheldPhotometry"] = {"V": visual, "reason": "Unresolved parent flux; secondary brightness unavailable"}
            star["spectral_type"] = spectrum(inherited_spectrum)
            star["notes"] += f" MSC physical hierarchy {wds}, component {label}. Shared system distance for close components is approximate. Catalog magnitude/spectral-type masses and minimum companion masses are withheld."
            # Prefer the explicitly named individual measurement to a compiled alternate class.
            if source and not COMPOSITE.search(source["sp_type"]) and number(source["V"]) is not None:
                star["absolute_mag"] = None
            enrich(star, source, evidence)
            if wds == hierarchy_review["wdsId"]:
                evidence["reviewedHierarchy"] = hierarchy_review["membership"]
                if observation := hierarchy_review.get("observations", {}).get(identifier):
                    star["stellar_observations"] = observation
                if label == "Aa":
                    evidence["retainedUnresolvedMscPhotometry"] = hierarchy_review["retainedUnresolvedMscPhotometry"]
            component = {"starId": identifier, "label": label}
            if len(ids) > 1 or alternates:
                component["alternateStarIds"] = [*ids[1:], *alternates]
            system["components"].append(component)
        definitions.append(system)
        reviewed_ids.update(identifier for c in system["components"] for identifier in [c["starId"], *c.get("alternateStarIds", [])])

    # Component-resolved Gaia IDs in the published M-dwarf multiplicity compilation.
    for group in sorted({r["IDsystem"] for r in cifuentes["rows"]}):
        members = [r for r in cifuentes["rows"] if r["IDsystem"] == group and r["Type"] == "Multiple" and r["Candidate"] != "T" and re.fullmatch(r"[A-Z][a-z]?", r["Comp"]) and not r["SB"] and r["Category"] != "3"]
        matched = [(r, unique(identity_ids.get(f"Gaia DR3 {r['GaiaDR3']}", []))) for r in members]
        if not matched or not any(ids for _, ids in matched):
            continue
        involved = {identifier for _, ids in matched for identifier in ids}
        existing_system = next((s for s in definitions if any(c["starId"] in involved for c in s["components"])), None)
        parent = stars[sorted(involved)[0]]
        name = existing_system["name"] if existing_system else f"GJ {next((r['GJ'].split()[0] for r, ids in matched if r['GJ']), parent['name'])}"
        system = existing_system or {"id": f"cifuentes-{group}", "name": name, "sourceRef": "catalog-companions-cifuentes", "sourceUrl": cifuentes["url"], "components": []}
        for row, ids in matched:
            if len(ids) > 1:
                continue
            identifier = ids[0] if ids else f"cifuentes-{row['IDstar']}"
            if identifier in reviewed_ids and not any(c["starId"] == identifier for c in system["components"]):
                continue
            star = copy.deepcopy(pool.get(identifier, stars.get(identifier))) if identifier in pool or identifier in stars else blank_component(identifier, f"{name} {row['Comp']}", parent)
            if identifier not in stars:
                place(star, number(row["RAGdeg"]), number(row["DEGdeg"]), number(row["plx"]), number(row["pmRA"]), number(row["pmDE"]), 2016, "Cifuentes et al. 2025 Table A.1, individual Gaia DR3 component")
            star["spectral_type"] = star["spectral_type"] or spectrum(row["SpType"])
            star["designations"] = unique([*star["designations"], row["Name"], f"Gaia DR3 {row['GaiaDR3']}", f"GJ {row['GJ']}"])
            withheld = set(re.findall(r"Withheld individual fields: ([a-z_, ]+)\.", star["notes"])[0].split(", ")) if "Withheld individual fields:" in star["notes"] else set()
            evidence = audit["componentRecords"].get(identifier, {})
            for field, key in [("temperature_k", "Teff"), ("mass_solar", "Mass"), ("radius_solar", "Rad"), ("luminosity_solar", "LBol"), ("metallicity_dex", "[Fe/H]")]:
                value = number(row[key])
                if star[field] is None and field not in withheld and value is not None and (field == "metallicity_dex" or value > 0):
                    star[field] = value
                    if field == "metallicity_dex":
                        star["metallicity_kind"] = "[Fe/H]"
                    evidence[field] = {"source": "2025A&A...693A.228C:Table A.1", "recordId": row["IDstar"], "method": "published component measurement/calibration estimate"}
            enrich(star, None, evidence)
            if not any(c["starId"] == identifier for c in system["components"]) and not any(c["label"] == row["Comp"] for c in system["components"]):
                system["components"].append({"starId": identifier, "label": row["Comp"]})
                reviewed_ids.add(identifier)
        if not existing_system and len(system["components"]) >= 2:
            definitions.append(system)

    # Two explicitly classified stellar spectra establish component records even
    # when no luminosity class or physical measurement is published for one member.
    source_aliases = {}
    for directory in ("bright-stars", "western-constellation-stars", "famous-cluster-stars", "nearest-1000"):
        path = ROOT / f"catalog-work/{directory}/simbad.csv"
        inputs.append(path)
        for row in read_csv(path):
            source_aliases[" ".join(row["main_id"].split())] = row
    for identifier, parent in stars.items():
        if identifier in reviewed_ids or not COMPOSITE.search(parent["spectral_type"] or ""):
            continue
        parts = [part for part in re.split(r"\++(?=\s*(?:[OBAFGKMLTY]|D[A-Z]|W[CN]))", parent["spectral_type"]) if part]
        if len(parts) < 2:
            continue
        matched_names = [" ".join(name.split()) for name in [identities.get(identifier, {}).get("simbadId", ""), *parent["designations"]] if " ".join(name.split()) in source_aliases]
        main = next(iter(matched_names), None)
        source_row = source_aliases.get(main, {})
        name = re.sub(r" [A-Z][a-z]?$", "", parent["name"])
        # Merge overlay aliases for the same exact SIMBAD unresolved object.
        duplicate = next((s for s in definitions if s.get("compositeSimbadId") == main and main), None)
        if duplicate:
            component = duplicate["components"][0]
            component.setdefault("alternateStarIds", []).append(identifier)
            reviewed_ids.add(identifier)
            continue
        system = {"id": f"spectroscopic-{identifier}", "name": name, "sourceRef": "catalog-companions-simbad", "sourceUrl": "https://simbad.cds.unistra.fr/simbad/", "compositeSimbadId": main, "components": []}
        for index, part in enumerate(parts):
            label = chr(65 + index)
            component_id = identifier if index == 0 else f"{identifier}-component-{label.lower()}"
            star = blank_component(component_id, f"{name} {label}", parent)
            star["spectral_type"] = spectrum(part)
            star["type"] = "white_dwarf" if part.startswith("D") else "brown_dwarf" if part.startswith(('L', 'T', 'Y')) else "star"
            star["designations"] = unique([*parent["designations"], parent["name"]]) if index == 0 else [f"{name} {label}"]
            star["notes"] = f"Individual {label} spectrum from catalog composite {parent['spectral_type']}; component spectral ordering retained. Integrated system photometry and physical estimates withheld. Shared system sky position/distance is approximate; no orbital phase or individual space motion inferred."
            evidence = {"membership": {"source": "frozen SIMBAD composite spectral classification", "mainId": main, "originalSpectralType": parent["spectral_type"], "spectralBibcode": source_row.get("sp_bibcode")}, "withheldIntegratedFields": {field: parent[field] for field in (*FIELDS, "absolute_mag") if parent[field] is not None}}
            if index == 0:
                retain_unresolved_photometry(star, parent, identities, evidence)
            enrich(star, simbad.get(f"{main} {label}") if main else None, evidence)
            system["components"].append({"starId": component_id, "label": label})
        definitions.append(system)
        reviewed_ids.add(identifier)

    # Ordinary visual binaries are absent from a catalog of triple hierarchies.
    # ORB6 supplies detected pair membership independently of composite spectra.
    orbit_path = WORK / 'orb6-20261009.txt'
    ordinary_path = WORK / 'ordinary-binaries-simbad.csv'
    exclusions_path = WORK / 'ordinary-binaries-review.json'
    inputs += [orbit_path, ordinary_path, WORK / 'ordinary-binaries-simbad.adql', exclusions_path]
    ordinary_sources = {" ".join(r['query_id'].split()): r for r in read_csv(ordinary_path)}
    ordinary_review = read_json(exclusions_path)
    exclusions = ordinary_review['systems']
    audit['ordinaryBinaryCoverage'] = []
    reviewed_ids.update(identifier for s in definitions for c in s['components'] for identifier in [c['starId'], *c.get('alternateStarIds', [])])
    for pair in orbit_pairs(stars, identity_ids, orbit_path.read_text().splitlines()):
        review = {key: value for key, value in pair.items() if key != 'sourceLine'}
        groups = matching_members(pair, stars)
        review['relevantCatalogIds'] = sorted({identifier for ids in groups.values() for identifier in ids})
        if any(identifier in reviewed_ids for identifier in review['relevantCatalogIds']):
            review['decision'] = 'covered-reviewed-system'
        elif pair['wds'] in exclusions:
            review.update(decision='withheld-reviewed-exclusion', evidence=exclusions[pair['wds']])
        elif pair['decision'] == 'detected-visual-pair':
            if not groups:
                review['decision'] = 'withheld-unrelated-subsystem'
            else:
                parent = stars[next(iter(groups.values()))[0]]
                name = ordinary_review['systemNames'].get(pair['wds'], re.sub(r" [A-Z][a-z]?$", "", parent['name']))
                system = dict(id=f"orb6-{pair['wds']}-{'-'.join(pair['labels']).lower()}", name=name,
                    wdsId=pair['wds'], sourceRef='catalog-companions-orb6',
                    sourceUrl='https://crf.usno.navy.mil/wds-orb6', components=[])
                if parent.get('raw_astrometry'):
                    system['adoptedDistance'] = {'parallaxMas': parent['raw_astrometry']['parallax_mas'],
                        'sourceStarId': parent['id'], 'scope': 'Shared catalog parent distance; approximate for unresolved components'}
                for label in pair['labels']:
                    ids = groups.get(label, [])
                    identifier = ids[0] if ids else f"{system['id']}-{label.lower()}"
                    existing = stars.get(identifier)
                    star = blank_component(identifier, f'{name} {label}', parent)
                    # An unresolved parent's physical values/flux/RV have no
                    # individual scope, even when its spectrum has no plus sign.
                    star['designations'] = unique([*(existing['designations'] if existing else []),
                        f"WDS J{pair['wds']}{label}", *(ids if ids else [])])
                    classified_parts = re.split(r'\++(?=\s*(?:[OBAFGKMLTY]|D[A-Z]|W[CN]))', parent['spectral_type'] or '')
                    if len(classified_parts) == len(pair['labels']) and len(classified_parts) > 1:
                        star['spectral_type'] = spectrum(classified_parts[pair['labels'].index(label)])
                        star['type'] = 'white_dwarf' if star['spectral_type'].startswith('D') else 'brown_dwarf' if star['spectral_type'].startswith(('L', 'T', 'Y')) else 'star'
                    source = ordinary_sources.get(f"WDS J{pair['wds']}{label}")
                    if source is None:
                        main = identities.get(parent['id'], {}).get('simbadId', '')
                        source = ordinary_sources.get(f'{main} {label}')
                    individual = source and bool(re.search(r'\s' + re.escape(label) + r'$', source['main_id'])) and source['otype'] not in {'**', 'SB*', 'EB*'} and len(re.split(r'\++(?=\s*(?:[OBAFGKMLTY]|D[A-Z]|W[CN]))', source['sp_type'])) == 1
                    evidence = {'membership': review.copy(), 'withheldIntegratedFields':
                        {field: existing[field] for field in (*FIELDS, 'absolute_mag', 'vx_kms', 'vy_kms', 'vz_kms') if existing and existing[field] is not None}}
                    if existing:
                        retain_unresolved_photometry(star, existing, identities, evidence)
                    if star['spectral_type']:
                        evidence['spectralClassification'] = {'method': 'Frozen component spectra in a source composite, with independent ORB6 detection', 'parentSpectralType': parent['spectral_type']}
                    classification = ordinary_review['componentClassifications'].get(pair['wds'])
                    if classification and label in classification['components']:
                        star.update(classification['components'][label])
                        evidence['reviewedSpectralClassification'] = classification
                    star['notes'] = f"Detected ORB6 visual pair {pair['wds']} {pair['designation']}, component {label}. Unresolved parent photometry, physical parameters and space motion withheld. Shared parent position/distance is approximate unless individual astrometry is available. ORB6 magnitudes are withheld because their photometric band is not guaranteed to be Johnson V."
                    if individual:
                        place(star, number(source['ra']), number(source['dec']), number(source['plx_value']),
                            number(source['pmra']), number(source['pmdec']), 2000,
                            'Frozen exact-component SIMBAD astrometry; ICRS J2000')
                        if star['raw_astrometry']:
                            star['raw_astrometry']['parallax_error_mas'] = number(source['plx_err'])
                    enrich(star, source if individual else None, evidence)
                    component = {'starId': identifier, 'label': label}
                    if len(ids) > 1:
                        component['alternateStarIds'] = ids[1:]
                    system['components'].append(component)
                definitions.append(system)
                reviewed_ids.update(i for c in system['components'] for i in [c['starId'], *c.get('alternateStarIds', [])])
                review.update(decision='authored-detected-pair', systemId=system['id'])
        audit['ordinaryBinaryCoverage'].append(review)

    # Fill remaining blanks on previously reviewed individuals too, using their
    # own exact source identities; do not borrow a parent's Gaia/atmosphere row.
    for identifier, star in pool.items():
        source_names = {" ".join(name.split()) for name in [identities.get(identifier, {}).get("simbadId", ""), *star["designations"]]}
        candidates = {r["oid"]: r for r in simbad_rows if " ".join(r["main_id"].split()) in source_names and not COMPOSITE.search(r["sp_type"])}
        if len(candidates) == 1:
            enrich(star, next(iter(candidates.values())), audit["componentRecords"].get(identifier, {}))

    inputs += apply_hierarchy_splits(ROOT, definitions, pool, audit)

    overrides = read_json(files[5])["objects"]
    if overrides.keys() & hierarchy_review["physicalOverrides"].keys():
        raise ValueError("Duplicate reviewed Regor physical override")
    for identifier, override in {**overrides, **hierarchy_review["physicalOverrides"]}.items():
        if identifier not in pool:
            raise ValueError(f"Component override has no exact member: {identifier}")
        star = pool[identifier]
        star.update(override["values"])
        star["notes"] += " " + override["note"]
        audit["componentRecords"].setdefault(identifier, {})["reviewedPhysicalOverride"] = override

    inputs += apply_literature(ROOT, WORK / "reviewed-companion-literature.json", definitions, pool, audit)
    inputs += apply_literature(ROOT, WORK / "reviewed-constellation-literature.json", definitions, pool, audit)
    inputs += apply_literature(ROOT, WORK / "reviewed-constellation-data.json", definitions, pool, audit)
    inputs += apply_literature(ROOT, WORK / "reviewed-white-dwarf-components.json", definitions, pool, audit)
    inputs += apply_cluster_astrometry(ROOT, definitions, pool, audit)
    inputs += apply_literature(ROOT, ROOT / "catalog-work/famous-cluster-stars/physical-review.json", definitions, pool, audit)
    inputs += apply_bright_system_motion(ROOT, definitions, pool, audit,
        read_json(WORK / "reviewed-constellation-hierarchies.json")["systems"])
    inputs += apply_constellation_motion(ROOT, definitions, pool, audit)
    inputs += apply_constellation_motion(ROOT, definitions, pool, audit,
        "catalog-work/famous-cluster-stars/motion-review.json", "clusterMotion")
    apply_related_astrometry(read_json(ROOT / "catalog-work/famous-cluster-stars/astrometry-review.json"), definitions, pool, audit)
    inputs += apply_izar_review(ROOT, definitions, pool, audit)
    # Reviewed duplicates retire into the same object's record with full provenance.
    merges_path = WORK / "duplicate-component-merges.json"
    inputs.append(merges_path)
    for merge in read_json(merges_path)["merges"]:
        if merge["retiredId"] in pool:
            raise ValueError(f"Reviewed duplicate is still authored: {merge['retiredId']}")
        # Native catalog rows of an aliased record are retained by the alias pass below.
        previous = merge["retainedPreviousEffective"]
        pool[merge["survivorId"]].setdefault("catalog_sources", []).append({"catalog_id": "duplicate-merge-before-20261025", "scope": merge["scope"],
                         "record": {key: copy.deepcopy(value) for key, value in previous.items() if key != "catalog_sources"}})
        audit["componentRecords"].setdefault(merge["survivorId"], {})["retiredDuplicate"] = {
            "id": merge["retiredId"], "reason": merge["reason"], "evidence": merge["retainedEvidence"]}

    # Resolved observations retain their own epoch and uncertainty semantics.
    # A spectroscopic component RV must not complete a different-epoch bulk
    # astrometry bundle or create a constant space-motion vector.
    primary_path = ROOT / "catalog-work/nearest-100/physical-overrides.json"
    manifest_path = ROOT / "catalog-work/shared-enrichment/source-manifest.json"
    inputs += [primary_path, manifest_path]
    expected_hash = read_json(manifest_path)["checksumsSha256"][str(primary_path.relative_to(ROOT))]
    if hashlib.sha256(primary_path.read_bytes()).hexdigest() != expected_hash:
        raise ValueError("Reviewed primary observation checksum drifted")
    for review in read_json(primary_path)["records"]:
        photometry = review.get("photometry", {})
        velocity = review.get("radialVelocityObservation")
        if not photometry.get("observed_on") and not velocity:
            continue
        identifier = review["starViewId"]
        star = pool[identifier]
        if star["name"] != review["expectedName"] or review["componentDesignation"] not in star["designations"]:
            raise ValueError(f"Resolved observation component identity drifted: {identifier}")
        if photometry.get("observed_on"):
            if star["apparent_mag"] is None or not math.isclose(star["apparent_mag"], photometry["johnson_v"], abs_tol=1e-6):
                raise ValueError(f"Resolved photometry adoption drifted: {identifier}")
            star["resolved_photometry"] = {
                "magnitude_v": photometry["johnson_v"], "error_mag": photometry["uncertainty"],
                **{key: photometry[key] for key in ("observed_on", "reference", "source_url", "scope")},
            }
        if velocity:
            star["radial_velocity_observation"] = velocity
        audit["componentRecords"].setdefault(identifier, {})["resolvedObservations"] = {
            "photometry": star.get("resolved_photometry"), "radialVelocity": velocity,
            "motionPolicy": "Component spectroscopic RV retained separately; catalog astrometry and transverse motion unchanged.",
        }

    photometry_path = WORK / "reviewed-unresolved-photometry.json"
    inputs.append(photometry_path)
    for identifier, review in read_json(photometry_path)["objects"].items():
        star = pool[identifier]
        observation = star.get("unresolved_photometry")
        if star["name"] != review["expectedName"] or observation is None or abs(
                observation["magnitude_v"] - review["expectedMagnitudeV"]) > 0.001:
            raise ValueError(f"Unresolved photometry identity/source drifted: {identifier}")
        star["unresolved_photometry"] = review["observation"]
        audit["componentRecords"][identifier]["unresolvedPhotometry"]["reviewedObservation"] = review

    # Freshly split records have no inherited stats. Use only their own
    # classification, never the aggregate's variability or planetary labels.
    for identifier, star in pool.items():
        if star["apparent_mag"] is not None:
            # The card should prefer its reviewed individual flux. Retain the
            # older unresolved observation in provenance only.
            star.pop("unresolved_photometry", None)
        labels = spectral_labels(star)
        added_labels = [label for label in labels if label not in star["subtypes"]]
        star["subtypes"] = prune_subtypes(unique([*star["subtypes"], *labels]))
        if added_labels:
            audit["componentRecords"].setdefault(identifier, {})["spectralSubtypes"] = {
                "spectralType": star["spectral_type"], "labels": added_labels,
                "method": "Physical subtype from this component's own adopted spectrum; no aggregate-label inheritance"}

    # Enrich after the motion/observation reviews so their retained historical
    # source records remain verbatim, rather than acquiring today's new values.
    inputs += apply_literature(ROOT, ROOT / "catalog-work/bright-western-enrichment-20261021/physical-review.json", definitions, pool, audit)

    definitions = [s for s in definitions if len(s["components"]) > 1]
    required_ids = {c["starId"] for s in definitions for c in s["components"]}
    pool = {identifier: star for identifier, star in pool.items() if identifier in required_ids}
    aliases = {}
    for system in definitions:
        for component in system["components"]:
            for identifier in [component["starId"], *component.get("alternateStarIds", [])]:
                if identifier in aliases and aliases[identifier] != component["starId"]:
                    raise ValueError(f"Ambiguous component identity: {identifier}")
                aliases[identifier] = component["starId"]
    # Replacing a catalog source with a reviewed component must be additive.
    # Retain the complete source snapshot, including values, uncertainties,
    # astrometry and notes, instead of discarding non-component-scoped fields.
    # Do not copy these measurements into individual component quantities.
    for source in catalog_sources:
        original = source["record"]
        identifier = aliases.get(original["id"])
        if identifier not in pool:
            continue
        fields = (*FIELDS, "type", "metallicity_kind", "spectral_type", "absolute_mag", "apparent_mag", "constellation",
                  "epoch", "x_pc", "y_pc", "z_pc", "vx_kms", "vy_kms", "vz_kms", "raw_astrometry", "subtypes", "known_planets")
        # Avoid duplicating records whose measurements and notes already survive.
        changed = any(original.get(field) is not None and original.get(field) != []
            and not retained_measurement(original[field], pool[identifier].get(field)) for field in fields)
        if not changed and original["notes"] in pool[identifier]["notes"]:
            continue
        source["scope"] = (f"Original {original['name']} catalog source; "
                           "component contributions are not separated here. "
                           "Retained source measurements, not individual component measurements.")
        pool[identifier].setdefault("catalog_sources", []).append(source)
    # A shared adoption can make a current catalog snapshot identical to its
    # effective component. Keep explicitly frozen earlier measurements too;
    # equality with the new snapshot must not discard their errors or scope.
    inputs.append(SHARED_OBJECT_REVIEW)
    shared_reviews = reviewed_objects()
    for identifier, star in pool.items():
        match = shared_reviews.get(identifier)
        if match:
            for source in match[1].get("retainedCatalogSources", []):
                retain_frozen_source(star.setdefault("catalog_sources", []), source)
    # Adoptions superseded when spectroscopy began to outrank Gaia GSP-Phot, and
    # FLAME masses and ages withheld for Gaia's own non-solar GSP-Phot metallicity.
    for retained_path in (WORK / "retained-gsp-phot-adoptions.json", WORK / "retained-flame-metallicity-adoptions.json"):
        retained = read_json(retained_path)
        inputs.append(retained_path)
        for identifier, record in retained["records"].items():
            if identifier in pool:
                retain_frozen_source(pool[identifier].setdefault("catalog_sources", []),
                                     {"catalog_id": retained["retainedCatalogId"], "scope": retained["scope"], "record": record})
        # Earlier catalog source records keep their catalog ID as an alternative scope.
        for identifier, sources in retained["catalogSources"].items():
            for source in sources if identifier in pool else []:
                retain_frozen_source(pool[identifier].setdefault("catalog_sources", []), {**source, "scope": retained["sourceScope"]})
    for identifier, star in pool.items():
        if star.get("catalog_sources"):
            star["catalog_sources"].sort(key=lambda source: (source["record"]["id"] != identifier, source["catalog_id"]))
    for identifier, star in stars.items():
        if COMPOSITE.search(star["spectral_type"] or "") and identifier not in aliases:
            audit["remainingCompositeRecords"].append({"id": identifier, "name": star["name"], "spectralType": star["spectral_type"]})
    audit['unreviewedMultiplicityRecords'] = []
    for identifier, star in stars.items():
        if identifier in aliases:
            continue
        main = " ".join(identities.get(identifier, {}).get('simbadId', '').split())
        source = source_aliases.get(main, {})
        wds = [name for name in star['designations'] if name.startswith('WDS J')]
        if wds or source.get('otype') in {'SB*', '**', 'EB*'} or re.search(r'\+[LTY]\d', star['spectral_type'] or ''):
            audit['unreviewedMultiplicityRecords'].append({'id': identifier, 'name': star['name'],
                'simbadType': source.get('otype'), 'spectralType': star['spectral_type'], 'wdsIds': wds,
                'status': 'Needs source review; a WDS identifier or spectral/astrometric flag alone does not establish physical component membership.'})
    audit.update(schemaVersion=1, reviewedOn="2026-10-13", systems=len(definitions), components=len(pool),
                 selectedFieldCoverage={
                     "individualApparentMagnitude": sum(s["apparent_mag"] is not None for s in pool.values()),
                     "unresolvedSourcePhotometry": sum(bool(s.get("unresolved_photometry")) for s in pool.values()),
                     "subtypes": sum(bool(s["subtypes"]) for s in pool.values()),
                     "missingSubtypes": [identifier for identifier, s in pool.items() if not s["subtypes"]],
                     "missingVisualPhotometry": [identifier for identifier, s in pool.items()
                                                 if s["apparent_mag"] is None and not s.get("unresolved_photometry")]},
                 propertyCoverage=property_coverage(pool),
                 sourcePreservation={
                     "componentRecordsWithSources": sum(bool(s.get("catalog_sources")) for s in pool.values()),
                     "sourceRecords": sum(len(s.get("catalog_sources", [])) for s in pool.values()),
                     "missingIndividualFieldsWithSourceValues": {
                         field: sum(s.get(field) is None and any(source["record"].get(field) is not None
                             for source in s.get("catalog_sources", [])) for s in pool.values())
                         for field in (*FIELDS, "absolute_mag", "apparent_mag", "spectral_type", "vx_kms", "vy_kms", "vz_kms")}},
                 coverage={field: sum(s[field] is not None for s in pool.values()) for field in FIELDS},
                 inputSha256={str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in inputs})
    payload = {"schemaVersion": 1, "policy": "Load every reviewed stellar component when any exact member is represented, independent of luminosity, brightness, distance and selection cutoff. No positional membership inference; unknown component fields remain null. Integrated system properties never become individual measurements.", "systems": definitions, "stars": list(pool.values())}
    return payload, audit


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true", help="Fail if the shared pool or membership audit is stale")
    args = parser.parse_args()
    payload, audit = build()
    systems = {system['id']: system for system in read_json(ROOT / 'src/data/star-systems.json')['systems']}
    systems.update({system['id']: system for system in payload['systems']})
    # Runtime identity only; the full authored files retain all source metadata.
    identities = {'systems': [
        {'id': system['id'], 'name': system['name'], 'components': [
            {key: component[key] for key in ('starId', 'label', 'alternateStarIds') if key in component}
            for component in system['components']]}
        for system in systems.values()]}
    if args.check and (read_json(OUTPUT) != payload or read_json(WORK / 'catalog-companions-audit.json') != json.loads(json.dumps(audit))
                       or not IDENTITIES.exists() or read_json(IDENTITIES) != identities):
        raise SystemExit('Stale companion coverage; run npm run catalog:companions and review the membership audit.')
    if args.write:
        previous = read_json(OUTPUT)
        retirements = read_json(ROOT / "catalog-work/reviewed-data-retirements.json")["retirements"]
        errors = pool_losses(previous, payload, retirements)
        if errors:
            raise SystemExit("Refusing companion regeneration that loses existing data:\n" + "\n".join(errors))
        OUTPUT.write_text(json.dumps(payload, indent=2) + "\n")
        IDENTITIES.write_text(json.dumps(identities, indent=2) + "\n")
        (WORK / "catalog-companions-audit.json").write_text(json.dumps(audit, indent=2) + "\n")
    print(f"{audit['systems']} systems, {audit['components']} individual records; coverage {audit['coverage']}; unresolved composite records {len(audit['remainingCompositeRecords'])}")


if __name__ == "__main__":
    main()
