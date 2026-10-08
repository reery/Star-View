"""Freeze and build nearby exoplanets; normal builds remain offline."""

import argparse
import csv
import hashlib
import html
import io
import json
import math
import re
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NASA = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
WORK = ROOT / "catalog-work/nearby-planets"
OUTPUT = ROOT / "src/data/nearby-planets.json"
FIELDS = ["pl_rade", "pl_bmasse", "pl_dens", "pl_eqt", "pl_insol", "pl_orbsmax",
          "pl_orbper", "pl_orbeccen", "pl_orbincl", "pl_imppar", "pl_trandep",
          "pl_trandur", "pl_ratdor", "pl_ratror", "pl_occdep", "pl_rvamp",
          "pl_projobliq", "pl_trueobliq"]


def query(url, adql):
    parameters = urllib.parse.urlencode({"request": "doQuery", "lang": "adql", "format": "csv", "query": adql})
    context = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
    with urllib.request.urlopen(url + "?" + parameters, context=context, timeout=55) as response:
        content = response.read().decode()
    if content.lstrip().startswith("<"):
        raise ValueError(content[:1000])
    return content


def inventory():
    stars = {}
    for catalog in ["nearest-100", "nearest-1000"]:
        with (ROOT / f"src/data/catalogs/{catalog}/stars.csv").open() as handle:
            for row in csv.DictReader(handle):
                stars.setdefault(row["id"], row)
    stats = json.loads((ROOT / "src/data/object-stats.json").read_text())["objects"]
    return {identifier: (row, stats[identifier]) for identifier, row in stars.items()
            if identifier != "sun" and stats[identifier]["known_planets"]}


def refresh(retrieved):
    hosts = sorted({host for _, stats in inventory().values() for host in stats["planetHosts"]})
    columns = ["hostname", "pl_name", "pl_bmassprov", "cb_flag", "pl_controv_flag",
               "discoverymethod", "disc_year", "disc_facility", "disc_refname"]
    for field in FIELDS:
        columns.extend([field, field + "err1", field + "err2", field + "lim", field + "_reflink"])
    quoted = ",".join("'" + host.replace("'", "''") + "'" for host in hosts)
    adql = f"SELECT {','.join(columns)} FROM pscomppars WHERE hostname IN ({quoted}) ORDER BY pl_name"
    content = query(NASA, adql)
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "planets.csv").write_text(content)
    (WORK / "planets.adql").write_text(adql + "\n")
    manifest = {"retrieved": retrieved, "source": NASA,
                "checksumsSha256": {name: hashlib.sha256((WORK / name).read_bytes()).hexdigest()
                                    for name in ["planets.csv", "planets.adql"]}}
    (WORK / "source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def numeric(value):
    if value == "":
        return None
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Non-finite archive value")
    return result


def reference(value):
    match = re.search(r'href\s*=\s*(?:"([^"]+)"|\'([^\']+)\'|([^\s>]+))', value, re.I)
    label = html.unescape(re.sub(r"<[^>]*>", "", value)).strip()
    url = html.unescape(next(group for group in match.groups() if group is not None)) if match else None
    if url and url.startswith("/"):
        url = "https://exoplanetarchive.ipac.caltech.edu" + url
    if url and not url.startswith(("https://", "http://")):
        url = None
    return {"label": label, "url": url}


def build():
    manifest = json.loads((WORK / "source-manifest.json").read_text())
    for name, expected in manifest["checksumsSha256"].items():
        if hashlib.sha256((WORK / name).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Checksum mismatch: {name}")
    with (WORK / "planets.csv").open() as handle:
        rows = list(csv.DictReader(handle))
    systems, planets = [], []
    ids = set()
    for host_id, (star, stats) in inventory().items():
        members = [row for row in rows if row["hostname"] in stats["planetHosts"] and row["cb_flag"] == "0"]
        if len(members) != stats["known_planets"]:
            raise ValueError(f"Planet count changed for {host_id}; review host snapshot")
        system_planets = []
        for row in members:
            identifier = "exo-" + re.sub(r"[^a-z0-9]+", "-", row["pl_name"].lower()).strip("-")
            if identifier in ids:
                raise ValueError(f"Duplicate planet: {identifier}")
            ids.add(identifier)
            metrics = {}
            for field in FIELDS:
                value = numeric(row[field])
                if value is None:
                    continue
                source = reference(row[field + "_reflink"])
                metrics[field] = {"value": value, "errorPlus": numeric(row[field + "err1"]),
                                  "errorMinus": numeric(row[field + "err2"]),
                                  "limit": int(row[field + "lim"] or 0), "source": source,
                                  "estimated": "calculat" in source["label"].lower()}
            distance = metrics.get("pl_orbsmax")
            color = "#aaa19b"
            planets.append({"kind": "extrasolar", "id": identifier, "name": row["pl_name"],
                            "hostStarId": host_id, "hostName": star["name"], "color": color,
                            "massProvenance": row["pl_bmassprov"], "controversial": row["pl_controv_flag"] == "1",
                            "discoveryMethod": row["discoverymethod"], "discoveryYear": int(row["disc_year"]),
                            "discoveryFacility": row["disc_facility"], "discoverySource": reference(row["disc_refname"]),
                            "metrics": metrics})
            system_planets.append({"id": identifier, "name": row["pl_name"], "color": color,
                                   "semiMajorAxisAu": distance["value"] if distance else None,
                                   "distanceKind": "projected" if row["discoverymethod"] == "Imaging" else "semi-major-axis",
                                   "distanceLimit": distance["limit"] if distance else 0})
        system_planets.sort(key=lambda planet: planet["semiMajorAxisAu"] if planet["semiMajorAxisAu"] is not None else math.inf)
        systems.append({"hostStarId": host_id, "name": star["name"], "source": {
            "label": "NASA Exoplanet Archive", "url": "https://exoplanetarchive.ipac.caltech.edu/docs/pscp_about.html",
            "epoch": manifest["retrieved"], "note": "Composite published parameters; values may come from different studies. Distances are approximate orbital sizes or projected separations for imaging discoveries, not current positions."},
            "planets": system_planets})
    return {"schemaVersion": 1, "retrieved": manifest["retrieved"], "sourceChecksumsSha256": manifest["checksumsSha256"],
            "systems": systems, "planets": planets}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--retrieved")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.refresh:
        if not args.retrieved:
            parser.error("--refresh requires --retrieved")
        refresh(args.retrieved)
    payload = build()
    content = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    if args.check:
        if OUTPUT.read_text() != content:
            raise SystemExit("Nearby planet data differs; regenerate after review")
    else:
        OUTPUT.write_text(content)
    print(f"{len(payload['systems'])} hosts; {len(payload['planets'])} planets")
