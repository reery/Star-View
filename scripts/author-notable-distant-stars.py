"""Build the Notable distant stars catalog and the compact-system identities and orbits.

The catalog holds reviewed stars beyond the nearby catalogs that belong to a
notable system: the measured stellar companions of pulsars and the luminous
stars of dormant black-hole and neutron-star systems. A companion shares its
compact host's plotted position and system astrometry; every physical value is
the companion's own published measurement.
Run with --check to compare the checked-in files without writing them.
"""

import argparse
import csv
import io
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/notable-distant-stars"
COMPANION_FILES = [WORK / "pulsar-companions.json", WORK / "gaia-companions.json", WORK / "binary-companions.json"]
NEUTRON_STARS = ROOT / "catalog-work/compact-remnants/pulsar-binaries.json"
COMPACT = ROOT / "src/data/overlays/compact-remnants/objects.json"
WESTERN = ROOT / "src/data/catalogs/western-constellation-stars/stars.csv"
OUTPUT = ROOT / "src/data/catalogs/notable-distant-stars"
IDENTITIES = ROOT / "src/data/compact-system-identities.json"
PREFERRED_NAMES = ROOT / "catalog-work/object-designations/preferred-names.json"
ORBITS = ROOT / "src/data/compact-system-orbits.json"
DAYS_PER_YEAR = 365.25
SOLAR_TEMPERATURE_K = 5772
ATNF_URL = "https://www.atnf.csiro.au/research/pulsar/psrcat/psrcat_help.html"


def number(value):
    return "" if value is None else repr(value)


def companion_row(source, host, header):
    astrometry = host["raw_astrometry"] or {}
    mass = source.get("mass_source")
    component = source.get("component", "B")
    period = host["compact"]["orbital_period_days"]
    # A wider outer star or an unmeasured orbit has no inner-binary period to quote.
    in_orbit = f" in its {period:.4g}-day orbit" if period is not None and component == "B" else ""
    notes = [f"Companion of {host['name']}{in_orbit}. {source['note']}"]
    if mass:
        uncertainty = f"{source['mass_solar']} ± {source['mass_error_solar']}" if source.get("mass_error_solar") is not None else f"about {source['mass_solar']}"
        notes.append(f"Mass {uncertainty} M_sun: {mass['label']}, {mass['url']}.")
    luminosity = source.get("luminosity_solar")
    atmosphere = source.get("atmosphere_source")
    if source.get("temperature_k") is not None:
        temperature = source.get("temperature_source", atmosphere)
        uncertainty = f" ± {source['temperature_error_k']}" if source.get("temperature_error_k") is not None else ""
        notes.append(f"Effective temperature {source['temperature_k']}{uncertainty} K: {temperature['label']}, {temperature['url']}.")
    if source.get("radius_solar") is not None:
        notes.append(f"Radius {source['radius_note']}: {atmosphere['label']}, {atmosphere['url']}.")
    if luminosity is not None:
        notes.append(f"Luminosity {source['luminosity_note']}: {atmosphere['label']}, {atmosphere['url']}.")
    elif source.get("radius_solar") is not None and source.get("temperature_k") is not None:
        # Stefan-Boltzmann luminosity from the companion's own radius and temperature.
        luminosity = float(f"{source['radius_solar'] ** 2 * (source['temperature_k'] / SOLAR_TEMPERATURE_K) ** 4:.3g}")
        notes.append("Luminosity is derived from that radius and temperature.")
    for field in ("metallicity", "age"):
        if source.get(f"{field}_note"):
            notes.append(f"{field.capitalize()} {source[f'{field}_note']}: {atmosphere['label']}, {atmosphere['url']}.")
    if host["type"] != "pulsar" and astrometry.get("radial_velocity_kms") is None:
        notes.append(f"Position{' and motion are' if astrometry else ' is'} the unresolved system's: {astrometry.get('astrometry_ref') or host['compact']['position_source']}. No radial velocity is adopted.")
    elif astrometry.get("radial_velocity_kms") is None:
        notes.append(f"Position, parallax and proper motion are the pulsar system's: {host['notes'].split(' Mass ')[0]} No radial velocity is adopted.")
    else:
        notes.append(f"Position and motion are the unresolved system's: {astrometry['astrometry_ref']}; {astrometry['radial_velocity_ref']}.")
    values = {
        "type": source["type"],
        "id": f"{host['id']}-{component.lower()}",
        "name": f"{host['name']} {component}",
        "designations": "|".join(source.get("designations", [])),
        "spectral_type": source["spectral_type"] or "",
        "x_pc": number(host["x_pc"]),
        "y_pc": number(host["y_pc"]),
        "z_pc": number(host["z_pc"]),
        "temperature_k": number(source.get("temperature_k")),
        "metallicity_dex": number(source.get("metallicity_dex")),
        "metallicity_kind": "[Fe/H]" if source.get("metallicity_dex") is not None else "",
        "age_gyr": number(source.get("age_gyr")),
        "mass_solar": number(source.get("mass_solar")),
        "luminosity_solar": number(luminosity),
        "radius_solar": number(source.get("radius_solar")),
        "epoch": "2000.0",
        "notes": " ".join(notes),
        "constellation": host["constellation"],
        "ra_deg": number(astrometry.get("ra_deg")),
        "dec_deg": number(astrometry.get("dec_deg")),
        "astrometry_epoch": number(astrometry.get("epoch")),
        "parallax_mas": number(astrometry.get("parallax_mas")),
        "parallax_error_mas": number(astrometry.get("parallax_error_mas")),
        "pm_ra_cosdec_masyr": number(astrometry.get("pm_ra_cosdec_masyr")),
        "pm_ra_error_masyr": number(astrometry.get("pm_ra_error_masyr")),
        "pm_dec_masyr": number(astrometry.get("pm_dec_masyr")),
        "pm_dec_error_masyr": number(astrometry.get("pm_dec_error_masyr")),
        "radial_velocity_kms": number(astrometry.get("radial_velocity_kms")),
        "radial_velocity_error_kms": number(astrometry.get("radial_velocity_error_kms")),
        "astrometry_ref": astrometry.get("astrometry_ref") or "",
        "radial_velocity_ref": astrometry.get("radial_velocity_ref") or "",
    }
    return [values.get(field, "") for field in header]


def orbit(pulsar, companion_mass, range_years=None):
    """Pulsar timing or published binary orbit; Kepler's law with both measured masses gives the relative axis."""
    details = pulsar["compact"]
    timing = pulsar["type"] == "pulsar"
    # A published range with no timing orbit is stored at its midpoint, and the scope says so.
    period_years = sum(range_years) / 2 if range_years else details["orbital_period_days"] / DAYS_PER_YEAR
    measured = pulsar["mass_solar"] is not None and companion_mass is not None
    axis = float(f"{((pulsar['mass_solar'] + companion_mass) * period_years ** 2) ** (1 / 3):.4g}") if measured else None
    derivation = "the relative semi-major axis follows from Kepler's third law with both measured masses." if measured else "the semi-major axis is not adopted because a component mass is unmeasured."
    return {"systemId": f"{pulsar['id']}-system", "name": pulsar["name"], "orbits": [{
        "id": f"{pulsar['id']}-system-0",
        "primary": "A",
        "secondary": "B",
        "primaryIds": [pulsar["id"]],
        "secondaryIds": [f"{pulsar['id']}-b"],
        "periodYears": period_years,
        "semiMajorAxisAu": axis,
        "eccentricity": details["eccentricity"],
        "inclinationDeg": None,
        "nodeDeg": None,
        "argumentDeg": None,
        "periastronEpoch": None,
        "epochKind": None,
        "grade": None,
        "catalog": "ATNF Pulsar Catalogue v2.9.0" if timing else "Reviewed literature",
        "reference": "Pulsar timing orbit" if timing else details["source_label"],
        "sourceUrl": ATNF_URL if timing else details["source_url"],
        "nodeAmbiguous": True,
        "argumentComponent": None,
        "scope": f"{f'Period is the midpoint of the published {range_years[0]:,}-{range_years[1]:,} year range; ' if range_years else ''}Period and eccentricity from {'pulsar timing' if timing and not range_years else 'the published orbit'}; {derivation} The orbit's orientation on the sky is not adopted.",
        "axisDerivation": None,
    }]}


def build():
    reviewed_files = [json.loads(path.read_text()) for path in COMPANION_FILES]
    companions = [source for reviewed in reviewed_files for source in reviewed["companions"]]
    neutron_stars = json.loads(NEUTRON_STARS.read_text())["neutronStarCompanions"]
    compact = {item["id"]: item for item in json.loads(COMPACT.read_text())["objects"]}
    with WESTERN.open(newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        sun = next(row for row in reader if row[header.index("id")] == "sun")
    rows = [sun, *(companion_row(source, compact[source["host"]], header) for source in companions)]
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(header)
    writer.writerows(rows)
    sources = {(source["mass_source"]["label"], source["mass_source"]["url"]) for source in companions if "mass_source" in source}
    sources |= {(source[key]["label"], source[key]["url"]) for source in companions for key in ("temperature_source", "atmosphere_source") if key in source}
    manifest = {
        "schemaVersion": 1,
        "id": "notable-distant-stars",
        "label": "Notable distant stars",
        "description": "Reviewed stars beyond the nearby catalogs that belong to notable systems: measured stellar companions of pulsars and the luminous stars of dormant black-hole and neutron-star systems, plus the Sun.",
        "epoch": 2000,
        "objectCount": len(rows),
        "sources": [{"name": "ATNF Pulsar Catalogue v2.9.0; host pulsar positions and system astrometry", "url": ATNF_URL},
                    *({"name": f"{host['compact']['source_label']}; system orbit and astrometry", "url": host["compact"]["source_url"]}
                      for host in (compact[source["host"]] for source in companions) if host["type"] != "pulsar"),
                    *({"name": label, "url": url} for label, url in sorted(sources))],
        "cutoffPolicy": "Explicitly reviewed members of notable systems only; no magnitude or distance cutoff. Luminous companions of compact objects are included with whichever individual values are published. Sun is included only as the map origin.",
        "snapshot": f"J2000 map positions from the compact-remnant overlay; companion measurements reviewed {max(reviewed['reviewed'] for reviewed in reviewed_files)}.",
    }
    provenance = {
        "schemaVersion": 1,
        "catalogId": "notable-distant-stars",
        "policy": " ".join(reviewed["policy"] for reviewed in reviewed_files),
        "objects": {f"{source['host']}-{source.get('component', 'B').lower()}": {"hostId": source["host"], **source} for source in companions},
    }
    # Runtime system identities: each compact object is component A, its measured companion B.
    inner = [source for source in companions if source.get("component", "B") == "B"]
    pairs = sorted([*(source["host"] for source in inner), *(f"psr-{source['pulsar'].lower().replace('+', 'p').replace('-', 'm')}" for source in neutron_stars)])
    outer = {source["host"]: source["component"] for source in companions if source.get("component", "B") != "B"}
    preferred = json.loads(PREFERRED_NAMES.read_text())
    identities = {"systems": [
        {"id": f"{pulsar}-system", "name": preferred.get(pulsar, {}).get("name", compact[pulsar]["name"]), "components": [
            {"starId": pulsar, "label": "A"}, {"starId": f"{pulsar}-b", "label": "B"},
            *([{"starId": f"{pulsar}-{outer[pulsar].lower()}", "label": outer[pulsar]}] if pulsar in outer else [])]}
        for pulsar in pairs]}
    companion_masses = {source["host"]: source.get("mass_solar") for source in inner}
    period_ranges = {source["host"]: source["orbit_period_range_years"] for source in inner if "orbit_period_range_years" in source}
    companion_masses.update({f"psr-{source['pulsar'].lower().replace('+', 'p').replace('-', 'm')}": source["mass_solar"] for source in neutron_stars})
    orbits = {"schemaVersion": 1, "systems": [orbit(compact[pulsar], companion_masses[pulsar], period_ranges.get(pulsar)) for pulsar in pairs]}
    return {
        OUTPUT / "stars.csv": buffer.getvalue(),
        ORBITS: json.dumps(orbits, indent=2) + "\n",
        OUTPUT / "catalog.json": json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        OUTPUT / "provenance.json": json.dumps(provenance, indent=2, ensure_ascii=False) + "\n",
        IDENTITIES: json.dumps(identities, indent=2) + "\n",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    files = build()
    if args.check:
        stale = [str(path.relative_to(ROOT)) for path, text in files.items() if not path.exists() or path.read_text() != text]
        if stale:
            raise SystemExit(f"Notable distant stars are stale: {', '.join(stale)}. Run python3 scripts/author-notable-distant-stars.py.")
        return
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for path, text in files.items():
        path.write_text(text)
    print(f"{len(files) - 1} catalog files; {sum(1 for _ in files[OUTPUT / 'stars.csv'].splitlines()) - 2} companions")


if __name__ == "__main__":
    main()
