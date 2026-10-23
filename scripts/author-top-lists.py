"""Build the Discover top lists from frozen literature rankings.

Rankings and values follow the cited Wikipedia revisions. Positions and
identifiers come from a frozen SIMBAD response; the IAU constellation is derived
from those positions once with astropy (Roman 1987 boundaries). Catalog
presence is detected by exact identifier overlap with the generated catalogs.

  --refresh  re-query SIMBAD and refreeze catalog-work/top-lists/simbad.json (needs network and astropy)
  --check    compare the checked-in output without writing it
"""

import argparse
import json
import sys
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/data/top-lists.json"
FROZEN = ROOT / "catalog-work/top-lists/simbad.json"
CATALOGS = ROOT / "src/data/generated/catalogs"
# Earlier catalogs win, so links prefer the landmark records.
CATALOG_ORDER = ["western-constellation-stars", "nearest-1000", "nearest-100"]
LY_PER_PC = 3.261563777

LARGEST = "https://en.wikipedia.org/w/index.php?oldid=1381460615"
HOTTEST = "https://en.wikipedia.org/w/index.php?oldid=1372500185"
SUPERNOVA = "https://en.wikipedia.org/w/index.php?oldid=1380408343"
GAIA = "Gaia EDR3 geometric distance (Bailer-Jones et al. 2021)"
RSGC1 = "RSGC1 cluster distance (Davies et al. 2008)"
STEPHENSON2 = "Stephenson 2 cluster distance (Davies et al. 2007)"
WESTERLUND1 = "Westerlund 1 cluster distance (Rate & Crowther 2020)"

# name, SIMBAD identifier, value, distance (pc), distance source.
# Radius ranges are listed by their lower value, as the source table sorts them.
LARGEST_STARS = [
    ("Stephenson 2 DFK 1", "Cl* Stephenson 2 DFK 1", 1840, 5830, STEPHENSON2),
    ("NML Cygni", "NML Cyg", 1590, 1610, "Wikipedia: NML Cygni"),
    ("V538 Carinae", "V538 Car", 1503, 4585, GAIA),
    ("RSGC1-F01", "[FMR2006] 1", 1470, 6600, RSGC1),
    ("VX Sagittarii", "VX Sgr", 1456, 1564, "Wikipedia: VX Sagittarii (maser parallax)"),
    ("Stephenson 2 DFK 2", "Cl* Stephenson 2 DFK 2", 1420, 5830, STEPHENSON2),
    ("VY Canis Majoris", "VY CMa", 1420, 1170, "Wikipedia: VY Canis Majoris"),
    ("AH Scorpii", "AH Sco", 1411, 2260, "Wikipedia: AH Scorpii"),
    ("CD−34°11794", "CD-34 11794", 1409, 4084, GAIA),
    ("RSGC1-F06", "[FMR2006] 6", 1380, 6600, RSGC1),
    ("S Persei", "S Per", 1364, 2420, "H₂O maser parallax (Asaki et al. 2010)"),
    ("HR 5171", "HR 5171", 1315, 2953, "Wikipedia: HR 5171"),
    ("RSGC1-F02", "[FMR2006] 2", 1290, 6600, RSGC1),
    ("HD 143183", "HD 143183", 1261, 2100, "Wikipedia: HD 143183"),
    ("PZ Cassiopeiae", "PZ Cas", 1260, 2810, "Wikipedia: PZ Cassiopeiae"),
    ("RSGC1-F10", "[FMR2006] 10", 1250, 6600, RSGC1),
    ("V354 Cephei", "V354 Cep", 1245, 3900, "Wikipedia: V354 Cephei"),
    ("Westerlund 1 W237", "Cl* Westerlund 1 W 237", 1241, 3780, WESTERLUND1),
    ("ST Cephei", "ST Cep", 1218, 830, "Wikipedia: ST Cephei (Cepheus OB2)"),
    ("IRC −30312", "IRC -30312", 1204, 3026, GAIA),
    ("IRC −10414", "IRC -10414", 1200, 2000, "Wikipedia: IRC −10414"),
    ("V517 Monocerotis", "V517 Mon", 1196, 5254, GAIA),
    ("RSGC1-F05", "[FMR2006] 5", 1190, 6600, RSGC1),
    ("GCIRS 7", "GCIRS 7", 1170, 8178, "Galactic Center distance (GRAVITY Collaboration 2019)"),
    ("Westerlund 1 W26", "Cl* Westerlund 1 W 26", 1165, 3780, WESTERLUND1),
    ("[A72c] 16", "[A72c] 16", 1157, 6049, GAIA),
    ("WY Velorum A", "WY Vel", 1157, 1900, "Wikipedia: WY Velorum"),
    ("RSGC1-F08", "[FMR2006] 8", 1150, 6600, RSGC1),
    ("IRC −30303", "IRC -30303", 1147, 4208, GAIA),
    ("RSGC1-F03", "[FMR2006] 3", 1140, 6600, RSGC1),
]

# Ranked values follow the cited list even where Star View adopts a different reviewed value.
# Supernova candidate notes give the expected time of the explosion where the source states one.
NOTES = {"Gamma Velorum (WR)": "Star View’s reviewed source gives the WR star T* = 57,100 K (Schmutz et al. 2026), an inner-boundary wind temperature.",
         "Wolf 1130": "Supernova expected in over 6.2 billion years (Mace et al. 2018).",
         "49 Librae": "Supernova expected in over 500 million years, after the binary pair merges (Fuhrmann & Chini 2017).",
         "NLTT 12758": "Supernova expected in about 140 billion years (Kawka et al. 2016).",
         "IK Pegasi": "Supernova expected in about 1.9 billion years (Beech 2011).",
         "WD J181058.67+311940.94": "Supernova expected in about 23 billion years (Munday et al. 2025).",
         "Sigma Sagittarii (Nunki)": "Supernova expected in over 20 million years, after the binary pair merges (Waisberg et al. 2025).",
         "HD 49798": "Supernova expected in a few tens of thousands of years (Wang & Han 2012; Liu et al. 2015)."}

# name, SIMBAD identifier, temperature (K), distance (ly) from the source table.
# Milky Way entries only; the table lists 29 above its 60,000 K threshold.
HOTTEST_STARS = [
    ("WR 102", "WR 102", 200000, 8610), ("WR 142", "WR 142", 200000, 5400),
    ("WR 93b", "WR 93b", 160000, 7470), ("WR 2", "WR 2", 141000, 7830),
    ("WR 9", "WR 9", 139700, 14900), ("WR 30a", "WR 30a", 129500, 25340),
    ("WR 38", "WR 38", 126000, 19700), ("WR 142a", "WR 142a", 125000, 5900),
    ("WR 1", "WR 1", 112000, 10300), ("WR 18", "WR 18", 112000, 12500),
    ("WR 46", "WR 46", 112000, 13000), ("WR 7", "WR 7", 112000, 14000),
    ("WR 144", "WR 144", 112000, 5710), ("WR 52", "WR 52", 112000, 5710),
    ("WR 37", "WR 37", 100000, 21900), ("Gamma Velorum (WR)", "gam02 Vel", 90000, 1100),
    ("EZ Canis Majoris", "EZ CMa", 89100, 5900), ("WR 36", "WR 36", 89100, 17700),
    ("WR 111", "WR 111", 89100, 5320), ("WR 150", "WR 150", 89100, 28500),
    ("WR 19 A", "WR 19", 79400, 14000), ("WR 44", "WR 44", 79400, 19800),
    ("WR 58", "WR 58", 79400, 19700), ("WR 45", "WR 45", 79400, 13900),
    ("WR 136", "WR 136", 70800, 6290), ("WR 75", "WR 75", 63100, 10800),
    ("WR 134", "WR 134", 63100, 6000), ("WR 60", "WR 60", 63100, 11500),
    ("WR 149", "WR 149", 63100, 15900),
]

# name, SIMBAD identifier, distance (ly), spectral class, evolutionary stage, possible supernova type.
# Text follows the source table with links removed and capitalization made consistent.
SUPERNOVA_CANDIDATES = [
    ("Wolf 1130", "Wolf 1130", 54.09, "M3 + D", "Subdwarf + white dwarf", "Ia"),
    ("49 Librae", "49 Lib", 95.3, "F8V + D", "Main sequence + white dwarf", "Ia"),
    ("NLTT 12758", "NLTT 12758", 114.5, "D + D", "White dwarf + white dwarf", "Ia"),
    ("IK Pegasi", "IK Peg", 154, "A8m: or kA6hA9mF0 + DA", "Main sequence + white dwarf", "Ia"),
    ("WD J181058.67+311940.94", "Gaia DR3 4591184666354179584", 160, "D + D", "White dwarf + white dwarf", "Ia"),
    ("Sigma Sagittarii (Nunki)", "sig Sgr", 224.7, "B2.5 V", "Main sequence", "II"),
    ("Bellatrix", "gam Ori", 250, "B2 III or B2V", "Blue giant", "II"),
    ("Spica", "alf Vir", 250, "B1III-IV", "Subgiant", "II"),
    ("Mimosa", "bet Cru", 280, "B0.5 III", "Blue giant", "II"),
    ("Eta Centauri", "eta Cen", 306, "B1.5 Vne", "Main sequence", "II"),
    ("Acrux Aa", "alf Cru", 348, "B0.5 IV", "Main sequence", "II"),
    ("Acrux B", "alf02 Cru", 348, "B1 V", "Main sequence", "II"),
    ("Beta Centauri Aa (Hadar)", "bet Cen", 361, "B1 III", "Blue giant", "II"),
    ("Beta Centauri Ab (Hadar)", "bet Cen", 361, "B1 III", "Blue giant", "II"),
    ("Epsilon Canis Majoris (Adhara)", "eps CMa", 405, "B2 II or B2 III-II", "Bright giant or subgiant", "II"),
    ("Betelgeuse", "alf Ori", 548, "M1–M2 Ia–ab", "Red supergiant", "II-P"),
    ("Zeta Ophiuchi", "zet Oph", 440, "O9.5V", "Main sequence", "II"),
    ("Beta Scorpii Aa (Acrab)", "bet01 Sco", 400, "B0.5IV-V", "Main sequence", "II"),
    ("Alpha Lupi (Uridim)", "alf Lup", 460, "B1.5 III", "Blue giant", "II"),
    ("Kappa Scorpii", "kap Sco", 480, "B1.5 III", "Blue giant", "II"),
    ("Delta Scorpii A (Dschubba)", "del Sco", 490, "B0.3 IV", "Main sequence", "II"),
    ("Beta Canis Majoris (Mirzam)", "bet CMa", 490, "B1 II-III", "Blue giant", "II"),
    ("Antares", "alf Sco", 550, "M1.5Iab-b", "Red supergiant", "II-P"),
    ("Gamma Cassiopeiae (Tiansi)", "gam Cas", 550, "B0.5IVe", "Main sequence", "II"),
    ("Lambda Scorpii (Shaula)", "lam Sco", 570, "B1.5IV", "Main sequence", "II"),
    ("Saiph", "kap Ori", 650, "B0.5 Ia", "Blue supergiant", "II"),
    ("Epsilon Pegasi (Enif)", "eps Peg", 690, "K2 Ib–II", "Red supergiant", "II"),
    ("Pi Puppis (Ahadi)", "pi. Pup", 807, "K3 Ib", "Red supergiant", "II?"),
    ("Rigel", "bet Ori", 848, "B8 Ia", "Blue supergiant", "IIn(pec?)"),
    ("S Monocerotis A", "S Mon", 920, "O7V", "Main sequence", "II"),
    ("S Monocerotis B", "S Mon", 920, "O9.5V", "Main sequence", "II"),
    ("Zeta Puppis (Naos)", "zet Pup", 1080, "O4If(n)p", "Blue supergiant", "II"),
    ("Gamma² Velorum A", "gam02 Vel", 1120, "WC8", "Wolf–Rayet star", "Ib/Ic"),
    ("Gamma² Velorum B", "gam02 Vel", 1120, "O7.5III", "Blue supergiant", "II"),
    ("Mintaka Aa1", "del Ori", 1200, "O9.5II", "Blue supergiant", "II"),
    ("Alnilam", "eps Ori", 1250, "B0 Ia", "Blue supergiant", "II"),
    ("Alnitak Aa", "zet Ori", 1260, "O9.5Iab", "Blue supergiant", ""),
    ("Delta Canis Majoris (Wezen)", "del CMa", 1600, "F8 Ia", "Yellow supergiant", "II"),
    ("HD 49798", "HD 49798", 1699, "sdO5.5/D", "White dwarf", "Ia"),
    ("119 Tauri", "119 Tau", 1790, "M2Iab-Ib", "Red supergiant", "IIb"),
    ("Gamma Cygni (Sadr)", "gam Cyg", 1800, "F8 Iab", "Yellow supergiant", "II"),
    # The source table prints A2la, a typo for luminosity class Ia.
    ("Deneb", "alf Cyg", 2615, "A2Ia", "Blue supergiant", "IIL"),
    ("KPD 1930+2752", "KPD 1930+2752", 2860, "sdB/D", "White dwarf", "Ia"),
    ("Mu Cephei (Garnet Star)", "mu. Cep", 3060, "M2Ia", "Red hypergiant", "IIn/IIb"),
    ("Rho Cassiopeiae", "rho Cas", 3440, "G2Ia0e", "Yellow hypergiant", "IIL"),
    ("VY Canis Majoris", "VY CMa", 3930, "M5eIa", "Red hypergiant", "II"),
    ("IRAS 17163-3907", "IRAS 17163-3907", 3930, "late B/early A", "Yellow hypergiant", "II"),
    ("Wray 17-96", "Wray 17-96", 3940, "B3", "Luminous blue variable", ""),
    ("VV Cephei A", "VV Cep", 4900, "M2Iab", "Red hypergiant", ""),
    ("Stephenson 2 DFK 52", "Cl* Stephenson 2 DFK 52", 4900, "M0I", "Red supergiant", "II-P"),
    ("Mu Sagittarii Aa (Polis)", "mu. Sgr", 5100, "B8Iap", "Blue supergiant", ""),
    ("P Cygni", "P Cyg", 5250, "B1Ia+", "Luminous blue variable", "IIb"),
    ("HD 168625", "HD 168625", 5250, "B6Ia", "Luminous blue variable", "II"),
    ("NML Cygni", "NML Cyg", 5250, "M6I", "Red hypergiant", "II"),
    ("IRC +10420", "IRC +10420", 5600, "F8Ia+", "Yellow hypergiant", "IIb"),
    ("WR 142", "WR 142", 5670, "WO2", "Wolf–Rayet star", "Ib/Ic"),
    ("RY Scuti", "RY Sct", 5870, "O9.7 Ibpe", "Blue supergiant", "IIb or Ib/c"),
    ("WR 136", "WR 136", 6700, "WN6(h)-s", "Wolf–Rayet star", "Ic"),
    ("RS Ophiuchi", "RS Oph", 7380, "M2III/D", "White dwarf", "Ia"),
    ("IRAS 00500+6713", "IRAS 00500+6713", 8000, "WD", "White dwarf", "Ia"),
    ("Eta Carinae", "eta Car", 8630, "LBV/O", "Luminous blue variable", "Ib"),
    ("WR 93b", "WR 93b", 8700, "WO3", "Wolf–Rayet star", "Ib/Ic"),
    ("WR 102", "WR 102", 9410, "WO2", "Wolf–Rayet star", "Ib/Ic"),
    ("HD 179821", "HD 179821", 10500, "G5Ia", "Yellow hypergiant", "IIL"),
    ("T Pyxidis", "T Pyx", 10700, "", "White dwarf", "Ia"),
    ("WR 104", "WR 104", 13400, "WC9d/OB", "Wolf–Rayet star", "Ib/Ic with GRB?"),
    ("AG Carinae", "AG Car", 17000, "LBV", "Luminous blue variable", "IIb"),
    ("WR 30a", "WR 30a", 38900, "WO4/O5((f))", "Wolf–Rayet star", ""),
    ("Sher 25", "Cl* NGC 3603 Sher 25", 43500, "B1.5Iab", "Blue supergiant", ""),
    ("LMC195-1", "[MNM2014] LMC195-1", 160000, "WO2", "Wolf–Rayet star", "Ib/Ic"),
    ("S Doradus", "S Dor", 169000, "LBV", "Luminous blue variable", ""),
    ("SMC AB8", "SMC AB 8", 200000, "WO4/O4", "Wolf–Rayet star", "Ib/Ic"),
    ("DR1", "[AM85] IC 1613 6", 2350000, "WO3", "Wolf–Rayet star", "Ib/Ic with GRB?"),
]
# The source lists Betelgeuse at 408–548 ly; the upper estimate carries its uncertainty.
SUPERNOVA_DISTANCE_SOURCES = {"Betelgeuse": "Source range 408–548 ly"}
# Components that SIMBAD resolves only as their system; the source's γ² Vel B is the O-type companion.
COMPONENTS = {
    "Acrux B": ("western-constellation-stars", "msc-12266-6306-b"),
    "Beta Centauri Ab (Hadar)": ("western-constellation-stars", "msc-14038-6022-ab"),
    "Gamma² Velorum B": ("western-constellation-stars", "msc-08095-4720-ab"),
}


def key(value):
    return "".join(value.split()).casefold()


def refresh(identifiers):
    from astropy.coordinates import SkyCoord, get_constellation
    import astropy.units as u
    script = 'output console=off script=off\nformat object "%IDLIST(1)|%COO(d;A D;ICRS)|%IDLIST[%*,]"\n'
    script += "\n".join(f"query id {identifier}" for identifier in identifiers)
    body = urllib.parse.urlencode({"script": script}).encode()
    text = urllib.request.urlopen("https://simbad.cds.unistra.fr/simbad/sim-script", body, timeout=120).read().decode()
    # Unresolved identifiers are reported as errors and omitted from the data rows.
    rows = [line for line in text.split("::data::")[-1].splitlines() if "|" in line]
    if len(rows) != len(identifiers):
        raise SystemExit(f"SIMBAD resolved {len(rows)} of {len(identifiers)} identifiers:\n{text}")
    frozen = {}
    for identifier, row in zip(identifiers, rows):
        main_id, position, ids = row.split("|", 2)
        ra, dec = map(float, position.split())
        constellation = get_constellation(SkyCoord(ra * u.deg, dec * u.deg, frame="icrs"))
        # The app names constellations without diacritics (Bootes).
        constellation = unicodedata.normalize("NFD", constellation).encode("ascii", "ignore").decode().strip()
        # astropy 8 spells Ophiuchus as Ophiucus.
        constellation = constellation.replace("Ophiucus", "Ophiuchus")
        frozen[identifier] = {"main_id": " ".join(main_id.split()), "ra_deg": ra, "dec_deg": dec,
                              "constellation": constellation, "ids": [" ".join(i.split()) for i in ids.split(",") if i.strip()]}
    FROZEN.parent.mkdir(parents=True, exist_ok=True)
    FROZEN.write_text(json.dumps({"source": "SIMBAD sim-script", "objects": frozen}, indent=1, ensure_ascii=False) + "\n")


def catalog_index():
    index, records = {}, {}
    for catalog in reversed(CATALOG_ORDER):
        for star in json.loads((CATALOGS / f"{catalog}.json").read_text())["stars"]:
            hip = next((d for d in star.get("designations") or [] if key(d).startswith("hip")), None)
            record = {"catalog": catalog, "id": star["id"], "designation": hip and " ".join(hip.split())}
            records[catalog, star["id"]] = record
            for designation in [star["name"], *(star.get("designations") or [])]:
                index[key(designation)] = record
    return index, records


def entry(index, frozen, name, identifier, value, distance_pc, distance_source=None):
    simbad = frozen[identifier]
    match = next((index[key(i)] for i in simbad["ids"] if key(i) in index), None)
    # Values below 100 pc keep a decimal so nearby candidates show three significant figures.
    return {"name": name, **({"value": value} if value is not None else {}),
            "distance_pc": round(distance_pc) if distance_pc >= 100 else round(distance_pc, 1),
            **({"distance_source": distance_source} if distance_source else {}),
            **({"note": NOTES[name]} if name in NOTES else {}),
            "constellation": simbad["constellation"].strip(), "object": match}


def candidate(index, records, frozen, name, identifier, ly, spectral_class, stage, supernova_type):
    row = entry(index, frozen, name, identifier, None, ly / LY_PER_PC, SUPERNOVA_DISTANCE_SOURCES.get(name))
    if name in COMPONENTS:
        row["object"] = records[COMPONENTS[name]]
    row["fields"] = [spectral_class, stage, supernova_type]
    return row


def build():
    frozen = json.loads(FROZEN.read_text())["objects"]
    index, records = catalog_index()
    return {"schemaVersion": 1, "lists": [
        {"id": "largest", "title": "Largest stars", "metric": "Radius", "unit": "R☉", "markers": "solar-orbits",
         "source": {"label": "Wikipedia · List of largest stars (Milky Way)", "url": LARGEST},
         "entries": [entry(index, frozen, *row) for row in LARGEST_STARS]},
        {"id": "hottest", "title": "Hottest stars", "metric": "Temperature", "unit": "K",
         "source": {"label": "Wikipedia · List of hottest stars (Milky Way)", "url": HOTTEST},
         "entries": [entry(index, frozen, name, identifier, value, ly / LY_PER_PC)
                     for name, identifier, value, ly in HOTTEST_STARS]},
        {"id": "supernova", "title": "Supernova candidates", "columns": ["Spectral class", "Evolutionary stage", "Supernova type"],
         "source": {"label": "Wikipedia · List of supernova candidates", "url": SUPERNOVA},
         # Ordered by distance, nearest first.
         "entries": sorted((candidate(index, records, frozen, *row) for row in SUPERNOVA_CANDIDATES),
                           key=lambda row: row["distance_pc"])},
    ]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.refresh:
        refresh(list(dict.fromkeys(row[1] for row in [*LARGEST_STARS, *HOTTEST_STARS, *SUPERNOVA_CANDIDATES])))
    text = json.dumps(build(), indent=1, ensure_ascii=False) + "\n"
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != text:
            sys.exit(f"{OUTPUT.relative_to(ROOT)} is stale; run scripts/author-top-lists.py")
        return
    OUTPUT.write_text(text)


if __name__ == "__main__":
    main()
