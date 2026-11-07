"""Turn the downloaded Gaia flags and Hipparcos-Gaia tables into reviewed adoptions by exact identity.

Writes the proper-motion adoptions and the Gaia orbit review. The full tables stay in
catalog-work/downloads, which is not committed; their hashes are recorded in the output.
"""
import collections
import csv
import hashlib
import json
import math
import re
from pathlib import Path

from catalog_sources.bright_system_motion import bulk_vector

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = ROOT / "catalog-work/downloads"
MOTION = ROOT / "src/data/long-baseline-motion.json"
REVIEW = ROOT / "catalog-work/star-systems/gaia-flags-review.json"
REVIEWED_ON = "2026-11-07"
# Chi-squared for two degrees of freedom at 3 sigma; smaller shifts are negligible on the map.
ACCELERATION_CHI2, MINIMUM_SHIFT_MASYR = 11.8, 1.0
# Plain targeted-search solutions agreed with only 6 of 12 known periods, so they are not adopted.
ORBIT_PREFERENCE = ("SB2", "SB2C", "AstroSpectroSB1", "Orbital", "OrbitalTargetedSearchValidated", "SB1", "SB1C")
ASTROMETRIC = {"Orbital", "OrbitalTargetedSearchValidated", "AstroSpectroSB1"}
PARALLAX_TOLERANCE, FAST_KMS = 0.3, 150
# Generous upper limits on a pair's total mass by spectral class, to catch impossible velocities.
MAXIMUM_PAIR_MASS = {"O": 200, "B": 50, "A": 12, "F": 8, "G": 12, "K": 15, "M": 3}
# (period in days, largest plausible eccentricity): tides circularize very close pairs.
CIRCULAR_ORBITS = ((1.5, 0.1), (5, 0.35))
DOUBLE_LINED = ROOT / "catalog-work/star-systems/gaia-double-lined-review.json"
STELLAR_TYPES = {"star", "white_dwarf", "brown_dwarf", "sub_brown_dwarf"}
# A pair wider than this multiple of the orbit's size cannot be the pair that orbit describes.
MAXIMUM_SEPARATION_RATIO = 10
ASSUMED_TOTAL_MASS_SOLAR = 2


SB9_ALIASES = collections.defaultdict(set)
for _row in (ROOT / "catalog-work/star-systems/sb9-20240621/Alias.dta").read_text(errors="replace").splitlines():
    _fields = _row.split("|")
    if len(_fields) > 2 and _fields[1] in ("HIP", "HD", "GJ", "BD", "CD"):
        SB9_ALIASES[" ".join(f"{_fields[1]} {_fields[2]}".split())].add(_fields[0])


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def read_tsv(path):
    lines = [line.rstrip("\n") for line in path.open() if line.strip() and not line.startswith("#")]
    header = lines[0].split("\t")
    return [dict(zip(header, line.split("\t"))) for line in lines[3:] if line.split("\t")[0].strip().isdigit()]


def read_csv(path):
    return list(csv.DictReader(path.open()))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def campbell(row):
    """Campbell elements from Thiele-Innes constants; the node and argument are ambiguous by 180 degrees."""
    a, b, f, g = (number(row[f"{name}_thiele_innes"]) for name in "abfg")
    if None in (a, b, f, g):
        return None
    total, difference = math.atan2(b - f, a + g), math.atan2(-b - f, a - g)
    argument, node = (total + difference) / 2, (total - difference) / 2
    if node < 0:
        node, argument = node + math.pi, argument + math.pi
    inclination = 2 * math.atan2(math.hypot(a - g, b + f), math.hypot(a + g, b - f))
    half = (a * a + b * b + f * f + g * g) / 2
    axis = math.sqrt(half + math.sqrt(max(half * half - (a * g - b * f) ** 2, 0)))
    return {"inclinationDeg": round(math.degrees(inclination), 3), "nodeDeg": round(math.degrees(node) % 360, 3),
            "argumentDeg": round(math.degrees(argument) % 360, 3), "photocenterAxisMas": round(axis, 4)}


def separation_au(first, second):
    """Projected separation of two rows with their own astrometry, or None."""
    if not all(row.get("ra_deg") and row.get("parallax_mas") and float(row["parallax_mas"]) > 0 for row in (first, second)):
        return None
    ra, dec = float(first["ra_deg"]), float(first["dec_deg"])
    offset = math.hypot((float(second["ra_deg"]) - ra) * math.cos(math.radians(dec)), float(second["dec_deg"]) - dec)
    return offset * 3600 * 1000 / float(first["parallax_mas"])


def orbit_axis_au(period_days):
    return (ASSUMED_TOTAL_MASS_SOLAR * (period_days / 365.25) ** 2) ** (1 / 3)


def sb9_numbers(identity):
    return {number for name in identity.get("designations", []) for number in SB9_ALIASES.get(" ".join(name.split()), ())}


def sb9_period_conflict(identity, period):
    known = [number(row.split("|")[2]) for row in (ROOT / "catalog-work/star-systems/sb9-20240621/Orbits.dta").read_text(errors="replace").splitlines()
             if row.split("|")[0] in sb9_numbers(identity) and len(row.split("|")) > 2]
    return bool(known) and not any(value and abs(period / value - 1) < 0.1 for value in known)


def minimum_total_mass(row):
    """M sin^3 i of both stars in solar masses, from the two velocity amplitudes."""
    period, first, second = number(row["period"]), number(row["semi_amplitude_primary"]), number(row["semi_amplitude_secondary"])
    if not period or not first or not second:
        return None
    return 1.036e-7 * (first + second) ** 3 * period * (1 - (number(row["eccentricity"]) or 0) ** 2) ** 1.5


def double_lined_problem(row, spectral_type, gaia_ids, name):
    """Why a double-lined Gaia orbit cannot be added automatically, or None."""
    if len(gaia_ids) != 1:
        return "Its identity lists several Gaia sources."
    if re.search(r"(\s|\d)[A-C][a-z]?$", name):
        return "It is already a component of a wider pair, so this orbit needs a reviewed hierarchy."
    period, eccentricity = number(row["period"]), number(row["eccentricity"]) or 0
    if any(eccentricity > limit and period < below for below, limit in CIRCULAR_ORBITS):
        return f"An eccentricity of {eccentricity:.2f} is implausible for a {period:.2f}-day orbit, which tides should have circularized."
    limit = MAXIMUM_PAIR_MASS.get((spectral_type or "")[:1].upper())
    mass = minimum_total_mass(row)
    if mass is None:
        return "It lacks a velocity amplitude for one of the stars."
    if limit is None:
        return "Its spectral class gives no mass limit to test the orbit against."
    if mass > limit:
        return f"The velocities imply at least {mass:.0f} solar masses, more than class {(spectral_type or '')[:1].upper()} stars can have."
    return None


def main():
    identities = json.loads((ROOT / "src/data/object-designations.json").read_text())["objects"]
    objects, gaia_sets = {}, {}
    for identifier, identity in identities.items():
        gaia = hip = None
        for name in identity.get("designations", []):
            gaia = (match := re.fullmatch(r"Gaia DR3 (\d+)", name)) and match[1] or gaia
            hip = (match := re.fullmatch(r"HIP (\d+)", name)) and int(match[1]) or hip
        objects[identifier] = (gaia, hip)
        gaia_sets[identifier] = {match[1] for name in identity.get("designations", []) for match in [re.fullmatch(r"Gaia DR3 (\d+)", name)] if match}
    rows = {}
    for path in sorted((ROOT / "src/data/catalogs").glob("*/stars.csv")):
        for row in read_csv(path):
            if row["type"] in STELLAR_TYPES:
                rows.setdefault(row["id"], row)

    files = {"hgca": DOWNLOADS / "brandt-2021-hgca/hgca.tsv", "kervella": DOWNLOADS / "kervella-2022-pma/tablea1.tsv",
             "gaia": DOWNLOADS / "gaia-dr3-flags/gaia_source.csv", "orbits": DOWNLOADS / "gaia-dr3-flags/nss_two_body_orbit.csv"}
    hgca = {int(row["HIP"]): row for row in read_tsv(files["hgca"])}
    kervella = {int(row["HIP"]): row for row in read_tsv(files["kervella"])}
    gaia_rows = {row["source_id"]: row for row in read_csv(files["gaia"])}
    orbit_rows = collections.defaultdict(list)
    for row in read_csv(files["orbits"]):
        orbit_rows[row["source_id"]].append(row)
    sources = {name: {"path": str(path.relative_to(ROOT)), "sha256": sha256(path)} for name, path in files.items()}

    merged = {identifier for identifier, identity in identities.items()
              if sum(bool(re.fullmatch(r"HIP \d+", name)) for name in identity.get("designations", [])) > 1 or len(gaia_sets[identifier]) > 1}
    cluster_ids = {row["id"] for row in read_csv(ROOT / "catalog-work/famous-cluster-stars/retired-catalog/stars.csv")}
    adopted, held = {}, {}
    for identifier, row in sorted(rows.items()):
        gaia, hip = objects.get(identifier, (None, None))
        entry = hgca.get(hip)
        if not entry or not row.get("pm_ra_cosdec_masyr") or not row.get("pm_dec_masyr"):
            continue
        current = float(row["pm_ra_cosdec_masyr"]), float(row["pm_dec_masyr"])
        long_baseline = number(entry["pmRAhg"]), number(entry["pmDEhg"])
        hipparcos = number(entry["pmRAhip"]), number(entry["pmDEhip"])
        if None in long_baseline or (number(entry["chi2"]) or 0) <= ACCELERATION_CHI2 or math.dist(current, long_baseline) <= MINIMUM_SHIFT_MASYR:
            continue
        if identifier in merged:
            held[identifier] = "Its identity lists several HIP or Gaia numbers, so it may merge different stars."
        elif identifier in cluster_ids:
            held[identifier] = "A reviewed cluster member keeps its frozen astrometry."
        elif entry["Gaia"].strip() != gaia:
            held[identifier] = "The Hipparcos-Gaia match is a different Gaia source."
        elif None in hipparcos or math.dist(long_baseline, hipparcos) >= math.dist(current, hipparcos):
            held[identifier] = "Hipparcos does not independently favor the long-baseline value."
        elif not row.get("parallax_mas") or float(row["parallax_mas"]) <= 0:
            held[identifier] = "No parallax to convert the change into a velocity."
        elif gaia not in gaia_rows:
            held[identifier] = "Its Gaia flags were not part of the download."
        elif abs(float(row["parallax_mas"]) / (number(gaia_rows[gaia]["parallax"]) or math.inf) - 1) > PARALLAX_TOLERANCE:
            held[identifier] = "The row's parallax disagrees with Gaia, so the row may describe another star."
        else:
            raw = {"ra_deg": float(row["ra_deg"]), "dec_deg": float(row["dec_deg"]), "parallax_mas": float(row["parallax_mas"])}
            before = bulk_vector({**raw, "pm_ra_cosdec_masyr": current[0], "pm_dec_masyr": current[1]}, 0)
            after = bulk_vector({**raw, "pm_ra_cosdec_masyr": long_baseline[0], "pm_dec_masyr": long_baseline[1]}, 0)
            if row.get("vx_kms"):
                velocity = [float(row[axis]) for axis in ("vx_kms", "vy_kms", "vz_kms")]
                speed, new_speed = math.hypot(*velocity), math.hypot(*(value + new - old for value, new, old in zip(velocity, after, before)))
                if new_speed > FAST_KMS and new_speed > 1.5 * speed:
                    held[identifier] = f"The change would raise its speed from {speed:.0f} to {new_speed:.0f} km/s."
                    continue
            adopted[identifier] = {"hip": hip, "gaiaDr3": gaia, "chi2": number(entry["chi2"]), "previous": list(current),
                "pm_ra_cosdec_masyr": long_baseline[0], "pm_ra_error_masyr": number(entry["e_pmRAhg"]),
                "pm_dec_masyr": long_baseline[1], "pm_dec_error_masyr": number(entry["e_pmDEhg"]),
                "delta_velocity_kms": [round(new - old, 6) for new, old in zip(after, before)]}
    MOTION.write_text(json.dumps({"schemaVersion": 1, "reviewedOn": REVIEWED_ON, "sources": {"hgca": sources["hgca"]},
        "reference": "Brandt 2021, ApJS 254, 42; 2021ApJS..254...42B", "sourceUrl": "https://vizier.cfa.harvard.edu/viz-bin/VizieR?-source=J/ApJS/254/42",
        "policy": "Adopt the Hipparcos-Gaia long-baseline proper motion when the same Gaia source shows significant acceleration, it differs from the catalog value by more than 1 mas/yr, it lies closer to the independent Hipparcos proper motion than the catalog value does, the row's parallax is within 30 percent of Gaia, and the star does not become implausibly fast. The change in velocity uses the row's own parallax, so its radial velocity is unaffected.",
        "objects": adopted, "held": held}, indent=1) + "\n")

    identity_sets = [json.loads((ROOT / path).read_text())["systems"] for path in ("src/data/stellar-system-identities.json",)]
    orbits = {system["systemId"]: system["orbits"] for system in json.loads((ROOT / "src/data/stellar-orbits.json").read_text())["systems"]}
    members = {identifier for systems in identity_sets for system in systems for component in system["components"]
               for identifier in [component["starId"], *component.get("alternateStarIds", [])]}
    adopted_orbits, held_orbits = [], []
    for system in identity_sets[0]:
        components = system["components"]
        if any(orbit.get("catalog") != "Gaia DR3 NSS" for orbit in orbits.get(system["id"], [])) and orbits.get(system["id"]):
            continue
        gaia_ids = {component["starId"]: objects.get(component["starId"], (None, None))[0] for component in components}
        hits = [row for gaia in set(gaia_ids.values()) for row in orbit_rows.get(gaia, [])]
        if not hits:
            continue
        usable = [row for row in hits if row["nss_solution_type"] in ORBIT_PREFERENCE and number(row["period"])]
        if not usable:
            held_orbits.append({"systemId": system["id"], "name": system["name"], "reason": "Only unvalidated targeted-search solutions."})
            continue
        best = min(usable, key=lambda row: ORBIT_PREFERENCE.index(row["nss_solution_type"]))
        period = number(best["period"])
        reason = None
        if len(components) != 2:
            reason = "More than two components, so the orbit's pair is not identified."
        elif len({gaia for gaia in gaia_ids.values() if gaia}) > 1:
            first, second = (rows.get(component["starId"], {}) for component in components)
            separation = separation_au(first, second)
            if separation is None:
                reason = "Two Gaia sources without astrometry to compare the separation with the orbit."
            elif separation > MAXIMUM_SEPARATION_RATIO * orbit_axis_au(period):
                reason = f"The pair is {separation:.0f} AU apart, far wider than this {period:.1f}-day orbit, which points to a hidden inner companion."
        if reason:
            held_orbits.append({"systemId": system["id"], "name": system["name"], "solution": best["nss_solution_type"], "periodDays": period, "reason": reason})
            continue
        elements = campbell(best) if best["nss_solution_type"] in ASTROMETRIC else None
        adopted_orbits.append({"systemId": system["id"], "name": system["name"], "sourceId": best["source_id"], "solution": best["nss_solution_type"],
            "periodDays": period, "periodErrorDays": number(best["period_error"]), "eccentricity": number(best["eccentricity"]), "eccentricityError": number(best["eccentricity_error"]),
            "argumentDeg": number(best["arg_periastron"]), "argumentErrorDeg": number(best["arg_periastron_error"]),
            "k1Kms": number(best["semi_amplitude_primary"]), "k2Kms": number(best["semi_amplitude_secondary"]), "systemicKms": number(best["center_of_mass_velocity"]),
            "goodnessOfFit": number(best["goodness_of_fit"]), "significance": number(best["significance"]), **(elements or {})})

    sorted_singles = collections.defaultdict(list)
    for identifier in sorted(rows):
        gaia = objects.get(identifier, (None, None))[0]
        if identifier in members or gaia not in orbit_rows:
            continue
        kinds = {row["nss_solution_type"] for row in orbit_rows[gaia]}
        if kinds & {"SB2", "SB2C"}:
            group = "doubleLined"
        elif kinds & ASTROMETRIC:
            group = "astrometric"
        elif kinds & {"SB1", "SB1C"}:
            group = "singleLined"
        elif "EclipsingBinary" in kinds:
            group = "eclipsing"
        else:
            group = "unvalidatedTargetedSearch"
        best = min(orbit_rows[gaia], key=lambda row: ORBIT_PREFERENCE.index(row["nss_solution_type"]) if row["nss_solution_type"] in ORBIT_PREFERENCE else 99)
        sorted_singles[group].append({"id": identifier, "name": rows[identifier]["name"], "solution": best["nss_solution_type"], "periodDays": number(best["period"]), "goodnessOfFit": number(best["goodness_of_fit"])})

    # Earlier adoptions stay once their stars have become system members.
    previous = json.loads(DOUBLE_LINED.read_text())["adopted"] if DOUBLE_LINED.exists() else {}
    shared_sources = collections.Counter(gaia for identifier, gaia in ((i, objects.get(i, (None, None))[0]) for i in rows) if gaia)
    decisions, double_held = dict(previous), {}
    for entry in sorted_singles.get("doubleLined", []):
        identifier, row = entry["id"], rows[entry["id"]]
        source = next(gaia for gaia in sorted(gaia_sets[identifier]) if gaia in orbit_rows)
        orbit = next(item for item in orbit_rows[source] if item["nss_solution_type"] in ("SB2", "SB2C"))
        problem = "Another catalog star lists the same Gaia source." if shared_sources[source] > 1 or identifier in merged else "SB9 lists several orbits for this star, so the pair is not identified." if len(sb9_numbers(identities[identifier])) > 1 else "SB9 gives a different period, so this may be another pair or a spurious solution." if sb9_period_conflict(identities[identifier], number(orbit["period"])) else double_lined_problem(orbit, row["spectral_type"], gaia_sets[identifier], row["name"])
        if problem:
            double_held[identifier] = {"name": row["name"], "reason": problem}
        else:
            decisions[identifier] = {"name": row["name"], "sourceId": source, "solution": orbit["nss_solution_type"], "periodDays": number(orbit["period"]),
                "periodErrorDays": number(orbit["period_error"]), "eccentricity": number(orbit["eccentricity"]), "systemicKms": number(orbit["center_of_mass_velocity"]),
                "systemicErrorKms": number(orbit["center_of_mass_velocity_error"]), "minimumTotalMassSolar": round(minimum_total_mass(orbit), 3), "spectralType": row["spectral_type"]}
    if not previous or decisions != previous:
        DOUBLE_LINED.write_text(json.dumps({"schemaVersion": 1, "reviewedOn": REVIEWED_ON,
            "policy": "A Gaia DR3 double-lined orbit adds a stellar companion to an otherwise single star when it has one exact Gaia source, is not a component of a wider pair, has a plausible eccentricity for its period, and implies a total mass its spectral class allows.",
            "adopted": decisions, "held": {**(json.loads(DOUBLE_LINED.read_text())["held"] if DOUBLE_LINED.exists() else {}), **double_held}}, indent=1, ensure_ascii=False) + "\n")

    distances = []
    for identifier, row in sorted(rows.items()):
        gaia, hip = objects.get(identifier, (None, None))
        entry, flags = kervella.get(hip), gaia_rows.get(gaia)
        if not entry or not flags or (number(flags["ruwe"]) or 0) <= 1.4:
            continue
        values = [number(entry[name]) for name in ("PlxG3", "e_PlxG3", "PlxH2", "e_PlxH2")]
        if None in values or values[0] <= 0 or values[2] <= 0 or abs(values[0] - values[2]) <= 3 * math.hypot(values[1], values[3]):
            continue
        distances.append({"id": identifier, "name": row["name"], "gaiaParallaxMas": values[0], "hipparcosParallaxMas": values[2], "ruwe": number(flags["ruwe"]),
                          "distanceGapPercent": round(abs(1 / values[0] - 1 / values[2]) * values[0] * 100)})
    REVIEW.write_text(json.dumps({"schemaVersion": 1, "reviewedOn": REVIEWED_ON, "sources": sources,
        "orbitPolicy": "Gaia DR3 orbits attach to a system only when its two components share one Gaia source or sit close enough for the orbit to describe them. Plain OrbitalTargetedSearch solutions are not adopted.",
        "orbits": adopted_orbits, "heldOrbits": held_orbits, "singleStarOrbits": sorted_singles,
        "distancesForGaiaDr4": sorted(distances, key=lambda item: -item["distanceGapPercent"])}, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(adopted)} proper motions adopted, {len(held)} held; {len(adopted_orbits)} orbits adopted, {len(held_orbits)} held; "
          f"single-star orbits {({key: len(value) for key, value in sorted_singles.items()})}; {len(distances)} distances listed")


if __name__ == "__main__":
    main()
