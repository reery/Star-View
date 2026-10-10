"""Rebuild the Western constellation-figure and famous-cluster star overlays."""

import argparse
import csv
import io
import json
import math
import re
from functools import cache
from pathlib import Path
from catalog_sources.enrichment import enrich_from_frozen, enrichment_sources, manifest_sha256
from catalog_sources.shared_objects import adopt_shared_objects
from catalog_sources.overlay_companions import expand_overlay
from catalog_sources.solar import adopt_solar_reference, solar_provenance


ROOT = Path(__file__).resolve().parents[1]
WESTERN_SOURCE = ROOT / "catalog-work/western-constellation-stars"
CLUSTER_SOURCE = ROOT / "catalog-work/famous-cluster-stars"
PHYSICAL_SOURCE = ROOT / "catalog-work/landmark-stars"
WESTERN_OUTPUT = ROOT / "src/data/catalogs/western-constellation-stars"
CLUSTER_OUTPUT = ROOT / "src/data/catalogs/famous-cluster-stars"
DEFAULT_CATALOG = ROOT / "src/data/stars.csv"
PHYSICAL_FIELDS = ("temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr")
SYSTEM_TYPES = {"**", "EB*", "SB*", "bC*", "s*b"}
HEADERS = [
    "type", "id", "name", "designations", "spectral_type", "x_pc", "y_pc", "z_pc",
    "vx_kms", "vy_kms", "vz_kms", "temperature_k", "mass_solar",
    "luminosity_solar", "radius_solar", "metallicity_dex", "metallicity_kind", "age_gyr",
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
GREEK_DESIGNATIONS = {
    "alf": "Alpha", "bet": "Beta", "gam": "Gamma", "del": "Delta", "eps": "Epsilon",
    "zet": "Zeta", "eta": "Eta", "tet": "Theta", "iot": "Iota", "kap": "Kappa",
    "lam": "Lambda", "mu.": "Mu", "nu.": "Nu", "ksi": "Xi", "omi": "Omicron",
    "pi.": "Pi", "rho": "Rho", "sig": "Sigma", "tau": "Tau", "ups": "Upsilon",
    "phi": "Phi", "chi": "Chi", "psi": "Psi", "ome": "Omega",
}
CLUSTER_ALIASES = {
    "Pleiades": "Melotte 22",
    "Hyades": "Melotte 25",
    "Coma Star Cluster": "Melotte 111",
    "Southern Pleiades": "IC 2602",
    "Omicron Velorum Cluster": "IC 2391",
    "Beehive Cluster": "NGC 2632",
}
CURATED_COMPONENT_IDS = {
    "* alf Cen A": "alpha-centauri-a",
}


def matrix_vector(matrix, vector):
    return tuple(sum(row[index] * vector[index] for index in range(3)) for row in matrix)


def compact_spaces(value):
    return re.sub(r"\s+", " ", value).strip()


def aliases(source):
    return [compact_spaces(alias) for alias in source["ids"].split("|") if alias.strip()]


def display_name(source):
    source_aliases = aliases(source)
    for prefix in ("NAME-IAU ", "NAME "):
        names = [alias.removeprefix(prefix) for alias in source_aliases if alias.startswith(prefix)]
        if names:
            return min(names, key=lambda name: (len(name), name.casefold()))
    main_id = re.sub(r"^(?:V\*|\*\*|\*)\s+", "", source["main_id"]).strip()
    match = re.match(r"^(alf|bet|gam|del|eps|zet|eta|tet|iot|kap|lam|mu\.|nu\.|ksi|omi|pi\.|rho|sig|tau|ups|phi|chi|psi|ome)(\d{2})?\s+(.+)$", main_id)
    if match:
        greek, component, remainder = match.groups()
        suffix = str(int(component)) if component else ""
        return f"{GREEK_DESIGNATIONS[greek]}{suffix} {compact_spaces(remainder)}"
    return compact_spaces(main_id)


def gaia_dr3_id(source):
    match = re.search(r"(?:^|\|)Gaia DR3\s+(\d+)(?:\||$)", source["ids"])
    return match.group(1) if match else None


def hip_id(source):
    match = re.search(r"(?:^|\|)HIP\s+(\d+)(?:\||$)", source["ids"])
    return match.group(1) if match else None


def landmark_gaia_ids():
    identifiers = set()
    for directory in (WESTERN_SOURCE, CLUSTER_SOURCE):
        with (directory / "simbad.csv").open(newline="") as handle:
            for source in csv.DictReader(handle):
                identifier = gaia_dr3_id(source)
                if identifier:
                    identifiers.add(identifier)
    return sorted(identifiers, key=int)


def landmark_hip_ids():
    identifiers = set()
    for directory in (WESTERN_SOURCE, CLUSTER_SOURCE):
        with (directory / "simbad.csv").open(newline="") as handle:
            for source in csv.DictReader(handle):
                identifier = hip_id(source)
                if identifier:
                    identifiers.add(identifier)
    return sorted(identifiers, key=int)


def gaia_query_text():
    identifiers = landmark_gaia_ids()
    return (
        "SELECT source_id,teff_gspphot,teff_gspphot_lower,teff_gspphot_upper,"
        "mh_gspphot,mh_gspphot_lower,mh_gspphot_upper,mass_flame,mass_flame_lower,"
        "mass_flame_upper,lum_flame,lum_flame_lower,lum_flame_upper,radius_flame,"
        "radius_flame_lower,radius_flame_upper,age_flame,age_flame_lower,age_flame_upper,"
        "flags_flame FROM gaiadr3.astrophysical_parameters WHERE source_id IN ("
        + ",".join(identifiers) + ") ORDER BY source_id\n"
    )


def distance_query_text():
    return (
        "SELECT source_id,r_med_geo,r_lo_geo,r_hi_geo,r_med_photogeo,"
        "r_lo_photogeo,r_hi_photogeo FROM external.gaiaedr3_distance "
        "WHERE source_id IN (" + ",".join(landmark_gaia_ids()) + ") ORDER BY source_id\n"
    )


def sed_query_text():
    return (
        'SELECT HIP,Dist,eDist,Teff,Lum FROM "J/MNRAS/427/343/table2" '
        "WHERE HIP IN (" + ",".join(landmark_hip_ids()) + ") ORDER BY HIP\n"
    )


def fundamental_query_text():
    return (
        'SELECT HIP,Mass,e_Mass,logRad,e_logRad,logTeff,e_logTeff FROM "J/A+A/352/555/table1" '
        "WHERE HIP IN (" + ",".join(landmark_hip_ids()) + ") ORDER BY HIP\n"
    )


def optional_number(value):
    text = (value or "").strip()
    if not text:
        return None
    number = float(text)
    return number if math.isfinite(number) else None


@cache
def gaia_rows():
    expected_ids = set(landmark_gaia_ids())
    with (PHYSICAL_SOURCE / "gaia.csv").open(newline="") as handle:
        rows = {row["source_id"].strip(): row for row in csv.DictReader(handle)}
    if set(rows) != expected_ids:
        missing = sorted(expected_ids - set(rows), key=int)
        extra = sorted(set(rows) - expected_ids, key=int)
        raise ValueError(f"Gaia physical source coverage drifted: {len(missing)} missing, {len(extra)} extra")
    if (PHYSICAL_SOURCE / "gaia.adql").read_text() != gaia_query_text():
        raise ValueError("Gaia physical query is stale")
    return rows


def exact_subset_rows(filename, query_filename, expected_query, identifier_column, expected_ids):
    with (PHYSICAL_SOURCE / filename).open(newline="") as handle:
        source_rows = list(csv.DictReader(handle))
    rows = {row[identifier_column].strip(): row for row in source_rows}
    if len(rows) != len(source_rows) or not set(rows).issubset(set(expected_ids)):
        raise ValueError(f"{filename} source identity coverage drifted")
    if (PHYSICAL_SOURCE / query_filename).read_text() != expected_query:
        raise ValueError(f"{query_filename} is stale")
    return rows


@cache
def distance_rows():
    return exact_subset_rows("distance.csv", "distance.adql", distance_query_text(), "source_id", landmark_gaia_ids())


@cache
def sed_rows():
    return exact_subset_rows("sed.csv", "sed.adql", sed_query_text(), "HIP", landmark_hip_ids())


@cache
def fundamental_rows():
    return exact_subset_rows("fundamental.csv", "fundamental.adql", fundamental_query_text(), "HIP", landmark_hip_ids())


@cache
def distance_overrides():
    with (PHYSICAL_SOURCE / "distance-overrides.csv").open(newline="") as handle:
        return {row["main_id"]: row for row in csv.DictReader(handle)}


@cache
def physical_overrides():
    with (PHYSICAL_SOURCE / "physical-overrides.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    valid_main_ids = set()
    for directory in (WESTERN_SOURCE, CLUSTER_SOURCE):
        with (directory / "simbad.csv").open(newline="") as handle:
            valid_main_ids.update(row["main_id"] for row in csv.DictReader(handle))
    if any(row["main_id"] not in valid_main_ids or row["field"] not in PHYSICAL_FIELDS for row in rows):
        raise ValueError("Physical override identity or field drifted")
    return rows


@cache
def radial_velocity_overrides():
    with (PHYSICAL_SOURCE / "radial-velocity-overrides.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    valid_main_ids = set()
    for directory in (WESTERN_SOURCE, CLUSTER_SOURCE):
        with (directory / "simbad.csv").open(newline="") as handle:
            valid_main_ids.update(row["main_id"] for row in csv.DictReader(handle))
    if len({row["main_id"] for row in rows}) != len(rows) or any(row["main_id"] not in valid_main_ids for row in rows):
        raise ValueError("Radial-velocity override identity coverage drifted")
    for row in rows:
        if float(row["radial_velocity_error_kms"]) < 0 or not row["reference"] or not row["source"] or not row["url"]:
            raise ValueError(f"Invalid radial-velocity override for {row['main_id']}")
    return {row["main_id"]: row for row in rows}


def angular_separation_arcsec(first_ra, first_dec, second_ra, second_dec):
    first_ra, first_dec, second_ra, second_dec = map(math.radians, (first_ra, first_dec, second_ra, second_dec))
    cosine = math.sin(first_dec) * math.sin(second_dec) + math.cos(first_dec) * math.cos(second_dec) * math.cos(first_ra - second_ra)
    return math.degrees(math.acos(max(-1, min(1, cosine)))) * 3600


@cache
def curated_physical_rows():
    result = []
    for catalog_id in ("bright-stars", "nearest-1000"):
        path = ROOT / f"src/data/catalogs/{catalog_id}/stars.csv"
        with path.open(newline="") as handle:
            result.extend((catalog_id, row) for row in csv.DictReader(handle) if row["id"] != "sun")
    return result


@cache
def bright_id_by_simbad_id():
    with (ROOT / "catalog-work/bright-stars/simbad.csv").open(newline="") as handle:
        return {row["main_id"]: row["id"] for row in csv.DictReader(handle)}


def curated_physical_match(source, name):
    bright_id = bright_id_by_simbad_id().get(source["main_id"]) or CURATED_COMPONENT_IDS.get(source["main_id"])
    if bright_id:
        match = next((item for item in curated_physical_rows() if item[0] == "bright-stars" and item[1]["id"] == bright_id), None)
        if match:
            return match
    normalized_name = name.casefold()
    for catalog_id, candidate in curated_physical_rows():
        if candidate["name"].casefold() == normalized_name:
            return catalog_id, candidate
        if candidate.get("ra_deg") and angular_separation_arcsec(
            float(source["ra"]), float(source["dec"]), float(candidate["ra_deg"]), float(candidate["dec_deg"]),
        ) <= 1:
            return catalog_id, candidate
    return None


def eligible_gaia_physical(source):
    identifier = gaia_dr3_id(source)
    if identifier is None:
        return {}, []
    gaia = gaia_rows()[identifier]
    flame_flags = (gaia.get("flags_flame") or "").strip()
    definitions = (
        ("temperature_k", "teff_gspphot", "teff_gspphot_lower", "teff_gspphot_upper", True),
        ("metallicity_dex", "mh_gspphot", "mh_gspphot_lower", "mh_gspphot_upper", True),
        ("mass_solar", "mass_flame", "mass_flame_lower", "mass_flame_upper", len(flame_flags) == 2 and flame_flags[0] == "0"),
        ("luminosity_solar", "lum_flame", "lum_flame_lower", "lum_flame_upper", len(flame_flags) == 2 and flame_flags[1] in {"0", "2"}),
        ("radius_solar", "radius_flame", "radius_flame_lower", "radius_flame_upper", len(flame_flags) == 2 and flame_flags[1] in {"0", "2"}),
        ("age_gyr", "age_flame", "age_flame_lower", "age_flame_upper", len(flame_flags) == 2 and flame_flags[0] == "0"),
    )
    values = {}
    observations = []
    for field, column, lower_column, upper_column, eligible in definitions:
        value = optional_number(gaia.get(column))
        if not eligible or value is None or (field != "metallicity_dex" and value <= 0):
            continue
        lower = optional_number(gaia.get(lower_column))
        upper = optional_number(gaia.get(upper_column))
        uncertainty = max(value - lower, upper - value) if lower is not None and upper is not None else None
        values[field] = str(round(value)) if field == "temperature_k" else str(value)
        observations.append({
            "field": field, "value": value, "uncertainty": uncertainty, "status": "model-derived",
            "source": "Gaia DR3 astrophysical_parameters", "sourceId": identifier, "qualityFlags": flame_flags,
        })
    return values, observations


def published_hip_physical(source):
    identifier = hip_id(source)
    if identifier is None:
        return {}, []
    fundamental = fundamental_rows().get(identifier, {})
    sed = sed_rows().get(identifier, {})
    values = {}
    observations = []

    def adopt(field, value, uncertainty, source_name, bibcode, status="model-derived"):
        if value is None or not math.isfinite(value) or value <= 0:
            return
        values[field] = str(round(value)) if field == "temperature_k" else str(value)
        observations.append({
            "field": field, "value": value, "uncertainty": uncertainty, "status": status,
            "source": source_name, "sourceId": f"HIP {identifier}", "bibcode": bibcode,
        })

    if fundamental:
        log_temperature = optional_number(fundamental.get("logTeff"))
        log_temperature_error = optional_number(fundamental.get("e_logTeff"))
        if log_temperature is not None:
            temperature = 10 ** log_temperature
            temperature_error = temperature * math.log(10) * log_temperature_error if log_temperature_error is not None else None
            adopt("temperature_k", temperature, temperature_error, "Allende Prieto & Lambert 1999", "1999A&A...352..555A")
        if source["otype"] not in SYSTEM_TYPES:
            adopt(
                "mass_solar", optional_number(fundamental.get("Mass")), optional_number(fundamental.get("e_Mass")),
                "Allende Prieto & Lambert 1999", "1999A&A...352..555A",
            )
            log_radius = optional_number(fundamental.get("logRad"))
            log_radius_error = optional_number(fundamental.get("e_logRad"))
            if log_radius is not None:
                radius = 10 ** log_radius
                radius_error = radius * math.log(10) * log_radius_error if log_radius_error is not None else None
                adopt("radius_solar", radius, radius_error, "Allende Prieto & Lambert 1999", "1999A&A...352..555A")
    if sed:
        source_distance = optional_number(sed.get("Dist"))
        if source_distance is not None and source_distance > 0:
            if "temperature_k" not in values:
                adopt("temperature_k", optional_number(sed.get("Teff")), None, "McDonald et al. 2012", "2012MNRAS.427..343M")
            luminosity = optional_number(sed.get("Lum"))
            distance, _ = adopted_distance(source)
            if luminosity is not None:
                luminosity *= (distance / source_distance) ** 2
                adopt("luminosity_solar", luminosity, None, "McDonald et al. 2012 SED rescaled to adopted distance", "2012MNRAS.427..343M")
    return values, observations


def enrich_physical(row, source):
    adopted = {}
    observations = []
    curated = curated_physical_match(source, row["name"])
    if curated:
        catalog_id, candidate = curated
        for field in PHYSICAL_FIELDS:
            if candidate[field]:
                row[field] = candidate[field]
                if field == "metallicity_dex":
                    row["metallicity_kind"] = candidate["metallicity_kind"]
                adopted[field] = f"{catalog_id}:{candidate['id']}"
                observations.append({"field": field, "value": float(candidate[field]), "status": "inherited", "source": catalog_id, "sourceId": candidate["id"]})
    for override in physical_overrides():
        if override["main_id"] != source["main_id"] or row[override["field"]]:
            continue
        field = override["field"]
        row[field] = override["value"]
        adopted[field] = f"targeted:{override['source_id']}"
        observations.append({
            "field": field, "value": float(override["value"]),
            "uncertainty": optional_number(override.get("uncertainty")), "status": "literature",
            "source": override["source"], "sourceId": override["source_id"], "note": override["note"],
        })
    published_values, published_observations = published_hip_physical(source)
    for field, value in published_values.items():
        if not row[field]:
            row[field] = value
            source_id = next(observation["bibcode"] for observation in published_observations if observation["field"] == field)
            adopted[field] = f"published:{source_id}:HIP-{hip_id(source)}"
            observations.extend(observation for observation in published_observations if observation["field"] == field)
    gaia_values, gaia_observations = eligible_gaia_physical(source)
    for field, value in gaia_values.items():
        if not row[field]:
            row[field] = value
            if field == "metallicity_dex":
                row["metallicity_kind"] = "[M/H]"
            adopted[field] = f"gaia-dr3:{gaia_dr3_id(source)}"
            observations.extend(observation for observation in gaia_observations if observation["field"] == field)
    temperature = optional_number(row["temperature_k"])
    radius = optional_number(row["radius_solar"])
    luminosity = optional_number(row["luminosity_solar"])
    if temperature and radius and not luminosity:
        luminosity = radius ** 2 * (temperature / 5772) ** 4
        row["luminosity_solar"] = f"{luminosity:.6f}"
        adopted["luminosity_solar"] = "derived:stefan-boltzmann"
        observations.append({"field": "luminosity_solar", "value": luminosity, "status": "derived", "source": "Stefan-Boltzmann scaling"})
    elif temperature and luminosity and not radius:
        radius = math.sqrt(luminosity) / (temperature / 5772) ** 2
        row["radius_solar"] = f"{radius:.6f}"
        adopted["radius_solar"] = "derived:stefan-boltzmann"
        observations.append({"field": "radius_solar", "value": radius, "status": "derived", "source": "Stefan-Boltzmann scaling"})
    if adopted:
        inherited = [field for field, source_id in adopted.items() if not source_id.startswith("gaia-dr3:")]
        gaia = [field for field, source_id in adopted.items() if source_id.startswith("gaia-dr3:")]
        details = []
        reviewed = [field for field, source_id in adopted.items() if source_id.startswith(("bright-stars:", "nearest-1000:"))]
        targeted = [field for field, source_id in adopted.items() if source_id.startswith("targeted:")]
        published = [field for field, source_id in adopted.items() if source_id.startswith("published:")]
        derived = [field for field, source_id in adopted.items() if source_id.startswith("derived:")]
        if reviewed:
            details.append(f"reviewed Star View values for {', '.join(reviewed)}")
        if targeted:
            details.append(f"targeted literature values for {', '.join(targeted)}")
        if published:
            details.append(f"published Hipparcos-source models for {', '.join(published)}")
        if gaia:
            details.append(f"Gaia DR3 model values for {', '.join(gaia)}")
        if derived:
            details.append(f"Stefan-Boltzmann scaling for {', '.join(derived)}")
        row["notes"] += f" Physical parameters: {'; '.join(details)}."
    shared_enrichment = enrich_from_frozen(row, source["main_id"], aliases(source))
    adopted.update({field: f"shared:{item['reference']}" for field, item in shared_enrichment.items()})
    observations.extend(shared_enrichment.values())
    return {
        "gaiaDr3Id": gaia_dr3_id(source),
        "adoptedPhysicalFields": adopted,
        "physicalObservations": observations,
    }


def adopted_distance(source):
    override = distance_overrides().get(source["main_id"])
    if override:
        distance = float(override["distance_pc"])
        return distance, {
            "method": override["method"], "distancePc": distance,
            "lowerPc": optional_number(override.get("distance_lower_pc")),
            "upperPc": optional_number(override.get("distance_upper_pc")),
            "source": override["source"], "sourceId": override["source_id"],
            "note": override["note"],
        }
    gaia_identifier = gaia_dr3_id(source)
    posterior = distance_rows().get(gaia_identifier) if gaia_identifier else None
    if posterior:
        distance = float(posterior["r_med_geo"])
        return distance, {
            "method": "Bailer-Jones EDR3 geometric posterior median", "distancePc": distance,
            "lowerPc": optional_number(posterior.get("r_lo_geo")),
            "upperPc": optional_number(posterior.get("r_hi_geo")),
            "source": "Bailer-Jones et al. 2021", "sourceId": gaia_identifier,
        }
    parallax = float(source["plx_value"])
    distance = 1000 / parallax
    error = optional_number(source.get("plx_err"))
    return distance, {
        "method": "inverse SIMBAD compiled parallax", "distancePc": distance,
        "parallaxSignalToNoise": parallax / error if error else None,
        "source": "SIMBAD TAP snapshot 2026-10-01", "sourceId": source["main_id"],
    }


def source_row(source, identifier, name, constellation, context, visual_magnitude, photometry):
    ra = math.radians(float(source["ra"]))
    dec = math.radians(float(source["dec"]))
    parallax = float(source["plx_value"])
    distance, distance_provenance = adopted_distance(source)
    radial = (math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec))
    east = (-math.sin(ra), math.cos(ra), 0)
    north = (-math.sin(dec) * math.cos(ra), -math.sin(dec) * math.sin(ra), math.cos(dec))
    position = matrix_vector(ICRS_TO_GALACTIC, tuple(distance * value for value in radial))
    source_radial_velocity = source["rvz_radvel"].strip()
    radial_velocity_override = radial_velocity_overrides().get(source["main_id"])
    radial_velocity = radial_velocity_override["radial_velocity_kms"] if radial_velocity_override else source_radial_velocity
    radial_velocity_error = radial_velocity_override["radial_velocity_error_kms"] if radial_velocity_override else ""
    radial_velocity_reference = radial_velocity_override["reference"] if radial_velocity_override else "SIMBAD TAP snapshot 2026-10-01" if radial_velocity else ""
    velocity = None
    if radial_velocity:
        scale = 4.74047 * distance / 1000
        equatorial_velocity = tuple(
            east[index] * scale * float(source["pmra"]) +
            north[index] * scale * float(source["pmdec"]) +
            radial[index] * float(radial_velocity)
            for index in range(3)
        )
        velocity = matrix_vector(ICRS_TO_GALACTIC, equatorial_velocity)
    absolute_magnitude = visual_magnitude - 5 * math.log10(distance / 10)
    row = {header: "" for header in HEADERS}
    row.update({
        "type": "star", "id": identifier, "name": name,
        "spectral_type": source["sp_type"],
        "x_pc": f"{position[0]:.9f}", "y_pc": f"{position[1]:.9f}", "z_pc": f"{position[2]:.9f}",
        "absolute_mag": f"{absolute_magnitude:.6f}", "epoch": "2000.0",
        "notes": f"{context} SIMBAD identity {source['main_id']}; {photometry}; {distance_provenance['method']} distance; absolute V uses no extinction correction.",
        "constellation": constellation, "ra_deg": source["ra"], "dec_deg": source["dec"],
        "astrometry_epoch": "2000.0", "parallax_mas": source["plx_value"],
        "parallax_error_mas": source["plx_err"], "pm_ra_cosdec_masyr": source["pmra"],
        "pm_dec_masyr": source["pmdec"], "radial_velocity_kms": radial_velocity,
        "radial_velocity_error_kms": radial_velocity_error,
        "astrometry_ref": "SIMBAD TAP snapshot 2026-10-01",
        "radial_velocity_ref": radial_velocity_reference,
    })
    radial_velocity_provenance = {
        "status": "reviewed-literature-override" if radial_velocity_override else "simbad-compiled" if radial_velocity else "unknown",
        "frozenSimbadValueKms": optional_number(source_radial_velocity),
        "adoptedValueKms": optional_number(radial_velocity),
        "uncertaintyKms": optional_number(radial_velocity_error),
        "reference": radial_velocity_reference or None,
    }
    if radial_velocity_override:
        radial_velocity_provenance.update({
            "source": radial_velocity_override["source"],
            "url": radial_velocity_override["url"],
            "note": radial_velocity_override["note"],
        })
        row["notes"] += f" Motion RV: {radial_velocity} +/- {radial_velocity_error} km/s from {radial_velocity_override['source']}; reviewed literature override."
    if velocity is not None:
        row.update({"vx_kms": f"{velocity[0]:.6f}", "vy_kms": f"{velocity[1]:.6f}", "vz_kms": f"{velocity[2]:.6f}"})
    return row, distance_provenance, radial_velocity_provenance


def sun_row():
    with DEFAULT_CATALOG.open(newline="") as handle:
        source = next(row for row in csv.DictReader(handle) if row["id"] == "sun")
    return {header: value for header, value in adopt_solar_reference(source).items() if header in HEADERS}


def csv_text(rows):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=HEADERS, lineterminator="\n")
    writer.writeheader()
    writer.writerows({header: row.get(header, "") for header in HEADERS} for row in rows)
    return output.getvalue()


def western_catalog():
    index = json.loads((WESTERN_SOURCE / "stellarium-western-index.json").read_text())
    constellations = {entry["iau"]: entry["common_name"]["native"] for entry in index["constellations"]}
    hips = {}
    for entry in index["constellations"]:
        for line in entry.get("lines", []):
            for hip in line:
                if isinstance(hip, int):
                    hips.setdefault(hip, set()).add(entry["iau"])
    with (WESTERN_SOURCE / "simbad.csv").open(newline="") as handle:
        simbad = {int(row["query_id"].removeprefix("HIP ")): row for row in csv.DictReader(handle)}
    with (WESTERN_SOURCE / "hipparcos-v.csv").open(newline="") as handle:
        hipparcos_v = {int(row["hip"]): row for row in csv.DictReader(handle)}
    if len(hips) != 691 or set(hips) != set(simbad) or set(hips) != set(hipparcos_v):
        raise ValueError("Western figure source identity coverage drifted")
    rows = []
    provenance = {"sun": solar_provenance()}
    for hip in sorted(hips):
        source = simbad[hip]
        memberships = sorted(hips[hip])
        designation = re.search(r"\b(?:alf|bet|gam|del|eps|zet|eta|tet|iot|kap|lam|mu\.|nu\.|ksi|omi|pi\.|rho|sig|tau|ups|phi|chi|psi|ome)\d{0,2}\s+([A-Z][A-Za-z]{2})\b", source["main_id"])
        constellation_code = designation.group(1) if designation and designation.group(1) in memberships else memberships[0]
        simbad_v = (source.get("v") or source.get("V") or "").strip()
        fallback = hipparcos_v[hip]["johnson_v"].strip()
        if not simbad_v and not fallback:
            raise ValueError(f"No Johnson V for HIP {hip}")
        visual_magnitude = float(simbad_v or fallback)
        photometry = f"SIMBAD compiled Johnson V={simbad_v}" if simbad_v else f"Hipparcos Johnson V={fallback} (SIMBAD V unavailable)"
        row, distance, radial_velocity = source_row(
            source, f"hip-{hip}", display_name(source), constellations[constellation_code],
            f"Western constellation line-figure star (HIP {hip}; Stellarium {', '.join(memberships)}).",
            visual_magnitude, photometry,
        )
        physical = enrich_physical(row, source)
        rows.append(row)
        provenance[row["id"]] = {
            "hip": hip,
            "figureConstellations": memberships,
            "displayConstellation": constellations[constellation_code],
            "simbadId": source["main_id"],
            "visualMagnitudeSource": "SIMBAD compiled Johnson V" if simbad_v else "Hipparcos main catalogue Johnson V",
            "adoptedDistance": distance,
            "radialVelocity": radial_velocity,
            **physical,
        }
    if len({row["id"] for row in rows}) != 691:
        raise ValueError("Western figure output IDs are not unique")
    rows, expansion, companion_sources = expand_overlay("western-constellation-stars", rows, provenance)
    adopt_shared_objects(rows, provenance)
    rows.sort(key=lambda row: math.hypot(float(row["x_pc"]), float(row["y_pc"]), float(row["z_pc"])))
    manifest = {
        "schemaVersion": 1,
        "id": "western-constellation-stars",
        "label": "Western constellation stars",
        "description": "All unique Hipparcos vertices in Stellarium's Western constellation figures with reviewed individual companions, plus the Sun.",
        "epoch": 2000,
        "objectCount": len(rows) + 1,
        "sources": [
            {"name": "Stellarium Western sky culture line figures, commit 014fbb5", "url": "https://github.com/Stellarium/stellarium-skycultures/blob/014fbb5e59233d133c22f9811af96b67d05a95c9/western/index.json"},
            {"name": "SIMBAD TAP snapshot; exact Hipparcos identity, astrometry, classification and compiled Johnson V", "url": "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"},
            {"name": "Hipparcos main catalogue; Johnson V fallback", "url": "https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239"},
            {"name": "Bailer-Jones et al. 2021 Gaia EDR3 geometric distances; exact Gaia source identifiers", "url": "https://bailer-jones.www3.mpia.de/gedr3_distances.html"},
            {"name": "Argyle et al. 2015 binary-orbit solution for Beta Phoenicis", "url": "https://doi.org/10.1002/asna.201412166"},
            {"name": "Kasikov et al. 2026 co-moving group distance for x Carinae", "url": "https://doi.org/10.1051/0004-6361/202558527"},
            {"name": "Maldonado et al. 2010 radial velocity for Tabit", "url": "https://doi.org/10.1051/0004-6361/201014948"},
            {"name": "Cazorla et al. 2017 radial velocities for Tau Scorpii", "url": "https://doi.org/10.1051/0004-6361/201629841"},
            {"name": "Hubrig et al. 2008 orbital systemic velocity for Theta Carinae", "url": "https://doi.org/10.1051/0004-6361:200810124"},
            {"name": "Allende Prieto & Lambert 1999 Hipparcos-star evolutionary models; exact HIP identifiers", "url": "https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/352/555"},
            {"name": "McDonald et al. 2012 Hipparcos-star SED models; exact HIP identifiers", "url": "https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/427/343"},
            {"name": "Gaia DR3 GSP-Phot and FLAME model parameters; exact Gaia DR3 identifiers", "url": "https://gea.esac.esa.int/tap-server/tap/sync"},
        ],
        "cutoffPolicy": "Every unique numeric Hipparcos vertex in all 88 Stellarium Western constellation line figures, plus reviewed companions of explicitly matched landmarks. Non-numeric drawing-style tokens are ignored. No apparent-magnitude cutoff is applied; Sun is included only as the map origin. Component-resolved records replace reviewed blended primaries.",
        "snapshot": "Stellarium commit 014fbb5e59233d133c22f9811af96b67d05a95c9; SIMBAD, Hipparcos, VizieR and Gaia snapshots frozen 2026-10-01; 691 original figure landmarks plus reviewed companions (2026-10-06) and Sun.",
    }
    manifest["sources"] += enrichment_sources()
    sources_by_url = {source["url"]: source for source in manifest["sources"]}
    for source in companion_sources:
        sources_by_url.setdefault(source["url"], source)
    manifest["sources"] = list(sources_by_url.values())
    provenance_payload = {
        "schemaVersion": 1,
        "catalogId": manifest["id"],
        "policy": manifest["cutoffPolicy"],
        "figureConstellations": len(index["constellations"]),
        "uniqueHipparcosStars": len(hips),
        "companionExpansion": expansion,
        "physicalCoverage": {field: sum(bool(row[field]) for row in rows) for field in PHYSICAL_FIELDS},
        "sharedEnrichmentManifestSha256": manifest_sha256(),
        "objects": provenance,
    }
    return {"catalog.json": json.dumps(manifest, indent=2) + "\n", "stars.csv": csv_text([sun_row(), *rows]), "provenance.json": json.dumps(provenance_payload, indent=2) + "\n"}


def cluster_catalog():
    selection = json.loads((CLUSTER_SOURCE / "selection.json").read_text())
    with (CLUSTER_SOURCE / "simbad.csv").open(newline="") as handle:
        simbad = {row["query_id"]: row for row in csv.DictReader(handle)}
    selected = [(group, star) for group in selection["groups"] for star in group["stars"]]
    if len(selected) != 42 or {star["queryId"] for _, star in selected} != set(simbad):
        raise ValueError("Famous-cluster source identity coverage drifted")
    rows = []
    provenance = {"sun": solar_provenance()}
    for group, selected_star in selected:
        query_id = selected_star["queryId"]
        source = simbad[query_id]
        expected_alias = CLUSTER_ALIASES.get(group["name"])
        if expected_alias and expected_alias not in compact_spaces(source["ids"]):
            raise ValueError(f"Missing {expected_alias} membership alias for {query_id}")
        visual_text = (source.get("v") or source.get("V") or "").strip()
        if not visual_text:
            raise ValueError(f"No Johnson V for {query_id}")
        identifier = f"hip-{query_id.removeprefix('HIP ')}" if query_id.startswith("HIP ") else "trapezium-" + re.sub(r"[^a-z0-9]+", "-", selected_star["name"].casefold()).strip("-")
        name = selected_star.get("name") or display_name(source)
        row, distance, radial_velocity = source_row(
            source, identifier, name, group["constellation"],
            f"{group['name']} landmark star; {group['selection']}", float(visual_text),
            f"SIMBAD compiled Johnson V={visual_text}",
        )
        physical = enrich_physical(row, source)
        rows.append(row)
        provenance[identifier] = {
            "group": group["name"], "queryId": query_id, "simbadId": source["main_id"],
            "selection": group["selection"], "adoptedDistance": distance,
            "radialVelocity": radial_velocity, **physical,
        }
    if len({row["id"] for row in rows}) != 42:
        raise ValueError("Famous-cluster output IDs are not unique")
    adopt_shared_objects(rows, provenance)
    manifest = {
        "schemaVersion": 1,
        "id": "famous-cluster-stars",
        "label": "Famous cluster stars",
        "description": "A compact landmark set for seven recognizable stellar groups, including the Orion Nebula's Trapezium.",
        "epoch": 2000,
        "objectCount": 43,
        "sources": [
            {"name": "SIMBAD TAP snapshot; exact identities, open-cluster aliases, astrometry, classification and compiled Johnson V", "url": "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"},
            {"name": "Bailer-Jones et al. 2021 Gaia EDR3 geometric distances; exact Gaia source identifiers", "url": "https://bailer-jones.www3.mpia.de/gedr3_distances.html"},
            {"name": "Hubrig et al. 2008 orbital systemic velocity for Theta Carinae", "url": "https://doi.org/10.1051/0004-6361:200810124"},
            {"name": "Allende Prieto & Lambert 1999 Hipparcos-star evolutionary models; exact HIP identifiers", "url": "https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/352/555"},
            {"name": "McDonald et al. 2012 Hipparcos-star SED models; exact HIP identifiers", "url": "https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/427/343"},
            {"name": "Gaia DR3 GSP-Phot and FLAME model parameters; exact Gaia DR3 identifiers", "url": "https://gea.esac.esa.int/tap-server/tap/sync"},
            {"name": "Component-resolved literature parameters for the four classical Trapezium systems", "url": "https://doi.org/10.1093/mnras/stab1119"}
        ],
        "cutoffPolicy": "Named Pleiades systems (the Seven Sisters, Atlas and Pleione), the classical Theta1 Orionis A-D Trapezium systems, and the brightest distance-consistent SIMBAD catalogued members of the Hyades, Coma Star Cluster, IC 2602, IC 2391 and the Beehive. Foreground Aldebaran and Gamma Comae Berenices are excluded. This is a visual landmark set, not a complete membership census. Sun is included only as the map origin.",
        "snapshot": "SIMBAD, VizieR and Gaia snapshots frozen 2026-10-01; 42 stars in seven landmark groups plus Sun.",
    }
    manifest["sources"] += enrichment_sources()
    provenance_payload = {
        "schemaVersion": 1, "catalogId": manifest["id"], "policy": manifest["cutoffPolicy"],
        "groups": selection["groups"], "physicalCoverage": {field: sum(bool(row[field]) for row in rows) for field in PHYSICAL_FIELDS},
        "sharedEnrichmentManifestSha256": manifest_sha256(),
        "objects": provenance,
    }
    return {"catalog.json": json.dumps(manifest, indent=2) + "\n", "stars.csv": csv_text([sun_row(), *rows]), "provenance.json": json.dumps(provenance_payload, indent=2) + "\n"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--write-source-queries", action="store_true")
    args = parser.parse_args()
    if args.write_source_queries:
        PHYSICAL_SOURCE.mkdir(parents=True, exist_ok=True)
        (PHYSICAL_SOURCE / "gaia.adql").write_text(gaia_query_text())
        (PHYSICAL_SOURCE / "distance.adql").write_text(distance_query_text())
        (PHYSICAL_SOURCE / "sed.adql").write_text(sed_query_text())
        (PHYSICAL_SOURCE / "fundamental.adql").write_text(fundamental_query_text())
        return
    for output, files in ((WESTERN_OUTPUT, western_catalog()), (CLUSTER_OUTPUT, cluster_catalog())):
        if args.write:
            output.mkdir(parents=True, exist_ok=True)
            for name, content in files.items():
                (output / name).write_text(content)
        else:
            for name, content in files.items():
                if not (output / name).exists() or (output / name).read_text() != content:
                    raise SystemExit(f"Landmark catalog is stale: run {Path(__file__).name} --write")


if __name__ == "__main__":
    main()
