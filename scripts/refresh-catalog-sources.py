"""Refresh network-backed authoring inputs; never called by application builds."""

import argparse
import json
from pathlib import Path

from catalog_sources.acquisition import DEFAULT_NETWORK_TIMEOUT_SECONDS, acquire_nearest1000


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("catalog", choices=("nearest-1000",))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--retrieved", required=True, help="Explicit ISO date recorded in the snapshot")
    parser.add_argument("--buffer-size", type=int, default=1100)
    parser.add_argument("--timeout", type=float, default=DEFAULT_NETWORK_TIMEOUT_SECONDS, help="Per-operation network timeout in seconds")
    parser.add_argument("--force", action="store_true")
    arguments = parser.parse_args()
    if not arguments.timeout > 0:
        parser.error("--timeout must be positive")
    manifest = acquire_nearest1000(arguments.output, arguments.retrieved, arguments.buffer_size, arguments.force, arguments.timeout)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()