"""Rebuild the compact-remnant overlay from frozen, source-defined inputs."""

import csv
import hashlib
import json
import math
from pathlib import Path

from astropy.coordinates import SkyCoord
from astropy.time import Time
import astropy.units as units


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/compact-remnants"
ATNF = WORK / "atnf-long.csv"
CURATED = WORK / "curated.json"
SOURCE_MANIFEST = WORK / "source-manifest.json"
OUTPUT = ROOT / "src/data/overlays/compact-remnants"
RADIUS_LY = 3000
LY_PER_PC = 3.261563777
ATNF_URL = "https://www.atnf.csiro.au/research/pulsar/psrcat/psrcat_help.html"


def nullable(row, index):
    value = row[index].strip()
    return None if not value or value == "*" else float(value)


def text(row, index):
    value = row[index].strip()
    return None if not value or value == "*" else value


def jyear_from_mjd(value):
    return Time(value, format="mjd", scale="tt").jyear if value is not None else 2000.0


def cartesian_from_galactic(longitude_deg, latitude_deg, distance_pc):
    longitude = math.radians(longitude_deg)
    latitude = math.radians(latitude_deg)
    return (
        distance_pc * math.cos(latitude) * math.cos(longitude),
        distance_pc * math.cos(latitude) * math.sin(longitude),
        distance_pc * math.sin(latitude),
    )


def empty_scene_object(object_type, identifier, name, constellation, position, notes, details, raw_astrometry=None, mass=None):
    return {
        "type": object_type,
        "id": identifier,
        "name": name,
        "spectral_type": None,
        "constellation": constellation,
        "x_pc": round(position[0], 9),
        "y_pc": round(position[1], 9),
        "z_pc": round(position[2], 9),
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


def distance_provenance(row, distance_kpc, parallax, parallax_error):
    independent = nullable(row, 12)
    if independent is not None and math.isclose(independent, distance_kpc, rel_tol=0.001):
        return "Independent distance estimate", text(row, 14) or "ATNF DIST_A"
    if parallax is not None and parallax > 0 and parallax_error not in (None, 0) and parallax / parallax_error >= 3:
        inverse = 1 / parallax
        if math.isclose(inverse, distance_kpc, rel_tol=0.03):
            return "Parallax", text(row, 23) or "ATNF PX"
    return "Dispersion measure model", text(row, 20) or "ATNF DIST_DM"


def pulsar_object(row):
    psrj = text(row, 1)
    if psrj is None:
        raise ValueError("ATNF row is missing PSRJ")
    ra = nullable(row, 5)
    dec = nullable(row, 7)
    longitude = nullable(row, 9)
    latitude = nullable(row, 10)
    distance_kpc = nullable(row, 11)
    if None in (ra, dec, longitude, latitude, distance_kpc):
        raise ValueError(f"ATNF row {psrj} is missing position or distance")
    distance_pc = distance_kpc * 1000
    parallax = nullable(row, 21)
    parallax_error = nullable(row, 22)
    pm_ra = nullable(row, 24)
    pm_dec = nullable(row, 27)
    position_epoch = nullable(row, 53)
    raw_astrometry = None
    if parallax is not None and parallax > 0 and pm_ra is not None and pm_dec is not None:
        raw_astrometry = {
            "ra_deg": ra,
            "dec_deg": dec,
            "epoch": jyear_from_mjd(position_epoch),
            "parallax_mas": parallax,
            "parallax_error_mas": parallax_error,
            "pm_ra_cosdec_masyr": pm_ra,
            "pm_ra_error_masyr": nullable(row, 25),
            "pm_dec_masyr": pm_dec,
            "pm_dec_error_masyr": nullable(row, 28),
            "radial_velocity_kms": None,
            "radial_velocity_error_kms": None,
            "astrometry_ref": ", ".join(filter(None, (text(row, 23), text(row, 26), text(row, 29)))),
            "radial_velocity_ref": None,
        }
    distance_method, distance_source = distance_provenance(row, distance_kpc, parallax, parallax_error)
    binary_model = text(row, 45)
    companion_class = text(row, 52)
    companion = None
    if binary_model or companion_class:
        companion = "; ".join(filter(None, (
            f"ATNF binary model {binary_model}" if binary_model else None,
            f"companion class {companion_class}" if companion_class else None,
        )))
    coordinate = SkyCoord(ra=ra * units.deg, dec=dec * units.deg, frame="icrs")
    constellation = coordinate.get_constellation(short_name=False)
    details = {
        "confidence": "confirmed",
        "distance_method": distance_method,
        "distance_source": distance_source,
        "position_source": text(row, 2) or "ATNF PSRJ",
        "mass_error_solar": None,
        "rotation_period_s": nullable(row, 30),
        "rotation_period_error_s": nullable(row, 31),
        "radio_luminosity_1400_mjy_kpc2": nullable(row, 42),
        "characteristic_age_yr": nullable(row, 36),
        "surface_magnetic_field_gauss": nullable(row, 37),
        "spin_down_power_erg_s": nullable(row, 38),
        "orbital_period_days": nullable(row, 47),
        "orbital_period_error_days": nullable(row, 48),
        "companion": companion,
        "detection_method": "Pulsed emission",
        "source_label": "ATNF Pulsar Catalogue v2.8.1",
        "source_url": ATNF_URL,
        "ra_deg": ra,
        "dec_deg": dec,
    }
    note = f"ATNF adopted distance {distance_kpc:g} kpc ({distance_method.lower()}; reference {distance_source})."
    return empty_scene_object(
        "pulsar", f"psr-{psrj.lower().replace('+', 'p').replace('-', 'm')}", f"PSR {psrj}",
        constellation, cartesian_from_galactic(longitude, latitude, distance_pc), note, details, raw_astrometry,
    )


def curated_object(source):
    coordinate = SkyCoord(ra=source["ra_deg"] * units.deg, dec=source["dec_deg"] * units.deg, distance=source["distance_pc"] * units.pc, frame="icrs")
    galactic = coordinate.galactic.cartesian
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
    }
    return empty_scene_object(
        source["type"], source["id"], source["name"], source["constellation"],
        (galactic.x.value, galactic.y.value, galactic.z.value), source["notes"], details,
        mass=source["mass_solar"],
    )


def render():
    source_manifest = json.loads(SOURCE_MANIFEST.read_text())
    expected_hash = source_manifest["atnf"]["subsetSha256"]
    if hashlib.sha256(ATNF.read_bytes()).hexdigest() != expected_hash:
        raise ValueError("Frozen ATNF subset checksum does not match source-manifest.json")
    with ATNF.open(newline="") as handle:
        rows = list(csv.reader(handle, delimiter=";"))[2:]
    if len(rows) != source_manifest["atnf"]["rows"]:
        raise ValueError("Frozen ATNF subset row count does not match source-manifest.json")
    objects = [pulsar_object(row) for row in rows]
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
        "description": "A separately loaded, source-defined overlay of catalogued pulsars and curated dormant compact-object systems within 3000 light-years.",
        "epoch": 2000,
        "objectCount": len(objects),
        "radiusLy": RADIUS_LY,
        "counts": counts,
        "sources": [
            {"name": "ATNF Pulsar Catalogue v2.8.1", "url": ATNF_URL},
            {"name": "BlackCAT Galactic black-hole transients", "url": "https://www.sc.eso.org/~jcorral/BlackCAT/transients.php"},
            {"name": "Gaia BH1 high-precision orbit", "url": "https://arxiv.org/abs/2312.05313"},
            {"name": "Gaia BH3 discovery", "url": "https://arxiv.org/abs/2404.10486"},
            {"name": "Gaia NS1 characterization", "url": "https://arxiv.org/abs/2402.06722"},
        ],
        "cutoffPolicy": "ATNF v2.8.1 non-candidate, non-interim pulsars with positive adopted DIST <= 0.9198041814 kpc, plus reviewed dormant black-hole and non-pulsar neutron-star systems no farther than 3000 light-years. Candidate status is explicit.",
        "snapshot": "J2000 map positions; ATNF package downloaded 2026-09-30; curated literature reviewed 2026-09-30.",
    }
    payload = {"schemaVersion": 1, "overlayId": "compact-remnants", "objects": objects}
    provenance = {
        "schemaVersion": 1,
        "overlayId": "compact-remnants",
        "sourceManifest": source_manifest,
        "curatedObjects": json.loads(CURATED.read_text()),
        "notes": [
            "ATNF DIST is the catalogue-adopted distance and can derive from independent estimates, significant parallax, or a dispersion-measure model.",
            "ATNF companion mass limits are not stored as pulsar masses.",
            "Gaia NS1 remains explicitly marked as a candidate because a close double-white-dwarf alternative is disfavored but not fully excluded.",
            "BlackCAT was checked for accreting black-hole transients; its nearest listed system is beyond the 3000-light-year boundary.",
        ],
    }
    return {
        "manifest.json": json.dumps(manifest, indent=2) + "\n",
        "objects.json": json.dumps(payload, separators=(",", ":")) + "\n",
        "provenance.json": json.dumps(provenance, indent=2) + "\n",
    }


def main():
    files = render()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        (OUTPUT / name).write_text(content)


if __name__ == "__main__":
    main()
