"""Build the nearest-1000 package from frozen corrected CNS5/TAP snapshots."""

import argparse
import csv
import io
import importlib.util
import json
import math
import re
import shutil
from functools import cache
from pathlib import Path

import astropy
import astropy.units as units
from astropy.coordinates import SkyCoord, get_constellation
from astropy.time import Time
from astropy.utils import iers

from catalog_sources.adapters import eligible_gaia_physical, read_cns5, read_gaia_tap, read_simbad_tap
from catalog_sources.enrichment import enrich_from_frozen, enrichment_sources, manifest_sha256
from catalog_sources.metallicity import metallicity_kind
from catalog_sources.component_enrichment import enrich_component, component_sources, component_plan_sha256
from catalog_sources.filesystem import write_managed_files
from catalog_sources.mdwarf import SUPPLEMENT_FIELDS, load_supplements, resolve_supplemented_fields, row_context, supplement_observations
from catalog_sources.models import AstrometryObservation
from catalog_sources.snapshots import canonical_json, sha256, verify_sha256

iers.conf.auto_download = False
ROOT = Path(__file__).resolve().parents[1]
FROZEN = ROOT / "catalog-work/nearest-1000"
INDIVIDUAL_OVERRIDES = FROZEN / "individual-object-overrides.json"
REVIEWED_COMPANIONS = FROZEN / "reviewed-companions.json"
SUPPLEMENTS = ROOT / "catalog-work/physical-supplements"
LANDMARK_SOURCES = ROOT / "catalog-work/landmark-stars"
NEAREST100_INPUT = ROOT / "catalog-work/nearest-100/source-input.json"
NEAREST100_CSV = ROOT / "src/data/catalogs/nearest-100/stars.csv"
NEAREST100_PROVENANCE = ROOT / "src/data/catalogs/nearest-100/provenance.json"
DEFAULT_OUTPUT = ROOT / "src/data/catalogs/nearest-1000"
NAME_CORRECTIONS = {"Bo\u00f6tes": "Bootes", "Chamaleon": "Chamaeleon", "Ophiucus": "Ophiuchus", "Pisces Austrinus": "Piscis Austrinus"}
BASE_HEADERS = [
    "type", "id", "name", "designations", "spectral_type", "x_pc", "y_pc", "z_pc",
    "vx_kms", "vy_kms", "vz_kms", "temperature_k", "mass_solar",
    "luminosity_solar", "radius_solar", "metallicity_dex", "metallicity_kind", "age_gyr",
    "absolute_mag", "epoch", "notes", "constellation",
]

GREEK_DESIGNATIONS = {
    "alf": "Alpha", "bet": "Beta", "gam": "Gamma", "del": "Delta",
    "eps": "Epsilon", "zet": "Zeta", "eta": "Eta", "tet": "Theta",
    "iot": "Iota", "kap": "Kappa", "lam": "Lambda", "mu.": "Mu",
    "nu.": "Nu", "ksi": "Xi", "omi": "Omicron", "pi.": "Pi",
    "rho": "Rho", "sig": "Sigma", "tau": "Tau", "ups": "Upsilon",
    "phi": "Phi", "chi": "Chi", "psi": "Psi", "ome": "Omega",
}
RAW_HEADERS = [
    "ra_deg", "dec_deg", "astrometry_epoch", "parallax_mas", "parallax_error_mas",
    "pm_ra_cosdec_masyr", "pm_ra_error_masyr", "pm_dec_masyr", "pm_dec_error_masyr",
    "radial_velocity_kms", "radial_velocity_error_kms", "astrometry_ref", "radial_velocity_ref",
]
HEADERS = BASE_HEADERS + RAW_HEADERS
SOURCES = [
    {"name": "CNS5, Golovin et al., corrected 2023-12-13; membership and adopted astrometry", "url": "https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/ReadMe"},
    {"name": "SIMBAD TAP snapshot; exact CNS5 identity, classification, spectrum and compiled Johnson V", "url": "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"},
    {"name": "Gaia DR3 TAP snapshot; exact-ID radial velocities and GSP-Phot/FLAME physical estimates", "url": "https://gea.esac.esa.int/tap-server/tap/sync"},
    {"name": "Nearest 100 audited release; higher-curation shared-object overrides", "url": "https://cdsarc.cds.unistra.fr/ftp/J/A+A/650/A201/ReadMe"},
    {"name": f"Astropy {astropy.__version__}, IAU constellations using Roman 1987 boundaries", "url": "https://docs.astropy.org/en/stable/api/astropy.coordinates.get_constellation.html"},
    {"name": "Cifuentes et al. 2020, CARMENES M-dwarf luminosities, temperatures, radii and masses (J/A+A/642/A115); ranks above Gaia DR3", "url": "https://cdsarc.cds.unistra.fr/ftp/J/A+A/642/A115/ReadMe"},
    {"name": "Mann et al. 2019, absolute-Ks mass relation (2019ApJ...871...63M); ranks above Cifuentes and Gaia DR3 masses", "url": "https://ui.adsabs.harvard.edu/abs/2019ApJ...871...63M/abstract"},
    {"name": "Mann et al. 2015, absolute-Ks radius relation (2015ApJ...804...64M); ranks below Cifuentes, above Gaia DR3 radii", "url": "https://ui.adsabs.harvard.edu/abs/2015ApJ...804...64M/abstract"},
    {"name": "2MASS All-Sky Point Source Catalog Ks photometry (VizieR II/246)", "url": "https://cdsarc.cds.unistra.fr/viz-bin/cat/II/246"},
    {"name": "Maldonado et al. 2010 radial velocity for Tabit (HIP 22449)", "url": "https://doi.org/10.1051/0004-6361/201014948"},
    {"name": "Chubak et al. 2012 preprint, Table 3 resolved HD 4614 (Achird A) radial velocity", "url": "https://arxiv.org/abs/1207.6212"},
    {"name": "Mamajek et al. 2013, Fomalhaut C individual-component membership review", "url": "https://arxiv.org/abs/1310.0764"},
    {"name": "Reyle et al. 2023 10pc census; individually reviewed missing companion records", "url": "https://cdsarc.cds.unistra.fr/ftp/J/A+A/650/A201/ReadMe"},
    {"name": "Burgasser et al. 2000, resolved GJ 570 ABC and brown-dwarf D membership", "url": "https://arxiv.org/abs/astro-ph/0001194"},
    {"name": "Forveille et al. 1999, GJ 570 BC individual dynamical masses and orbital parallax", "url": "https://arxiv.org/abs/astro-ph/9909342"},
    {"name": "Adibekyan et al. 2016, individually observed Zeta Reticuli components", "url": "https://arxiv.org/abs/1605.01918"},
    {"name": "Winterhalder et al. 2024, WT 766 directly detected substellar companion and dynamical masses", "url": "https://arxiv.org/abs/2403.13055"},
    {"name": "Xuan et al. 2024, resolved Gliese 229 Ba/Bb masses and ATMO physical parameters", "url": "https://arxiv.org/abs/2410.11953"},
    {"name": "Golimowski et al. 2007, resolved GJ 1001 BC membership and L4.5 spectra; hypothetical individual masses not adopted", "url": "https://static.cambridge.org/content/id/urn%3Acambridge.org%3Aid%3Aarticle%3AS1743921307004255/resource/name/golimowski.pdf"},
    {"name": "Dedrick et al. 2025, GJ 105 AC resolved membership and dynamical masses", "url": "https://arxiv.org/abs/2505.08042"},
    {"name": "Woitas et al. 2003, resolved Gliese 22 AC with outer B", "url": "https://arxiv.org/abs/astro-ph/0305330"},
    {"name": "Jodar et al. 2013, Gliese 835 resolved close pair", "url": "https://academic.oup.com/mnras/article/429/1/859/1028530"},
    {"name": "Mason et al. 2018, HD 50281 Ba/Bb speckle resolution", "url": "https://arxiv.org/abs/1804.07845"},
    {"name": "ESO eso1214 and corrected CNS5 spectra, GJ 667 ABC membership", "url": "https://www.eso.org/public/news/eso1214/"},
    {"name": "Marcussen et al. 2026 preprint, Mu Her Aa/Ab/B/C membership and dynamical masses", "url": "https://arxiv.org/abs/2604.12492"},
    {"name": "Delfosse et al. 2000, GJ 661 resolved component masses", "url": "https://arxiv.org/abs/astro-ph/0010586"},
    {"name": "Delfosse et al. 1999, GJ 268 double-lined binary", "url": "https://citeseerx.ist.psu.edu/document?doi=632dc4feecc21ebe55cdf3c697ec4831dbbbb9e6&repid=rep1&type=pdf"},
    {"name": "Segransan et al. 2000, GJ 644 five-member system and inner A/Ba/Bb masses", "url": "https://arxiv.org/abs/astro-ph/0010585"},
    {"name": "Zapatero Osorio et al. 2004, resolved GJ 569 Ba/Bb membership and spectra", "url": "https://arxiv.org/abs/astro-ph/0407334"},
    {"name": "Burgasser et al. 2010, Ross 458 AB pair and wide C membership", "url": "https://arxiv.org/abs/1009.5722"},
    {"name": "Torres et al. 2015, Capella resolved giant-pair properties and wide H/L membership", "url": "https://arxiv.org/abs/1505.07461"},
    {'name': 'Farrington et al. 2010, resolved Chi Draconis binary', 'url': 'https://chara.gsu.edu/files/papers/2010_Farrington_AJ_139_2308.pdf'},
    {'name': 'Bond et al. 2020, HST Mu Cassiopeiae component masses', 'url': 'https://arxiv.org/abs/2010.06609'},
    {'name': 'Koenig et al. 2002, direct detection of Chi1 Orionis B', 'url': 'https://arxiv.org/abs/astro-ph/0209404'},
    {'name': 'Morel et al. 2001, Zeta Herculis stellar binary', 'url': 'https://arxiv.org/abs/astro-ph/0110004'},
    {'name': 'Boden and Koresko 1998, resolved Iota Pegasi orbit and masses', 'url': 'https://arxiv.org/abs/astro-ph/9811029'},
    {'name': 'Schnupp et al. 2010, directly imaged HD 104304 companion', 'url': 'https://arxiv.org/abs/1005.0620'},
    {'name': 'Torres 2006, Gamma Cephei stellar binary orbit', 'url': 'https://arxiv.org/abs/astro-ph/0609638'},
    {'name': 'Tsvetkova et al. 2023, GJ 867 AC resolved double-line stellar binary', 'url': 'https://arxiv.org/abs/2312.04247'},
]


def source_manifest():
    manifest = json.loads((FROZEN / "source-manifest.json").read_text())
    for name, digest in manifest["checksumsSha256"].items():
        verify_sha256(FROZEN / name, digest)
    if manifest["bufferSize"] != 1100:
        raise ValueError("Nearest-1000 source buffer must contain 1100 ranked CNS5 candidates")
    return manifest


def shared_rows_and_cns5_map():
    rows = list(csv.DictReader(io.StringIO(NEAREST100_CSV.read_text())))
    provenance = json.loads(NEAREST100_PROVENANCE.read_text())
    frozen = json.loads(NEAREST100_INPUT.read_text())
    sequence_by_id = {item["id"]: item.get("sourceRow") for item in provenance["objects"]}
    cns5_by_sequence = {sequence: match["cns5"] for match in frozen["cns5Matches"] for sequence in match["sequences"]}
    mapping = {}
    for row in rows:
        if row["id"] == "sun":
            continue
        sequence = sequence_by_id[row["id"]]
        cns5_id = cns5_by_sequence.get(sequence)
        if cns5_id:
            mapping.setdefault(cns5_id, []).append(row["id"])
    if len(rows) != 101 or len(mapping) != 89 or sum(map(len, mapping.values())) != 94:
        raise ValueError("Curated nearest-100 identity mapping drifted")
    return rows, mapping


def simbad_by_cns5():
    result = {}
    for record in read_simbad_tap(FROZEN / "simbad.csv"):
        query_id = (record.raw or {}).get("query_id", "")
        if not query_id.startswith("CNS5 ") or query_id.removeprefix("CNS5 ") in result:
            raise ValueError(f"SIMBAD CNS5 identity is missing or ambiguous: {record.identity.source_record_id}")
        result[query_id.removeprefix("CNS5 ")] = record
    return result


def source_type(simbad_type):
    if simbad_type == "WD*":
        return "white_dwarf"
    if simbad_type in {"BD*", "LM*"}:
        return "brown_dwarf"
    return "star"


def display_name(simbad):
    raw = simbad.raw or {}
    main_id = raw.get("main_id") or simbad.identity.simbad_id
    common_names = sorted(
        alias.removeprefix("NAME ").strip()
        for alias in simbad.identity.aliases
        if alias.startswith("NAME ") and alias.removeprefix("NAME ").strip()
    )
    if common_names:
        return min(common_names, key=lambda name: (len(name), name.casefold()))
    name = re.sub(r"^(?:V\*|\*\*|\*)\s+", "", main_id.removeprefix("NAME ")).strip()
    match = re.match(r"^(alf|bet|gam|del|eps|zet|eta|tet|iot|kap|lam|mu\.|nu\.|ksi|omi|pi\.|rho|sig|tau|ups|phi|chi|psi|ome)(\d{2})?\s+(.+)$", name)
    if match:
        greek, component, remainder = match.groups()
        suffix = str(int(component)) if component else ""
        return f"{GREEK_DESIGNATIONS[greek]}{suffix} {remainder}"
    return re.sub(r"\s+", " ", name)


@cache
def radial_velocity_overrides():
    rows = []
    for directory in (LANDMARK_SOURCES, FROZEN):
        manifest = json.loads((directory / "source-manifest.json").read_text())
        path = directory / "radial-velocity-overrides.csv"
        verify_sha256(path, manifest["checksumsSha256"][path.name])
        with path.open(newline="") as handle:
            rows.extend(csv.DictReader(handle))
    if len({row["main_id"] for row in rows}) != len(rows):
        raise ValueError("Reviewed radial-velocity override identities must be unique")
    return {row["main_id"]: row for row in rows}


def reviewed_radial_velocity(simbad, astrometry):
    override = radial_velocity_overrides().get((simbad.raw or {}).get("main_id"))
    if override is None:
        return None
    if simbad.identity.gaia_dr3_id != override["gaia_dr3_id"]:
        raise ValueError(f"Reviewed radial-velocity Gaia identity drifted: {override['main_id']}")
    return AstrometryObservation(
        source_id="reviewed-literature-rv",
        source_record_id=f"HIP {override['hip_id']}",
        ra_deg=astrometry.ra_deg,
        dec_deg=astrometry.dec_deg,
        epoch=astrometry.epoch,
        parallax_mas=astrometry.parallax_mas,
        pm_ra_cosdec_masyr=astrometry.pm_ra_cosdec_masyr,
        pm_dec_masyr=astrometry.pm_dec_masyr,
        radial_velocity_kms=float(override["radial_velocity_kms"]),
        radial_velocity_error_kms=float(override["radial_velocity_error_kms"]) if override["radial_velocity_error_kms"] else None,
        radial_velocity_ref=override["reference"],
        quality_flags=(override["source"], override["note"]),
    )


def radial_velocity_choice(astrometry, gaia, object_type, reviewed=None):
    gaia_astrometry = gaia.astrometry if gaia is not None else None
    observation = next((candidate for candidate in (reviewed, astrometry, gaia_astrometry)
                        if candidate is not None and candidate.radial_velocity_kms is not None), None)
    if observation is None:
        return None, "unknown"
    if object_type == "white_dwarf":
        return observation, "withheld-white-dwarf"
    if observation is reviewed:
        return observation, "reviewed-literature-override"
    return observation, "compiled-cns5" if observation is astrometry else "gaia-dr3-fallback"


def radial_velocity_provenance(observation, status):
    result = {"status": status}
    if observation is not None:
        result["observation"] = {
            "sourceId": observation.source_id,
            "sourceRecordId": observation.source_record_id,
            "valueKms": observation.radial_velocity_kms,
            "uncertaintyKms": observation.radial_velocity_error_kms,
            "reference": observation.radial_velocity_ref,
            "qualityFlags": list(observation.quality_flags),
        }
    return result


def normalize(record, simbad, gaia, supplements):
    astrometry = record.astrometry
    raw = simbad.raw or {}
    object_type = source_type(raw.get("otype"))
    radial_velocity, radial_velocity_status = radial_velocity_choice(astrometry, gaia, object_type, reviewed_radial_velocity(simbad, astrometry))
    use_rv = radial_velocity is not None and radial_velocity_status != "withheld-white-dwarf"
    motion = {"radial_velocity": radial_velocity.radial_velocity_kms * units.km / units.s} if use_rv else {}
    motion_note = {
        "compiled-cns5": "Full source space motion.",
        "gaia-dr3-fallback": "Full source space motion using exact-ID Gaia DR3 radial velocity fallback.",
        "reviewed-literature-override": "Full source space motion using a reviewed literature radial velocity override.",
    }.get(radial_velocity_status, "Transverse-only source motion; radial velocity unavailable or withheld.")
    if radial_velocity_status == "reviewed-literature-override":
        motion_note += " " + radial_velocity.quality_flags[-1]
    original = SkyCoord(
        ra=astrometry.ra_deg * units.deg,
        dec=astrometry.dec_deg * units.deg,
        distance=1000 / astrometry.parallax_mas * units.pc,
        pm_ra_cosdec=astrometry.pm_ra_cosdec_masyr * units.mas / units.yr,
        pm_dec=astrometry.pm_dec_masyr * units.mas / units.yr,
        obstime=Time(astrometry.epoch, format="jyear", scale="tt"),
        frame="icrs",
        **motion,
    )
    shifted = original.apply_space_motion(new_obstime=Time(2000.0, format="jyear", scale="tt"))
    direction = SkyCoord(ra=shifted.ra, dec=shifted.dec, distance=shifted.distance, frame="icrs")
    position = direction.galactic.cartesian.xyz.to_value(units.pc)
    velocity = original.galactic.velocity.d_xyz.to_value(units.km / units.s) if use_rv else None
    identifier = f"cns5-{int(record.identity.source_record_id):04d}"
    name = display_name(simbad)
    constellation = get_constellation(direction, short_name=False, constellation_list="iau").strip()
    row = {header: "" for header in HEADERS}
    row.update({
        "type": object_type,
        "id": identifier,
        "name": name,
        "spectral_type": raw.get("sp_type") or "",
        "x_pc": f"{position[0]:.9f}",
        "y_pc": f"{position[1]:.9f}",
        "z_pc": f"{position[2]:.9f}",
        "epoch": "2000.0",
        "notes": f"Corrected CNS5 {record.identity.source_record_id}; J2000 Sun-relative Galactic position. SIMBAD exact CNS5 identity. {motion_note}",
        "constellation": NAME_CORRECTIONS.get(constellation, constellation),
        "ra_deg": str(astrometry.ra_deg),
        "dec_deg": str(astrometry.dec_deg),
        "astrometry_epoch": str(astrometry.epoch),
        "parallax_mas": str(astrometry.parallax_mas),
        "parallax_error_mas": "" if astrometry.parallax_error_mas is None else str(astrometry.parallax_error_mas),
        "pm_ra_cosdec_masyr": str(astrometry.pm_ra_cosdec_masyr),
        "pm_ra_error_masyr": "" if astrometry.pm_ra_error_masyr is None else str(astrometry.pm_ra_error_masyr),
        "pm_dec_masyr": str(astrometry.pm_dec_masyr),
        "pm_dec_error_masyr": "" if astrometry.pm_dec_error_masyr is None else str(astrometry.pm_dec_error_masyr),
        "radial_velocity_kms": str(radial_velocity.radial_velocity_kms) if use_rv else "",
        "radial_velocity_error_kms": str(radial_velocity.radial_velocity_error_kms) if use_rv and radial_velocity.radial_velocity_error_kms is not None else "",
        "astrometry_ref": astrometry.astrometry_ref or "CNS5 corrected 2023-12-13",
        "radial_velocity_ref": radial_velocity.radial_velocity_ref if use_rv else "",
    })
    if velocity is not None:
        row.update({key: f"{value:.6f}" for key, value in zip(("vx_kms", "vy_kms", "vz_kms"), velocity, strict=True)})
    v_magnitude = raw.get("V")
    if v_magnitude:
        row["absolute_mag"] = f"{float(v_magnitude) - 5 * math.log10(direction.distance.to_value(units.pc) / 10):.6f}"
    physical = []
    by_field = {}
    if gaia is not None and object_type == "star":
        by_field = eligible_gaia_physical(gaia)
        if "temperature_k" in by_field:
            row["temperature_k"] = str(round(by_field["temperature_k"].value))
        if "mass_solar" in by_field:
            row["mass_solar"] = str(by_field["mass_solar"].value)
        if "luminosity_solar" in by_field:
            row["luminosity_solar"] = str(by_field["luminosity_solar"].value)
        if "radius_solar" in by_field:
            row["radius_solar"] = str(by_field["radius_solar"].value)
        if "metallicity_dex" in by_field:
            row["metallicity_dex"] = str(by_field["metallicity_dex"].value)
            row["metallicity_kind"] = "[M/H]"
        if "age_gyr" in by_field:
            row["age_gyr"] = str(by_field["age_gyr"].value)
        physical = [item.to_dict() for item in by_field.values()]
    supplement_obs, supplement_audit = supplement_observations(row_context(row), supplements)
    supplemented = resolve_supplemented_fields(row, supplement_obs, {field: by_field[field] for field in SUPPLEMENT_FIELDS if field in by_field})
    physical += [item.to_dict() for item in supplement_obs]
    if supplement_audit is not None:
        supplement_audit["adopted"] = {field: f"{item.source_id}:{item.source_record_id}" for field, item in supplemented.items()}
    status = lambda field: supplemented[field].status if field in supplemented else "model-derived" if row[field] else "unknown"
    provenance = {
        "id": identifier,
        "cns5Id": record.identity.source_record_id,
        "gaiaDr3Id": record.identity.gaia_dr3_id,
        "simbadId": simbad.identity.simbad_id,
        "sourceType": raw.get("otype"),
        "identityMethod": "exact CNS5 identifier; exact Gaia DR3 identifier when present",
        "astrometry": astrometry.to_dict(),
        "radialVelocity": radial_velocity_provenance(radial_velocity, radial_velocity_status),
        "physicalObservations": physical,
        "fieldStatus": {
            "temperature_k": status("temperature_k"),
            "mass_solar": status("mass_solar"),
            "luminosity_solar": status("luminosity_solar"),
            "radius_solar": status("radius_solar"),
            "metallicity_dex": "model-derived" if row["metallicity_dex"] else "unknown",
            "age_gyr": "model-derived" if row["age_gyr"] else "unknown",
            "absolute_mag": "derived-from-compiled-Johnson-V" if row["absolute_mag"] else "unknown",
            "radial_velocity_kms": radial_velocity_status,
        },
    }
    if supplement_audit is not None:
        provenance["physicalSupplements"] = supplement_audit
    shared_enrichment = enrich_from_frozen(row, simbad.identity.simbad_id, simbad.identity.aliases)
    if shared_enrichment:
        provenance["sharedPhysicalEnrichment"] = shared_enrichment
        provenance["fieldStatus"].update({field: observation["status"] for field, observation in shared_enrichment.items()})
    return row, provenance, direction.distance.to_value(units.pc)


def apply_component_physical(row, observations):
    """Adopt only individually reviewed values, retaining units and uncertainties."""
    physical = []
    for field, original in observations.items():
        item = dict(original)
        factor = {"M_jup": units.M_jup.to(units.M_sun), "R_jup": units.R_jup.to(units.R_sun)}.get(item.get("unit"), 1)
        if item.get("unit") in {"M_jup", "R_jup"}:
            item["sourceValue"] = original["value"]
            item["sourceUncertainty"] = original.get("uncertainty")
            item["sourceUnit"] = original["unit"]
            item["unit"] = "M_sun" if original["unit"] == "M_jup" else "R_sun"
        if item["value"] is None:
            row[field] = ""
        else:
            item["value"] *= factor
            if item.get("uncertainty") is not None:
                item["uncertainty"] *= factor
            row[field] = str(round(item["value"])) if field == "temperature_k" else f"{item['value']:.12g}"
        if field == "metallicity_dex":
            row["metallicity_kind"] = metallicity_kind(item.get("quantity")) if item["value"] is not None else ""
        physical.append({"field": field, "sourceId": "reviewed-individual-component", **item})
    return physical


def additional_component_candidates(review, candidates):
    additions = []
    if review["censusComponents"]:
        # Reuse the established source-epoch propagation and temperature sequence,
        # without adopting combined photometry or generic parent physical models.
        spec = importlib.util.spec_from_file_location("nearest100_companion_sources", ROOT / "scripts/author-nearest100.py")
        census_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(census_module)
        frozen = json.loads(NEAREST100_INPUT.read_text())
        census_rows = {item["Seq"]: item for item in frozen["candidates"]}
        for item in review["censusComponents"]:
            original = census_rows[item["sourceRow"]]
            source = dict(original)
            source.update({"plx": str(item["parallaxMas"]), "e_plx": str(item["parallaxErrorMas"]), "r_plx": item["parallaxRef"], "SpType": item["spectralType"]})
            direction, velocity, mode = census_module.normalized_position(source)
            position = direction.galactic.cartesian.xyz.to_value(units.pc)
            temperature, temperature_note = census_module.temperature_estimate(source, frozen["temperatureSequenceKelvin"])
            row = {header: "" for header in HEADERS}
            row.update({"id": item["starId"], "name": item["name"], "type": "star", "spectral_type": item["spectralType"], "epoch": "2000.0", "temperature_k": str(temperature) if temperature is not None else "", "constellation": census_module.constellation(direction)})
            row.update({key: f"{value:.9f}" for key, value in zip(("x_pc", "y_pc", "z_pc"), position, strict=True)})
            row.update(census_module.raw_astrometry(source))
            row["notes"] = f"10pc census object {item['sourceRow']}, system {source['Sys']}; reviewed component membership {item['membershipRef']}. {item['note']} {temperature_note} No component-resolved Johnson V or bolometric luminosity adopted."
            physical = apply_component_physical(row, item["physical"])
            provenance = {"id": row["id"], "sourceRow": item["sourceRow"], "systemId": source["Sys"], "sourceObjectName": original["ObjName"], "sourceObjectType": original["ObjType"], "sourceMeasurements": original, "individualComponentReview": item, "astrometryScope": "Shared BC source position/proper motion; reviewed BC orbital parallax. Not an independently resolved component trajectory.", "physicalObservations": physical, "fieldStatus": {field: "unknown" for field in ("temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr", "absolute_mag", "radial_velocity_kms")}}
            provenance["fieldStatus"]["temperature_k"] = "estimated" if temperature is not None else "unknown"
            provenance["fieldStatus"].update({observation["field"]: observation["status"] for observation in physical})
            additions.append((direction.distance.to_value(units.pc), row["id"], row, provenance))
    by_id = {item[1]: item for item in candidates}
    for item in review["sharedSystemComponents"]:
        parent = by_id[item["parentId"]]
        row = dict(parent[2])
        row.update({"id": item["starId"], "name": item["name"], "type": item["type"], "spectral_type": item.get("spectralType", "")})
        row["designations"] = ""
        row["metallicity_kind"] = ""
        for field in ("vx_kms", "vy_kms", "vz_kms", "radial_velocity_kms", "radial_velocity_error_kms", "radial_velocity_ref", "temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr", "absolute_mag"):
            row[field] = ""
        row["astrometry_ref"] = f"Shared system snapshot from {item['parentId']}: " + row["astrometry_ref"]
        row["notes"] = f"Reviewed individual companion: {item['reference']}. {item['note']}"
        physical = apply_component_physical(row, item["physical"])
        withheld = [field for field in ("temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr", "absolute_mag") if not row[field]]
        if withheld:
            row["notes"] += " Withheld individual fields: " + ", ".join(withheld) + "."
        provenance = {"id": row["id"], "individualComponentReview": item, "astrometryScope": "Shared system snapshot; individual orbital position, proper motion and radial velocity not adopted.", "astrometryParentId": item["parentId"], "physicalObservations": physical, "fieldStatus": {field: "unknown" for field in ("temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr", "absolute_mag", "radial_velocity_kms")}}
        provenance["fieldStatus"].update({observation["field"]: observation["status"] for observation in physical})
        additions.append((parent[0], row["id"], row, provenance))
    for item in additions:
        if item[0] > review["maximumDistancePc"]:
            raise ValueError(f"Reviewed companion exceeds the approved vicinity: {item[1]}")
    return additions


def build_package():
    manifest_input = source_manifest()
    individual_overrides = {item["cns5Id"]: item for item in json.loads(INDIVIDUAL_OVERRIDES.read_text())["objects"]}
    companion_review = json.loads(REVIEWED_COMPANIONS.read_text())
    shared, shared_mapping = shared_rows_and_cns5_map()
    shared_by_id = {row["id"]: row for row in shared}
    cns5 = [record for record in read_cns5(FROZEN / "cns5.dat") if record.astrometry is not None]
    cns5.sort(key=lambda record: (-record.astrometry.parallax_mas, record.identity.source_record_id))
    cns5 = cns5[:manifest_input["bufferSize"]]
    simbad = simbad_by_cns5()
    gaia = {record.identity.gaia_dr3_id: record for record in read_gaia_tap(FROZEN / "gaia.csv")}
    supplements = load_supplements(SUPPLEMENTS, FROZEN / "cns5.dat")
    candidates = []
    audit = []
    replaced_ids = {identifier for identifiers in shared_mapping.values() for identifier in identifiers}
    for row in shared:
        if row["id"] == "sun":
            continue
        distance = math.sqrt(sum(float(row[key]) ** 2 for key in ("x_pc", "y_pc", "z_pc")))
        candidates.append((distance, row["id"], row, {"id": row["id"], "status": "higher-curation nearest-100 override"}))
    for record in cns5:
        cns5_id = record.identity.source_record_id
        if cns5_id in shared_mapping:
            audit.append({"cns5Id": cns5_id, "status": "replaced", "starViewIds": shared_mapping[cns5_id]})
            continue
        source = simbad.get(cns5_id)
        if source is None:
            raise ValueError(f"Missing exact SIMBAD enrichment for CNS5 {cns5_id}")
        source_object_type = (source.raw or {}).get("otype")
        individual_review = individual_overrides.get(cns5_id)
        if individual_review is not None and (
            source.identity.simbad_id != individual_review["simbadId"]
            or record.identity.gaia_dr3_id != individual_review.get("cns5GaiaDr3Id", individual_review["gaiaDr3Id"])
            or source.identity.gaia_dr3_id != individual_review["gaiaDr3Id"]
        ):
            raise ValueError(f"Reviewed individual-component identity drifted for CNS5 {cns5_id}")
        if source_object_type == "BD?" or (source_object_type == "**" and individual_review is None):
            audit.append({"cns5Id": cns5_id, "status": "excluded", "reason": "aggregate system" if source_object_type == "**" else "tentative brown-dwarf classification", "simbadType": source_object_type})
            continue
        row, provenance, distance = normalize(record, source, gaia.get(record.identity.gaia_dr3_id), supplements)
        if individual_review is not None:
            if distance > companion_review["maximumDistancePc"]:
                raise ValueError(f"Reviewed CNS5 component exceeds the approved vicinity: {row['id']}")
            original_name = row["name"]
            row["name"] = individual_review["name"]
            row["designations"] = "|".join(dict.fromkeys(filter(lambda name: name and name != row["name"], [*row.get("designations", "").split("|"), original_name])))
            row["spectral_type"] = individual_review.get("spectralType", row["spectral_type"])
            row["notes"] += f" Reviewed individual-component membership: {individual_review['reference']}. {individual_review['decision']}"
            provenance["individualComponentReview"] = individual_review
            if individual_review.get("astrometryScope"):
                provenance["astrometryScope"] = individual_review["astrometryScope"]
                row["notes"] = f"Corrected CNS5 {cns5_id}; exact source identity {individual_review['simbadId']}. {individual_review['astrometryScope']} {individual_review['decision']} Reviewed membership and individual physical parameters: {individual_review['reference']}."
            if individual_review.get("withholdIndividualMotion"):
                for field in ("vx_kms", "vy_kms", "vz_kms", "radial_velocity_kms", "radial_velocity_error_kms", "radial_velocity_ref"):
                    row[field] = ""
                provenance["radialVelocity"] = {"status": "withheld-individual-orbital-motion", "sourceAlternative": provenance["radialVelocity"]}
                provenance["fieldStatus"]["radial_velocity_kms"] = "unknown"
            if individual_review.get("physicalOverrides"):
                overridden = set(individual_review["physicalOverrides"])
                supplement = provenance.get("physicalSupplements", {})
                previous_adopted = {field: value for field, value in supplement.get("adopted", {}).items() if field in overridden}
                if previous_adopted:
                    supplement["supersededByIndividualReview"] = previous_adopted
                    supplement["adopted"] = {field: value for field, value in supplement["adopted"].items() if field not in overridden}
                enrichment = provenance.get("sharedPhysicalEnrichment", {})
                previous_enrichment = {field: enrichment.pop(field) for field in overridden if field in enrichment}
                if previous_enrichment:
                    provenance["supersededSharedPhysicalEnrichment"] = previous_enrichment
                observations = apply_component_physical(row, individual_review["physicalOverrides"])
                provenance["physicalObservations"].extend(observations)
                provenance["fieldStatus"].update({item["field"]: item["status"] for item in observations})
                row["notes"] += f" Individually reviewed physical values/withholding: {individual_review['reference']}; supersedes blended-source values for these fields."
                withheld = [field for field, item in individual_review["physicalOverrides"].items() if item["value"] is None]
                if withheld:
                    row["notes"] += " Withheld individual fields: " + ", ".join(withheld) + "."
        candidates.append((distance, row["id"], row, provenance))
    extra_candidates = additional_component_candidates(companion_review, candidates)
    candidates.extend(extra_candidates)
    for _, _, row, provenance in candidates:
        enrich_component(row, provenance)
    ranked = sorted(candidates, key=lambda item: (item[0], item[1]))
    # Reviewed companions are additive: preserve the original nearest-1000
    # baseline instead of displacing its boundary object with each addition.
    extra_ids = {item[1] for item in extra_candidates}
    additive_cns5_ids = {cid for cid, review in individual_overrides.items() if review.get("additive", True)}
    baseline_candidates = [item for item in ranked if item[3].get("cns5Id") not in additive_cns5_ids and item[1] not in extra_ids]
    baseline = baseline_candidates[:1000]
    reviewed_ids = {item[1] for item in ranked if item[3].get("cns5Id") in additive_cns5_ids} | extra_ids
    selected_ids = {item[1] for item in baseline} | reviewed_ids
    selected = [item for item in ranked if item[1] in selected_ids]
    if len(baseline) != 1000 or not replaced_ids.issubset(selected_ids):
        raise ValueError("Nearest-1000 candidate buffer or curated override coverage is insufficient")
    sun = shared_by_id["sun"]
    rows = [sun] + [item[2] for item in selected]
    names = [row["name"] for row in rows]
    if len(set(row["id"] for row in rows)) != len(rows) or len(set(names)) != len(rows):
        duplicates = sorted(name for name in set(names) if names.count(name) > 1)
        raise ValueError(f"Generated identifiers or names are not unique: {duplicates}")
    cutoff = baseline[-1]
    next_candidate = baseline_candidates[1000]
    def distance_sigma(candidate):
        astrometry = candidate[3].get("astrometry")
        if not astrometry or astrometry["parallax_error_mas"] is None:
            return None
        return 1000 * astrometry["parallax_error_mas"] / astrometry["parallax_mas"] ** 2
    cutoff_sigma = distance_sigma(cutoff)
    next_sigma = distance_sigma(next_candidate)
    uncertainty_overlap = bool(cutoff_sigma is not None and next_sigma is not None and cutoff[0] + cutoff_sigma >= next_candidate[0] - next_sigma)
    candidate_audit = audit + [{
        "id": item[1],
        "cns5Id": item[3].get("cns5Id"),
        "rank": rank,
        "distancePc": item[0],
        "distanceSigmaPcLinearized": distance_sigma(item),
        "selected": item[1] in selected_ids,
        "reviewedAddition": item[1] in reviewed_ids,
    } for rank, item in enumerate(ranked, 1)]
    manifest = {
        "schemaVersion": 1,
        "id": "nearest-1000",
        "label": "Nearest 1000 + companions",
        "description": "Nearest-1000 baseline of individual stellar/substellar objects from corrected CNS5 with exact SIMBAD/Gaia enrichment and curated nearest-100 overrides, plus reviewed individual companions and Sun.",
        "epoch": 2000,
        "objectCount": len(rows),
        "sources": SOURCES + enrichment_sources() + component_sources(),
        "cutoffPolicy": f"Exclude SIMBAD multiple-star records (**) unless explicitly reviewed as individual components, and tentative brown-dwarf candidates (BD?); replace mapped CNS5 records with curated nearest-100 components; rank nominal adopted J2000 distance then stable ID. Keep the nearest-1000 baseline plus {len(reviewed_ids)} reviewed individual companion additions without removing baseline members. Baseline rank 1000 is {cutoff[2]['name']} ({cutoff[1]}) at {cutoff[0]:.12f} pc; next baseline candidate is {next_candidate[2]['name']} at {next_candidate[0]:.12f} pc. Linearized parallax intervals {'overlap' if uncertainty_overlap else 'do not overlap'}; nominal baseline ranking is retained.",
        "snapshot": f"J2000.0; CNS5 corrected 2023-12-13; SIMBAD and Gaia DR3 TAP frozen {manifest_input['retrieved']}; source-defined snapshot, not a 2026 completeness claim.",
    }
    provenance = {
        "schemaVersion": 1,
        "catalogId": "nearest-1000",
        "policyRevision": "cns5-individuals-v5-reviewed-component-exceptions",
        "sourceManifestSha256": sha256(FROZEN / "source-manifest.json"),
        "individualComponentReviewSha256": sha256(INDIVIDUAL_OVERRIDES),
        "reviewedCompanionsSha256": sha256(REVIEWED_COMPANIONS),
        "reviewedComponentPropertiesSha256": component_plan_sha256(),
        "reviewedCompanionVicinityPc": companion_review["maximumDistancePc"],
        "reviewedAdditionIds": sorted(reviewed_ids),
        "supplementManifestSha256": supplements.manifest_sha256,
        "sharedEnrichmentManifestSha256": manifest_sha256(),
        "sources": SOURCES + enrichment_sources() + component_sources(),
        "radialVelocityPolicy": {
            "precedence": ["nearest-100 curated override", "reviewed literature override", "CNS5 spectroscopic radial velocity", "Gaia DR3 exact-ID radial velocity fallback"],
            "whiteDwarfs": "Withhold new spectroscopic radial velocities because gravitational redshift may contaminate space motion.",
            "review": "Gaia DR3 fallback measurements are source-backed and retain uncertainty and quality flags, but are not individually reviewed for systemic binary motion.",
            "resolvedComponents": "After aggregate splitting, reviewed systemic RVs can fill withheld motion as an explicitly documented bulk-motion approximation; no individual orbital velocities are supplied.",
        },
        "coverage": {field: sum(bool(row.get(field)) for row in rows if row["id"] != "sun") for field in ("constellation", "spectral_type", "temperature_k", "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr", "absolute_mag", "radial_velocity_kms")},
        "cutoff": {"rank": ranked.index(cutoff) + 1, "baselineRank": 1000, "id": cutoff[1], "name": cutoff[2]["name"], "distancePc": cutoff[0], "distanceSigmaPcLinearized": cutoff_sigma, "nextId": next_candidate[1], "nextDistancePc": next_candidate[0], "nextDistanceSigmaPcLinearized": next_sigma, "oneSigmaIntervalsOverlap": uncertainty_overlap},
        "audit": candidate_audit,
        "objects": [{"id": "sun", "status": "shared override"}] + [item[3] for item in selected],
    }
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=HEADERS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return {"stars.csv": stream.getvalue(), "catalog.json": canonical_json(manifest), "provenance.json": canonical_json(provenance)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("build",))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    if arguments.output.is_symlink():
        raise ValueError("Output directory must not be a symbolic link")
    package = build_package()
    if arguments.check:
        if any(not (arguments.output / name).exists() or (arguments.output / name).read_text() != content for name, content in package.items()):
            raise ValueError("Nearest-1000 output does not reproduce byte for byte")
        print(json.dumps({"reproduced": True, "objects": json.loads(package["catalog.json"])["objectCount"]}, indent=2))
        return
    if arguments.output.exists() and not arguments.force:
        raise FileExistsError("Output exists; use --force for an intentional regeneration")
    write_managed_files(arguments.output, package, arguments.force)
    print(json.dumps(json.loads(package["provenance.json"])["coverage"] | {"objects": json.loads(package["catalog.json"])["objectCount"]}, indent=2))


if __name__ == "__main__":
    main()
