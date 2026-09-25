"""Rebuild the curated bright-star catalog from its frozen SIMBAD snapshot."""

import argparse
import csv
import io
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "catalog-work/bright-stars/simbad.csv"
PARAMETERS = ROOT / "catalog-work/bright-stars/parameters.csv"
DIAMETERS = ROOT / "catalog-work/bright-stars/diameters.csv"
FUNDAMENTAL = ROOT / "catalog-work/bright-stars/fundamental.csv"
SED = ROOT / "catalog-work/bright-stars/sed.csv"
PRIMARY = ROOT / "catalog-work/bright-stars/primary.csv"
DEFAULT_CATALOG = ROOT / "src/data/stars.csv"
OUTPUT = ROOT / "src/data/catalogs/bright-stars"
HEADERS = [
    "type", "id", "name", "spectral_type", "x_pc", "y_pc", "z_pc",
    "vx_kms", "vy_kms", "vz_kms", "temperature_k", "mass_solar",
    "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr",
    "absolute_mag", "epoch", "notes", "constellation", "ra_deg", "dec_deg",
    "astrometry_epoch", "parallax_mas", "parallax_error_mas",
    "pm_ra_cosdec_masyr", "pm_ra_error_masyr", "pm_dec_masyr",
    "pm_dec_error_masyr", "radial_velocity_kms", "radial_velocity_error_kms",
    "astrometry_ref", "radial_velocity_ref",
]
ICRS_TO_GALACTIC = (
    (-0.0548755604, -0.8734370902, -0.4838350155),
    (0.4941094279, -0.4448296300, 0.7469822445),
    (-0.8676661490, -0.1980763734, 0.4559837762),
)
CONSTELLATIONS = {
    "Achernar": "Eridanus", "Acrux": "Crux", "Adhara": "Canis Major",
    "Aldebaran": "Taurus", "Alhena": "Gemini", "Alioth": "Ursa Major", "Alkaid": "Ursa Major",
    "Almach": "Andromeda", "Alnair": "Grus", "Alnilam": "Orion", "Alnitak": "Orion",
    "Alpha Lupi": "Lupus", "Alphard": "Hydra", "Alphecca": "Corona Borealis",
    "Alpheratz": "Andromeda", "Algol": "Perseus", "Altair": "Aquila", "Ankaa": "Phoenix",
    "Antares": "Scorpius", "Arcturus": "Bootes", "Aspidiske": "Carina",
    "Atria": "Triangulum Australe", "Avior": "Carina", "Bellatrix": "Orion",
    "Beta Gruis": "Grus", "Betelgeuse": "Orion", "Canopus": "Carina", "Caph": "Cassiopeia",
    "Capella": "Auriga", "Castor": "Gemini", "Deneb": "Cygnus", "Denebola": "Leo",
    "Diphda": "Cetus", "Dschubba": "Scorpius", "Dubhe": "Ursa Major", "Elnath": "Taurus",
    "Eltanin": "Draco", "Enif": "Pegasus", "Epsilon Centauri": "Centaurus",
    "Epsilon Scorpii": "Scorpius", "Eta Centauri": "Centaurus", "Fomalhaut": "Piscis Austrinus",
    "Gacrux": "Crux", "Gamma Cassiopeiae": "Cassiopeia", "Gamma Centauri": "Centaurus",
    "Hadar": "Centaurus", "Hamal": "Aries", "Kappa Scorpii": "Scorpius",
    "Kaus Australis": "Sagittarius", "Kochab": "Ursa Minor", "Menkalinan": "Auriga",
    "Menkent": "Centaurus", "Merak": "Ursa Major", "Miaplacidus": "Carina", "Mimosa": "Crux",
    "Mintaka": "Orion", "Mirach": "Andromeda", "Mirfak": "Perseus", "Mirzam": "Canis Major",
    "Mizar A": "Ursa Major", "Naos": "Puppis", "Nunki": "Sagittarius", "Peacock": "Pavo",
    "Polaris": "Ursa Minor", "Pollux": "Gemini", "Procyon": "Canis Minor",
    "Rasalhague": "Ophiuchus", "Regor": "Vela", "Regulus": "Leo", "Rigel": "Orion",
    "Sadr": "Cygnus", "Saiph": "Orion", "Sargas": "Scorpius", "Schedar": "Cassiopeia",
    "Shaula": "Scorpius", "Spica": "Virgo", "Suhail": "Vela", "Vega": "Lyra",
    "Wezen": "Canis Major",
}
SYSTEM_TYPES = {"**", "SB*", "bC*", "s*b"}
SOLAR_RADIUS_KM = 695700
SOLAR_TEMPERATURE_K = 5772


def matrix_vector(matrix, vector):
    return tuple(sum(row[index] * vector[index] for index in range(3)) for row in matrix)


def source_row(source, parameters, diameters, fundamental, sed, primary):
    ra = math.radians(float(source["ra"]))
    dec = math.radians(float(source["dec"]))
    parallax = float(source["plx_value"])
    distance = 1000 / parallax
    radial = (math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec))
    east = (-math.sin(ra), math.cos(ra), 0)
    north = (-math.sin(dec) * math.cos(ra), -math.sin(dec) * math.sin(ra), math.cos(dec))
    position = matrix_vector(ICRS_TO_GALACTIC, tuple(distance * value for value in radial))
    scale = 4.74047 / parallax
    equatorial_velocity = tuple(
        east[index] * scale * float(source["pmra"]) +
        north[index] * scale * float(source["pmdec"]) +
        radial[index] * float(source["rvz_radvel"])
        for index in range(3)
    )
    velocity = matrix_vector(ICRS_TO_GALACTIC, equatorial_velocity)
    visual_magnitude = float(source["V"])
    absolute_magnitude = visual_magnitude - 5 * math.log10(distance / 10)
    photometry = "Bright Star Catalogue V=0.76" if source["name"] == "Acrux" else f"SIMBAD compiled Johnson V={source['V']}"
    system = source["otype"] in SYSTEM_TYPES
    system_note = " The entry represents the named unresolved system; physical values describe its integrated or primary-dominated light." if system else ""
    measured = parameters.get(source["main_id"], {})
    model = fundamental.get(source["main_id"], {})
    diameter = diameters.get(source["main_id"], {})
    sed_model = sed.get(source["main_id"], {})
    reviewed = primary.get(source["main_id"], {})
    temperature = round(10 ** float(model["log_temperature_k"])) if model else sed_model.get("temperature_k") or measured.get("teff", "")
    metallicity = measured.get("fe_h", "")
    reliable_model_mass = model and not system and (not metallicity or abs(float(metallicity)) <= 0.3)
    mass = reviewed.get("mass_solar") or (model["mass_solar"] if reliable_model_mass else "")
    age = reviewed.get("age_gyr", "")
    if diameter:
        radius = float(diameter["diameter_km"]) / (2 * SOLAR_RADIUS_KM)
        radius_ref = diameter["bibcode"]
    elif model and not system:
        radius = 10 ** float(model["log_radius_solar"])
        radius_ref = model["bibcode"]
    elif sed_model and temperature:
        radius = math.sqrt(float(sed_model["luminosity_solar"])) / (float(temperature) / SOLAR_TEMPERATURE_K) ** 2
        radius_ref = sed_model["bibcode"]
    else:
        radius = None
        radius_ref = ""
    luminosity = float(sed_model["luminosity_solar"]) if sed_model else (radius ** 2 * (float(temperature) / SOLAR_TEMPERATURE_K) ** 4 if radius is not None and temperature else None)
    physical_refs = sorted(set(filter(None, (
        model.get("bibcode"), measured.get("bibcode"), diameter.get("bibcode"), sed_model.get("bibcode"), reviewed.get("bibcode"),
    ))))
    physical_note = f" Physical parameters: {', '.join(physical_refs)}." if physical_refs else ""
    age_note = f" Age source detail: {reviewed['note']}." if age else " No component-resolved age was adopted from the reviewed sources."
    row = {header: "" for header in HEADERS}
    row.update({
        "type": "star", "id": source["id"], "name": source["name"],
        "spectral_type": source["sp_type"],
        "x_pc": f"{position[0]:.9f}", "y_pc": f"{position[1]:.9f}", "z_pc": f"{position[2]:.9f}",
        "vx_kms": f"{velocity[0]:.6f}", "vy_kms": f"{velocity[1]:.6f}", "vz_kms": f"{velocity[2]:.6f}",
        "temperature_k": str(temperature), "mass_solar": mass,
        "luminosity_solar": f"{luminosity:.3f}" if luminosity is not None else "",
        "radius_solar": f"{radius:.4f}" if radius is not None else "",
        "metallicity_dex": metallicity,
        "age_gyr": age,
        "absolute_mag": f"{absolute_magnitude:.6f}", "epoch": "2000.0",
        "notes": f"Curated bright-star landmark; SIMBAD identity {source['main_id']}. {photometry}; absolute V derived from parallax with no extinction correction.{physical_note}{age_note}{system_note}",
        "constellation": CONSTELLATIONS[source["name"]], "ra_deg": source["ra"], "dec_deg": source["dec"],
        "astrometry_epoch": "2000.0", "parallax_mas": source["plx_value"], "parallax_error_mas": source["plx_err"],
        "pm_ra_cosdec_masyr": source["pmra"], "pm_dec_masyr": source["pmdec"],
        "radial_velocity_kms": source["rvz_radvel"], "astrometry_ref": "SIMBAD TAP snapshot 2026-09-25",
        "radial_velocity_ref": "SIMBAD TAP snapshot 2026-09-25",
    })
    return row


def render():
    defaults = {row["id"]: row for row in csv.DictReader(DEFAULT_CATALOG.read_text().splitlines())}
    inherited = []
    for identifier in ("sun", "sirius-a", "alpha-centauri-a", "alpha-centauri-b"):
        source = defaults[identifier]
        inherited.append({header: source.get(header, "") or "" for header in HEADERS})
    with SOURCE.open(newline="") as handle:
        source_rows = list(csv.DictReader(handle))
    source_by_id = {row["id"]: row for row in source_rows}
    with PARAMETERS.open(newline="") as handle:
        parameters = {row["main_id"]: row for row in csv.DictReader(handle)}
    with DIAMETERS.open(newline="") as handle:
        diameters = {row["main_id"]: row for row in csv.DictReader(handle)}
    with FUNDAMENTAL.open(newline="") as handle:
        fundamental = {row["main_id"]: row for row in csv.DictReader(handle)}
    with SED.open(newline="") as handle:
        sed = {row["main_id"]: row for row in csv.DictReader(handle)}
    with PRIMARY.open(newline="") as handle:
        primary = {row["main_id"]: row for row in csv.DictReader(handle)}
    if len(source_rows) != 79 or len({row["id"] for row in source_rows}) != 79 or len({row["name"] for row in source_rows}) != 79:
        raise ValueError("Bright-star source must contain 79 unique named landmarks")
    authored = [source_row(row, parameters, diameters, fundamental, sed, primary) for row in source_rows]
    for source, row in zip(source_rows, authored, strict=True):
        distance_ly = math.hypot(float(row["x_pc"]), float(row["y_pc"]), float(row["z_pc"])) * 3.261563777
        if distance_ly > 2000 or float(source["V"]) > 2.41:
            raise ValueError(f"Bright-star policy violation: {row['name']}")
    rows = [inherited[0], *sorted([*inherited[1:], *authored], key=lambda row: math.hypot(float(row["x_pc"]), float(row["y_pc"]), float(row["z_pc"])))]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=HEADERS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    provenance = {
        "schemaVersion": 1,
        "catalogId": "bright-stars",
        "policy": "All frozen SIMBAD stellar entries within 2000 ly with compiled Johnson V <= 2.41, deduplicating the Alpha Centauri system in favor of A/B components; Acrux uses the Bright Star Catalogue combined V=0.76. Includes Sun as the map origin.",
        "objects": {
            row["id"]: ({"source": "nearest-neighbors", "adoptedWithoutChange": True} if row["id"] in {"sun", "sirius-a", "alpha-centauri-a", "alpha-centauri-b"} else {
                "source": "SIMBAD TAP snapshot 2026-09-25",
                "queryId": source_by_id[row["id"]]["main_id"],
                "absoluteMagnitudeMethod": "Johnson V and inverse-parallax distance; no extinction correction",
                "physicalParameters": "SIMBAD mesFe_h/mesDiameter ranked measurements, Allende Prieto & Lambert 1999 evolutionary models, McDonald et al. 2012 SED models, and reviewed primary papers; see row notes",
                "luminosityMethod": "McDonald et al. 2012 SED luminosity where available; otherwise Stefan-Boltzmann scaling R^2 (T/5772 K)^4 when both inputs are adopted",
            }) for row in rows
        },
    }
    return output.getvalue(), json.dumps(provenance, indent=2, ensure_ascii=True) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    csv_text, provenance = render()
    files = {"stars.csv": csv_text, "provenance.json": provenance}
    if args.write:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for name, content in files.items():
            (OUTPUT / name).write_text(content)
        return
    for name, content in files.items():
        if not (OUTPUT / name).exists() or (OUTPUT / name).read_text() != content:
            raise SystemExit(f"Bright-star catalog is stale: run {Path(__file__).name} --write")


if __name__ == "__main__":
    main()
