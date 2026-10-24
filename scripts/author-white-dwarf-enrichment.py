"""Reproduce the reviewed white dwarf physical parameters from frozen source tables.

Catalog rows receive them through the shared exact-identity enrichment layer;
reviewed system components receive them through the component literature plan.
Usage: python3 scripts/author-white-dwarf-enrichment.py [--write]
"""

import argparse
import json
import math
import re
from pathlib import Path

from catalog_sources.snapshots import canonical_json, verify_sha256

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "catalog-work/shared-enrichment/white-dwarfs"
SHARED_OUTPUT = ROOT / "catalog-work/shared-enrichment/reviewed-white-dwarfs.json"
COMPONENT_OUTPUT = ROOT / "catalog-work/star-systems/reviewed-white-dwarf-components.json"
REVIEWED = "2026-10-20"

# IAU 2015 nominal solar mass parameter, radius and effective temperature.
GM_SUN = 1.3271244e20
R_SUN = 6.957e8
T_SUN = 5772

SURVEY = {
    "reference": "2024MNRAS.527.8687O",
    "url": "https://arxiv.org/abs/2312.02735",
    "sourceUrl": "https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/527/8687",
    "section": "Table A1 (CDS J/MNRAS/527/8687, updated 2024-11-14); method section 2",
}
# The paper's ad-hoc population correction applies below this initial Teff (section 2.1.2).
LOW_MASS_LIMIT_K = 6000
DOUBLE_DEGENERATE = re.compile(r"double degenerate", re.IGNORECASE)
CARBON_OR_METALS = re.compile(r"^D[A-Z]*[QZX]")


def table_rows():
    def column(line, start, end):
        return line[start - 1:end].strip()

    def number(line, start, end):
        text = column(line, start, end)
        return float(text) if text else None

    rows = {}
    for line in (SOURCES / "obrien2024-tablea1.dat").read_text().splitlines():
        # Byte ranges from obrien2024-ReadMe.txt.
        row = {"name": column(line, 1, 22), "gaiaDr3Id": column(line, 24, 42), "spectralType": column(line, 163, 171),
               "composition": column(line, 173, 174), "teff": number(line, 176, 180), "teffError": number(line, 182, 185),
               "logg": number(line, 187, 192), "loggError": number(line, 194, 198), "mass": number(line, 200, 205),
               "massError": number(line, 207, 211), "correctedTeff": number(line, 213, 217), "correctedMass": number(line, 219, 223),
               "coolingAgeGyr": number(line, 225, 229), "spectralTypeReference": column(line, 231, 249), "comment": column(line, 251, 368)}
        if row["gaiaDr3Id"] in rows:
            raise ValueError(f"Duplicate Table A1 Gaia DR3 identity: {row['gaiaDr3Id']}")
        rows[row["gaiaDr3Id"]] = row
    return rows


def radius_from_gravity(mass_solar, log_g_cgs):
    return math.sqrt(GM_SUN * mass_solar / (10 ** log_g_cgs / 100)) / R_SUN


def luminosity_from_radius(radius_solar, temperature_k):
    return radius_solar ** 2 * (temperature_k / T_SUN) ** 4


def derived_fields(temperature, mass, log_g, source, caveat):
    """Radius from the fit's own mass and gravity; luminosity from that radius and Teff."""
    radius = radius_from_gravity(mass, log_g)
    luminosity = luminosity_from_radius(radius, temperature)
    no_error = "Mass, gravity and temperature are correlated fit parameters, so no uncertainty is propagated."
    return {
        "radius_solar": {"value": radius, "uncertainty": None, "status": "derived", **source,
                         "method": "R = sqrt(G M / g) with IAU 2015 nominal GM_sun and R_sun",
                         "inputs": {"mass_solar": mass, "log_g_cgs": log_g},
                         "caveat": f"Derived from the same fit's mass and surface gravity. {no_error} {caveat}".strip()},
        "luminosity_solar": {"value": luminosity, "uncertainty": None, "status": "derived", **source,
                             "method": "Stefan-Boltzmann scaling, L = R^2 (Teff / 5772 K)^4",
                             "inputs": {"radius_solar": radius, "temperature_k": temperature},
                             "caveat": f"Derived from the adopted radius and temperature. {no_error} {caveat}".strip()},
    }


def survey_review(target, row):
    temperature, mass, log_g = row["teff"], row["mass"], row["logg"]
    caveats = [f"Uniform photometric fit to Gaia DR3 photometry and parallax with {'pure-H' if row['composition'] == 'H' else 'pure-He'} "
               "model atmospheres and the Bedard et al. (2020) mass-radius relation; not an individual spectroscopic fit."]
    if temperature < LOW_MASS_LIMIT_K:
        caveats.append(f"Below {LOW_MASS_LIMIT_K} K the paper finds photometric masses systematically low because of model opacities "
                       f"(section 2.1). Its ad-hoc population correction ({row['correctedTeff']:.0f} K, {row['correctedMass']} solar masses) "
                       "is retained here but not adopted as an individual measurement.")
    if row["composition"] == "He" and (CARBON_OR_METALS.match(target["spectralType"]) or CARBON_OR_METALS.match(row["spectralType"])):
        caveats.append("Carbon or metals in this helium-rich atmosphere are not modeled; tailored atmosphere fits can differ in Teff and log g (section 2).")
    caveat = " ".join(caveats)
    inputs = {"wdjName": row["name"], "gaiaDr3Id": row["gaiaDr3Id"], "sourceSpectralType": row["spectralType"],
              "spectralTypeReference": row["spectralTypeReference"], "composition": row["composition"],
              "logGCgs": log_g, "logGErrorCgs": row["loggError"], "coolingAgeGyr": row["coolingAgeGyr"],
              "correctedTeffK": row["correctedTeff"], "correctedMassSolar": row["correctedMass"]}
    fields = {
        "temperature_k": {"value": temperature, "uncertainty": row["teffError"], "status": "model-derived", **SURVEY,
                          "method": "Gaia DR3 photometric fit (gaia_teff)", "inputs": inputs, "caveat": caveat},
        "mass_solar": {"value": mass, "uncertainty": row["massError"], "status": "model-derived", **SURVEY,
                       "method": "Gaia DR3 photometric fit with the Bedard et al. (2020) mass-radius relation (gaia_mass)",
                       "inputs": inputs, "caveat": caveat},
        **derived_fields(temperature, mass, log_g, SURVEY, caveat),
    }
    note = (f"O'Brien et al. (2024) 40 pc Gaia DR3 fit ({row['composition']}-rich atmosphere): Teff {temperature:.0f} +/- {row['teffError']:.0f} K, "
            f"log g {log_g} +/- {row['loggError']}, mass {mass} +/- {row['massError']} solar masses. Radius from that mass and gravity; "
            f"luminosity from radius and Teff. Its {row['coolingAgeGyr']} Gyr cooling age excludes the progenitor lifetime and is not adopted as total age. "
            + " ".join(caveats[1:])).strip()
    return fields, note


def literature_review(entry):
    source = {"reference": entry["reference"], "url": entry["url"], "sourceUrl": entry["sourceUrl"], "section": entry["section"]}
    fields = {}
    for field, observation in entry["fields"].items():
        fields[field] = {"value": observation["value"], "uncertainty": observation.get("uncertainty"), "status": observation["status"],
                         **source, **{key: observation[key] for key in ("section", "method", "caveat", "inputs") if key in observation}}
    if entry.get("deriveLuminosity"):
        radius, temperature = fields["radius_solar"]["value"], fields["temperature_k"]["value"]
        fields["luminosity_solar"] = {"value": luminosity_from_radius(radius, temperature), "uncertainty": None, "status": "derived", **source,
                                      "method": "Stefan-Boltzmann scaling, L = R^2 (Teff / 5772 K)^4",
                                      "inputs": {"radius_solar": radius, "temperature_k": temperature},
                                      "caveat": "Derived from the published radius and temperature of the same fit; no uncertainty is propagated from correlated parameters."}
    return fields, entry["note"]


def build_reviews():
    manifest = json.loads((SOURCES / "source-manifest.json").read_text())
    for filename, digest in manifest["checksumsSha256"].items():
        verify_sha256(SOURCES / filename, digest)
    targets = json.loads((SOURCES / "targets.json").read_text())["targets"]
    literature = json.loads((SOURCES / "literature.json").read_text())["objects"]
    rows = table_rows()
    shared, components, audit = {}, {}, {}
    for target in targets:
        identifier = target["starViewId"]
        decision = audit[identifier] = {"name": target["name"], "simbadId": target["simbadId"], "gaiaDr3Id": target["gaiaDr3Id"]}
        if identifier in literature and "withheld" in literature[identifier]:
            decision["withheld"] = literature[identifier]["withheld"]
            continue
        if identifier in literature:
            fields, note = literature_review(literature[identifier])
            reference, url = literature[identifier]["reference"], literature[identifier]["url"]
            decision["adopted"] = {"reference": reference, "fields": sorted(fields)}
        else:
            row = rows.get(target["gaiaDr3Id"] or "")
            if row is None:
                decision["withheld"] = "No exact Gaia DR3 identity in O'Brien et al. (2024) Table A1 and no reviewed literature entry."
                continue
            decision.update(tableA1=row["name"], sourceSpectralType=row["spectralType"], comment=row["comment"])
            if DOUBLE_DEGENERATE.search(row["comment"]):
                decision["withheld"] = f"Table A1 comment '{row['comment']}': a single-star photometric fit of an unresolved double white dwarf does not describe either component."
                continue
            if any(row[key] is None or row[key] <= 0 for key in ("teff", "teffError", "logg", "loggError", "mass", "massError")):
                decision["withheld"] = "Incomplete Table A1 fit."
                continue
            fields, note = survey_review(target, row)
            reference, url = SURVEY["reference"], SURVEY["url"]
            decision["adopted"] = {"reference": reference, "fields": sorted(fields)}
        if target["simbadId"]:
            key = " ".join(target["simbadId"].split())
            shared[key] = {"label": target["name"], "starViewIds": [identifier], "objectType": "white_dwarf",
                           "component": "individual white dwarf",
                           "scope": "Exact-identity individual white dwarf; no unresolved companion light or system totals.",
                           "reference": reference, "url": url, "fields": fields, "note": note}
        component = target.get("component")
        if component:
            components[identifier] = {"expectedName": component["expectedName"], "systemId": component["systemId"],
                                      "component": component["label"], "expectedType": "white_dwarf",
                                      **({"gaiaDr3Id": target["gaiaDr3Id"]} if component["gaiaDesignation"] else {}),
                                      "fields": fields, "note": note}
    inputs = {str((SOURCES / name).relative_to(ROOT)): digest for name, digest in manifest["checksumsSha256"].items()}
    policy = ("Fill blank white dwarf physical fields from O'Brien et al. (2024) Table A1 by exact Gaia DR3 identity, using the uncorrected "
              "per-object fit; withhold flagged double degenerates; radius from the fit's mass and gravity, luminosity by Stefan-Boltzmann; "
              "cooling ages are not total ages. Objects without a Table A1 fit use reviewed individual literature.")
    shared_review = {"schemaVersion": 1, "reviewed": REVIEWED, "policy": policy, "inputSha256": inputs, "objects": shared, "audit": audit}
    component_plan = {"schemaVersion": 1, "reviewed": REVIEWED, "policy": policy, "inputSha256": inputs, "objects": components}
    return shared_review, component_plan


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    shared_review, component_plan = build_reviews()
    for path, review in ((SHARED_OUTPUT, shared_review), (COMPONENT_OUTPUT, component_plan)):
        content = canonical_json(review)
        if args.write:
            path.write_text(content)
        elif not path.exists() or path.read_text() != content:
            raise ValueError(f"White dwarf review does not reproduce: {path.relative_to(ROOT)}")
    adopted = sum("adopted" in decision for decision in shared_review["audit"].values())
    print(json.dumps({"targets": len(shared_review["audit"]), "adopted": adopted,
                      "withheld": len(shared_review["audit"]) - adopted, "catalogRecords": len(shared_review["objects"]),
                      "componentRecords": len(component_plan["objects"])}))
