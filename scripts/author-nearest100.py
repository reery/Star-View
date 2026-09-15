"""Offline catalog authoring; never imported by the application."""

import argparse
import csv
import hashlib
import io
import json
import math
import re
from pathlib import Path

import astropy
import astropy.units as units
from astropy.coordinates import CartesianRepresentation, SkyCoord, get_constellation
from astropy.io import ascii
from astropy.time import Time
from astropy.utils import iers

iers.conf.auto_download = False
ROOT = Path(__file__).resolve().parents[1]
NAME_CORRECTIONS = {"Bo\u00f6tes": "Bootes", "Chamaleon": "Chamaeleon", "Ophiucus": "Ophiuchus", "Pisces Austrinus": "Piscis Austrinus"}
FROZEN = ROOT / "catalog-work/nearest-100"
LEGACY_TENTATIVE_EXCEPTIONS = {"27", "28"}
POLICY_REVISION = "confirmed-membership-v2"
MEMBERSHIP_POLICY = "Exclude Planet rows, aggregate system rows and source ObjType endings '?'. The only approved exceptions are Seq 27/28 (EZ Aquarii B/C): preserve vetted default membership and every default field, while retaining raw LM? classifications explicitly; this is not a new classification measurement. Keep all tentative buffer records for audit."
LEGACY_IDS = {
    "1": "proxima-centauri", "3": "alpha-centauri-a", "4": "alpha-centauri-b",
    "5": "barnards-star", "6": "luhman-16-a", "7": "luhman-16-b",
    "8": "wise-0855-0714", "9": "wolf-359", "10": "lalande-21185",
    "13": "sirius-a", "14": "sirius-b", "15": "luyten-726-8-a",
    "16": "luyten-726-8-b", "17": "ross-154", "18": "ross-248",
    "19": "epsilon-eridani", "21": "lacaille-9352", "24": "ross-128",
    "26": "ez-aquarii-a", "27": "ez-aquarii-b", "28": "ez-aquarii-c",
}
CNS_IDENTITIES = {
    "3627": ["3", "4"], "2653": ["6", "7"], "2194": ["8"],
    "1676": ["13"], "5586": ["26", "27", "28"], "1895": ["31"],
    "5550": ["61", "62"], "1828": ["68"], "1610": ["66"],
    "4091": ["84"], "4370": ["90"], "69": ["164", "165"],
    "4912": ["117"], "2389": ["123"], "2747": ["130"],
    "965": ["134"], "1054": ["137"], "3707": ["1001"],
    "1529": ["141"], "3699": ["147"], "4217": ["160", "161"],
    "3866": ["163"], "2383": ["175"], "5474": ["177"],
    "4136": ["197", "198", "199"], "3482": ["186"],
    "2079": ["208"], "1035": ["209"], "1338": ["210"],
}
SOURCES = [
    {"name": "10pc census, Reyle et al., tablea1 update 2023-08-25", "url": "https://cdsarc.cds.unistra.fr/ftp/J/A+A/650/A201/ReadMe"},
    {"name": "CNS5, Golovin et al., corrected 2023-12-13; membership audit", "url": "https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/ReadMe"},
    {"name": "Pecaut & Mamajek 2013, dwarf sequence version 2022.04.16; estimated temperatures", "url": "https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt"},
    {"name": "NASA Sun Fact Sheet, 2024-05-09", "url": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html"},
    {"name": "Astropy 7.1.1, IAU constellations using Roman 1987 boundaries", "url": "https://docs.astropy.org/en/stable/api/astropy.coordinates.get_constellation.html"},
]


def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=True, allow_nan=False) + "\n")


def normalized_position(row):
    required = ("RAdeg", "DEdeg", "plx", "Epoch", "pmRA", "pmDE")
    if any(row[field] is None for field in required):
        raise ValueError(f"Missing astrometry: {row.get('ObjName', row.get('CNS5'))}")
    assert float(row["plx"]) > 0
    use_rv = row.get("RV") is not None and row.get("r_RV") is not None and row.get("ObjType") != "WD"
    motion = {"radial_velocity": float(row["RV"]) * units.km / units.s} if use_rv else {}
    original = SkyCoord(
        ra=float(row["RAdeg"]) * units.deg, dec=float(row["DEdeg"]) * units.deg,
        distance=1000 / float(row["plx"]) * units.pc,
        pm_ra_cosdec=float(row["pmRA"]) * units.mas / units.yr,
        pm_dec=float(row["pmDE"]) * units.mas / units.yr,
        obstime=Time(float(row["Epoch"]), format="jyear", scale="tt"), frame="icrs", **motion,
    )
    shifted = original.apply_space_motion(new_obstime=Time(2000.0, format="jyear", scale="tt"))
    direction = SkyCoord(ra=shifted.ra, dec=shifted.dec, distance=shifted.distance, frame="icrs")
    velocity = original.galactic.velocity.d_xyz.to_value(units.km / units.s).tolist() if use_rv else None
    return direction, velocity, "full-space-motion" if use_rv else "transverse-only; unknown/withheld RV, no exported velocity"


def freeze_sources(folder, force=False):
    target = FROZEN / "source-input.json"
    if target.exists() and not force:
        raise FileExistsError("Frozen input exists; use --force only for an intentional source release update.")
    rows = read_cds(folder, "tablea1.dat", "10pc.ReadMe")
    cns = read_cds(folder, "cns5.dat", "cns5.ReadMe")
    assert len(rows) == 562 and len(cns) == 5909
    eligible = [row for row in rows if row["ObjType"] != "Planet"]
    candidates = [row for row in eligible if float(row["plx"]) >= 150]
    audit_rows = [row for row in cns if row["plx"] and float(row["plx"]) >= 150]
    system_counts = {}
    for row in eligible:
        system_counts[row["Sys"]] = system_counts.get(row["Sys"], 0) + 1
    by_gaia = {row["GaiaEDR3"]: row for row in eligible if row["GaiaEDR3"]}
    by_seq = {row["Seq"]: row for row in eligible}
    matches = []
    for row in audit_rows:
        direct = by_gaia.get(row["GaiaDR3"])
        sequences = [direct["Seq"]] if direct else CNS_IDENTITIES[row["CNS5"]]
        source_direction = SkyCoord(float(row["RAdeg"]) * units.deg, float(row["DEdeg"]) * units.deg)
        offsets = [source_direction.separation(SkyCoord(float(by_seq[seq]["RAdeg"]) * units.deg, float(by_seq[seq]["DEdeg"]) * units.deg)).arcsec for seq in sequences]
        assert max(offsets) < 180, (row["CNS5"], offsets)
        assert all(float(by_seq[seq]["plx"]) >= 150 for seq in sequences)
        matches.append({"cns5": row["CNS5"], "sequences": sequences, "method": "exact Gaia identifier" if direct else "reviewed sky direction and object/component identifiers", "rawEpochSeparationArcsec": offsets, "systemAggregate": len(sequences) > 1})
    temperature_text = (folder / "mamajek.txt").read_text()
    assert "Version 2022.04.16" in temperature_text
    temperatures = {match[1]: int(match[2]) for match in re.finditer(r"^([OBAFGKMLTY][0-9](?:\.[0-9])?V)\s+(\d+)\s", temperature_text, re.MULTILINE)}
    legacy = list(csv.DictReader(io.StringIO((ROOT / "src/data/stars.csv").read_text())))
    assert set(LEGACY_IDS.values()) == {row["id"] for row in legacy if row["id"] != "sun"}
    data = {
        "schemaVersion": 1, "release": "reyle-2023-08-25+cns5-2023-12-13+preserved-neighbors-v1",
        "policyRevision": POLICY_REVISION,
        "retrieved": "2026-09-15", "sources": SOURCES,
        "sourceChecksumsSha256": {name: checksum(folder / name) for name in ("10pc.ReadMe", "tablea1.dat", "cns5.ReadMe", "cns5.dat", "mamajek.txt")},
        "sourceCounts": {"reyle": len(rows), "excludedPlanets": len(rows) - len(eligible), "nonPlanet": len(eligible), "cns5": len(cns)},
        "bufferPolicy": "All non-planet 10pc records and all CNS5 records with nominal source parallax >=150 mas (6.6667 pc), including tentative classifications for audit, not automatic release eligibility. Entire source tables were scanned before freezing this subset.",
        "excludedPlanetSequences": [row["Seq"] for row in rows if row["ObjType"] == "Planet"],
        "excludedTentativeSequences": [row["Seq"] for row in candidates if not release_eligible(row)],
        "preservedTentativeSequences": sorted(LEGACY_TENTATIVE_EXCEPTIONS),
        "legacyRows": legacy, "candidates": candidates, "cns5AuditRows": audit_rows,
        "fullCensusSystemMemberCounts": system_counts,
        "cns5Matches": matches, "temperatureSequenceKelvin": temperatures,
        "decisions": {
            "membership": MEMBERSHIP_POLICY,
            "astrometry": "Adopt curated 10pc astrometry, except preserve all existing neighbor fields; CNS5 is an independent membership/measurement audit, not an automatic replacement.",
            "GJ1005": "CNS5 69 uses Hipparcos 200.53 mas; 10pc 164/165 explicitly marks Hipparcos less accurate and adopts 166.6 +/-0.3 mas from Benedict et al. 2016AJ....152..141B. Retain curated value; outside cutoff.",
            "candidate1001": "Exclude Seq 1001 (Gaia EDR3 6305165514134625024) from release membership: raw BD? is tentative. Retain its unmodified candidate record and CNS5 3707 crossmatch; CNS5 membership does not establish confirmed classification. Gaia identifier is explicit in ObjName despite an empty GaiaEDR3 column.",
            "cutoff138": "GJ 229 A, Seq 138/system 75, has confirmed source ObjType LM and spectrum M1 (2002AJ....123.2002H). Adopt the 10pc Gaia EDR3 solution at J2016.0: RA 92.643579082 deg, Dec -21.867823113 deg, parallax 173.574 +/-0.017 mas, pmRA*cos(dec) -135.691607948 and pmDec -719.178133955 mas/yr (2020yCat.1350....0G), RV 4.734 km/s (2018A&A...616A...7S). CNS5 1528/GJ 229 A matches Gaia 2940856402123426176 exactly, with parallax 173.59297083190438 +/-0.019386925 mas; retain curated 10pc astrometry. CNS5 1529/GJ 229 B instead has parallax 173.6999969482422 +/-0.05 mas (2018A&A...616A...1G), versus dedicated 10pc 173.19 +/-1.12 mas (2012ApJ...752...56F); this alternate solution could move B inside the cutoff. Preserve the source solution, do not infer a new component or silently substitute CNS5 values. Rank 101 Alsafi and rank 102 GJ 229 B have linearized one-sigma distance intervals overlapping rank 100. No statistically secure membership claim.",
            "multiplicity": "No aggregate CNS5 row is added as an individual object. Unconfirmed companions mentioned only in comments are not invented. This release freezes 2023 component knowledge, not later resolved multiplicity.",
            "photometry": "For new objects, Vmag is adopted only for systems with one non-planet census member. All multi-star system V is withheld pending component-resolved passband references. Existing neighbor component magnitudes are preserved.",
            "whiteDwarfMotion": "New white dwarf RV is withheld: a spectroscopic radial velocity is not necessarily a true space-motion RV. Existing Sirius B systemic correction is preserved.",
            "temperature": "Only appropriate exact dwarf subtypes or interpolation between bracketing subtypes use the mean sequence. No estimate for white dwarfs, subdwarfs, peculiar/limited/unknown types or Procyon A (subgiant). No sequence masses, luminosities or V estimates are adopted.",
        },
    }
    assert len(candidates) == 160 and len(audit_rows) == len(matches) == 141
    assert set(data["excludedTentativeSequences"]) == {"146", "161", "198", "199", "1001"}
    write_json(target, data)
    (FROZEN / "source-input.sha256").write_text(checksum(target) + "  source-input.json\n")
    print(json.dumps({"frozenCandidates": len(candidates), "auditedCNS5": len(matches), "sha256": checksum(target)}, indent=2))


def temperature_estimate(row, sequence):
    if row["ObjType"] == "WD" or row["Seq"] == "31":
        return None, "No appropriate object-specific temperature adopted; dwarf sequence not applied."
    match = re.fullmatch(r"([OBAFGKMLTY])([0-9](?:\.[0-9])?)(?:V)?(?:e)?", row["SpType"] or "")
    if not match:
        return None, "Unknown, limited, peculiar, subdwarf or unsupported spectral classification."
    family, subtype = match[1], float(match[2])
    calibration = sorted((float(key[1:-1]), value) for key, value in sequence.items() if key[0] == family)
    for calibrated_subtype, value in calibration:
        if calibrated_subtype == subtype:
            return value, f"Estimated: Pecaut-Mamajek 2022.04.16 {family}{subtype:g}V mean dwarf class, not a measured temperature."
    lower = [(number, value) for number, value in calibration if number < subtype]
    upper = [(number, value) for number, value in calibration if number > subtype]
    if lower and upper:
        lower_type, lower_temp = lower[-1]
        upper_type, upper_temp = upper[0]
        value = round(lower_temp + (upper_temp - lower_temp) * (subtype - lower_type) / (upper_type - lower_type))
        return value, f"Estimated: linear interpolation between Pecaut-Mamajek 2022.04.16 {family}{lower_type:g}V and {family}{upper_type:g}V mean dwarf classes."
    return None, "No bracketing dwarf temperature calibration; no extrapolation."


def field_source(status, source, detail=None):
    value = {"status": status, "sourceRefs": [source] if source else []}
    if detail:
        value["detail"] = detail
    return value


def adopt_object(source, frozen, system_counts):
    identifier = LEGACY_IDS.get(source["Seq"], f"10pc-{int(source['Seq']):04d}")
    if source["Seq"] == "1001":
        identifier = "gaia-dr3-6305165514134625024"
    reference = f"10pc:tablea1:Seq={source['Seq']}"
    legacy = next((row for row in frozen["legacyRows"] if row["id"] == identifier), None)
    fields = {}
    if legacy:
        row = dict(legacy)
        direction = direction_from_row(row)
        mode = "Preserved existing J2000 Galactic Cartesian snapshot; inverse transform for constellation only."
        for key in row:
            fields[key] = field_source("adopted-existing" if row[key] else "unknown", f"legacy-neighbors:{identifier}", row["notes"] if key == "notes" else None)
    else:
        direction, velocity, mode = normalized_position(source)
        row = {key: "" for key in frozen["legacyRows"][0]}
        row.update({"id": identifier, "name": source["Common"] or source["ObjName"], "type": {"*": "star", "LM": "star", "LM?": "star", "BD": "brown_dwarf", "BD?": "brown_dwarf", "WD": "white_dwarf"}[source["ObjType"]], "spectral_type": source["SpType"] or "", "epoch": "2000.0"})
        vector = direction.galactic.cartesian.xyz.to_value(units.pc)
        row.update({key: f"{value:.9f}" for key, value in zip(("x_pc", "y_pc", "z_pc"), vector, strict=True)})
        if velocity:
            row.update({key: f"{value:.6f}" for key, value in zip(("vx_kms", "vy_kms", "vz_kms"), velocity, strict=True)})
        temperature, temperature_note = temperature_estimate(source, frozen["temperatureSequenceKelvin"])
        row["temperature_k"] = str(temperature) if temperature is not None else ""
        if system_counts[source["Sys"]] > 1:
            photometry_note = "Component-resolved Johnson V not independently established; multi-star system V withheld."
        elif source["Vmag"] is None:
            photometry_note = "Johnson V unknown in source; no G/IR substitution."
        else:
            row["absolute_mag"] = f"{float(source['Vmag']) - 5 * math.log10(direction.distance.to_value(units.pc) / 10):.6f}"
            photometry_note = f"Absolute Johnson V derived from 10pc Vmag={source['Vmag']} and adopted distance; negligible extinction assumed. Photometric epoch, uncertainty and individual V bibliography not supplied by compilation."
        row["notes"] = f"10pc census (2023-08-25), object {source['Seq']}, system {source['Sys']}; {source['ObjName']}. J2000 Sun-relative Galactic position via Astropy; {mode}. {temperature_note} {photometry_note} No orbital model."
        if "?" in source["ObjType"]:
            row["notes"] += f" Classification tentative ({source['ObjType']} in source); no subtype inferred."
        if source["Com"] and source["Com"] != "...":
            row["notes"] += " Source caution: " + source["Com"]
        for key in row:
            fields[key] = field_source("unknown" if row[key] == "" else "compiled", reference)
        fields["id"] = field_source("assigned", reference, "Stable component identity; existing shared IDs take precedence.")
        fields["type"] = field_source("tentative" if "?" in source["ObjType"] else "compiled", reference + ":ObjType")
        fields["spectral_type"] = field_source("compiled" if row["spectral_type"] else "unknown", reference + ":SpType", source["r_SpType"])
        for key in ("x_pc", "y_pc", "z_pc"):
            fields[key] = field_source("derived", reference + ":RAdeg,DEdeg,Epoch,plx,pmRA,pmDE,RV", mode)
        for key in ("vx_kms", "vy_kms", "vz_kms"):
            fields[key] = field_source("derived" if velocity else "unknown", reference + ":pmRA,pmDE,RV", "Sun-relative Galactic vector; source spectroscopic RV, not an orbit solution." if velocity else "Incomplete/withheld space-motion inputs; placeholders are not exported.")
        fields["temperature_k"] = field_source("estimated" if temperature is not None else "unknown", "pecaut-mamajek:2022.04.16" if temperature is not None else None, temperature_note)
        fields["absolute_mag"] = field_source("derived" if row["absolute_mag"] else "unknown", reference + ":Vmag", photometry_note)
        for key in ("mass_solar", "luminosity_solar"):
            fields[key] = field_source("unknown", None, "No vetted component measurement adopted; mean-sequence values are not substituted.")
    row["constellation"] = constellation(direction)
    if legacy:
        assert row == legacy
    fields["constellation"] = field_source("derived", "astropy:7.1.1:Roman1987", "ICRS snapshot direction transformed to B1875 boundary coordinates; no physical motion to 1875. Canonical spelling normalization applied.")
    fields["epoch"] = field_source("adopted", None, "Static J2000.0 snapshot; source decimal years treated as Julian years TT.")
    provenance = {
        "id": identifier, "sourceRow": source["Seq"], "systemId": source["Sys"], "sourceObjectName": source["ObjName"], "sourceObjectType": source["ObjType"],
        "identifiers": {key: source[key] for key in ("GaiaEDR3", "GaiaDR2", "SIMBAD", "GJ", "HIP")},
        "sourceMeasurements": {key: source[key] for key in ("RAdeg", "DEdeg", "Epoch", "plx", "e_plx", "r_plx", "pmRA", "e_pmRA", "pmDE", "e_pmDE", "r_pmDE", "RV", "e_RV", "r_RV", "SpType", "r_SpType", "SpMethod", "Vmag", "r_Sys", "Com")},
        "adoptedJ2000": {"frame": "ICRS", "raDeg": float(direction.ra.deg), "decDeg": float(direction.dec.deg), "distancePc": float(direction.distance.to_value(units.pc)), "method": mode},
        "fields": fields, "overrides": ["All existing neighbor fields preserved, including unknowns; new source measurements are audit-only."] if legacy else [],
    }
    if source["Seq"] in LEGACY_TENTATIVE_EXCEPTIONS:
        assert legacy and source["ObjType"] == "LM?" and row["type"] == "star"
        provenance["overrides"].append("Explicit approved membership exception: preserve vetted EZ Aquarii B/C default row despite raw 10pc LM?; source classification unchanged, not newly measured or reclassified.")
    if source["Seq"] == "1001":
        provenance["identifiers"]["GaiaEDR3"] = "6305165514134625024"
        provenance["overrides"].append("Gaia identifier recovered from explicit source ObjName, not from a numeric conversion or positional guess.")
    return row, provenance


def release_eligible(source):
    preserved_member = source["ObjType"] == "LM?" and source.get("Seq") in LEGACY_TENTATIVE_EXCEPTIONS
    return source["ObjType"] != "Planet" and (not source["ObjType"].endswith("?") or preserved_member)


def build_catalog(output, force=False, check=False):
    input_path = FROZEN / "source-input.json"
    assert checksum(input_path) == (FROZEN / "source-input.sha256").read_text().split()[0]
    frozen = json.loads(input_path.read_text())
    assert astropy.__version__ == "7.1.1", "Use the pinned authoring environment."
    assert frozen["policyRevision"] == POLICY_REVISION and frozen["decisions"]["membership"] == MEMBERSHIP_POLICY
    assert frozen["legacyRows"] == list(csv.DictReader(io.StringIO((ROOT / "src/data/stars.csv").read_text())))
    system_counts = frozen["fullCensusSystemMemberCounts"]
    source_by_seq = {source["Seq"]: source for source in frozen["candidates"]}
    adopted = [adopt_object(source, frozen, system_counts) for source in frozen["candidates"]]
    adopted.sort(key=lambda item: (item[1]["adoptedJ2000"]["distancePc"], item[0]["id"]))
    eligible = [item for item in adopted if release_eligible(source_by_seq[item[1]["sourceRow"]])]
    excluded = [item for item in adopted if not release_eligible(source_by_seq[item[1]["sourceRow"]])]
    assert len(adopted) == 160 and len(eligible) == 155 and len(excluded) == 5
    assert {item["sourceRow"] for _, item in excluded} == set(frozen["excludedTentativeSequences"])
    assert set(frozen["preservedTentativeSequences"]) == LEGACY_TENTATIVE_EXCEPTIONS
    selected = eligible[:100]
    assert selected[-1][0]["id"] == "10pc-0138"
    assert len({row["id"] for row, _ in selected}) == len({row["name"] for row, _ in selected}) == 100
    assert set(LEGACY_IDS.values()).issubset({row["id"] for row, _ in selected})
    boundary_fixtures = [
        {"raDeg": 2.061231111601851, "decDeg": 88.68996629384206, "expected": "Cepheus"},
        {"raDeg": 2.06142651798794, "decDeg": 88.69052182614006, "expected": "Ursa Minor"},
    ]
    for fixture in boundary_fixtures:
        assert constellation(SkyCoord(fixture["raDeg"] * units.deg, fixture["decDeg"] * units.deg)) == fixture["expected"]
    for row, provenance in selected:
        direction = SkyCoord(provenance["adoptedJ2000"]["raDeg"] * units.deg, provenance["adoptedJ2000"]["decDeg"] * units.deg)
        assert constellation(direction) == row["constellation"]
        assert constellation(direction_from_row(row)) == row["constellation"]
        for bearing in range(0, 360, 45):
            assert constellation(direction.directional_offset_by(bearing * units.deg, 1 * units.arcsec)) == row["constellation"]
    sun = next(row for row in frozen["legacyRows"] if row["id"] == "sun")
    rows = [sun] + [row for row, _ in selected]
    headers = list(sun)
    assert len(headers) == 17 and headers[-1] == "constellation"
    cutoff_policy = MEMBERSHIP_POLICY + " Rank eligible individual non-Sun objects by unrounded adopted J2000 distance, then ASCII stable ID for exact ties; retain exactly 100 plus Sun. Rank 100 is GJ 229 A; nearby one-sigma distance intervals overlap, so membership is not statistically secure. Frozen 2023 source releases with preserved neighbor overrides; no 2026 completeness claim."
    manifest = {"schemaVersion": 1, "id": "nearest-100", "label": "Nearest 100 objects", "description": "100 individual stellar/substellar objects from the frozen 2023 10pc census, audited against corrected CNS5, plus Sun. Tentative candidates excluded except explicitly preserved EZ Aquarii B/C default membership; photometry and physical properties are incomplete.", "epoch": 2000, "objectCount": 101, "sources": SOURCES, "cutoffPolicy": cutoff_policy, "snapshot": "J2000.0; 10pc 2023-08-25 / CNS5 corrected 2023-12-13; preserved neighbor measurements; frozen 2026-09-15; " + POLICY_REVISION}
    coverage = {field: sum(row[field] != "" for row in rows) for field in ("constellation", "spectral_type", "temperature_k", "mass_solar", "luminosity_solar", "absolute_mag")}
    coverage["fullVelocity"] = sum(all(row[key] != "" for key in ("vx_kms", "vy_kms", "vz_kms")) for row in rows)
    coverage["typesIncludingSun"] = {kind: sum(row["type"] == kind for row in rows) for kind in ("star", "white_dwarf", "brown_dwarf", "sub_brown_dwarf")}
    cutoff_distance = selected[-1][1]["adoptedJ2000"]["distancePc"]
    cutoff_measurement = selected[-1][1]["sourceMeasurements"]
    cutoff_sigma = 1000 * float(cutoff_measurement["e_plx"]) / float(cutoff_measurement["plx"]) ** 2
    rankings = []
    eligible_ranks = {row["id"]: rank for rank, (row, _) in enumerate(eligible, 1)}
    for buffer_rank, (row, provenance) in enumerate(adopted, 1):
        measurement = provenance["sourceMeasurements"]
        parallax = float(measurement["plx"])
        error = float(measurement["e_plx"]) if measurement["e_plx"] else None
        distance = provenance["adoptedJ2000"]["distancePc"]
        sigma = 1000 * error / parallax ** 2 if error is not None else None
        rank = eligible_ranks.get(row["id"])
        rankings.append({"bufferRank": buffer_rank, "rank": rank, "id": row["id"], "name": row["name"], "sourceRow": provenance["sourceRow"], "sourceObjectType": provenance["sourceObjectType"], "eligible": rank is not None, "exclusionReason": "Tentative source ObjType ending '?'; no approved preserved-default membership exception." if rank is None else None, "preservedDefaultException": provenance["sourceRow"] in LEGACY_TENTATIVE_EXCEPTIONS, "distancePc": distance, "sourceParallaxMas": parallax, "sourceParallaxErrorMas": error, "distanceSigmaPcLinearized": sigma, "selected": rank is not None and rank <= 100, "oneSigmaOverlapsCutoff": sigma is not None and abs(distance - cutoff_distance) <= sigma, "oneSigmaIntervalsOverlap": sigma is not None and abs(distance - cutoff_distance) <= sigma + cutoff_sigma})
    positions = {}
    for row in rows:
        key = tuple(row[field] for field in ("x_pc", "y_pc", "z_pc"))
        positions.setdefault(key, []).append(row["id"])
    provenance = {
        "schemaVersion": 1, "catalogId": "nearest-100", "sourceRelease": frozen["release"], "policyRevision": frozen["policyRevision"], "inputSha256": checksum(input_path),
        "sources": SOURCES, "sourceChecksumsSha256": frozen["sourceChecksumsSha256"],
        "tools": {"astropy": astropy.__version__, "boundary": "Roman 1987, VI/42 via Astropy", "constellationSpellingCorrections": NAME_CORRECTIONS},
        "conventions": {"position": "Sun-relative Galactic x toward Galactic center, y toward Galactic longitude 90 deg, z toward north Galactic pole; pc", "epoch": "J2000.0 Julian years TT; linear Astropy apply_space_motion, no binary orbit model. Source epoch precision is retained as published, including 0.1-year rounding.", "velocity": "Sun-relative Galactic km/s; no solar Galactic offset. Missing/withheld RV is used only as a transverse-only propagation approximation, never exported as measured velocity.", "constellation": "Earth-view IAU region from high-precision adopted snapshot direction before Cartesian rounding. Existing vectors are preserved and inverted. Sun has no fixed region. No physical propagation to B1875.", "photometry": "Johnson V only, MV=V-5log10(d/10), local extinction neglected; no G/IR/bolometric substitutions. No time-variable photometry or unresolved flux aggregation.", "uncertainty": "Raw source measurement errors retained. Rank uses nominal adopted distance; linearized parallax-only distance sigma is an audit, not a covariance-aware posterior or a guarantee of order. Existing row source errors are audit-only when astrometry is overridden."},
        "decisions": frozen["decisions"], "coverage": coverage,
        "audit": {"sourceCounts": frozen["sourceCounts"], "bufferPolicy": frozen["bufferPolicy"], "candidateCount": len(adopted), "eligibleCandidateCount": len(eligible), "excludedTentativeSequences": frozen["excludedTentativeSequences"], "excludedPlanetSequences": frozen["excludedPlanetSequences"], "preservedTentativeSequences": frozen["preservedTentativeSequences"], "rankingPolicy": "bufferRank covers all 160 frozen candidates; rank covers only the 155 eligible objects and is null for explicit exclusions. Uncertainty flags on excluded rows are diagnostic only, not eligibility.", "cns5RowsChecked": len(frozen["cns5Matches"]), "unmatchedCNS5Rows": 0, "rankings": rankings, "cns5Matches": frozen["cns5Matches"], "coincidentGroups": [members for members in positions.values() if len(members) > 1], "constellationBoundaryProbeArcsec": 1, "boundaryFixtures": boundary_fixtures, "boundaryFixtureMethod": "Synthetic B1875 directions RA=0h, Dec=88deg +/-1arcsec transformed to ICRS with Astropy PrecessedGeocentric; no physical proper motion.", "cutoffTie": [row["id"] for row, item in eligible if item["adoptedJ2000"]["distancePc"] == cutoff_distance], "splitCutoffTie": any(item["adoptedJ2000"]["distancePc"] == cutoff_distance for _, item in eligible[100:])},
        "objects": [{"id": "sun", "fields": {key: field_source("not-applicable" if key == "constellation" else "adopted", "NASA:sunfact:2024-05-09" if key == "absolute_mag" else "legacy-neighbors:sun") for key in sun}}] + [item for _, item in selected],
    }
    csv_text = io.StringIO(newline="")
    writer = csv.DictWriter(csv_text, fieldnames=headers, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    files = {"stars.csv": csv_text.getvalue(), "catalog.json": json.dumps(manifest, indent=2, ensure_ascii=True, allow_nan=False) + "\n", "provenance.json": json.dumps(provenance, indent=2, ensure_ascii=True, allow_nan=False) + "\n"}
    if check:
        for filename, text in files.items():
            assert (output / filename).read_text() == text, f"Reproduction mismatch: {filename}"
    else:
        if not force and any((output / filename).exists() for filename in files):
            raise FileExistsError("Catalog exists; use --force for an intentional rebuild, or --check to verify.")
        output.mkdir(parents=True, exist_ok=True)
        for filename, text in files.items():
            (output / filename).write_text(text)
    print(json.dumps({"objects": len(rows), "coverage": coverage, "eligibleCandidates": len(eligible), "excludedTentativeSequences": frozen["excludedTentativeSequences"], "preservedTentativeSequences": frozen["preservedTentativeSequences"], "cutoff": next(item for item in rankings if item["rank"] == 100), "next": next(item for item in rankings if item["rank"] == 101), "reproduced": check}, indent=2))


def constellation(direction):
    name = str(get_constellation(direction, short_name=False, constellation_list="iau")).strip()
    return NAME_CORRECTIONS.get(name, name)


def direction_from_row(row):
    vector = [float(row[field]) for field in ("x_pc", "y_pc", "z_pc")]
    return SkyCoord(CartesianRepresentation(vector * units.pc), frame="galactic").icrs


def default_catalog(write=False):
    path = ROOT / "src/data/stars.csv"
    text = path.read_text()
    rows = list(csv.DictReader(io.StringIO(text)))
    assert len(rows) == 22
    assignments = {}
    for row in rows:
        if row["id"] == "sun":
            assignments[row["id"]] = ""
            assert float(row["absolute_mag"]) == 4.83
            continue
        direction = direction_from_row(row)
        assigned = constellation(direction)
        for bearing in range(0, 360, 45):
            assert constellation(direction.directional_offset_by(bearing * units.deg, 1 * units.arcsec)) == assigned
        assignments[row["id"]] = assigned
    assert assignments["sirius-a"] == assignments["sirius-b"] == "Canis Major"
    assert assignments["proxima-centauri"] == "Centaurus"
    assert assignments["barnards-star"] == "Ophiuchus"
    lines = text.splitlines()
    if "constellation" not in rows[0]:
        assert len(lines) == len(rows) + 1
        generated = lines[0] + ",constellation\n"
        generated += "\n".join(line + "," + assignments[row["id"]] for line, row in zip(lines[1:], rows, strict=True)) + "\n"
        result = list(csv.DictReader(io.StringIO(generated)))
        assert all(all(output[key] == value for key, value in original.items()) for original, output in zip(rows, result, strict=True))
        if write:
            path.write_text(generated)
    else:
        assert all(row["constellation"] == assignments[row["id"]] for row in rows)
    print(json.dumps({"defaultRows": len(rows), "constellations": assignments, "boundaryProbeArcsec": 1}, indent=2))


def read_cds(folder, filename, readme):
    table = ascii.read(str(folder / filename), readme=str(folder / readme), format="cds")
    return [{key: (None if bool(getattr(row[key], "mask", False)) else str(row[key])) for key in table.colnames} for row in table]


def inspect_sources(folder):
    rows = read_cds(folder, "tablea1.dat", "10pc.ReadMe")
    eligible = [row for row in rows if row["ObjType"] != "Planet"]
    eligible.sort(key=lambda row: (-float(row["plx"]), row["Seq"]))
    print("Source records:", len(rows), "non-planets:", len(eligible))
    for rank, row in enumerate(eligible[:150], 1):
        print(rank, json.dumps({key: row[key] for key in ("Seq", "Sys", "ObjType", "ObjName", "Common", "plx", "e_plx", "SpType", "Epoch", "Vmag", "RV", "SIMBAD", "GJ", "Com")}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    default = commands.add_parser("default")
    default.add_argument("--write", action="store_true")
    inspect = commands.add_parser("inspect")
    inspect.add_argument("folder", type=Path)
    freeze = commands.add_parser("freeze")
    freeze.add_argument("folder", type=Path)
    freeze.add_argument("--force", action="store_true")
    build = commands.add_parser("build")
    build.add_argument("--output", type=Path, default=ROOT / "src/data/catalogs/nearest-100")
    build.add_argument("--force", action="store_true")
    build.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.command == "default":
        default_catalog(args.write)
    elif args.command == "inspect":
        inspect_sources(args.folder)
    elif args.command == "freeze":
        freeze_sources(args.folder, args.force)
    elif args.command == "build":
        build_catalog(args.output, args.force, args.check)


if __name__ == "__main__":
    main()