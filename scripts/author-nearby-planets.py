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

from catalog_sources.filesystem import atomic_write_text, write_managed_files

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
    """Hosts by catalog ID, plus later-catalog IDs whose exact archive hosts an earlier ID already covers."""
    names = {identifier: entry["name"] for identifier, entry in
             json.loads((ROOT / "src/data/object-designations.json").read_text())["objects"].items()}
    # Reviewed component records name the exact component the planets orbit.
    names.update({star["id"]: star["name"] for star in json.loads((ROOT / "src/data/stellar-companions.json").read_text())["stars"]})
    stats = json.loads((ROOT / "src/data/object-stats.json").read_text())["objects"]
    hosts, aliases, covered = {}, {}, {}
    for catalog in ["nearest-100", "nearest-1000", "nearest-5000", "western-constellation-stars"]:
        with (ROOT / f"src/data/catalogs/{catalog}/stars.csv").open() as handle:
            for row in csv.DictReader(handle):
                identifier = row["id"]
                if identifier == "sun" or identifier in hosts or identifier in aliases or not stats[identifier]["known_planets"]:
                    continue
                planet_hosts = stats[identifier]["planetHosts"]
                matches = {covered.get(host) for host in planet_hosts}
                if matches == {None}:
                    hosts[identifier] = ({"name": names.get(identifier, row["name"])}, stats[identifier])
                    covered.update({host: identifier for host in planet_hosts})
                elif len(matches) == 1 and stats[next(iter(matches))]["planetHosts"] == planet_hosts:
                    aliases[identifier] = next(iter(matches))
                else:
                    raise ValueError(f"Partial planet host overlap for {identifier}; review host identity")
    return hosts, aliases


def pulsar_inventory():
    """Planet-hosting pulsars from the compact overlay, under their display names."""
    names = json.loads((ROOT / "src/data/object-designations.json").read_text())["objects"]
    stats = json.loads((ROOT / "src/data/object-stats.json").read_text())["objects"]
    objects = json.loads((ROOT / "src/data/overlays/compact-remnants/objects.json").read_text())["objects"]
    return {item["id"]: ({"name": names.get(item["id"], item)["name"]}, stats[item["id"]]) for item in objects
            if item["type"] == "pulsar" and stats.get(item["id"], {}).get("known_planets")}


def refresh(retrieved, pulsars=False):
    """Query the archive; --pulsars refreshes only the separately frozen pulsar-host snapshot."""
    hosts = sorted({host for _, stats in (pulsar_inventory() if pulsars else inventory()[0]).values() for host in stats["planetHosts"]})
    columns = ["hostname", "pl_name", "pl_bmassprov", "cb_flag", "pl_controv_flag",
               "discoverymethod", "disc_year", "disc_facility", "disc_refname"]
    for field in FIELDS:
        columns.extend([field, field + "err1", field + "err2", field + "lim", field + "_reflink"])
    quoted = ",".join("'" + host.replace("'", "''") + "'" for host in hosts)
    adql = f"SELECT {','.join(columns)} FROM pscomppars WHERE hostname IN ({quoted}) ORDER BY pl_name"
    content = query(NASA, adql)
    prefix = "pulsar-planets" if pulsars else "planets"
    files = {f"{prefix}.csv": content, f"{prefix}.adql": adql + "\n"}
    manifest = json.loads((WORK / "source-manifest.json").read_text())
    manifest["pulsarsRetrieved" if pulsars else "retrieved"] = retrieved
    manifest["source"] = NASA
    manifest["checksumsSha256"].update({name: hashlib.sha256(value.encode()).hexdigest() for name, value in files.items()})
    files["source-manifest.json"] = json.dumps(manifest, indent=2) + "\n"
    write_managed_files(WORK, files, force=True)


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
    # Archive references occasionally carry legacy http:// links; publishers serve the same paths over HTTPS.
    if url and url.startswith("http://"):
        url = "https://" + url.removeprefix("http://")
    if url and not url.startswith("https://"):
        url = None
    return {"label": label, "url": url}


def build():
    manifest = json.loads((WORK / "source-manifest.json").read_text())
    for name, expected in manifest["checksumsSha256"].items():
        if hashlib.sha256((WORK / name).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Checksum mismatch: {name}")
    with (WORK / "planets.csv").open() as handle:
        rows = list(csv.DictReader(handle))
    stellar_hosts, aliases = inventory()
    hosts = list(stellar_hosts.items())
    if (WORK / "pulsar-planets.csv").exists():
        with (WORK / "pulsar-planets.csv").open() as handle:
            rows += list(csv.DictReader(handle))
        hosts += list(pulsar_inventory().items())
    systems, planets = [], []
    ids = set()
    for host_id, (star, stats) in hosts:
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
            "epoch": manifest["pulsarsRetrieved"] if host_id.startswith("psr-") else manifest["retrieved"], "note": "Composite published parameters; values may come from different studies. Distances are approximate orbital sizes or projected separations for imaging discoveries, not current positions."},
            "planets": system_planets})
    return {"schemaVersion": 1, "retrieved": manifest["retrieved"], "sourceChecksumsSha256": manifest["checksumsSha256"],
            "aliases": aliases, "systems": systems, "planets": planets}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--pulsars", action="store_true", help="With --refresh, query only planet-hosting pulsars")
    parser.add_argument("--retrieved")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.refresh:
        if not args.retrieved:
            parser.error("--refresh requires --retrieved")
        refresh(args.retrieved, args.pulsars)
    payload = build()
    content = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    if args.check:
        if OUTPUT.read_text() != content:
            raise SystemExit("Nearby planet data differs; regenerate after review")
    else:
        atomic_write_text(OUTPUT, content)
    print(f"{len(payload['systems'])} hosts; {len(payload['planets'])} planets")
