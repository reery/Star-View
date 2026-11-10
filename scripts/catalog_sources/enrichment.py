"""Share frozen, exact-identity physical sources across all stellar catalogs.

Existing values win. No positional/name guesses, generic binary masses, or
main-sequence mass/luminosity estimates are introduced by this fallback layer.
"""

import csv
import json
import math
import re
from collections import Counter
from functools import cache
from pathlib import Path
from statistics import median

from .adapters import eligible_gaia_physical, read_gaia_tap
from .metallicity import metallicity_kind
from .snapshots import sha256, verify_sha256

ROOT = Path(__file__).resolve().parents[2]
FIELDS = ("temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr")
SYSTEM_TYPES = {"**", "EB*", "SB*", "bC*", "s*b"}
MANIFEST = ROOT / "catalog-work/shared-enrichment/source-manifest.json"
LITERATURE = "catalog-work/shared-enrichment/literature"
# Exact-identity snapshot for CNS5 objects beyond the nearest-1000 buffer. It is
# opt-in so that existing catalogs keep their frozen enrichment byte for byte.
# `extended=True` selects it; a snapshot directory selects that snapshot instead.
EXTENSION = "catalog-work/nearest-5000"
# SIMBAD mesFe_h rows that reproduce Gaia DR3 GSP-Phot values (76 of 77 identical
# Teff and [M/H]); they are photometric model values, not spectroscopy.
GAIA_REPUBLICATIONS = {"2024A&A...681A.107R"}


def extension_directory(extended):
    return EXTENSION if extended is True else extended


@cache
def extension_rows(name, directory=EXTENSION):
    manifest = json.loads((ROOT / directory / "source-manifest.json").read_text())
    if name not in manifest["checksumsSha256"]:
        return []
    verify_sha256(ROOT / directory / name, manifest["checksumsSha256"][name])
    return csv_rows(f"{directory}/{name}")


def normalized_id(value):
    return " ".join((value or "").split())


def csv_rows(relative):
    with (ROOT / relative).open(newline="") as handle:
        return list(csv.DictReader(handle))


@cache
def source_index(extended=False):
    manifest = json.loads(MANIFEST.read_text())
    for filename, digest in manifest["checksumsSha256"].items():
        verify_sha256(ROOT / filename, digest)
    sources = {}
    for directory in ("nearest-1000", "bright-stars", "western-constellation-stars", "famous-cluster-stars"):
        for row in csv_rows(f"catalog-work/{directory}/simbad.csv"):
            key = normalized_id(row["main_id"])
            merged = sources.setdefault(key, {})
            # Bright-star rows lack aliases; retain identifiers from richer exports.
            merged.update({k: v for k, v in row.items() if v})
    crossmatch = csv_rows("catalog-work/physical-supplements/crossmatch.csv")
    counts = Counter(normalized_id(row["simbad_id"]) for row in crossmatch if row["simbad_id"])
    identities = {row["star_view_id"]: normalized_id(row["simbad_id"])
                  for row in crossmatch if row["simbad_id"] and counts[normalized_id(row["simbad_id"])] == 1}
    fundamental = {row["HIP"]: row for row in csv_rows("catalog-work/landmark-stars/fundamental.csv")}
    sed = {row["HIP"]: row for row in csv_rows("catalog-work/landmark-stars/sed.csv")}
    measured = {normalized_id(row["main_id"]): row for row in csv_rows("catalog-work/bright-stars/parameters.csv")}
    diameters = {normalized_id(row["main_id"]): row for row in csv_rows("catalog-work/bright-stars/diameters.csv")}
    # Retain bright-star coverage outside the constellation figure selection.
    for row in csv_rows("catalog-work/bright-stars/fundamental.csv"):
        fundamental.setdefault(row["hip"], {"HIP": row["hip"], "Mass": row["mass_solar"], "e_Mass": row["mass_error_solar"],
                                           "logRad": row["log_radius_solar"], "logTeff": row["log_temperature_k"]})
    for row in csv_rows("catalog-work/bright-stars/sed.csv"):
        sed.setdefault(row["hip"], {"HIP": row["hip"], "Dist": row["distance_pc"], "Teff": row["temperature_k"], "Lum": row["luminosity_solar"]})
    # The older subsets covered constellation figures and bright landmarks only.
    # This snapshot queries the union of exact identifiers across every catalog.
    for row in csv_rows(f"{LITERATURE}/fundamental.csv"):
        fundamental.setdefault(row["HIP"], row)
    for row in csv_rows(f"{LITERATURE}/sed.csv"):
        sed.setdefault(row["HIP"], row)
    gaia = {}
    for directory in ("nearest-1000", "landmark-stars"):
        for record in read_gaia_tap(ROOT / f"catalog-work/{directory}/gaia.csv"):
            gaia.setdefault(record.identity.gaia_dr3_id, record)
    bright_hips = {normalized_id(row["main_id"]): row["hip"] for filename in ("fundamental", "sed")
                   for row in csv_rows(f"catalog-work/bright-stars/{filename}.csv")}
    if extended:
        # Fill only identities absent from the earlier snapshots.
        directory = extension_directory(extended)
        for row in extension_rows("simbad.csv", directory):
            sources.setdefault(normalized_id(row["main_id"]), {k: v for k, v in row.items() if v})
        for row in extension_rows("fundamental.csv", directory):
            fundamental.setdefault(row["HIP"], row)
        for row in extension_rows("sed.csv", directory):
            sed.setdefault(row["HIP"], row)
        for record in read_gaia_tap(ROOT / directory / "gaia.csv"):
            gaia.setdefault(record.identity.gaia_dr3_id, record)
    return sources, identities, fundamental, sed, measured, diameters, gaia, bright_hips


SUPPLEMENTS = ("catalog-work/shared-enrichment/gaia-supplement", "catalog-work/shared-enrichment/vizier-supplement")
# Riello et al. 2021, Table C.2: G - V as a cubic in BP - RP. Checked against 3,458 SIMBAD V values:
# robust scatter 0.028 mag, offsets within 0.03 mag below BP - RP = 3; redder M dwarfs come out 0.07-0.27 mag too bright.
G_MINUS_V = (-0.02704, 0.01424, -0.2156, 0.01426)
G_MINUS_V_COLOURS = (-0.5, 3.0)
# Unblended BP/RP photometry: |C*| below 0.05 (corrected excess factor, Riello et al. 2021 eq. 6).
MAX_CORRECTED_EXCESS = 0.05
# Recio-Blanco et al. 2023, Table 3: field-star [M/H] calibration in uncalibrated log g. With all first 13 flags zero,
# calibrated values lie within 0.08 dex (robust) of spectroscopic [Fe/H] for 4000-7000 K; outside that range they do not.
GSP_SPEC_MH = (0.274, -0.1373, -0.0050, 0.0048)
GSP_SPEC_TEFF = (4000, 7000)
# Isochrone ages whose 68 percent half-width exceeds 30 percent of the median are too loose to adopt.
AGE_MAX_RELATIVE_HALF_WIDTH = 0.3
AU_SOLAR_RADII = 215.032


def corrected_excess(bp_rp, excess):
    """Riello et al. 2021 eq. 6, as published in the Gaia team's reference code."""
    if bp_rp < 0.5:
        return excess - (1.154360 + 0.033772 * bp_rp + 0.032277 * bp_rp ** 2)
    if bp_rp < 4.0:
        return excess - (1.162004 + 0.011464 * bp_rp + 0.049255 * bp_rp ** 2 - 0.005879 * bp_rp ** 3)
    return excess - (1.057572 + 0.140537 * bp_rp)


def _age_candidate(median_age, low, high, scale, reference, record_id, method):
    values = [number(value) for value in (median_age, low, high)]
    if None in values or values[0] <= 0:
        return None
    middle, lower, upper = (value * scale for value in values)
    width = (upper - lower) / 2 / middle
    return {"value": middle, "lower": lower, "upper": upper, "relativeHalfWidth": width, "reference": reference,
            "sourceRecordId": record_id, "method": method} if width <= AGE_MAX_RELATIVE_HALF_WIDTH else None


@cache
def supplement_index():
    """Gaia DR3 photometry and GSP-Spec rows by source ID, qualifying isochrone ages by HIP, JMDC diameters by space-free name."""
    for directory in SUPPLEMENTS:
        manifest = json.loads((ROOT / directory / "source-manifest.json").read_text())
        for name, digest in manifest["checksumsSha256"].items():
            verify_sha256(ROOT / directory / name, digest)
    gaia_rows = {row["source_id"]: row for row in csv_rows(f"{SUPPLEMENTS[0]}/gaia.csv")}
    ages = {}
    for row in csv_rows(f"{SUPPLEMENTS[1]}/casagrande2011.csv"):
        # Photometry that includes several components gives no single-star age.
        candidate = None if row["m_Name"] else _age_candidate(row["ageMB"], row["age16B"], row["age84B"], 1, "2011A&A...530A.138C", f"HIP {row['HIP']}",
                                                                "BaSTI isochrone median and 16-84 percent range (Geneva-Copenhagen re-analysis)")
        if candidate:
            ages.setdefault(row["HIP"], []).append(candidate)
    for row in csv_rows(f"{SUPPLEMENTS[1]}/david2015.csv"):
        # Age68t below 68 marks a posterior cut off by the model grid.
        candidate = _age_candidate(row["Agemed"], row["Age68lo"], row["Age68up"], 1e-3, "2015ApJ...804..146D", f"HIP {row['HIP']}",
                                   "Strömgren-photometry isochrone median and 68 percent range") if row["Age68t"] == "68" else None
        if candidate:
            ages.setdefault(row["HIP"], []).append(candidate)
    diameters = {}
    for row in csv_rows(f"{SUPPLEMENTS[1]}/jmdc.csv"):
        # A blank error marks a measurement in doubt; binarity notes mark blended or companion-affected fits. Keck nuller
        # diameters (2014ApJ...797..119M) are exozodi-survey by-products with large systematics (Gamma Lep: 1.87 mas
        # against about 1.25 mas); every kept value must be precise to 5 percent.
        diameter, error, notes = number(row["LDdiam"]), number(row["e_LDdiam"]), row["Notes"].lower()
        if diameter and error and error <= .05 * diameter and "kin (nuller)" not in notes and "binary" not in notes and "doubt" not in notes:
            diameters.setdefault("".join(row["ID1"].split()), []).append(row)
    return gaia_rows, ages, diameters


def gaia_visual_magnitude(gaia_id):
    """Johnson V from the exact Gaia DR3 source's G and BP - RP where the colour is validated and the photometry unblended."""
    row = supplement_index()[0].get(gaia_id or "")
    if not row or row["duplicated_source"] == "true" or not (row["phot_g_mean_mag"] and row["bp_rp"] and row["phot_bp_rp_excess_factor"]):
        return None
    colour = float(row["bp_rp"])
    if not G_MINUS_V_COLOURS[0] <= colour < G_MINUS_V_COLOURS[1] or abs(corrected_excess(colour, float(row["phot_bp_rp_excess_factor"]))) >= MAX_CORRECTED_EXCESS:
        return None
    return float(row["phot_g_mean_mag"]) - sum(coefficient * colour ** power for power, coefficient in enumerate(G_MINUS_V)), {
        "method": "Gaia DR3 G and BP-RP transformed to Johnson V (Riello et al. 2021, Table C.2; 0.03 mag scatter)",
        "reference": "2021A&A...649A...3R", "sourceId": gaia_id, "G": float(row["phot_g_mean_mag"]), "BP-RP": colour}


def gsp_spec_metallicity(gaia_id):
    """Calibrated Gaia DR3 GSP-Spec [M/H] for best-quality RVS solutions of 4000-7000 K stars."""
    row = supplement_index()[0].get(gaia_id or "")
    if not row or not row["mh_gspspec"] or not row["flags_gspspec"].startswith("0" * 13):
        return None
    if not GSP_SPEC_TEFF[0] <= float(row["teff_gspspec"]) < GSP_SPEC_TEFF[1]:
        return None
    gravity = float(row["logg_gspspec"])
    lower, upper = number(row["mh_gspspec_lower"]), number(row["mh_gspspec_upper"])
    return {"value": float(row["mh_gspspec"]) + sum(coefficient * gravity ** power for power, coefficient in enumerate(GSP_SPEC_MH)),
            "uncertainty": (upper - lower) / 2 if lower is not None and upper is not None else None}


def manifest_sha256():
    source_index()
    return sha256(MANIFEST)


def enrichment_sources():
    return json.loads(MANIFEST.read_text())["sources"]


@cache
def temperature_sequence():
    return json.loads((ROOT / "catalog-work/nearest-100/source-input.json").read_text())["temperatureSequenceKelvin"]


def sequence_temperature(family, subtype):
    sequence = sorted((float(key[1:-1]), value) for key, value in temperature_sequence().items() if key.startswith(family))
    exact = next((value for number, value in sequence if number == subtype), None)
    if exact is None:
        lower = [(number, value) for number, value in sequence if number < subtype]
        upper = [(number, value) for number, value in sequence if number > subtype]
        if not lower or not upper:
            return None
        low, high = lower[-1], upper[0]
        exact = round(low[1] + (high[1] - low[1]) * (subtype - low[0]) / (high[0] - low[0]))
    return exact


def estimate_temperature(row):
    if row.get("temperature_k") or row["id"] == "sun":
        return {}
    spectrum = re.sub(r"\s+", "", row.get("spectral_type", ""))
    pattern = r"([OBAFGKM])(\d(?:\.\d+)?)V(?:e)?" if row["type"] == "star" else r"([LTY])(\d(?:\.\d+)?)(?:V)?" if row["type"] in {"brown_dwarf", "sub_brown_dwarf"} else None
    match = re.fullmatch(pattern, spectrum) if pattern else None
    if not match:
        return {}
    exact = sequence_temperature(match.group(1), float(match.group(2)))
    if exact is None:
        return {}
    row["temperature_k"] = str(exact)
    row["notes"] += f" Estimated temperature from Pecaut-Mamajek 2022.04.16 {spectrum} mean dwarf sequence (interpolation where needed); not an object-specific measurement."
    return {"temperature_k": {"field": "temperature_k", "value": exact, "status": "estimated", "reference": "Pecaut-Mamajek 2022.04.16", "spectralType": spectrum}}


def number(value):
    if value is None or str(value).strip() == "":
        return None
    result = float(value)
    return result if math.isfinite(result) else None


@cache
def spectroscopy_index(extended=False):
    index = {}
    for observation in csv_rows(f"{LITERATURE}/spectroscopy.csv"):
        index.setdefault(normalized_id(observation["main_id"]), []).append(observation)
    if extended:
        additions = {}
        for observation in extension_rows("spectroscopy.csv", extension_directory(extended)):
            if normalized_id(observation["main_id"]) not in index:
                additions.setdefault(normalized_id(observation["main_id"]), []).append(observation)
        index.update(additions)
    return index


def contradicts_spectral_type(observation, spectral_type):
    """Teff over 20% from the Pecaut-Mamajek sequence of an F-M dwarf (class V or none).

    Giants, O-A peculiar/rotating stars and ultracool dwarfs are not checked.
    """
    teff = number(observation.get("teff"))
    spectrum = re.sub(r"\s+", "", spectral_type or "")
    match = re.match(r"([FGKM])(\d(?:\.\d+)?)", spectrum)
    if teff is None or not match or "I" in spectrum:
        return False
    expected = sequence_temperature(match.group(1), float(match.group(2)))
    return expected is not None and abs(teff - expected) > .2 * expected


def select_spectroscopy(observations, column, spectral_type=None):
    """Use a recent, consensus-compatible measurement; withhold conflicts.

    This is not a new averaged measurement. Values and bibliography remain those
    of the selected paper, and the complete raw measurement pool remains frozen.
    """
    consistent = consistent_spectroscopy(observations, column, spectral_type)
    return newest_spectroscopy(consistent) if consistent else None


def newest_spectroscopy(observations):
    return max(observations, key=lambda item: (item["bibcode"][:4], item["bibcode"], int(item.get("mespos") or 0)))


def consistent_spectroscopy(observations, column, spectral_type=None, bounds=None):
    """Measurements within tolerance of a strict-majority median; empty on conflict.

    Survey grids (RAVE, LAMOST, APOGEE Net) can return their edge for cool dwarfs.
    Such solutions contradict the spectral type, and their [Fe/H] is equally
    unusable. Three agreeing papers instead indicate a wrong spectral type.
    `bounds` limits log g to the range plausible for the object's class.
    """
    conflicting = [item for item in observations if contradicts_spectral_type(item, spectral_type)]
    if conflicting:
        center = median(float(item["teff"]) for item in conflicting)
        if len({item["bibcode"] for item in conflicting if abs(float(item["teff"]) - center) <= .1 * center}) < 3:
            observations = [item for item in observations if item not in conflicting]
    candidates = []
    for observation in observations:
        value = number(observation.get(column))
        reference = observation.get("bibcode", "")
        if value is None or not re.match(r"(?:19|20)\d{2}", reference) or reference in GAIA_REPUBLICATIONS:
            continue
        if column == "teff" and not 1000 <= value <= 100000:
            continue
        if column == "fe_h" and not -5 <= value <= 1.5:
            continue
        if bounds and not bounds[0] <= value <= bounds[1]:
            continue
        candidates.append(observation)
    if not candidates:
        return []
    center = median(float(item[column]) for item in candidates)
    tolerance = .3 if column in ("fe_h", "log_g") else .1 * center
    consistent = [item for item in candidates if abs(float(item[column]) - center) <= tolerance]
    if not consistent or len(consistent) <= len(candidates) / 2 and len(candidates) > 1:
        return []
    return consistent


def flame_withheld(gaia_temperature, temperature=None, metallicity=None, gaia_metallicity=None):
    """Gaia DR3 FLAME fields that an adopted spectroscopic value invalidates.

    FLAME radius follows from its luminosity and the GSP-Phot temperature; mass
    and age also assume solar-metallicity BaSTI tracks (Gaia DR3 documentation 11.3.6).
    A temperature offset beyond 2% exceeds GSP-Phot's typical accuracy. Gaia's own
    GSP-Phot [M/H] beyond 0.3 dex either breaks that assumption or marks an
    unreliable GSP-Phot solution (Andrae et al. 2023, 2023A&A...674A..27A).
    """
    withheld = set()
    if gaia_temperature is not None and temperature is not None and abs(gaia_temperature - temperature) > 0.02 * temperature:
        withheld |= {"radius_solar", "mass_solar", "age_gyr"}
    if any(value is not None and abs(value) > 0.3 for value in (metallicity, gaia_metallicity)):
        withheld |= {"mass_solar", "age_gyr"}
    return withheld


@cache
def reviewed_physical():
    existing = json.loads((ROOT / "catalog-work/shared-enrichment/reviewed-physical.json").read_text())["objects"]
    ultracool = json.loads((ROOT / "catalog-work/shared-enrichment/reviewed-ultracool.json").read_text())["objects"]
    bright_review = json.loads((ROOT / "catalog-work/bright-stars/gap-physical-review.json").read_text())
    for path, digest in bright_review["inputSha256"].items():
        verify_sha256(ROOT / path, digest)
    bright = bright_review["catalogObjects"]
    cluster_review = json.loads((ROOT / "catalog-work/famous-cluster-stars/physical-review.json").read_text())
    for path, digest in cluster_review["inputSha256"].items():
        verify_sha256(ROOT / path, digest)
    cluster = {normalized_id(key): value for key, value in cluster_review["catalogObjects"].items()}
    if len(cluster) != len(cluster_review["catalogObjects"]):
        raise ValueError("Duplicate normalized cluster review identity")
    white_dwarf_review = json.loads((ROOT / "catalog-work/shared-enrichment/reviewed-white-dwarfs.json").read_text())
    for path, digest in white_dwarf_review["inputSha256"].items():
        verify_sha256(ROOT / path, digest)
    white_dwarfs = white_dwarf_review["objects"]
    target_review = json.loads((ROOT / "catalog-work/bright-western-enrichment-20261021/physical-review.json").read_text())
    for path, digest in target_review["inputSha256"].items():
        verify_sha256(ROOT / path, digest)
    targets = {normalized_id(key): value for key, value in target_review["catalogObjects"].items()}
    if len(targets) != len(target_review["catalogObjects"]):
        raise ValueError("Duplicate normalized 151-target review identity")
    if any(review["objectType"] != "white_dwarf" for review in white_dwarfs.values()):
        raise ValueError("White dwarf reviews must declare their object type")
    if (existing.keys() & ultracool.keys() or (existing.keys() | ultracool.keys()) & bright.keys()
            or (existing.keys() | ultracool.keys() | bright.keys()) & cluster.keys()
            or (existing.keys() | ultracool.keys() | bright.keys() | cluster.keys()) & white_dwarfs.keys()):
        raise ValueError("Reviewed physical identities must be unique")
    combined = existing | ultracool | bright | cluster | white_dwarfs
    if combined.keys() & targets.keys():
        raise ValueError("151-target reviews must not replace an earlier object review")
    return combined | targets


def derive_physical(row):
    """Complete Stefan-Boltzmann triples, recording the actual input values."""
    if row["id"] == "sun":
        return {}
    temperature, radius, luminosity = (number(row.get(field)) for field in ("temperature_k", "radius_solar", "luminosity_solar"))
    if not temperature or temperature <= 0:
        return {}
    if radius and radius > 0 and luminosity is None:
        field, value = "luminosity_solar", radius ** 2 * (temperature / 5772) ** 4
        inputs = {"temperature_k": temperature, "radius_solar": radius}
    elif luminosity and luminosity > 0 and radius is None:
        field, value = "radius_solar", math.sqrt(luminosity) / (temperature / 5772) ** 2
        inputs = {"temperature_k": temperature, "luminosity_solar": luminosity}
    else:
        return {}
    row[field] = format(value, ".10g")
    row["notes"] += f" {field} derived by Stefan-Boltzmann scaling from adopted inputs (solar Teff=5772 K); inherits their measurement/model/estimate assumptions."
    return {field: {"field": field, "value": float(row[field]), "status": "derived", "reference": "Stefan-Boltzmann scaling", "inputs": inputs}}


def contradicts_class(teff, spectral_type, tolerance):
    """Teff beyond `tolerance` of the Pecaut-Mamajek temperature of its spectral class and subtype, any luminosity class."""
    # Am notation (kA6hA9mF0) states the class after a prefix.
    match = re.search(r"([OBAFGKM])(\d(?:\.\d+)?)", re.sub(r"\s+", "", spectral_type or ""))
    expected = sequence_temperature(match.group(1), float(match.group(2))) if match and teff is not None else None
    return expected is not None and abs(teff - expected) > tolerance * expected


def enrich_from_frozen(row, main_id=None, aliases=(), derive=True, reviewed_only=False, extended=False, gaia_fields=FIELDS, class_tolerance=None, withheld=None):
    """`withheld`, when given, collects the Gaia FLAME values that the adopted values invalidate."""
    sources, identities, fundamental, sed, measured, diameters, gaia, bright_hips = source_index(extended)
    key = normalized_id(main_id or identities.get(row["id"]))
    source = sources.get(key, {})
    adopted = {}

    def adopt(field, value, reference, status="model-derived", uncertainty=None, **detail):
        value = number(value)
        if row.get(field) or value is None or (field != "metallicity_dex" and value <= 0):
            return
        row[field] = str(round(value)) if field == "temperature_k" else format(value, ".10g")
        if field == "metallicity_dex":
            row["metallicity_kind"] = metallicity_kind(detail.get("quantity"))
        adopted[field] = {"field": field, "value": float(row[field]), "status": status,
                          "reference": reference, "uncertainty": uncertainty, "identity": key, **detail}

    if row["type"] in {"star", "brown_dwarf", "sub_brown_dwarf", "white_dwarf"} and key:
        review = reviewed_physical().get(key)
        # Stellar reviews never describe white dwarfs; only explicitly typed white dwarf reviews apply to them.
        if review and row["type"] == "white_dwarf" and review.get("objectType") != "white_dwarf":
            review = None
        if review:
            if review.get("objectType", row["type"]) != row["type"] or row["id"] not in review.get("starViewIds", [row["id"]]):
                raise ValueError(f"Reviewed ultracool identity/type drifted: {key}")
            for field, observation in review["fields"].items():
                if field not in FIELDS:
                    raise ValueError(f"Unknown reviewed physical field: {field}")
                superseded = None
                if field == "temperature_k" and observation.get("replaceSpectralTypeEstimate"):
                    pattern = r"\s*(?:Estimated: Pecaut-Mamajek 2022\.04\.16 .*?mean dwarf class, not a measured temperature\.|Estimated temperature from Pecaut-Mamajek 2022\.04\.16 .*?not an object-specific measurement\.)"
                    if row.get(field) and re.search(pattern, row["notes"]):
                        superseded = {"value": float(row[field]), "status": "estimated", "reference": "Pecaut-Mamajek 2022.04.16 dwarf sequence"}
                        row[field] = ""
                        row["notes"] = re.sub(pattern, "", row["notes"])
                adopt(field, observation["value"], observation.get("reference", review["reference"]), observation["status"],
                      observation.get("uncertainty"), component=review["component"], scope=review["scope"],
                      section=observation.get("section"), caveat=observation.get("caveat"),
                      quantity=observation.get("quantity"), sourceUrl=observation.get("url", review["url"]),
                      **{name: observation[name] for name in ("inputs", "sourceRecordId", "method") if name in observation})
                if superseded is not None:
                    adopted[field]["superseded"] = superseded
            if adopted:
                row["notes"] += f" Reviewed physical values describe {review['label']}. {review['scope']} {review['note']}"
    if reviewed_only:
        # Let explicitly reviewed corrections precede an overlay's automatic
        # catalog models without also pulling in other fallback sources.
        return adopted
    if row["type"] == "star" and key:
        identifiers = set(normalized_id(alias) for alias in aliases)
        identifiers.update(normalized_id(alias) for alias in source.get("ids", "").split("|"))
        # The bright subset explicitly records exact Hipparcos identifiers.
        if key in bright_hips:
            identifiers.add(f"HIP {bright_hips[key]}")
        hips = {alias.removeprefix("HIP ") for alias in identifiers if re.fullmatch(r"HIP \d+", alias)}
        hip = next(iter(hips)) if len(hips) == 1 else None
        model = fundamental.get(hip, {})
        sed_model = sed.get(hip, {})
        measurement = measured.get(key, {})
        system = source.get("otype") in SYSTEM_TYPES
        # Previously reviewed measurement choices retain priority over an
        # automatic recent/consensus selection from the larger literature pool.
        adopt("temperature_k", measurement.get("teff"), measurement.get("bibcode", "SIMBAD mesFe_h"), "measured")
        adopt("metallicity_dex", measurement.get("fe_h"), measurement.get("bibcode", "SIMBAD mesFe_h"), "measured", quantity="photospheric [Fe/H]")
        for column, field in (("teff", "temperature_k"), ("fe_h", "metallicity_dex")):
            if row.get(field):
                continue
            observations = [item for item in spectroscopy_index(extended).get(key, [])
                            if not class_tolerance or not contradicts_class(number(item.get("teff")), row.get("spectral_type"), class_tolerance)]
            observation = select_spectroscopy(observations, column, row.get("spectral_type"))
            if observation:
                adopt(field, observation[column], observation["bibcode"], "measured",
                      sourceRecordId=f"{key}:mesFe_h:{observation['mespos']}",
                      quantity="photospheric [Fe/H]" if column == "fe_h" else "spectroscopic effective temperature",
                      selection="Newest within 0.3 dex / 10 percent of the median; strict majority required for multiple observations",
                      scope="SIMBAD object as catalogued; unresolved spectra may be primary-dominated" if system else "catalogued stellar object")
        gaia_ids = {alias.removeprefix("Gaia DR3 ") for alias in identifiers if re.fullmatch(r"Gaia DR3 \d+", alias)}
        gaia_id = next(iter(gaia_ids)) if len(gaia_ids) == 1 else None
        # RVS spectroscopy outranks the photometric GSP-Phot [M/H]; a published [Fe/H] consensus outranks both.
        spectroscopic = gsp_spec_metallicity(gaia_id)
        if spectroscopic:
            adopt("metallicity_dex", spectroscopic["value"], "2023A&A...674A..29R", "measured", spectroscopic["uncertainty"], sourceRecordId=f"Gaia DR3 {gaia_id}",
                  quantity="Gaia DR3 GSP-Spec RVS [M/H], field-star log g calibration",
                  selection="All first 13 GSP-Spec flags zero; GSP-Spec Teff 4000-7000 K",
                  scope="SIMBAD object as catalogued; unresolved spectra may be primary-dominated" if system else "catalogued stellar object")
        metallicity = number(row.get("metallicity_dex"))
        if metallicity is None:
            metallicity = number(measurement.get("fe_h"))
        diameter = diameters.get(key, {})
        if diameter:
            adopt("radius_solar", float(diameter["diameter_km"]) / 1391400, diameter["bibcode"], "derived")
        # Direct angular diameters: the most precise limb-darkened value within 10 percent of the median, held by a strict majority.
        names = {"".join(alias.removeprefix("* ").split()) for alias in identifiers}
        measurements = [] if system else [item for name in sorted(names) for item in supplement_index()[2].get(name, [])]
        if measurements:
            center = median(float(item["LDdiam"]) for item in measurements)
            consistent = [item for item in measurements if abs(float(item["LDdiam"]) - center) <= .1 * center]
            if len(consistent) * 2 > len(measurements):
                best = min(consistent, key=lambda item: float(item["e_LDdiam"]) / float(item["LDdiam"]))
                distance = math.hypot(*(float(row[field]) for field in ("x_pc", "y_pc", "z_pc")))
                radius = float(best["LDdiam"]) / 2000 * distance * AU_SOLAR_RADII
                adopt("radius_solar", radius, best["BibCode"], "derived", radius * float(best["e_LDdiam"]) / float(best["LDdiam"]),
                      sourceRecordId=f"JMDC {best['ID1']}", angularDiameterMas=float(best["LDdiam"]), band=best["Band"], distancePc=distance,
                      method="Limb-darkened angular diameter (JMDC, direct technique) and adopted distance; uncertainty from the diameter only",
                      selection="Most precise of the JMDC measurements within 10 percent of their median; strict majority required")
        physical = eligible_gaia_physical(gaia.get(gaia_id)) if gaia_id else {}
        # FLAME values follow from the GSP-Phot temperature, so a contradicted temperature withholds them all.
        if class_tolerance and "temperature_k" in physical and contradicts_class(physical["temperature_k"].value, row.get("spectral_type"), class_tolerance):
            physical = {}
        if class_tolerance:
            # Zero-reddening McDonald fits run systematically cool for O and B stars: in the naked-eye snapshot 129 of
            # 130 fits beyond 20 percent of their class were too cool, and half of the rest that have spectra miss them
            # by over 20 percent. Their temperature and luminosity are not used for these classes.
            if re.match(r"[OB]\d", row.get("spectral_type") or ""):
                sed_model = {}
            # A model temperature that contradicts the spectral class, or lies over 20 percent from the adopted
            # measurement (the hot-star review criterion), marks a failed solution; its mass, radius and luminosity go with it.
            measured_temperature = number(row.get("temperature_k"))

            def failed(teff):
                return teff is not None and (contradicts_class(teff, row.get("spectral_type"), class_tolerance)
                                             or measured_temperature is not None and abs(teff - measured_temperature) > .2 * measured_temperature)

            log_temperature = number(model.get("logTeff"))
            if log_temperature is not None and failed(10 ** log_temperature):
                model = {}
            if failed(number(sed_model.get("Teff"))):
                sed_model = {}
        if model:
            log_temperature = number(model.get("logTeff"))
            if log_temperature is not None:
                adopt("temperature_k", 10 ** log_temperature, "1999A&A...352..555A", sourceRecordId=f"HIP {hip}")
            if not system and (metallicity is None or abs(metallicity) <= 0.3):
                adopt("mass_solar", model.get("Mass"), "1999A&A...352..555A", uncertainty=number(model.get("e_Mass")), sourceRecordId=f"HIP {hip}")
            if not system:
                log_radius = number(model.get("logRad"))
                if log_radius is not None:
                    adopt("radius_solar", 10 ** log_radius, "1999A&A...352..555A", sourceRecordId=f"HIP {hip}")
        if sed_model:
            adopt("temperature_k", sed_model.get("Teff"), "2012MNRAS.427..343M", sourceRecordId=f"HIP {hip}")
            source_distance = number(sed_model.get("Dist"))
            luminosity = number(sed_model.get("Lum"))
            distance = math.hypot(*(float(row[field]) for field in ("x_pc", "y_pc", "z_pc")))
            if source_distance and luminosity:
                adopt("luminosity_solar", luminosity * (distance / source_distance) ** 2, "2012MNRAS.427..343M", sourceRecordId=f"HIP {hip}", sourceDistancePc=source_distance, adoptedDistancePc=distance)
        # Individual isochrone ages outrank Gaia FLAME; the tightest qualifying one wins.
        age = min(supplement_index()[1].get(hip, []), key=lambda item: item["relativeHalfWidth"], default=None)
        if age:
            adopt("age_gyr", age["value"], age["reference"], "model-derived", sourceRecordId=age["sourceRecordId"], method=age["method"],
                  lowerGyr=age["lower"], upperGyr=age["upper"])
        if physical:
            invalid = flame_withheld(physical["temperature_k"].value if "temperature_k" in physical else None, number(row.get("temperature_k")),
                                     number(row.get("metallicity_dex")) if row.get("metallicity_kind") == "[Fe/H]" else None,
                                     physical["metallicity_dex"].value if "metallicity_dex" in physical else None)
            for field, observation in physical.items():
                if field not in gaia_fields:
                    continue
                if field in invalid:
                    if withheld is not None:
                        withheld[field] = {"value": observation.value, "reference": observation.reference, "sourceRecordId": observation.source_record_id,
                                           "gspPhotTemperatureK": physical["temperature_k"].value if "temperature_k" in physical else None,
                                           "adoptedTemperatureK": number(row.get("temperature_k")),
                                           "reason": "FLAME assumes the GSP-Phot temperature and solar metallicity; the adopted, more accurate temperature differs "
                                                     "by over 2 percent or the metallicity lies beyond 0.3 dex"}
                    continue
                adopt(field, observation.value, observation.reference, observation.status, observation.uncertainty,
                      sourceRecordId=observation.source_record_id, qualityFlags=list(observation.quality_flags),
                      quantity="[M/H]" if field == "metallicity_dex" else None)
    if adopted:
        if "age_gyr" in adopted:
            row["notes"] = row["notes"].replace(" No component-resolved age was adopted from the reviewed sources.", "")
        details = "; ".join(f"{field}: {item['reference']}" for field, item in adopted.items())
        row["notes"] += f" Shared exact-identity physical supplements ({details})."
    adopted.update(estimate_temperature(row))
    if derive:
        adopted.update(derive_physical(row))
    return adopted
