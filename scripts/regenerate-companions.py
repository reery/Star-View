"""Rebuild everything derived from the companion pool, in order, until the outputs stop changing.

These files hash each other, so a single pass can leave one of them stale.
"""
import hashlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STEPS = (["author-stellar-companions.py", "--write"], ["author-object-designations.py"], ["author-stellar-orbits.py"],
         ["author-surface-gravity.py"], ["author-top-lists.py"])
OUTPUTS = ("src/data/stellar-companions.json", "src/data/stellar-system-identities.json", "src/data/object-designations.json", "src/data/stellar-orbits.json",
           "src/data/surface-gravity.json", "src/data/top-lists.json", "catalog-work/star-systems/catalog-companions-audit.json",
           "catalog-work/star-systems/stellar-orbits-audit.json")
MAX_PASSES = 6


def fingerprint():
    return [hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in OUTPUTS]


def main():
    for attempt in range(1, MAX_PASSES + 1):
        before = fingerprint()
        for script, *arguments in STEPS:
            subprocess.run([sys.executable, str(ROOT / "scripts" / script), *arguments], cwd=ROOT, check=True)
        if fingerprint() == before:
            print(f"Companion outputs settled after {attempt} passes.")
            return
    raise SystemExit(f"Companion outputs did not settle after {MAX_PASSES} passes.")


if __name__ == "__main__":
    main()
