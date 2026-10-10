"""Explicitly freeze SIMBAD classifications and NASA confirmed-planet hosts.

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
    manifest = {"retrieved": retrieved, "sources": {"simbad": SIMBAD, "planets": NASA},
                "checksumsSha256": {name: hashlib.sha256(content.encode()).hexdigest() for name, content in files.items()}}
    files["source-manifest.json"] = json.dumps(manifest, indent=2) + "\n"
    # Publish only after every request succeeded, so a failure never leaves a mixed snapshot.
    write_managed_files(WORK, files, force=True)
    print(f"Frozen {len(records)} classifications and NASA planet-host snapshot.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--retrieved", required=True)
    parser.add_argument("--planets-only", action="store_true")
    arguments = parser.parse_args()
    refresh(arguments.retrieved, arguments.planets_only)
