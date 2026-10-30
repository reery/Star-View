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
EXTENSION = "catalog-work/nearest-5000"
# SIMBAD mesFe_h rows that reproduce Gaia DR3 GSP-Phot values (76 of 77 identical
# Teff and [M/H]); they are photometric model values, not spectroscopy.
GAIA_REPUBLICATIONS = {"2024A&A...681A.107R"}


@cache
def extension_rows(name):
    manifest = json.loads((ROOT / EXTENSION / "source-manifest.json").read_text())
    verify_sha256(ROOT / EXTENSION / name, manifest["checksumsSha256"][name])
    return csv_rows(f"{EXTENSION}/{name}")


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
        for row in extension_rows("simbad.csv"):
            sources.setdefault(normalized_id(row["main_id"]), {k: v for k, v in row.items() if v})
        for row in extension_rows("fundamental.csv"):
            fundamental.setdefault(row["HIP"], row)
        for row in extension_rows("sed.csv"):
            sed.setdefault(row["HIP"], row)
        for record in read_gaia_tap(ROOT / EXTENSION / "gaia.csv"):
            gaia.setdefault(record.identity.gaia_dr3_id, record)
    return sources, identities, fundamental, sed, measured, diameters, gaia, bright_hips


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
        for observation in extension_rows("spectroscopy.csv"):
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


def enrich_from_frozen(row, main_id=None, aliases=(), derive=True, reviewed_only=False, extended=False):
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
        measurement = measured.get(key, {})
        system = source.get("otype") in SYSTEM_TYPES
        # Previously reviewed measurement choices retain priority over an
        # automatic recent/consensus selection from the larger literature pool.
        adopt("temperature_k", measurement.get("teff"), measurement.get("bibcode", "SIMBAD mesFe_h"), "measured")
        adopt("metallicity_dex", measurement.get("fe_h"), measurement.get("bibcode", "SIMBAD mesFe_h"), "measured", quantity="photospheric [Fe/H]")
        for column, field in (("teff", "temperature_k"), ("fe_h", "metallicity_dex")):
            if row.get(field):
                continue
            observation = select_spectroscopy(spectroscopy_index(extended).get(key, []), column, row.get("spectral_type"))
            if observation:
                adopt(field, observation[column], observation["bibcode"], "measured",
                      sourceRecordId=f"{key}:mesFe_h:{observation['mespos']}",
                      quantity="photospheric [Fe/H]" if column == "fe_h" else "spectroscopic effective temperature",
                      selection="Newest within 0.3 dex / 10 percent of the median; strict majority required for multiple observations",
                      scope="SIMBAD object as catalogued; unresolved spectra may be primary-dominated" if system else "catalogued stellar object")
        metallicity = number(row.get("metallicity_dex"))
        if metallicity is None:
            metallicity = number(measurement.get("fe_h"))
        diameter = diameters.get(key, {})
        if diameter:
            adopt("radius_solar", float(diameter["diameter_km"]) / 1391400, diameter["bibcode"], "derived")
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
        sed_model = sed.get(hip, {})
        if sed_model:
            adopt("temperature_k", sed_model.get("Teff"), "2012MNRAS.427..343M", sourceRecordId=f"HIP {hip}")
            source_distance = number(sed_model.get("Dist"))
            luminosity = number(sed_model.get("Lum"))
            distance = math.sqrt(sum(float(row[field]) ** 2 for field in ("x_pc", "y_pc", "z_pc")))
            if source_distance and luminosity:
                adopt("luminosity_solar", luminosity * (distance / source_distance) ** 2, "2012MNRAS.427..343M", sourceRecordId=f"HIP {hip}", sourceDistancePc=source_distance, adoptedDistancePc=distance)
        gaia_ids = {alias.removeprefix("Gaia DR3 ") for alias in identifiers if re.fullmatch(r"Gaia DR3 \d+", alias)}
        if len(gaia_ids) == 1:
            physical = eligible_gaia_physical(gaia.get(next(iter(gaia_ids))))
            invalid = flame_withheld(physical["temperature_k"].value if "temperature_k" in physical else None, number(row.get("temperature_k")),
                                     number(row.get("metallicity_dex")) if row.get("metallicity_kind") == "[Fe/H]" else None,
                                     physical["metallicity_dex"].value if "metallicity_dex" in physical else None)
            for field, observation in physical.items():
                if field in invalid:
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
