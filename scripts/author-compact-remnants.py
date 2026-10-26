"""Rebuild the compact-remnant overlay from frozen, source-defined inputs.

`--freeze PSRCAT_DB GLITCH_DB` selects the overlay's pulsars from a downloaded
ATNF package and stores their verbatim records; without arguments the overlay
is rendered from those frozen records. Derived values follow psrcat v1.54
(defineParams.c): distance precedence, P0/P1 from F0/F1, characteristic age,
surface field, spin-down power and companion masses for a 1.35 M_sun pulsar.
"""

import argparse
import hashlib
import json
import math
import re
from pathlib import Path

from astropy.coordinates import SkyCoord
from astropy.time import Time
import astropy.units as units


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/compact-remnants"
ATNF = WORK / "atnf-subset.db"
GLITCHES = WORK / "atnf-glitches.db"
CURATED = WORK / "curated.json"
BINARIES = WORK / "pulsar-binaries.json"
SOURCE_MANIFEST = WORK / "source-manifest.json"
OUTPUT = ROOT / "src/data/overlays/compact-remnants"
RADIUS_LY = 3000
LY_PER_PC = 3.261563777
MAX_DISTANCE_KPC = 0.9198041814
ATNF_URL = "https://www.atnf.csiro.au/research/pulsar/psrcat/psrcat_help.html"
PSR_INERTIA = 1e45
PSR_MASS = 1.35
GM_SUN = 1.3271243999e26
LIGHT_CM_S = 2.99792458e10
COS_OBLIQUITY, SIN_OBLIQUITY = 0.91748213149438, 0.39777699580108
KMS_PER_MASYR_KPC = 4.740470446
MILLISECOND_PULSAR_S = 0.03
TYPE_LABELS = {
    "HE": "High-energy pulses",
    "NRAD": "Radio-quiet",
    "RRAT": "Rotating radio transient",
    "XINS": "X-ray isolated neutron star",
    "AXP": "Magnetar",
}
ASSOCIATION_LABELS = {
    "SNR": "Supernova remnant",
    "PWN": "Pulsar wind nebula",
    "GC": "Globular cluster",
    "GRS": "Gamma-ray source",
    "XRS": "X-ray source",
    "OPT": "Optical counterpart",
}
COMPANION_LABELS = {
    "He": "Helium white dwarf",
    "CO": "Carbon–oxygen or oxygen–neon white dwarf",
    "NS": "Neutron star",
    "MS": "Main-sequence star",
    "UL": "Ultra-light companion or planet",
}


def parse_records(text):
    """Return ATNF database records as (verbatim text, {label: fields})."""
    records, lines = [], []
    for line in text.splitlines(keepends=True):
        if line.startswith("#"):
            continue
        if line.startswith("@"):
            if lines:
                records.append(("".join(lines), {parts[0]: parts[1:] for parts in (entry.split() for entry in lines) if parts}))
            lines = []
        elif line.strip():
            lines.append(line)
    return records


def value(record, label):
    try:
        return float(record[label][0])
    except (KeyError, IndexError, ValueError):
        return None


def uncertainty(record, label):
    """ATNF uncertainties count units of the last quoted digit."""
    fields = record.get(label, [])
    if len(fields) < 2 or not re.fullmatch(r"\d+", fields[1]):
        return None
    mantissa, _, exponent = fields[0].lower().partition("e")
    decimals = len(mantissa.split(".")[1]) if "." in mantissa else 0
    return int(fields[1]) * 10.0 ** ((int(exponent) if exponent else 0) - decimals)


def reference(record, label):
    fields = record.get(label, [])
    return fields[-1] if len(fields) > 1 and not re.fullmatch(r"\d+", fields[-1]) else None


def codes(record, label):
    return [entry for entry in " ".join(record.get(label, [])).split(",") if entry]


def significant(number, digits=6):
    return None if number is None else float(f"{number:.{digits}g}")


def sexagesimal(text, hours):
    sign = -1 if text.startswith("-") else 1
    parts = [abs(float(part)) for part in text.lstrip("+-").split(":")]
    return sign * sum(part / 60 ** index for index, part in enumerate(parts)) * (15 if hours else 1)


def ecliptic_to_equatorial(longitude, latitude):
    longitude, latitude = math.radians(longitude), math.radians(latitude)
    sin_dec = math.sin(latitude) * COS_OBLIQUITY + math.cos(latitude) * SIN_OBLIQUITY * math.sin(longitude)
    dec = math.asin(sin_dec)
    cos_ra = math.cos(longitude) * math.cos(latitude) / math.cos(dec)
    sin_ra = (math.sin(dec) * COS_OBLIQUITY - math.sin(latitude)) / (math.cos(dec) * SIN_OBLIQUITY)
    return math.degrees(math.atan2(sin_ra, cos_ra)) % 360, math.degrees(dec)


def equatorial_to_ecliptic(ra, dec):
    ra, dec = math.radians(ra), math.radians(dec)
    latitude = math.asin(math.sin(dec) * COS_OBLIQUITY - math.cos(dec) * SIN_OBLIQUITY * math.sin(ra))
    longitude = math.atan2(math.sin(ra) * COS_OBLIQUITY + math.tan(dec) * SIN_OBLIQUITY, math.cos(ra))
    return math.degrees(longitude) % 360, math.degrees(latitude)


def position(record):
    """psrcat derives RAJ/DECJ from ecliptic coordinates whenever those exist."""
    if "ELONG" in record and "ELAT" in record:
        return (*ecliptic_to_equatorial(value(record, "ELONG"), value(record, "ELAT")), reference(record, "ELONG"))
    if "RAJ" in record and "DECJ" in record:
        return sexagesimal(record["RAJ"][0], True), sexagesimal(record["DECJ"][0], False), reference(record, "RAJ")
    raise ValueError(f"ATNF record {record['PSRJ'][0]} has no position")


def proper_motion(record, ra, dec):
    """Equatorial proper motion and errors (mas/yr); ecliptic motion is rotated locally."""
    if "PMRA" in record or "PMDEC" in record:
        return (value(record, "PMRA"), uncertainty(record, "PMRA"), value(record, "PMDEC"), uncertainty(record, "PMDEC"),
                ", ".join(filter(None, (reference(record, "PMRA"), reference(record, "PMDEC")))))
    if "PMELONG" not in record or "PMELAT" not in record:
        return None
    longitude, latitude = (value(record, "ELONG"), value(record, "ELAT")) if "ELONG" in record else equatorial_to_ecliptic(ra, dec)
    north_ra, north_dec = ecliptic_to_equatorial(longitude, latitude + 1e-6)
    angle = math.atan2(((north_ra - ra + 180) % 360 - 180) * math.cos(math.radians(dec)), north_dec - dec)
    along, across = value(record, "PMELONG"), value(record, "PMELAT")
    along_error, across_error = uncertainty(record, "PMELONG") or 0, uncertainty(record, "PMELAT") or 0
    return (
        across * math.sin(angle) + along * math.cos(angle),
        math.hypot(across_error * math.sin(angle), along_error * math.cos(angle)),
        across * math.cos(angle) - along * math.sin(angle),
        math.hypot(across_error * math.cos(angle), along_error * math.sin(angle)),
        ", ".join(filter(None, (reference(record, "PMELONG"), reference(record, "PMELAT")))),
    )


def distance(record):
    """ATNF DIST: DIST_A, then a >3-sigma parallax, then DIST_DM bounded by DIST_AMN/AMX."""
    parallax, parallax_error = value(record, "PX"), uncertainty(record, "PX")
    if "DIST_A" in record:
        return value(record, "DIST_A"), "Independent distance estimate", reference(record, "DIST_A") or "ATNF DIST_A"
    if parallax is not None and parallax_error and abs(parallax / parallax_error) > 3:
        return 1 / parallax, "Parallax", reference(record, "PX") or "ATNF PX"
    low, high, model = value(record, "DIST_AMN"), value(record, "DIST_AMX"), value(record, "DIST_DM")
    model_source = reference(record, "DIST_DM") or "ATNF DIST_DM"
    if low is not None and high is not None:
        if model is None:
            return (low + high) / 2, "Independent distance limits", reference(record, "DIST_AMN") or "ATNF DIST_AMN"
        if not low <= model <= high:
            return (high if model > high else low), "Independent distance limit", reference(record, "DIST_AMN") or "ATNF DIST_AMN"
    return model, "Dispersion measure model", model_source


def spin(record):
    """P0, its error, P1 and its error; F0/F1 timing solutions are converted."""
    if "P0" in record:
        return value(record, "P0"), uncertainty(record, "P0"), value(record, "P1"), uncertainty(record, "P1")
    frequency, frequency_error = value(record, "F0"), uncertainty(record, "F0")
    if frequency is None:
        return None, None, None, None
    derivative, derivative_error = value(record, "F1"), uncertainty(record, "F1")
    period_error = frequency_error / frequency ** 2 if frequency_error is not None else None
    if derivative is None:
        return 1 / frequency, period_error, None, None
    period_derivative_error = None if derivative_error is None else math.hypot(
        derivative_error / frequency ** 2, 2 * derivative * (frequency_error or 0) / frequency ** 3)
    return 1 / frequency, period_error, -derivative / frequency ** 2, period_derivative_error


def spin_down(period, derivative):
    """Characteristic age, surface field and spin-down power at psrcat's printed precision."""
    if period is None or derivative is None or derivative <= 0:
        return None, None, None
    return (
        significant(period / 2 / derivative / 86400 / 365.25, 3),
        significant(3.2e19 * math.sqrt(period * derivative), 3),
        significant(4 * math.pi ** 2 * PSR_INERTIA * derivative / period ** 3, 2),
    )


def orbital_period(record):
    if "PB" in record:
        return value(record, "PB"), uncertainty(record, "PB")
    frequency = value(record, "FB0")
    if frequency is None:
        return None, None
    frequency_error = uncertainty(record, "FB0")
    return 1 / frequency / 86400, None if frequency_error is None else frequency_error / frequency ** 2 / 86400


def companion_mass(mass_function, sin_inclination):
    guess = PSR_MASS
    for _ in range(10000):
        equation = (PSR_MASS + guess) ** 2 - (guess * sin_inclination) ** 3 / mass_function
        step = equation / (2 * (PSR_MASS + guess) - 3 * (guess * sin_inclination) ** 2 / mass_function)
        guess -= step
        if abs(step) <= abs(guess) * 1e-10:
            return significant(guess, 4)
    raise ValueError("Companion mass did not converge")


def binary(record):
    period = orbital_period(record)[0]
    semi_major_axis = value(record, "A1")
    eccentricity = value(record, "ECC")
    if eccentricity is None and "EPS1" in record and "EPS2" in record:
        eccentricity = math.hypot(value(record, "EPS1"), value(record, "EPS2"))
    minimum = median = None
    if period is not None and semi_major_axis is not None:
        mass_function = 4 * math.pi ** 2 / GM_SUN * (semi_major_axis * LIGHT_CM_S) ** 3 / (period * 86400) ** 2
        minimum, median = companion_mass(mass_function, 1.0), companion_mass(mass_function, 0.866025403)
    return semi_major_axis, significant(eccentricity, 4), minimum, median


def companion_label(record):
    if not codes(record, "BINCOMP"):
        return "Unclassified companion" if "BINARY" in record or "PB" in record or "FB0" in record else None
    code = codes(record, "BINCOMP")[0]
    match = re.fullmatch(r"([A-Za-z]+?)(T?)(\(\?\))?(?:\[[^]]*])?", code)
    if not match or match[1] not in COMPANION_LABELS:
        raise ValueError(f"Unknown ATNF companion code {code}")
    label = COMPANION_LABELS[match[1]]
    if match[3]:
        label = f"Probable {label[0].lower()}{label[1:]}"
    return f"{label}; more than one companion" if match[2] else label


def pulsar_classes(record, period):
    """Millisecond spin first, then emission: every ATNF pulsar without NRAD pulses in radio."""
    classes = ["Millisecond"] if period is not None and period < MILLISECOND_PULSAR_S else []
    if not any(code.startswith("NRAD") or code.startswith("XINS") for code in codes(record, "TYPE")):
        classes.append("Radio")
    for code in codes(record, "TYPE"):
        match = re.fullmatch(r"([A-Z]+)(\(\?\))?(?:\[[^]]*])?", code)
        if match and match[1] in TYPE_LABELS:
            label = TYPE_LABELS[match[1]] + (" (probable)" if match[2] else "")
            if label not in classes:
                classes.append(label)
    return classes


def associations(record):
    """Readable association kinds, each followed by its named counterparts."""
    names = {}
    for code in codes(record, "ASSOC"):
        match = re.fullmatch(r"([A-Z]+):([^[]*)(?:\[[^]]*])?", code)
        if match and match[1] in ASSOCIATION_LABELS:
            kind = names.setdefault(ASSOCIATION_LABELS[match[1]], [])
            name = match[2].replace("_", " ").strip()
            if name and name not in kind:
                kind.append(name)
    return [f"{label}: {', '.join(values)}" if values else label for label, values in names.items()]


def jyear_from_mjd(mjd):
    return Time(mjd, format="mjd", scale="tt").jyear if mjd is not None else 2000.0


def galactic_position(ra, dec, distance_pc):
    galactic = SkyCoord(ra=ra * units.deg, dec=dec * units.deg, distance=distance_pc * units.pc, frame="icrs").galactic.cartesian
    return galactic.x.value, galactic.y.value, galactic.z.value


# astropy 8 names differ from the app's IAU spellings.
ASTROPY_CONSTELLATIONS = {"Boötes": "Bootes", "Chamaleon": "Chamaeleon", "Ophiucus": "Ophiuchus"}


def constellation(ra, dec):
    name = SkyCoord(ra=ra * units.deg, dec=dec * units.deg, frame="icrs").get_constellation(short_name=False)
    return ASTROPY_CONSTELLATIONS.get(name, name)


def object_id(psrj):
    return f"psr-{psrj.lower().replace('+', 'p').replace('-', 'm')}"


def empty_scene_object(object_type, identifier, name, sky, position_pc, notes, details, raw_astrometry=None, mass=None):
    return {
        "type": object_type,
        "id": identifier,
        "name": name,
        "spectral_type": None,
        "constellation": sky,
        "x_pc": round(position_pc[0], 9),
        "y_pc": round(position_pc[1], 9),
        "z_pc": round(position_pc[2], 9),
        "vx_kms": None,
        "vy_kms": None,
        "vz_kms": None,
        "temperature_k": None,
        "mass_solar": mass,
        "luminosity_solar": None,
        "radius_solar": None,
        "metallicity_dex": None,
        "age_gyr": None,
        "absolute_mag": None,
        "epoch": 2000,
        "notes": notes,
        "raw_astrometry": raw_astrometry,
        "compact": details,
    }


def empty_pulsar_details():
    return {
        "period_derivative": None,
        "period_derivative_error": None,
        "dispersion_measure_pc_cm3": None,
        "transverse_velocity_kms": None,
        "pulsar_classes": [],
        "associations": [],
        "glitch_count": None,
        "eccentricity": None,
        "projected_semi_major_axis_lt_s": None,
        "companion_min_mass_solar": None,
        "companion_median_mass_solar": None,
    }


def pulsar_object(record, glitch_count, measured):
    psrj = record["PSRJ"][0]
    ra, dec, position_source = position(record)
    distance_kpc, distance_method, distance_source = distance(record)
    period, period_error, derivative, derivative_error = spin(record)
    age, field, power = spin_down(period, derivative)
    flux = value(record, "S1400")
    period_days, period_days_error = orbital_period(record)
    semi_major_axis, eccentricity, minimum, median = binary(record)
    motion = proper_motion(record, ra, dec)
    parallax = value(record, "PX")
    epoch_mjd = value(record, "POSEPOCH") if "POSEPOCH" in record else value(record, "PEPOCH")
    raw_astrometry = None
    if parallax is not None and parallax > 0 and motion and motion[0] is not None and motion[2] is not None:
        raw_astrometry = {
            "ra_deg": round(ra, 9),
            "dec_deg": round(dec, 9),
            "epoch": jyear_from_mjd(epoch_mjd),
            "parallax_mas": parallax,
            "parallax_error_mas": significant(uncertainty(record, "PX"), 2),
            "pm_ra_cosdec_masyr": significant(motion[0]),
            "pm_ra_error_masyr": significant(motion[1]),
            "pm_dec_masyr": significant(motion[2]),
            "pm_dec_error_masyr": significant(motion[3]),
            "radial_velocity_kms": None,
            "radial_velocity_error_kms": None,
            "astrometry_ref": ", ".join(filter(None, (reference(record, "PX"), motion[4]))),
            "radial_velocity_ref": None,
        }
    transverse = None
    if motion and motion[0] is not None and motion[2] is not None:
        transverse = significant(KMS_PER_MASYR_KPC * math.hypot(motion[0], motion[2]) * distance_kpc, 3)
    details = {
        "confidence": "confirmed",
        "distance_method": distance_method,
        "distance_source": distance_source,
        "position_source": position_source or "ATNF PSRJ",
        "mass_error_solar": measured["mass_error_solar"] if measured else None,
        # ATNF reports 0 where it has no period uncertainty.
        "rotation_period_s": significant(period, 13),
        "rotation_period_error_s": significant(period_error, 2) or None,
        "radio_luminosity_1400_mjy_kpc2": significant(flux * distance_kpc ** 2, 3) if flux is not None else None,
        "characteristic_age_yr": age,
        "surface_magnetic_field_gauss": field,
        "spin_down_power_erg_s": power,
        "orbital_period_days": significant(period_days, 13),
        "orbital_period_error_days": significant(period_days_error, 2) or None,
        "companion": companion_label(record),
        "detection_method": "Pulsed emission",
        "source_label": "ATNF Pulsar Catalogue v2.9.0",
        "source_url": ATNF_URL,
        "ra_deg": round(ra, 9),
        "dec_deg": round(dec, 9),
        **empty_pulsar_details(),
        "period_derivative": significant(derivative),
        "period_derivative_error": significant(derivative_error, 2) or None,
        "dispersion_measure_pc_cm3": value(record, "DM"),
        "transverse_velocity_kms": transverse,
        "pulsar_classes": pulsar_classes(record, period),
        "associations": associations(record),
        "glitch_count": glitch_count or None,
        "eccentricity": eccentricity,
        "projected_semi_major_axis_lt_s": semi_major_axis,
        "companion_min_mass_solar": minimum,
        "companion_median_mass_solar": median,
    }
    note = f"ATNF adopted distance {distance_kpc:.3f} kpc ({distance_method.lower()}; reference {distance_source})."
    if measured:
        note += f" Mass {measured['mass_solar']} ± {measured['mass_error_solar']} M_sun: {measured['source_label']}, {measured['source_url']}."
        if measured.get("note"):
            note += f" {measured['note']}"
    if minimum is not None:
        note += " Companion minimum and median masses assume a 1.35 M_sun pulsar and inclinations of 90 and 60 degrees."
    return empty_scene_object(
        "pulsar", object_id(psrj), f"PSR {psrj}", constellation(ra, dec),
        galactic_position(ra, dec, distance_kpc * 1000), note, details, raw_astrometry,
        measured["mass_solar"] if measured else None,
    )


def neutron_star_companion(source, pulsar):
    """An unseen neutron-star companion shares its pulsar's plotted system position."""
    details = {
        **pulsar["compact"],
        **empty_pulsar_details(),
        "mass_error_solar": source["mass_error_solar"],
        "rotation_period_s": None,
        "rotation_period_error_s": None,
        "radio_luminosity_1400_mjy_kpc2": None,
        "characteristic_age_yr": None,
        "surface_magnetic_field_gauss": None,
        "spin_down_power_erg_s": None,
        "companion": f"Pulsar {pulsar['name']}",
        "detection_method": "Relativistic timing of its pulsar companion",
        "source_label": source["source_label"],
        "source_url": source["source_url"],
    }
    note = (f"Neutron-star companion of {pulsar['name']}, measured through the pulsar's relativistic orbit. "
            f"Mass {source['mass_solar']} ± {source['mass_error_solar']} M_sun: {source['source_label']}, {source['source_url']}. "
            "Its plotted position and motion are those of the pulsar's system.")
    if source.get("note"):
        note += f" {source['note']}"
    return {
        **pulsar,
        "type": "neutron_star",
        "id": f"{pulsar['id']}-b",
        "name": f"{pulsar['name']} B",
        "mass_solar": source["mass_solar"],
        "notes": note,
        "compact": details,
    }


def curated_object(source):
    coordinate = SkyCoord(ra=source["ra_deg"] * units.deg, dec=source["dec_deg"] * units.deg, distance=source["distance_pc"] * units.pc, frame="icrs")
    galactic = coordinate.galactic.cartesian
    astrometry = source.get("astrometry")
    # The reviewed system astrometry describes the unresolved binary, shared by both components.
    raw_astrometry = {"ra_deg": source["ra_deg"], "dec_deg": source["dec_deg"], **astrometry} if astrometry else None
    details = {
        "confidence": source["confidence"],
        "distance_method": source["distance_method"],
        "distance_source": source["source_label"],
        "position_source": source["source_label"],
        "mass_error_solar": source["mass_error_solar"],
        "rotation_period_s": None,
        "rotation_period_error_s": None,
        "radio_luminosity_1400_mjy_kpc2": None,
        "characteristic_age_yr": None,
        "surface_magnetic_field_gauss": None,
        "spin_down_power_erg_s": None,
        "orbital_period_days": source["orbital_period_days"],
        "orbital_period_error_days": source["orbital_period_error_days"],
        "companion": source["companion"],
        "detection_method": source["detection_method"],
        "source_label": source["source_label"],
        "source_url": source["source_url"],
        "ra_deg": source["ra_deg"],
        "dec_deg": source["dec_deg"],
        **empty_pulsar_details(),
        "eccentricity": source.get("eccentricity"),
    }
    return empty_scene_object(
        source["type"], source["id"], source["name"], source["constellation"],
        (galactic.x.value, galactic.y.value, galactic.z.value), source["notes"], details,
        raw_astrometry, mass=source["mass_solar"],
    )


def glitch_counts(text):
    counts = {}
    for line in text.splitlines()[3:]:
        parts = line.split()
        if len(parts) > 2:
            counts[parts[1]] = counts.get(parts[1], 0) + 1
    return counts


def selected(record):
    types = " ".join(record.get("TYPE", []))
    kpc = distance(record)[0]
    return kpc is not None and 0 < kpc <= MAX_DISTANCE_KPC and "CAND" not in types and "INTERIM" not in types and "INTERIM" not in record


def freeze(catalogue_path, glitch_path):
    """Store the selected verbatim records and their glitch rows."""
    catalogue = Path(catalogue_path).read_text(encoding="latin-1")
    version = re.search(r"^#CATALOGUE\s+(\S+)", catalogue, re.M)[1]
    records = [(text, record) for text, record in parse_records(catalogue) if selected(record)]
    names = {record["PSRJ"][0] for _, record in records}
    ATNF.write_text(f"#CATALOGUE {version}\n# Verbatim ATNF records selected by scripts/author-compact-remnants.py --freeze.\n"
                    + "".join(text + "@" + "-" * 65 + "\n" for text, _ in records))
    glitch_lines = Path(glitch_path).read_text(encoding="latin-1").splitlines()
    rows = [line for line in glitch_lines[3:] if len(line.split()) > 2 and line.split()[1] in names]
    GLITCHES.write_text("\n".join(glitch_lines[:3] + rows) + "\n")
    print(f"Froze {len(records)} ATNF {version} records and {len(rows)} glitches.")


def render():
    source_manifest = json.loads(SOURCE_MANIFEST.read_text())
    atnf = source_manifest["atnf"]
    for path, expected in ((ATNF, atnf["subsetSha256"]), (GLITCHES, atnf["glitchSubsetSha256"])):
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f"Frozen {path.name} checksum does not match source-manifest.json")
    records = [record for _, record in parse_records(ATNF.read_text(encoding="latin-1"))]
    if len(records) != atnf["rows"] or not all(selected(record) for record in records):
        raise ValueError("Frozen ATNF subset does not match its selection or row count")
    glitches = glitch_counts(GLITCHES.read_text(encoding="latin-1"))
    reviewed = json.loads(BINARIES.read_text())
    masses = reviewed["pulsarMasses"]
    pulsars = {record["PSRJ"][0]: pulsar_object(record, glitches.get(record["PSRJ"][0]), masses.get(record["PSRJ"][0])) for record in records}
    if set(masses) - set(pulsars):
        raise ValueError("Reviewed pulsar masses name pulsars outside the overlay")
    objects = list(pulsars.values())
    objects.extend(neutron_star_companion(source, pulsars[source["pulsar"]]) for source in reviewed["neutronStarCompanions"])
    objects.extend(curated_object(source) for source in json.loads(CURATED.read_text()))
    if len({item["id"] for item in objects}) != len(objects):
        raise ValueError("Compact-object IDs must be unique")
    for item in objects:
        distance_ly = math.hypot(item["x_pc"], item["y_pc"], item["z_pc"]) * LY_PER_PC
        if distance_ly > RADIUS_LY + 0.001:
            raise ValueError(f"Compact-object radius violation: {item['name']} at {distance_ly:g} ly")
    counts = {object_type: sum(item["type"] == object_type for item in objects) for object_type in ("pulsar", "neutron_star", "black_hole")}
    manifest = {
        "schemaVersion": 1,
        "id": "compact-remnants",
        "label": "Compact remnants",
        "description": "A separately loaded, source-defined overlay of catalogued pulsars, their measured neutron-star companions and curated dormant compact-object systems within 3000 light-years.",
        "epoch": 2000,
        "objectCount": len(objects),
        "radiusLy": RADIUS_LY,
        "counts": counts,
        "sources": [
            {"name": f"ATNF Pulsar Catalogue v{atnf['catalogVersion']}", "url": ATNF_URL},
            *({"name": name, "url": url} for name, url in sorted({(entry["source_label"], entry["source_url"]) for entry in [*masses.values(), *reviewed["neutronStarCompanions"]]})),
            {"name": "BlackCAT Galactic black-hole transients", "url": "https://www.sc.eso.org/~jcorral/BlackCAT/transients.php"},
            {"name": "Gaia BH1 high-precision orbit", "url": "https://arxiv.org/abs/2312.05313"},
            {"name": "Gaia BH3 discovery", "url": "https://arxiv.org/abs/2404.10486"},
            {"name": "Gaia NS1 characterization", "url": "https://arxiv.org/abs/2402.06722"},
        ],
        "cutoffPolicy": f"ATNF v{atnf['catalogVersion']} non-candidate, non-interim pulsars with positive adopted DIST <= {MAX_DISTANCE_KPC} kpc, their reviewed neutron-star companions with measured masses, plus reviewed dormant black-hole and non-pulsar neutron-star systems no farther than 3000 light-years. Candidate status is explicit.",
        "snapshot": f"J2000 map positions; ATNF package downloaded {atnf['downloaded']}; binary masses reviewed {reviewed['reviewed']}; curated literature reviewed 2026-09-30.",
    }
    payload = {"schemaVersion": 1, "overlayId": "compact-remnants", "objects": objects}
    provenance = {
        "schemaVersion": 1,
        "overlayId": "compact-remnants",
        "sourceManifest": source_manifest,
        "curatedObjects": json.loads(CURATED.read_text()),
        "reviewedBinaries": reviewed,
        "notes": [
            "ATNF DIST is the catalogue-adopted distance: DIST_A, else a parallax above 3 sigma, else the YMW16 dispersion-measure distance bounded by DIST_AMN/DIST_AMX.",
            "Derived spin quantities follow psrcat v1.54 with a 10^45 g cm^2 moment of inertia; companion minimum and median masses assume a 1.35 M_sun pulsar at 90 and 60 degrees inclination.",
            "ATNF companion mass limits are not stored as pulsar masses; measured pulsar masses come only from the reviewed binary list.",
            "An ATNF uncertainty of 0 means no uncertainty was reported and is stored as null.",
            "Millisecond marks spin periods below 30 ms; Radio marks pulsars without the ATNF NRAD or XINS radio-quiet codes; other classes come from ATNF TYPE codes.",
            "Gaia NS1 remains explicitly marked as a candidate because a close double-white-dwarf alternative is disfavored but not fully excluded.",
            "BlackCAT was checked for accreting black-hole transients; its nearest listed system is beyond the 3000-light-year boundary.",
        ],
    }
    return {
        "manifest.json": json.dumps(manifest, indent=2) + "\n",
        "objects.json": json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n",
        "provenance.json": json.dumps(provenance, indent=2, ensure_ascii=False) + "\n",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--freeze", nargs=2, metavar=("PSRCAT_DB", "GLITCH_DB"))
    args = parser.parse_args()
    if args.freeze:
        freeze(*args.freeze)
        return
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, content in render().items():
        (OUTPUT / name).write_text(content)


if __name__ == "__main__":
    main()
