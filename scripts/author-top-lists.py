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
NOTES = {"Gamma Velorum (WR)": "Star View’s reviewed source gives the WR star T* = 57,100 K (Schmutz et al. 2026), an inner-boundary wind temperature."}

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
        frozen[identifier] = {"main_id": " ".join(main_id.split()), "ra_deg": ra, "dec_deg": dec,
                              "constellation": constellation, "ids": [" ".join(i.split()) for i in ids.split(",") if i.strip()]}
    FROZEN.parent.mkdir(parents=True, exist_ok=True)
    FROZEN.write_text(json.dumps({"source": "SIMBAD sim-script", "objects": frozen}, indent=1, ensure_ascii=False) + "\n")


def catalog_index():
    index = {}
    for catalog in reversed(CATALOG_ORDER):
        for star in json.loads((CATALOGS / f"{catalog}.json").read_text())["stars"]:
            hip = next((d for d in star.get("designations") or [] if key(d).startswith("hip")), None)
            for designation in [star["name"], *(star.get("designations") or [])]:
                index[key(designation)] = {"catalog": catalog, "id": star["id"], "designation": hip and " ".join(hip.split())}
    return index


def entry(index, frozen, name, identifier, value, distance_pc, distance_source=None):
    simbad = frozen[identifier]
    match = next((index[key(i)] for i in simbad["ids"] if key(i) in index), None)
    return {"name": name, "value": value, "distance_pc": round(distance_pc),
            **({"distance_source": distance_source} if distance_source else {}),
            **({"note": NOTES[name]} if name in NOTES else {}),
            "constellation": simbad["constellation"].strip(), "object": match}


def build():
    frozen = json.loads(FROZEN.read_text())["objects"]
    index = catalog_index()
    return {"schemaVersion": 1, "lists": [
        {"id": "largest", "title": "Largest stars", "metric": "Radius", "unit": "R☉", "markers": "solar-orbits",
         "source": {"label": "Wikipedia · List of largest stars (Milky Way)", "url": LARGEST},
         "entries": [entry(index, frozen, *row) for row in LARGEST_STARS]},
        {"id": "hottest", "title": "Hottest stars", "metric": "Temperature", "unit": "K",
         "source": {"label": "Wikipedia · List of hottest stars (Milky Way)", "url": HOTTEST},
         "entries": [entry(index, frozen, name, identifier, value, ly / LY_PER_PC)
                     for name, identifier, value, ly in HOTTEST_STARS]},
    ]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.refresh:
        refresh([row[1] for row in [*LARGEST_STARS, *HOTTEST_STARS]])
    text = json.dumps(build(), indent=1, ensure_ascii=False) + "\n"
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != text:
            sys.exit(f"{OUTPUT.relative_to(ROOT)} is stale; run scripts/author-top-lists.py")
        return
    OUTPUT.write_text(text)


if __name__ == "__main__":
    main()
