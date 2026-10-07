"""Extract the physical columns of the published Montréal cooling sequences.

Usage: python3 scripts/extract-white-dwarf-references.py /path/to/AllSequences.tar.gz
Source: https://www.astro.umontreal.ca/~bergeron/CoolingModels/
"""

import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile

archive_path = Path(sys.argv[1])
tracks = []
with tarfile.open(archive_path) as archive:
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
    "source": "https://www.astro.umontreal.ca/~bergeron/CoolingModels/",
    "citation": "https://www.astro.umontreal.ca/~bergeron/CoolingModels/Bedard2020.pdf",
    "version": "2020-08-18",
    "downloaded": "2026-10-07",
    "archive_sha256": hashlib.sha256(archive_path.read_bytes()).hexdigest(),
    "columns": ["temperature_k", "radius_cm", "luminosity_erg_s"],
    "tracks": tracks,
}
destination = Path(__file__).resolve().parents[1] / "src/data/white-dwarf-references.json"
# Compact rows keep the snapshot small without rounding source values.
destination.write_text(json.dumps(data, separators=(",", ":")) + "\n")
print(f"Wrote {len(tracks)} tracks, {sum(len(track['rows']) for track in tracks)} model points to {destination}")
