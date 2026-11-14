"""Explicitly freeze SIMBAD classifications, NASA confirmed-planet hosts and GCVS variability types.

This acquisition is separate from offline application builds.
"""

import argparse
import csv
import hashlib
import io
import json
import ssl
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

from catalog_sources.filesystem import write_managed_files

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/object-stats"
SIMBAD = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"
NASA = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
GCVS_TABLE = "B/gcvs/gcvs_cat"


def query(url, adql):
    context = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
    parameters = urllib.parse.urlencode({"request": "doQuery", "lang": "adql", "format": "csv", "query": adql})
    try:
        with urllib.request.urlopen(url + "?" + parameters, context=context, timeout=55) as response:
            result = response.read().decode()
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()[:2000]) from error
    if result.lstrip().startswith("<"):
        raise ValueError(result[:1000])
    return result


def refresh(retrieved, planets_only=False):
    WORK.mkdir(parents=True, exist_ok=True)
    identities = json.loads((ROOT / "src/data/object-designations.json").read_text())["objects"]
    names = sorted({entry["simbadId"] for entry in identities.values() if entry.get("simbadId")})
    records = []
    queries = []
    # Small batches avoid proxy URL limits; exact reviewed identities only.
    for start in range(0, len(names) if not planets_only else 0, 80):
        values = ",".join("'" + name.replace("'", "''") + "'" for name in names[start:start + 80])
        adql = ("SELECT basic.main_id,basic.otype,otypes.otype AS subtype FROM basic "
                "LEFT OUTER JOIN otypes ON basic.oid=otypes.oidref "
                f"WHERE basic.main_id IN ({values}) ORDER BY main_id")
        queries.append(adql)
        records.extend(csv.DictReader(io.StringIO(query(SIMBAD, adql))))
        print(f"SIMBAD: {min(start + 80, len(names))}/{len(names)} identities", flush=True)
    if not planets_only:
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=["main_id", "otype", "subtype"])
        writer.writeheader()
        writer.writerows(records)
        adql = "SELECT otype,description FROM otypedef ORDER BY otype"
        files = {"simbad.csv": buffer.getvalue(), "simbad.adql": "\n\n".join(queries) + "\n",
                 "types.csv": query(SIMBAD, adql), "types.adql": adql + "\n"}
    else:
        # Planet-only refreshes keep the frozen SIMBAD files unchanged.
        files = {name: (WORK / name).read_text() for name in ["simbad.csv", "simbad.adql", "types.csv", "types.adql"]}
    adql = ("SELECT hostname,pl_name,hd_name,hip_name,tic_id,gaia_dr2_id,gaia_dr3_id,cb_flag "
            "FROM pscomppars ORDER BY pl_name")
    files["planet-hosts.csv"] = query(NASA, adql)
    files["planet-hosts.adql"] = adql + "\n"
    # GCVS is frozen separately (--gcvs) and carried over unchanged.
    if (WORK / "gcvs.csv").exists():
        files["gcvs.csv"] = (WORK / "gcvs.csv").read_text()
    manifest = {"retrieved": retrieved, "sources": {"simbad": SIMBAD, "planets": NASA},
                "checksumsSha256": {name: hashlib.sha256(content.encode()).hexdigest() for name, content in files.items()}}
    files["source-manifest.json"] = json.dumps(manifest, indent=2) + "\n"
    # Publish only after every request succeeded, so a failure never leaves a mixed snapshot.
    write_managed_files(WORK, files, force=True)
    print(f"Frozen {len(records)} classifications and NASA planet-host snapshot.")


def freeze_gcvs(retrieved, vizier_url):
    """The complete GCVS name and variability-type columns, through VizieR ASU (official mirrors serve it too)."""
    url = f"{vizier_url}/viz-bin/asu-tsv?" + urllib.parse.urlencode({"-source": GCVS_TABLE, "-out": "GCVS,VarType", "-out.max": "unlimited"}, safe="/,")
    with urllib.request.urlopen(url, context=ssl.create_default_context(cafile="/etc/ssl/cert.pem"), timeout=300) as response:
        lines = [line for line in response.read().decode().splitlines() if line and not line.startswith("#")]
    if lines[0].split("\t") != ["GCVS", "VarType"]:
        raise ValueError(f"Unexpected GCVS columns: {lines[0]}")
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(["name", "type"])
    writer.writerows([" ".join(name.split()), kind.strip()] for name, kind in (line.split("\t") for line in lines[3:]))
    manifest = json.loads((WORK / "source-manifest.json").read_text())
    manifest["checksumsSha256"]["gcvs.csv"] = hashlib.sha256(buffer.getvalue().encode()).hexdigest()
    manifest["sources"]["gcvs"] = url
    manifest["extensions"] = [entry for entry in manifest.get("extensions", []) if entry.get("files") != ["gcvs.csv"]] + [
        {"retrieved": retrieved, "source": url, "files": ["gcvs.csv"],
         "note": "General Catalogue of Variable Stars (Samus et al. 2017, 2017ARep...61...80S): every name with its variability type."}]
    write_managed_files(WORK, {"gcvs.csv": buffer.getvalue(), "source-manifest.json": json.dumps(manifest, indent=2) + "\n"}, force=True)
    print(f"Frozen {buffer.getvalue().count(chr(10)) - 1} GCVS variables.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--retrieved", required=True)
    parser.add_argument("--planets-only", action="store_true")
    parser.add_argument("--gcvs", action="store_true", help="freeze only the GCVS variability types")
    parser.add_argument("--vizier-url", default="https://vizier.cds.unistra.fr", help="VizieR host or official mirror (--gcvs)")
    arguments = parser.parse_args()
    if arguments.gcvs:
        freeze_gcvs(arguments.retrieved, arguments.vizier_url)
    else:
        refresh(arguments.retrieved, arguments.planets_only)
