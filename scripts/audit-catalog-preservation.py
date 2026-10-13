"""Reject record loss and known-to-missing regressions against a git baseline.

Changed, reviewed values may replace previous values. When component scope
prevents adoption, the original source record must remain explicitly retained.
Includes every bundled CSV, component values, nested astrometric errors and
previously retained sources. Does not run the test suite or access the network.
"""

import argparse
import csv
import io
import json
import subprocess
from pathlib import Path

from catalog_sources.preservation import lost_fields, pool_losses, reviewed_fields

ROOT = Path(__file__).resolve().parents[1]
POOL = "src/data/stellar-companions.json"


def audit(base):
    files = subprocess.run(["git", "ls-tree", "-r", "--name-only", base, "src/data"],
        cwd=ROOT, check=True, capture_output=True, text=True).stdout.splitlines()
    paths = [path for path in files if path == "src/data/stars.csv" or
             path.startswith("src/data/catalogs/") and path.endswith("/stars.csv")]
    previous = lambda path: subprocess.run(["git", "show", f"{base}:{path}"],
        cwd=ROOT, check=True, capture_output=True, text=True).stdout
    errors = []
    rows = 0
    retirements = json.loads((ROOT / "catalog-work/reviewed-data-retirements.json").read_text())["retirements"]
    reviewed = 0

    for path in paths:
        old = list(csv.DictReader(io.StringIO(previous(path))))
        new_path = ROOT / path
        new = {row["id"]: row for row in csv.DictReader(io.StringIO(new_path.read_text()))} if new_path.exists() else {}
        for record in old:
            rows += 1
            identifier = record["id"]
            if identifier not in new:
                errors.append(f"{path}/{identifier}: missing record")
                continue
            missing = lost_fields(record, new[identifier])
            remaining = reviewed_fields(path, identifier, record, new[identifier], missing, retirements)
            reviewed += len(missing) - len(remaining)
            missing = remaining
            if missing:
                errors.append(f"{path}/{identifier}: {', '.join(missing)}")
    old_pool = json.loads(previous(POOL))
    new_pool = json.loads((ROOT / POOL).read_text())
    rows += len(old_pool["stars"])
    pool_errors = pool_losses(old_pool, new_pool, retirements)
    reviewed += len(pool_losses(old_pool, new_pool, [])) - len(pool_errors)
    errors.extend(f"{POOL}/{error}" for error in pool_errors)
    return rows, errors, reviewed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="HEAD", help="Git revision before the data change (default HEAD)")
    args = parser.parse_args()
    rows, errors, reviewed = audit(args.base)
    if errors:
        raise SystemExit("Catalog preservation failed:\n" + "\n".join(errors))
    print(f"Catalog preservation: {rows} catalog/component records compared with {args.base}; no unexplained record/field loss; {reviewed} explicitly reviewed classification correction(s).")


if __name__ == "__main__":
    main()
