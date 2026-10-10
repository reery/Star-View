"""Build shared object stats offline from frozen, exact-identity source records."""

import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/object-stats"
OUTPUT = ROOT / "src/data/object-stats.json"
STELLAR = {"star", "white_dwarf", "brown_dwarf", "sub_brown_dwarf", "pulsar", "neutron_star", "black_hole"}
# Physical and variability classes only: omit wavelength detections, proper
# motion, catalog membership and the generic object types already on the card.
LABELS = {
    "WR*": "Wolf–Rayet", "Be*": "Be star", "Ae*": "Herbig Ae/Be", "HB*": "Horizontal-branch",
    "RG*": "Red giant", "sg*": "Evolved supergiant", "s*r": "Red supergiant", "s*y": "Yellow supergiant",
    "s*b": "Blue supergiant", "AB*": "Asymptotic giant branch", "C*": "Carbon star", "S*": "S-type star",
    "BS*": "Blue straggler", "pMS*": "Pre-main-sequence", "TT*": "T Tauri", "Y*O": "Young stellar object",
    "Em*": "Emission-line star", "Pe*": "Chemically peculiar", "LM*": "Low-mass star",
    "SB*": "Spectroscopic binary", "EB*": "Eclipsing binary", "El*": "Ellipsoidal variable",
    "Sy*": "Symbiotic star", "CV*": "Cataclysmic variable", "No*": "Nova", "XB*": "X-ray binary",
    "LXB": "Low-mass X-ray binary", "HXB": "High-mass X-ray binary", "Pu*": "Pulsating variable",
    "V*": "Variable star", "Ir*": "Irregular variable", "Er*": "Eruptive variable",
    "Ro*": "Rotating variable", "a2*": "Alpha² CVn variable", "BY*": "BY Draconis variable",
    "RS*": "RS CVn variable", "dS*": "Delta Scuti variable", "RR*": "RR Lyrae variable",
    "Ce*": "Cepheid variable", "cC*": "Classical Cepheid", "CWB": "Type II Cepheid",
    "WV*": "Type II Cepheid", "bC*": "Beta Cephei variable", "gD*": "Gamma Doradus variable",
    "LP*": "Long-period variable", "Mi*": "Mira variable", "sr*": "Semiregular variable",
    "RV*": "RV Tauri variable", "Fl*": "Flare star", "FU*": "FU Orionis variable",
    "RC*": "R Coronae Borealis variable", "N*": "Neutron star", "Psr": "Pulsar",
    "Or*": "Orion variable", "HS*": "Hot subdwarf",
}


def key(value):
    return re.sub(r"\s+", "", re.sub(r"^(?:NAME|V\*|\*\*|\*)\s+", "", value)).casefold()


def csv_rows(path):
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def spectral_labels(row):
    spectrum = row.get("spectral_type") or ""
    if row["type"] in {"brown_dwarf", "sub_brown_dwarf"}:
        match = re.match(r"([LTY])\d", spectrum)
        return [f"{match[1]}-type"] if match else []
    if row["type"] != "star":
        return []
    labels = []
    if re.search(r"(?:^|\+)W[NCOR]\d", spectrum):
        labels.append("Wolf–Rayet")
    # Only unambiguous luminosity classes; never assume a class for a bare spectrum.
    if re.search(r"[OBAFGKM]\d(?:\.\d)?(?:Iab|Ia|Ib|I)(?![IV])", spectrum):
        labels.append("Supergiant")
    elif re.search(r"[OBAFGKM]\d(?:\.\d)?III(?![IV])", spectrum):
        labels.append("Giant")
    elif re.search(r"[OBAFGKM]\d(?:\.\d)?IV(?![IV])", spectrum):
        labels.append("Subgiant")
    elif re.search(r"[OBAFGKM]\d(?:\.\d)?V(?!I)", spectrum):
        labels.append("Main-sequence")
    return labels


def build():
    manifest = json.loads((WORK / "source-manifest.json").read_text())
    for name, expected in manifest["checksumsSha256"].items():
        if hashlib.sha256((WORK / name).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Source checksum mismatch: {name}")
    identities = json.loads((ROOT / "src/data/object-designations.json").read_text())["objects"]
    inventory = {}
    for path in [ROOT / "src/data/stars.csv", *sorted((ROOT / "src/data/catalogs").glob("*/stars.csv"))]:
        for row in csv_rows(path):
            inventory.setdefault(row["id"], row)
    for path in sorted((ROOT / "src/data/overlays").glob("*/objects.json")):
        for row in json.loads(path.read_text())["objects"]:
            inventory.setdefault(row["id"], row)
    types = defaultdict(set)
    for source in csv_rows(WORK / "simbad.csv"):
        types[key(source["main_id"])].update([source["otype"], source["subtype"]])
    aliases = defaultdict(set)
    for identifier, entry in identities.items():
        main = entry.get("simbadId")
        if main and inventory[identifier]["type"] in STELLAR:
            for alias in [entry["name"], main, *entry["designations"]]:
                aliases[key(alias)].add(key(main))
    hosts = defaultdict(set)
    host_matches = defaultdict(list)
    withheld_hosts = set()
    unmatched = []
    for host in csv_rows(WORK / "planet-hosts.csv"):
        matches = set()
        for field in ["hostname", "gaia_dr3_id", "gaia_dr2_id", "hd_name", "hip_name", "tic_id"]:
            candidates = aliases.get(key(host[field]), set()) if host[field] else set()
            if len(candidates) == 1:
                matches.update(candidates)
        if len(matches) != 1:
            withheld_hosts.update(matches)
            unmatched.append(host["hostname"])
            continue
        main = next(iter(matches))
        # Circumbinary planets cannot be assigned to either individual star.
        if host["cb_flag"] == "1":
            withheld_hosts.add(main)
            continue
        hosts[main].add(host["pl_name"])
        host_matches[main].append(host["hostname"])
    objects = {}
    for identifier, row in sorted(inventory.items()):
        main = identities[identifier].get("simbadId")
        codes = sorted(types.get(key(main), set())) if main else []
        labels = [LABELS[code] for code in codes if code in LABELS]
        # Candidate classes stay explicitly tentative.
        labels.extend(LABELS[code[:-1] + "*"] + " candidate" for code in codes
                      if code.endswith("?") and code[:-1] + "*" in LABELS)
        labels.extend(spectral_labels(row))
        labels = list(dict.fromkeys(labels))
        if "Supergiant" in labels and any(label in labels for label in ["Red supergiant", "Yellow supergiant", "Blue supergiant", "Evolved supergiant"]):
            labels.remove("Supergiant")
        if row["type"] == "pulsar":
            labels = [label for label in labels if label not in {"Pulsar", "Neutron star"}]
        elif row["type"] == "neutron_star":
            labels = [label for label in labels if label != "Neutron star"]
        if "Wolf–Rayet" in labels:
            labels.remove("Wolf–Rayet")
            labels.insert(0, "Wolf–Rayet")
        # Specialized variability classes already imply Variable star.
        if "Variable star" in labels and any("variable" in label.lower() and label != "Variable star" for label in labels):
            labels.remove("Variable star")
        counts = hosts.get(key(main), set()) if main else set()
        known = len(counts) if counts else None
        if identifier == "sun":
            known = 8
        elif main and key(main) in withheld_hosts:
            known = None
        elif not counts and main and row["type"] in STELLAR and key(main) in types:
            known = 0
        objects[identifier] = {"subtypes": labels, "known_planets": known,
                               "simbadId": main, "sourceTypes": codes,
                               "planetHosts": sorted(set(host_matches.get(key(main), []))) if main else []}
    return {"schemaVersion": 1, "retrieved": manifest["retrieved"],
            "policy": "Exact reviewed SIMBAD identities and unique exact NASA host identifiers. Count distinct confirmed pscomppars planet rows per host, never system sy_pnum on stellar companions; circumbinary counts withheld. Zero means no confirmed host match in this archive snapshot, not absence of planets. Unresolved identities remain null. Apparent Johnson V is generated per row from reviewed absolute V and adopted distance; no blended flux substitution. Sun: eight planets and apparent V -26.74 (NASA Sun fact sheet).",
            "sources": manifest["sources"], "sourceChecksumsSha256": manifest["checksumsSha256"],
            "unmatchedArchiveHosts": sorted(set(unmatched)), "objects": objects}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    payload = build()
    content = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    if args.check:
        if OUTPUT.read_text() != content:
            raise SystemExit("Object stats differ; regenerate after reviewing inputs.")
    else:
        OUTPUT.write_text(content)
    objects = payload["objects"]
    print(f"{len(objects)} objects; {sum(bool(row['subtypes']) for row in objects.values())} classified; "
          f"{sum(row['known_planets'] is not None for row in objects.values())} with planet-count coverage; "
          f"{sum(bool(row['known_planets']) for row in objects.values())} planet hosts")
