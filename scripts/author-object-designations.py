"""Build the offline identity supplement from exact, frozen catalog identifiers.

No positional matching, live queries, or changes to scientific source rows.
Run with --check to compare the checked-in supplement without writing it.
"""

import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/data/object-designations.json"
WORK = ROOT / "catalog-work/object-designations"
GREEK = dict(zip(
    "alf bet gam del eps zet eta tet iot kap lam mu. nu. ksi omi pi. rho sig tau ups phi chi psi ome".split(),
    "Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigma Tau Upsilon Phi Chi Psi Omega".split(),
))
GENITIVES = dict(re.findall(r"([A-Za-z]{3}):(.+?)(?= [A-Za-z]{3}:|$)", (
    "And:Andromedae Ant:Antliae Aps:Apodis Aqr:Aquarii Aql:Aquilae Ara:Arae Ari:Arietis Aur:Aurigae "
    "Boo:Bootis Cae:Caeli Cam:Camelopardalis Cnc:Cancri CVn:Canum Venaticorum CMa:Canis Majoris CMi:Canis Minoris "
    "Cap:Capricorni Car:Carinae Cas:Cassiopeiae Cen:Centauri Cep:Cephei Cet:Ceti Cha:Chamaeleontis Cir:Circini "
    "Col:Columbae Com:Comae Berenices CrA:Coronae Australis CrB:Coronae Borealis Crv:Corvi Crt:Crateris Cru:Crucis "
    "Cyg:Cygni Del:Delphini Dor:Doradus Dra:Draconis Equ:Equulei Eri:Eridani For:Fornacis Gem:Geminorum "
    "Gru:Gruis Her:Herculis Hor:Horologii Hya:Hydrae Hyi:Hydri Ind:Indi Lac:Lacertae Leo:Leonis LMi:Leonis Minoris "
    "Lep:Leporis Lib:Librae Lup:Lupi Lyn:Lyncis Lyr:Lyrae Men:Mensae Mic:Microscopii Mon:Monocerotis Mus:Muscae "
    "Nor:Normae Oct:Octantis Oph:Ophiuchi Ori:Orionis Pav:Pavonis Peg:Pegasi Per:Persei Phe:Phoenicis Pic:Pictoris "
    "Psc:Piscium PsA:Piscis Austrini Pup:Puppis Pyx:Pyxidis Ret:Reticuli Sge:Sagittae Sgr:Sagittarii Sco:Scorpii "
    "Scl:Sculptoris Sct:Scuti Ser:Serpentis Sex:Sextantis Tau:Tauri Tel:Telescopii Tri:Trianguli TrA:Trianguli Australis "
    "Tuc:Tucanae UMa:Ursae Majoris UMi:Ursae Minoris Vel:Velorum Vir:Virginis Vol:Volantis Vul:Vulpeculae"
)))


def key(value):
    return " ".join(value.split()).casefold()


def display(value):
    return re.sub(r"^(?:NAME|V\*|\*\*|\*)\s+", "", " ".join(value.split()))


def expanded(value):
    match = re.fullmatch(r"([a-z.]+)(\d{0,2}) ([A-Z][A-Za-z]{2})(.*)", value)
    if not match or match[1] not in GREEK or match[3] not in GENITIVES:
        return None
    number = str(int(match[2])) if match[2] else ""
    return f"{GREEK[match[1]]}{number} {GENITIVES[match[3]]}{match[4]}"


def unique(values):
    seen = set()
    result = []
    for value in values:
        if value and key(value) not in seen:
            seen.add(key(value))
            result.append(" ".join(value.split()))
    return result


def generic(name):
    return bool(re.match(r"^(?:CNS5 |HIP |HD |GJ |Gl |Gaia |2MASS |WISE|SDSS |PSR |IC |NGC |vdB |Sh |\*)", name)) or bool(re.match(
        r"^(?:" + "|".join(re.escape(value) for value in [*GREEK.values(), *GREEK]) + r")\d* ", name))


def build():
    inputs = {}

    def read_json(path):
        inputs[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
        return json.loads(path.read_text())

    def read_csv(path):
        inputs[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
        with path.open(newline="") as handle:
            return list(csv.DictReader(handle))

    manifest = read_json(WORK / "source-manifest.json")
    for filename, expected in manifest["checksumsSha256"].items():
        if hashlib.sha256((WORK / filename).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Designation source checksum mismatch: {filename}")

    # Collapse repeated exact SIMBAD records, keeping the published aliases.
    records = {}
    for path in [ROOT / f"catalog-work/{catalog}/simbad.csv" for catalog in
                 ("nearest-1000", "western-constellation-stars", "famous-cluster-stars", "bright-stars")] + [WORK / "simbad.csv", WORK / "components.csv", WORK / "extended.csv"]:
        for row in read_csv(path):
            main = key(row["main_id"])
            record = records.setdefault(main, {"aliases": [], "sources": [], "queries": []})
            record["aliases"].extend([row["main_id"], *(row.get("ids") or "").split("|")])
            record["queries"].append(row.get("query_id") or row["main_id"])
            record["sources"].append(str(path.relative_to(ROOT)))
    index = defaultdict(set)
    for main, record in records.items():
        for value in record["aliases"] + record["queries"]:
            if value:
                index[key(value)].add(main)

    def resolve(identifier):
        matches = index.get(key(identifier), set())
        return next(iter(matches)) if len(matches) == 1 else None

    def simbad_identifier(identifier):
        if re.match(r"^(?:\d+|" + "|".join(re.escape(greek) for greek in GREEK) + r")\d* ", identifier):
            return "* " + identifier
        if re.fullmatch(r"[A-Z]{1,2} [A-Z][a-z]{2}", identifier):
            return "V* " + identifier
        if identifier.startswith("Luhman "):
            return "NAME " + identifier
        return identifier

    iau_names = defaultdict(list)
    for row in read_csv(WORK / "iau-names.csv"):
        main = resolve(row["identifier"])
        if main:
            iau_names[main].append(row["name"])

    inventory = defaultdict(list)
    for path in [ROOT / "src/data/stars.csv", *sorted((ROOT / "src/data/catalogs").glob("*/stars.csv"))]:
        for row in read_csv(path):
            inventory[row["id"]].append((row, str(path.relative_to(ROOT))))
    for path in sorted((ROOT / "src/data/overlays").glob("*/objects.json")):
        for row in read_json(path)["objects"]:
            inventory[row["id"]].append((row, str(path.relative_to(ROOT))))

    nearby = {row["id"]: row for row in read_json(ROOT / "src/data/catalogs/nearest-100/provenance.json")["objects"]}
    distant = read_json(ROOT / "src/data/catalogs/nearest-1000/provenance.json")
    cns5 = {row["id"]: row["cns5Id"] for row in distant["objects"] if row.get("cns5Id")}
    # Never assign one unresolved system's identifiers to its separate components.
    cns5.update({row["starViewIds"][0]: row["cns5Id"] for row in distant["audit"] if len(row.get("starViewIds", [])) == 1})
    bright = read_json(ROOT / "src/data/catalogs/bright-stars/provenance.json")["objects"]
    landmarks = {}
    for catalog in ("western-constellation-stars", "famous-cluster-stars"):
        landmarks.update(read_json(ROOT / f"src/data/catalogs/{catalog}/provenance.json")["objects"])
    default_names = {row["id"]: row["name"] for row in inventory_rows(inventory, "src/data/stars.csv")}
    bright_names = {row["id"]: row["name"] for row in inventory_rows(inventory, "src/data/catalogs/bright-stars/stars.csv")}
    reviewed = read_json(WORK / "preferred-names.json")
    pulsars = {}
    atnf_path = ROOT / "catalog-work/compact-remnants/atnf-long.csv"
    inputs[str(atnf_path.relative_to(ROOT))] = hashlib.sha256(atnf_path.read_bytes()).hexdigest()
    with atnf_path.open(newline="") as handle:
        for row in list(csv.reader(handle, delimiter=";"))[2:]:
            pulsars[f"psr-{row[1].lower().replace('+', 'p').replace('-', 'm')}"] = [f"PSR {value.strip()}" for value in (row[1], row[3]) if value.strip() != "*"]

    objects = {}
    for identifier, rows in sorted(inventory.items()):
        row = rows[0][0]
        name = default_names.get(identifier, bright_names.get(identifier, row["name"]))
        aliases = [r["name"] for r, _ in rows]
        sources = [path for _, path in rows]
        identifiers = []
        if identifier in nearby:
            source = nearby[identifier]
            values = source.get("identifiers", {})
            if values.get("SIMBAD"):
                identifiers.append(simbad_identifier(values["SIMBAD"]))
            identifiers.extend(value for field in ("HIP", "GJ", "HD") if (value := values.get(field)))
            if values.get("GaiaDR2"):
                identifiers.append("Gaia DR2 " + values["GaiaDR2"])
            if values.get("GaiaEDR3"):
                identifiers.append("Gaia EDR3 " + values["GaiaEDR3"])
            # ObjName belongs to the component; the census Name belongs to the system.
            aliases.append(source.get("sourceObjectName"))
        if identifier in cns5:
            identifiers.append("CNS5 " + cns5[identifier])
        if identifier in bright and bright[identifier].get("queryId"):
            identifiers.append(bright[identifier]["queryId"])
        if identifier in landmarks:
            identifiers.append(landmarks[identifier].get("queryId") or landmarks[identifier].get("simbadId") or "")
        if identifier.startswith("hip-"):
            identifiers.append("HIP " + identifier.removeprefix("hip-"))
        if identifier in pulsars:
            identifiers.extend(pulsars[identifier])
        nebula = row["type"] in ("reflection_nebula", "hii_region", "planetary_nebula")
        if nebula and identifier != "pleiades-nebula":
            for value in row["nebula"]["designations"]:
                query = re.sub(r"^M(?=\d)", "M ", value)
                resolved = resolve(query)
                # SIMBAD often attaches VdB numbers to illuminating stars.
                # Abell numbers can also resolve to galaxy clusters. Neither is
                # an identity match for a separately rendered nebula.
                if resolved and re.match(r"^(?:ic |ngc |m |sh |lbn |pn |vdb )", resolved):
                    identifiers.append(query)
        if identifier in reviewed:
            identifiers.extend(reviewed[identifier].get("identifiers", []))
        main = next((match for value in identifiers if (match := resolve(value))), None)
        # A second exact identifier resolving to a different record is withheld.
        # This matters for the Gaia DR3 Luhman 16 system versus Gaia DR2 A/B.
        aliases.extend(display(value) for value in identifiers if resolve(value.replace("Gaia EDR3 ", "Gaia DR3 ")) in (None, main))
        named = []
        if main:
            record = records[main]
            sources.extend(record["sources"])
            for value in record["aliases"]:
                if row["type"] == "pulsar" and (value.startswith(("SNR ", "PWN ")) or re.search(r"\b(?:SNR|PWN|Nebula)\b", value, re.I)):
                    continue
                if nebula and not re.match(r"^(?:NAME|IC|NGC|M|SH|LBN|Ced|PN|PK|GN|VDB|ESO)\s+", value, re.I):
                    # Some planetary-nebula records also contain central-star
                    # measurements and identifiers. Keep nebular nomenclature.
                    continue
                clean = display(value)
                aliases.extend([clean, expanded(clean)])
                if value.startswith("NAME "):
                    named.append(clean)
            if iau_names[main]:
                aliases.extend(iau_names[main])
                named = iau_names[main] + named
                sources.append("catalog-work/object-designations/iau-names.csv")
            # Keep authored, familiar names; use a published proper name for
            # catalog-number names. Explicit choices resolve ambiguous nicknames.
            if identifier not in default_names and generic(name) and named:
                name = next((value for value in named if not generic(value)), name)
        for r, _ in rows:
            aliases.extend(r.get("designations", "").split("|") if isinstance(r.get("designations"), str) else r.get("designations", []))
            aliases.extend(r.get("nebula", {}).get("designations", []))
            aliases.extend(r.get("bubble", {}).get("designations", []))
            # Cahlon indices identify segmented features, not entire complexes.
            if r["type"] == "molecular_cloud":
                aliases.append(f"Cahlon Cloud {r['molecular_cloud']['catalog_id']}")
        if identifier in reviewed:
            decision = reviewed[identifier]
            name = decision["name"]
            aliases.extend(decision.get("designations", []))
            sources.extend(decision["sources"])
        aliases = unique(aliases)
        aliases = [value for value in aliases if key(value) != key(name)]
        aliases.sort(key=lambda value: (0 if value in named else 1 if re.match(r"^(?:PSR |HD |HIP |GJ |Alpha|Beta|Gamma|Delta|Epsilon)", value) else 2, key(value)))
        objects[identifier] = {"name": name, "designations": aliases, "sources": sorted(set(sources))}
    return {"schemaVersion": 1, "policy": "Exact source identifiers only; preserve familiar authored names, prefer published common names to catalog numbers; keep individual components distinct. No positional alias matching. Associated nebula names are withheld from pulsars.",
            "sourceChecksumsSha256": dict(sorted(inputs.items())), "objects": objects}


def inventory_rows(inventory, source):
    return [row for rows in inventory.values() for row, path in rows if path == source]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    payload = build()
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    if args.check:
        if OUTPUT.read_text() != text:
            raise SystemExit("Object designation supplement differs; regenerate after reviewing inputs.")
    else:
        OUTPUT.write_text(text)
    objects = payload["objects"]
    print(f"{len(objects)} unique objects; {sum(len(row['designations']) for row in objects.values())} alternate designations; {sum(bool(row['designations']) for row in objects.values())} objects with aliases")
