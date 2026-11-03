"""Refresh network-backed authoring inputs; never called by application builds."""

import argparse
import json
from pathlib import Path

from catalog_sources.acquisition import DEFAULT_NETWORK_TIMEOUT_SECONDS, SIMBAD_TAP_URL, acquire_naked_eye_stars, acquire_nearest1000, acquire_nearest5000, acquire_physical_supplements

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("catalog", choices=("nearest-1000", "nearest-5000", "naked-eye-stars", "physical-supplements"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--retrieved", required=True, help="Explicit ISO date recorded in the snapshot")
    parser.add_argument("--buffer-size", type=int, default=1100)
    parser.add_argument("--timeout", type=float, default=DEFAULT_NETWORK_TIMEOUT_SECONDS, help="Per-operation network timeout in seconds")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--simbad-url", default=SIMBAD_TAP_URL, help="SIMBAD TAP endpoint or official mirror (naked-eye-stars)")
    arguments = parser.parse_args()
    if not arguments.timeout > 0:
        parser.error("--timeout must be positive")
    if arguments.catalog == "naked-eye-stars":
        manifest = acquire_naked_eye_stars(arguments.output, arguments.retrieved, arguments.force, arguments.timeout, arguments.simbad_url)
    elif arguments.catalog == "physical-supplements":
        manifest = acquire_physical_supplements(arguments.output, arguments.retrieved, ROOT, arguments.force, arguments.timeout)
    elif arguments.catalog == "nearest-5000":
        manifest = acquire_nearest5000(arguments.output, arguments.retrieved, ROOT, arguments.force, arguments.timeout)
    else:
        manifest = acquire_nearest1000(arguments.output, arguments.retrieved, arguments.buffer_size, arguments.force, arguments.timeout)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()