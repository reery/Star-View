"""Build the Discover top lists from frozen literature rankings and from Star View's own catalogs.

Literature rankings and values follow the cited Wikipedia revisions. Positions and
identifiers come from a frozen SIMBAD response; the IAU constellation is derived
from those positions once with astropy (Roman 1987 boundaries). Catalog
presence is detected by exact identifier overlap with the generated catalogs.
Computed lists rank the generated catalog records and the compact-object overlay.

  --refresh  re-query SIMBAD and refreeze catalog-work/top-lists/simbad.json (needs network and astropy)
  --check    compare the checked-in output without writing it
"""

import argparse
import csv
import json
import math
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/data/top-lists.json"
FROZEN = ROOT / "catalog-work/top-lists/simbad.json"
CATALOGS = ROOT / "src/data/generated/catalog-records"
# Earlier catalogs win, so links prefer the landmark records.
CATALOG_ORDER = ["western-constellation-stars", "nearest-1000", "nearest-5000", "nearest-100", "naked-eye-stars",
                 "nearest-neighbors", "notable-distant-stars"]
COMPACT_REMNANTS = ROOT / "src/data/generated/overlays/compact-remnants.json"
COMPANIONS = ROOT / "src/data/stellar-companions.json"
PLANETS = ROOT / "src/data/nearby-planets.json"
DESIGNATIONS = ROOT / "src/data/object-designations.json"
# Frozen SIMBAD mesFe_h measurements that the catalogs select their [Fe/H] from.
SPECTROSCOPY = [ROOT / f"catalog-work/{path}/spectroscopy.csv" for path in ("naked-eye-stars", "nearest-5000", "shared-enrichment/literature")]
LY_PER_PC = 3.261563777
# Myr taken to cross 1 pc at 1 km/s.
MYR_PER_PC_KMS = 0.9777922
# Straight lines approximate Galactic orbits only near the present.
ENCOUNTER_WINDOW_MYR = 2

LARGEST = "https://en.wikipedia.org/w/index.php?oldid=1381460615"
HOTTEST = "https://en.wikipedia.org/w/index.php?oldid=1372500185"
SUPERNOVA = "https://en.wikipedia.org/w/index.php?oldid=1380408343"
SOLAR_ANALOG = "https://en.wikipedia.org/w/index.php?oldid=1380419382"
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
         "49 Librae": "Possible supernova after its F-type star also becomes a white dwarf, in about 500 million years (Fuhrmann & Chini 2017).",
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
# name, SIMBAD identifier, distance (ly), spectral class, temperature (K), metallicity (dex), age (Gyr).
# Rows follow the source's solar-type sample table in its distance order; the Sun's comparison row is omitted.
# Minus signs and ranges are normalized and uncertainties written as ±.
SOLAR_TYPE = [
    ("Alpha Centauri A (Rigil Kentaurus)", "alf Cen A", 4.37, "G2V", "5,790", "+0.20", "4.4"),
    # The source gives no metallicity for Alpha Centauri B.
    ("Alpha Centauri B (Toliman)", "alf Cen B", 4.37, "K1V", "5,242", "", "5.3"),
    ("Epsilon Eridani", "eps Eri", 10.4, "K2V", "5,084", "−0.13", "0.4–0.8"),
    ("Tau Ceti", "tau Cet", 11.9, "G8V", "5,344", "−0.52", "5.8"),
    ("HD 20794", "HD 20794", 19.8, "G8V", "5,338", "−0.54", "6.1"),
    ("Delta Pavonis", "del Pav", 19.9, "G8IV", "5,604", "+0.33", "~7"),
    ("V538 Aurigae", "V538 Aur", 39.9, "K1V", "5,257", "−0.20", "3.7"),
    ("HD 14412", "HD 14412", 41.3, "G5V", "5,432", "−0.46", "9.6"),
    ("HR 4587", "HR 4587", 42.1, "G8IV", "5,538", "+0.18", "8.5"),
    ("HD 172051", "HD 172051", 42.7, "G5V", "5,610", "−0.32", "4.3"),
    ("72 Herculis", "72 Her", 46.9, "G0V", "5,662", "−0.37", "5"),
    ("HD 196761", "HD 196761", 46.9, "G8V", "5,415", "−0.31", "6.6"),
    ("Nu² Lupi", "nu.02 Lup", 47.5, "G4V", "5,664", "−0.34", "10.3"),
]
# The source's solar twin table, in the same layout: the known stars closest to the twin criteria.
SOLAR_TWINS = [
    ("18 Scorpii", "18 Sco", 45.1, "G2Va", "5,433", "−0.03", "2.9"),
    ("HD 150248", "HD 150248", 90.7, "G3V + ?", "5,750", "−0.04", "8.10"),
    ("HD 195034", "HD 195034", 92, "G5", "5,760", "−0.04", "2.9"),
    ("HD 117939", "HD 117939", 98, "G3", "5,730", "−0.10", "6.1"),
    ("HD 138573", "HD 138573", 99, "G5IV–V", "5,757", "+0.00", "7.1"),
    ("HD 98649", "HD 98649", 135, "G4V", "5,759", "−0.02", "2.3"),
    ("HD 143436", "HD 143436", 141, "G0", "5,768", "+0.00", "3.8 ± 2.9"),
    ("HD 129357", "HD 129357", 154, "G2V", "5,749", "−0.02", "8.2"),
    ("HD 133600", "HD 133600", 171, "G0", "5,808", "+0.02", "6.3"),
    ("HD 186302", "HD 186302", 184, "G3", "5,675", "+0.00", "4.5"),
    ("HIP 11915", "HIP 11915", 190, "G5V", "5,760", "−0.059", "4.1"),
    ("HIP 56948", "HIP 56948", 208, "G5V", "5,795", "+0.02", "7.1"),
    ("HIP 102152", "HIP 102152", 250, "G3V", "5,723", "−0.013", "8.2"),
    ("Kepler-452", "Kepler-452", 1400, "G2V", "5,757", "+0.21", "6.0"),
    ("YBP 1194", "Cl* NGC 2682 YBP 1194", 2934, "G5V", "5,780", "+0.023", "~4.2 ± 1.6"),
]
# The source's solar analog table, which excludes the stricter solar twins, in the same layout.
SOLAR_ANALOGS = [
    ("Sigma Draconis", "sig Dra", 18.8, "G9–K0 V", "5,297", "−0.20", "4.7"),
    ("Beta Canum Venaticorum", "bet CVn", 27.4, "G0V", "5,930", "−0.30", "6.0"),
    ("61 Virginis", "61 Vir", 27.8, "G5V", "5,558", "−0.02", "6.3"),
    ("Zeta Tucanae", "zet Tuc", 28.0, "F9.5V", "5,956", "−0.14", "2.5"),
    ("Beta Comae Berenices", "bet Com", 29.8, "G0V", "5,970", "−0.06", "2.0"),
    ("61 Ursae Majoris", "61 UMa", 31.1, "G8V", "5,483", "−0.12", "1.0"),
    ("HR 511", "HR 511", 32.8, "K0V", "5,333", "+0.05", "3.0"),
    ("Alpha Mensae", "alf Men", 33.1, "G5V", "5,594", "+0.10", "5.4"),
    ("HD 69830", "HD 69830", 40.6, "K0V", "5,410", "−0.03", "10.6"),
    ("HD 10307", "HD 10307", 41.2, "G1.5V", "5,848", "−0.05", "7.0"),
    ("HD 147513", "HD 147513", 42.0, "G1V", "5,858", "+0.03", "0.4"),
    ("58 Eridani", "58 Eri", 43.3, "G3V", "5,868", "+0.02", "0.6"),
    ("47 Ursae Majoris", "47 UMa", 45.9, "G1V", "5,954", "+0.06", "6.0"),
    ("Psi Serpentis", "psi Ser", 47.8, "G5V", "5,683", "+0.04", "3.2"),
    ("HD 84117", "HD 84117", 48.5, "F8V", "6,167", "−0.03", "3.1"),
    ("HD 4391", "HD 4391", 48.6, "G3V", "5,878", "−0.03", "1.2"),
    ("20 Leonis Minoris", "20 LMi", 49.1, "G3V", "5,741", "+0.20", "6.5"),
    ("Nu Phoenicis", "nu. Phe", 49.3, "F8V", "6,140", "+0.18", "5.7"),
    ("51 Pegasi (Helvetios)", "51 Peg", 50.9, "G2.5IVa", "5,804", "+0.20", "7.0"),
]
SOLAR_COLUMNS = ["Spectral class", "Temperature (K)", "Metallicity (dex)", "Age (Gyr)"]

PIONEER = "https://johnstonsarchive.net/astro/pulsarmap.html"
ATNF = "ATNF Pulsar Catalogue v2.9.0 adopted distance"
# name, J2000 name, period encoded on the plaque (s), distance (pc), constellation.
# Periods are the plaque's hydrogen-unit values as identified in Johnston's table.
PIONEER_PULSARS = [
    ("PSR B1727-47", "J1731-4744", "0.8296830003", 700, "Ara"),
    ("PSR B1451-68", "J1456-6843", "0.2633767643", 430, "Circinus"),
    ("PSR B1240-64", "J1243-6423", "0.3880000002", 2000, "Crux"),
    ("Vela Pulsar", "J0835-4510", "0.0892187481", 280, "Vela"),
    ("PSR B0950+08", "J0953+0755", "0.2530650432", 261, "Leo"),
    ("PSR B0823+26", "J0826+2637", "0.5306595992", 500, "Cancer"),
    ("Crab Pulsar", "J0534+2200", "0.0331296448", 2000, "Taurus"),
    ("PSR B0525+21", "J0528+2200", "3.7454907997", 1215, "Taurus"),
    ("PSR B0329+54", "J0332+5434", "0.7145186427", 1680, "Camelopardalis"),
    ("PSR B2217+47", "J2219+4754", "0.5384673780", 2383, "Lacerta"),
    ("PSR B2016+28", "J2018+2839", "0.5579533903", 980, "Vulpecula"),
    ("PSR B1933+16", "J1935+1616", "0.3587354200", 3700, "Aquila"),
    ("PSR B1929+10", "J1932+1059", "0.2265170382", 310, "Aquila"),
    ("PSR B1642-03", "J1645-0317", "0.3876887792", 4000, "Ophiuchus"),
]
PIONEER_NOTES = {"PSR B1240-64": "Its period was known to only three significant digits when the plaque was designed."}

# The source lists Betelgeuse at 408–548 ly; the upper estimate carries its uncertainty.
SUPERNOVA_DISTANCE_SOURCES = {"Betelgeuse": "Source range 408–548 ly"}
# Components that SIMBAD resolves only as their system; the source's γ² Vel B is the O-type companion.
# None keeps a component unlinked when the only catalog record is another component (15 Mon is S Mon A).
COMPONENTS = {
    "Acrux B": ("western-constellation-stars", "msc-12266-6306-b"),
    "Beta Centauri Ab (Hadar)": ("western-constellation-stars", "msc-14038-6022-ab"),
    "Gamma² Velorum B": ("western-constellation-stars", "msc-08095-4720-ab"),
    "S Monocerotis B": None,
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
    """Designation index, every catalog record, and each object with its preferred record."""
    index, records, objects = {}, {}, {}
    for catalog in reversed(CATALOG_ORDER):
        for star in json.loads((CATALOGS / f"{catalog}.json").read_text())["stars"]:
            hip = next((d for d in star.get("designations") or [] if key(d).startswith("hip")), None)
            record = {"catalog": catalog, "id": star["id"], "designation": hip and " ".join(hip.split())}
            records[catalog, star["id"]] = record
            objects[star["id"]] = record, star
            for designation in [star["name"], *(star.get("designations") or [])]:
                index[key(designation)] = record
    objects.pop("sun", None)
    return index, records, objects


def identity(objects, systems=False):
    """Representative of each object: records sharing a HIP or Gaia DR3 number are one object; `systems` also joins reviewed system members."""
    parent = {identifier: identifier for identifier in objects}

    def root(identifier):
        while parent[identifier] != identifier:
            identifier = parent[identifier]
        return identifier

    def join(first, second):
        parent[root(second)] = root(first)

    first = {}
    for identifier, (_, star) in objects.items():
        for designation in star.get("designations") or []:
            designation = " ".join(designation.split())
            if re.fullmatch(r"(?:HIP|Gaia DR3) \d+", designation):
                join(first.setdefault(designation, identifier), identifier)
    if systems:
        for system in json.loads(COMPANIONS.read_text())["systems"]:
            members = [component["starId"] for component in system["components"] if component["starId"] in objects]
            for member in members[1:]:
                join(members[0], member)
    return root


def distance(star):
    return math.hypot(star["x_pc"], star["y_pc"], star["z_pc"])


def computed(object_record, star, value=None, fields=None, name=None):
    """A computed entry; four significant digits keep the 3-digit display exact in either unit."""
    return {"name": name or star["name"], **({"value": value} if value is not None else {}), "distance_pc": float(f"{distance(star):.4g}"),
            **({"fields": fields} if fields else {}), "constellation": star["constellation"], "object": object_record}


def best(ranked, root, count):
    """The first `count` (sort key, identifier) pairs in key order, one per representative."""
    chosen, seen = [], set()
    for _, identifier in sorted(ranked):
        if root(identifier) not in seen:
            seen.add(root(identifier))
            chosen.append(identifier)
        if len(chosen) == count:
            break
    return chosen


def when(myr):
    years = abs(myr) * 1e6
    text = f"{float(f'{abs(myr):.2g}'):g} million" if years >= 1e6 else f"{float(f'{years:.2g}'):,.0f}"
    return f"in {text} years" if myr > 0 else f"{text} years ago"


def encounters(objects):
    """Closest approaches to the Sun on straight lines from today's positions and space velocities."""
    approaches = {}
    for identifier, (_, star) in objects.items():
        velocity = [star[f"v{axis}_kms"] for axis in "xyz"]
        if None in velocity or not any(velocity):
            continue
        position = [star[f"{axis}_pc"] for axis in "xyz"]
        time = -sum(p * v for p, v in zip(position, velocity)) / sum(v * v for v in velocity)
        if abs(time * MYR_PER_PC_KMS) <= ENCOUNTER_WINDOW_MYR:
            approaches[identifier] = math.dist([p + v * time for p, v in zip(position, velocity)], (0, 0, 0)), time * MYR_PER_PC_KMS
    chosen = best([(approach[0], identifier) for identifier, approach in approaches.items()], identity(objects, systems=True), 20)
    return [computed(*objects[identifier], float(f"{approaches[identifier][0]:.4g}"), [when(approaches[identifier][1])]) for identifier in chosen]


def proper_motions(objects):
    motions = {identifier: math.hypot(star["raw_astrometry"]["pm_ra_cosdec_masyr"], star["raw_astrometry"]["pm_dec_masyr"]) / 1000
               for identifier, (_, star) in objects.items() if (star.get("raw_astrometry") or {}).get("pm_dec_masyr") is not None}
    chosen = best([(-motion, identifier) for identifier, motion in motions.items()], identity(objects, systems=True), 20)
    return [computed(*objects[identifier], round(motions[identifier], 2)) for identifier in chosen]


def remnant_entry(remnant, value=None):
    return computed({"catalog": "compact-remnants", "id": remnant["id"], "designation": None}, remnant, value)


def fastest_pulsars(remnants):
    spinning = sorted((remnant for remnant in remnants if remnant["type"] == "pulsar" and remnant["compact"].get("rotation_period_s")),
                      key=lambda remnant: remnant["compact"]["rotation_period_s"])
    return [remnant_entry(remnant, round(1 / remnant["compact"]["rotation_period_s"], 1)) for remnant in spinning[:20]]


def spectral_class(star):
    match = re.search(r"([OBAFGKM])\d", star.get("spectral_type") or "")
    return match and match[1]


def labelled(star, *labels):
    return any(label in (star.get("subtypes") or []) for label in labels)


def main_sequence(letter):
    return lambda star: star["type"] == "star" and spectral_class(star) == letter and labelled(star, "Main-sequence")


# Kinds follow the type, spectral class and luminosity-class labels shown on each object's card;
# the key selects the kind's mark in src/top-lists.ts.
STAR_KINDS = (
    ("red-dwarfs", "Red dwarfs", main_sequence("M")),
    ("orange-dwarfs", "Orange dwarfs", main_sequence("K")),
    ("yellow-dwarfs", "Yellow dwarfs", main_sequence("G")),
    ("f-dwarfs", "F-type main-sequence stars", main_sequence("F")),
    ("a-dwarfs", "A-type main-sequence stars", main_sequence("A")),
    ("b-dwarfs", "B-type main-sequence stars", main_sequence("B")),
    ("o-stars", "O-type stars", lambda star: star["type"] == "star" and spectral_class(star) == "O"),
    ("subgiants", "Subgiants", lambda star: labelled(star, "Subgiant")),
    ("giants", "Giants", lambda star: labelled(star, "Giant", "Red giant")),
    ("bright-giants", "Bright giants", lambda star: labelled(star, "Bright giant")),
    ("supergiants", "Supergiants", lambda star: labelled(star, "Supergiant", "Red supergiant", "Yellow supergiant", "Blue supergiant", "Evolved supergiant")),
    ("wolf-rayet", "Wolf–Rayet stars", lambda star: labelled(star, "Wolf–Rayet")),
    ("carbon-stars", "Carbon stars", lambda star: labelled(star, "Carbon star")),
    ("cepheids", "Cepheids", lambda star: labelled(star, "Classical Cepheid", "Type II Cepheid", "Cepheid variable")),
    ("miras", "Mira variables", lambda star: labelled(star, "Mira variable")),
    ("white-dwarfs", "White dwarfs", lambda star: star["type"] == "white_dwarf"),
    ("brown-dwarfs", "Brown dwarfs", lambda star: star["type"] in {"brown_dwarf", "sub_brown_dwarf"}),
    ("planet-hosts", "Planet hosts", lambda star: (star.get("known_planets") or 0) > 0),
)
REMNANT_KINDS = (("neutron-stars", "Neutron stars", "neutron_star"), ("pulsars", "Pulsars", "pulsar"), ("black-holes", "Black holes", "black_hole"))


def nearest_kinds(objects, remnants):
    root = identity(objects)
    groups = [{"kind": kind, "title": title, "entries": [computed(*objects[identifier]) for identifier in
               best([(distance(star), identifier) for identifier, (_, star) in objects.items() if test(star)], root, 5)]}
              for kind, title, test in STAR_KINDS]
    for key_, title, kind in REMNANT_KINDS:
        # Candidates stay out of a list of confirmed nearest objects.
        nearest = sorted((remnant for remnant in remnants if remnant["type"] == kind and remnant["compact"]["confidence"] == "confirmed"), key=distance)
        groups.append({"kind": key_, "title": title, "entries": [remnant_entry(remnant) for remnant in nearest[:5]]})
    return groups


def corroborated_metallicities(objects):
    """[Fe/H] of F-M stars that a second paper confirms within 0.3 dex. Hotter stars' surface abundances
    are reshaped by diffusion (Ap, Am, Lambda Bootis stars) and do not describe their composition."""
    measured = {}
    for path in SPECTROSCOPY:
        with path.open(newline="") as handle:
            for row in csv.DictReader(handle):
                if row["fe_h"]:
                    measured.setdefault(" ".join(row["main_id"].split()), set()).add((row["bibcode"], float(row["fe_h"])))
    simbad = {identifier: " ".join(entry["simbadId"].split()) for identifier, entry in json.loads(DESIGNATIONS.read_text())["objects"].items() if entry.get("simbadId")}
    values = {}
    for identifier, (_, star) in objects.items():
        value = star.get("metallicity_dex")
        # Am notation (kA1mA1) and Lambda Bootis stars (_lB) state a peculiar hotter atmosphere even under an F type.
        peculiar = re.search(r"k[A-F]\d|m[A-F]\d|lB", star.get("spectral_type") or "")
        if star["type"] != "star" or star.get("metallicity_kind") != "[Fe/H]" or value is None or spectral_class(star) not in set("FGKM") or peculiar:
            continue
        papers = {bibcode for bibcode, fe_h in measured.get(simbad.get(identifier), ()) if abs(fe_h - value) <= 0.3}
        if len(papers) >= 2:
            values[identifier] = value
    return values


def metallicity_groups(objects):
    values, root = corroborated_metallicities(objects), identity(objects)
    poorest = best([(value, identifier) for identifier, value in values.items()], root, 5)
    richest = best([(-value, identifier) for identifier, value in values.items()], root, 5)
    group = lambda title, chosen, ascending: {"title": title, "metric": "[Fe/H]", "unit": "dex", "digits": 2, **({"ascending": True} if ascending else {}),
                                              "entries": [computed(*objects[identifier], values[identifier]) for identifier in chosen]}
    return [group("Most metal-poor", poorest, True), group("Most metal-rich", richest, False)]


def measured(planet, metric):
    """A planet metric the archive reports as measured: neither calculated nor a limit."""
    value = planet["metrics"].get(metric)
    return value["value"] if value and not value.get("estimated") and not value.get("limit") else None


# Kopparapu et al. (2014) conservative limits, as src/habitable-zone.ts draws them in the system diagram.
HZ_INNER = (1.107, 1.332e-4, 1.58e-8, -8.308e-12, -1.931e-15)
HZ_OUTER = (0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16)


def habitable_zone(star):
    luminosity, temperature = star.get("luminosity_solar"), star.get("temperature_k")
    if not luminosity or luminosity <= 0 or temperature is None or not 2600 <= temperature <= 7200:
        return None
    t = temperature - 5780
    flux = lambda c: c[0] + t * (c[1] + t * (c[2] + t * (c[3] + t * c[4])))
    return math.sqrt(luminosity / flux(HZ_INNER)), math.sqrt(luminosity / flux(HZ_OUTER))


def planet_groups(objects):
    data = json.loads(PLANETS.read_text())
    host = lambda planet: objects.get(data["aliases"].get(planet["hostStarId"], planet["hostStarId"]))
    # Disputed planets stay out; every listed planet opens its card from its host star.
    planets = [planet for planet in data["planets"] if not planet["controversial"] and host(planet)]
    orbits = {planet["id"]: planet["semiMajorAxisAu"] for system in data["systems"] for planet in system["planets"]
              if planet["distanceKind"] == "semi-major-axis" and not planet["distanceLimit"]}

    def entry(planet, value=None):
        record, star = host(planet)
        return computed({**record, "planet": planet["id"]}, star, value, name=planet["name"])

    def ranked(metric, descending):
        values = [(measured(planet, metric), planet) for planet in planets if measured(planet, metric) is not None]
        return [entry(planet, value) for value, planet in sorted(values, key=lambda item: (-item[0] if descending else item[0], item[1]["id"]))[:5]]

    counts = {}
    for planet in planets:
        counts.setdefault(host(planet)[0]["id"], []).append(planet)
    most = sorted(counts.values(), key=lambda system: (-len(system), distance(host(system[0])[1])))[:5]
    habitable = []
    for planet in planets:
        zone, orbit = habitable_zone(host(planet)[1]), orbits.get(planet["id"])
        if zone and orbit and zone[0] <= orbit <= zone[1]:
            habitable.append(planet)
    habitable.sort(key=lambda planet: (distance(host(planet)[1]), planet["id"]))
    return [
        {"title": "Most planets", "metric": "Planets", "entries": [computed(*host(system[0]), len(system)) for system in most]},
        {"title": "Habitable-zone planets", "entries": [entry(planet) for planet in habitable[:10]]},
        {"title": "Hottest planets", "metric": "Temperature", "unit": "K", "entries": ranked("pl_eqt", True)},
        {"title": "Smallest planets", "metric": "Radius", "unit": "R⊕", "digits": 2, "ascending": True, "entries": ranked("pl_rade", False)},
    ]


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
        row["object"] = COMPONENTS[name] and records[COMPONENTS[name]]
    row["fields"] = [spectral_class, stage, supernova_type]
    return row


def solar(index, frozen, name, identifier, ly, *fields):
    return {**entry(index, frozen, name, identifier, None, ly / LY_PER_PC), "fields": list(fields)}


def pioneer(remnants, name, j_name, period, distance_pc, constellation):
    # Overlay IDs encode the J2000 name, so pulsars added to the overlay link automatically.
    identifier = "psr-" + j_name.lower().replace("+", "p").replace("-", "m")
    return {"name": name, "distance_pc": distance_pc, "distance_source": ATNF,
            **({"note": PIONEER_NOTES[name]} if name in PIONEER_NOTES else {}), "constellation": constellation,
            "object": {"catalog": "compact-remnants", "id": identifier, "designation": None} if identifier in remnants else None,
            "fields": [period, j_name]}


def build():
    frozen = json.loads(FROZEN.read_text())["objects"]
    index, records, objects = catalog_index()
    overlay = json.loads(COMPACT_REMNANTS.read_text())["objects"]
    remnants = {o["id"] for o in overlay}
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
        # Ordered from the broadest to the strictest similarity to the Sun.
        {"id": "solar-type", "title": "Solar-type stars", "columns": SOLAR_COLUMNS,
         "source": {"label": "Wikipedia · Solar analog (solar-type stars)", "url": SOLAR_ANALOG},
         "entries": [solar(index, frozen, *row) for row in SOLAR_TYPE]},
        {"id": "solar-analogs", "title": "Solar analogs", "columns": SOLAR_COLUMNS,
         "source": {"label": "Wikipedia · Solar analog (solar analogs)", "url": SOLAR_ANALOG},
         "entries": [solar(index, frozen, *row) for row in SOLAR_ANALOGS]},
        # No exact solar twin is known; the source lists the closest candidates.
        {"id": "solar-twins", "title": "Solar twin candidates", "columns": SOLAR_COLUMNS,
         "source": {"label": "Wikipedia · Solar analog (solar twins)", "url": SOLAR_ANALOG},
         "entries": [solar(index, frozen, *row) for row in SOLAR_TWINS]},
        # The 14 pulsars that locate the Sun on the Pioneer plaques and Voyager Golden Records.
        {"id": "pioneer-plaque", "title": "Pioneer plaque pulsars", "columns": ["Period on plaque (s)", "J2000 name"],
         "source": {"label": "Johnston · Pioneer plaque pulsar map identifications", "url": PIONEER},
         "entries": sorted((pioneer(remnants, *row) for row in PIONEER_PULSARS), key=lambda row: row["distance_pc"])},
        {"id": "nearest-kinds", "title": "Nearest of each kind",
         "method": "From Star View’s catalogs and compact-object overlay, by each object’s type, spectral class and luminosity class.",
         "groups": nearest_kinds(objects, overlay)},
        {"id": "encounters", "title": "Closest stellar encounters", "metric": "Closest approach", "unit": "distance", "ascending": True, "columns": ["When"],
         "method": f"Straight-line motion from today’s positions and space velocities in Star View’s catalogs, for closest approaches within {ENCOUNTER_WINDOW_MYR} million years. "
                   "Stars without a radial velocity are not included.",
         "entries": encounters(objects)},
        {"id": "proper-motion", "title": "Highest proper motion", "metric": "Proper motion", "unit": "″/yr", "digits": 2,
         "method": "From Star View’s catalogs; one entry per star system.",
         "entries": proper_motions(objects)},
        {"id": "metallicity", "title": "Metal-poor and metal-rich stars",
         "method": "Spectroscopic [Fe/H] of F- to M-type stars in Star View’s catalogs, confirmed by a second paper within 0.3 dex. "
                   "Hotter stars are left out: their surface abundances reflect atomic diffusion rather than their composition.",
         "groups": metallicity_groups(objects)},
        {"id": "planets", "title": "Planets",
         "method": "Confirmed planets of stars in Star View’s catalogs, with measured values only. The habitable zone is the conservative zone "
                   "of Kopparapu et al. (2014) drawn in each system diagram.",
         "source": {"label": "NASA Exoplanet Archive", "url": "https://exoplanetarchive.ipac.caltech.edu/"},
         "groups": planet_groups(objects)},
        {"id": "fastest-pulsars", "title": "Fastest pulsars", "metric": "Spin rate", "unit": "rotations/s",
         "source": {"label": "ATNF Pulsar Catalogue v2.9.0", "url": "https://www.atnf.csiro.au/research/pulsar/psrcat/"},
         "entries": fastest_pulsars(overlay)},
    ]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.refresh:
        refresh(list(dict.fromkeys(row[1] for row in [*LARGEST_STARS, *HOTTEST_STARS, *SUPERNOVA_CANDIDATES, *SOLAR_TYPE, *SOLAR_ANALOGS, *SOLAR_TWINS])))
    text = json.dumps(build(), indent=1, ensure_ascii=False) + "\n"
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != text:
            sys.exit(f"{OUTPUT.relative_to(ROOT)} is stale; run scripts/author-top-lists.py")
        return
    OUTPUT.write_text(text)


if __name__ == "__main__":
    main()
