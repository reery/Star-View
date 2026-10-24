"""Rebuild the Montréal white dwarf cooling grid in a disposable local cache.

The grid is needed only to regenerate src/data/white-dwarf-class-references.json
(`npm run catalog:white-dwarf-references`); it is never committed or shipped.
Usage: python3 scripts/extract-white-dwarf-references.py [/path/to/AllSequences.tar.gz]
Without a path, the archive is downloaded and checked against its recorded SHA-256.
"""

import hashlib
import io
import json
from pathlib import Path
import re
import sys
import tarfile
import urllib.request

SOURCE = "https://www.astro.umontreal.ca/~bergeron/CoolingModels/"
ARCHIVE_URL = SOURCE + "CoolingModels/AllSequences.tar.gz"
# Bédard et al. (2020) sequences, version 2020-08-18, first retrieved 2026-10-07.
ARCHIVE_SHA256 = "24aac73615f4ca1431b013af9ed6b64242c91c940a0a4bdeea2a60360d61bb0a"
ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "node_modules/.cache/star-view/white-dwarf-cooling-grid.json"

if len(sys.argv) > 1:
    archive_bytes = Path(sys.argv[1]).read_bytes()
else:
    from catalog_sources.acquisition import _ssl_context
    with urllib.request.urlopen(ARCHIVE_URL, timeout=120, context=_ssl_context()) as response:
        archive_bytes = response.read()
digest = hashlib.sha256(archive_bytes).hexdigest()
if digest != ARCHIVE_SHA256:
    raise SystemExit(f"Cooling-model archive changed: expected {ARCHIVE_SHA256}, received {digest}. Review the new release before adopting it.")

tracks = []
with tarfile.open(fileobj=io.BytesIO(archive_bytes)) as archive:
    for member in archive.getmembers():
        match = re.fullmatch(r"seq_(\d{3})_(thick|thin)\.txt", member.name)
        if not match:
            continue
        source = archive.extractfile(member).read()
        rows = []
        for line in source.decode("ascii").splitlines():
            if re.match(r"^\s+\d+\s", line):
                values = [float(value) for value in line.split()]
                assert len(values) == 6
                rows.append([values[1], values[3], values[5]])
        # Keep every original model point, sorted by increasing temperature.
        rows.reverse()
        assert all(a[0] < b[0] for a, b in zip(rows, rows[1:]))
        assert all(all(value > 0 for value in row) for row in rows)
        tracks.append({
            "mass_solar": int(match[1]) / 100,
            "envelope": match[2],
            "file": member.name,
            "sha256": hashlib.sha256(source).hexdigest(),
            "rows": rows,
        })

assert len(tracks) == 46
tracks.sort(key=lambda track: (track["envelope"], track["mass_solar"]))
data = {
    "source": SOURCE,
    "citation": SOURCE + "Bedard2020.pdf",
    "version": "2020-08-18",
    "archive_sha256": digest,
    "columns": ["temperature_k", "radius_cm", "luminosity_erg_s"],
    "tracks": tracks,
}
DESTINATION.parent.mkdir(parents=True, exist_ok=True)
DESTINATION.write_text(json.dumps(data, separators=(",", ":")) + "\n")
print(f"Wrote {len(tracks)} tracks, {sum(len(track['rows']) for track in tracks)} model points to {DESTINATION.relative_to(ROOT)}")
