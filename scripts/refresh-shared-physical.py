"""Explicit acquisition of physical literature for the union of stellar catalogs.

Application builds remain offline. Raw measurements, exact query IDs and query
text are frozen before any authoring decision is made.
"""

import argparse
import csv
import io
import json
import re
import tempfile
import urllib.error
from pathlib import Path

from catalog_sources.acquisition import SIMBAD_TAP_URL, VIZIER_TAP_URL, _quoted, _tap_query
from catalog_sources.filesystem import write_managed_files
from catalog_sources.snapshots import sha256

ROOT = Path(__file__).resolve().parents[1]
INPUTS = [ROOT / f"catalog-work/{name}/simbad.csv" for name in
          ("nearest-1000", "bright-stars", "western-constellation-stars", "famous-cluster-stars")]


def queries():
    identities, hips = set(), set()
    for path in INPUTS:
        for row in csv.DictReader(path.open()):
            identities.add(" ".join(row["main_id"].split()))
            hips.update(int(alias.split()[1]) for alias in row.get("ids", "").split("|")
                        if re.fullmatch(r"HIP \d+", alias.strip()))
    # Bright-star source rows have no aliases, but their literature subsets do.
    for name in ("fundamental", "sed"):
        hips.update(int(row["hip"]) for row in csv.DictReader(
            (ROOT / f"catalog-work/bright-stars/{name}.csv").open()))
    identifiers = sorted(identities)
    spectroscopy = [
        "SELECT b.main_id,m.teff,m.log_g,m.fe_h,m.bibcode,m.mespos FROM basic AS b "
        "JOIN mesFe_h AS m ON b.oid=m.oidref WHERE b.main_id IN ("
        + _quoted(identifiers[start:start + 200]) + ") ORDER BY main_id,mespos"
        for start in range(0, len(identifiers), 200)
    ]
    hip_list = ",".join(map(str, sorted(hips)))
    return {
        "spectroscopy": (SIMBAD_TAP_URL, spectroscopy),
        "fundamental": (VIZIER_TAP_URL, [
            'SELECT HIP,Mass,e_Mass,logRad,e_logRad,logTeff,e_logTeff FROM "J/A+A/352/555/table1" '
            f"WHERE HIP IN ({hip_list}) ORDER BY HIP"]),
        "sed": (VIZIER_TAP_URL, [
            'SELECT HIP,Dist,eDist,Teff,Lum FROM "J/MNRAS/427/343/table2" '
            f"WHERE HIP IN ({hip_list}) ORDER BY HIP"]),
    }, len(identities), len(hips)


def acquire(output, retrieved, timeout, force):
    source_queries, identity_count, hip_count = queries()
    if (output / "source-manifest.json").exists() and not force:
        raise FileExistsError("Shared snapshot exists; use --force for an intentional refresh")
    files, counts = {}, {}
    with tempfile.TemporaryDirectory(prefix="star-view-shared-physical-") as directory:
        for name, (url, batches) in source_queries.items():
            rows, header = [], None
            for index, query in enumerate(batches):
                target = Path(directory) / f"{name}-{index}.csv"
                try:
                    _tap_query(url, query, target, timeout)
                except urllib.error.HTTPError as error:
                    raise RuntimeError(error.read().decode("utf-8", errors="replace")) from error
                reader = csv.reader(io.StringIO(target.read_text()))
                batch_header = next(reader)
                if header is not None and batch_header != header:
                    raise ValueError(f"Inconsistent {name} query columns")
                header = batch_header
                rows.extend(reader)
                print(f"{name}: batch {index + 1}/{len(batches)}, {len(rows)} rows", flush=True)
            stream = io.StringIO()
            writer = csv.writer(stream, lineterminator="\n")
            writer.writerow(header)
            writer.writerows(rows)
            files[f"{name}.csv"] = stream.getvalue()
            files[f"{name}.adql"] = "\n".join(batches) + "\n"
            counts[name] = len(rows)
        # Hash staged data, never partially publish a source package.
        for filename, content in files.items():
            (Path(directory) / filename).write_text(content)
        manifest = {
            "schemaVersion": 1, "retrieved": retrieved,
            "identityPolicy": "Union of exact frozen SIMBAD main IDs and unique HIP aliases; no positional matching",
            "identityCount": identity_count, "hipCount": hip_count, "rowCounts": counts,
            "inputChecksumsSha256": {str(path.relative_to(ROOT)): sha256(path) for path in INPUTS},
            "sources": {name: {"url": url, "queryFile": f"{name}.adql"}
                        for name, (url, _) in source_queries.items()},
            "checksumsSha256": {filename: sha256(Path(directory) / filename) for filename in files},
        }
        files["source-manifest.json"] = json.dumps(manifest, indent=2) + "\n"
        write_managed_files(output, files, force)
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "catalog-work/shared-enrichment/literature")
    parser.add_argument("--retrieved", required=True)
    parser.add_argument("--timeout", type=float, default=60)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error("--timeout must be positive")
    print(json.dumps(acquire(args.output, args.retrieved, args.timeout, args.force), indent=2))
