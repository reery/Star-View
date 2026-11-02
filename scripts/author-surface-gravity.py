"""Adopt measured spectroscopic surface gravity (log g) for bundled stellar objects.

Values come from the frozen SIMBAD mesFe_h snapshots through exact SIMBAD
identities in object-designations.json; no positional matching. A SIMBAD record
shared by objects listed together in one catalog, such as unresolved components,
cannot be assigned to one of them and is withheld. Each value is one paper's
measurement, selected as the newest within 0.3 dex of a strict-majority median,
never an average.

SIMBAD's log_g column also holds grid points, mis-ingested quantities such as
negative values for nearby dwarfs, and constants that abundance analyses
assumed. Measurements outside the range plausible for the object's type and
luminosity class, and papers that report one value for nearly every star, are
therefore not candidates.

Run with --check to compare the checked-in file without writing it.
"""

import argparse
import csv
import json
import re
from pathlib import Path
from statistics import median, pstdev

from catalog_sources.classification import spectral_labels
from catalog_sources.enrichment import (EXTENSION, LITERATURE, SYSTEM_TYPES, consistent_spectroscopy, newest_spectroscopy,
                                        normalized_id, number, spectroscopy_index)
from catalog_sources.snapshots import sha256

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/data/surface-gravity.json"
CATALOGS = [ROOT / "src/data/stars.csv", *sorted((ROOT / "src/data/catalogs").glob("*/stars.csv"))]
COMPANIONS = ROOT / "src/data/stellar-companions.json"
DESIGNATIONS = ROOT / "src/data/object-designations.json"
RETIREMENTS = ROOT / "catalog-work/reviewed-data-retirements.json"
SIMBAD = [ROOT / f"catalog-work/{name}/simbad.csv" for name in
          ("nearest-1000", "nearest-5000", "bright-stars", "western-constellation-stars", "famous-cluster-stars")]
SPECTROSCOPY = [ROOT / LITERATURE / "spectroscopy.csv", ROOT / EXTENSION / "spectroscopy.csv"]
SYSTEM_SCOPE = "SIMBAD object as catalogued; unresolved spectra may be primary-dominated"
# Generous log g (cgs) ranges; they reject impossible values, not unusual stars.
TYPE_BOUNDS = {"star": (-1, 6.5), "white_dwarf": (6, 10), "brown_dwarf": (2.5, 6), "sub_brown_dwarf": (2.5, 6)}
CLASS_BOUNDS = {"Supergiant": (-1, 2.6), "Bright giant": (.5, 3.3), "Giant": (-.5, 3.9),
                "Subgiant": (2.8, 4.4), "Main-sequence": (3.5, 5.6), "Subdwarf": (4, 6.5)}
# K and M dwarfs cannot yet have left the main sequence; lower values are survey
# grid points or fit systematics. The margin keeps young stars.
DWARF_MINIMUM = {"K": 4.1, "M": 4.4}


def bounds(star):
    labels = spectral_labels(star)
    label = labels[0].removesuffix(" candidate") if labels else None
    luminosity, magnitude = number(star.get("luminosity_solar")), number(star.get("absolute_mag"))
    # Without a class, a star fainter than the Sun cannot be a giant.
    if star["type"] == "star" and not label and (luminosity is not None and luminosity <= 1 or magnitude is not None and magnitude >= 5):
        label = "Main-sequence"
    low, high = CLASS_BOUNDS.get(label) or TYPE_BOUNDS.get(star["type"]) or (None, None)
    spectrum = star.get("spectral_type") or ""
    # Late-M objects typed as brown dwarfs are held to the same floor unless flagged as low gravity.
    if label == "Main-sequence" or star["type"] in {"brown_dwarf", "sub_brown_dwarf"} and not re.search(r"[βγδ]|beta|gamma|delta", spectrum):
        low = max(low, DWARF_MINIMUM.get(re.sub(r"^(?:sd|d)", "", spectrum)[:1], low))
    return (low, high) if low is not None else None


def assumed_sources(spectra):
    """Papers that adopt one log g for nearly every star; such values are inputs, not measurements."""
    values = {}
    for observations in spectra.values():
        for item in observations:
            if (value := number(item.get("log_g"))) is not None:
                values.setdefault(item["bibcode"], []).append(value)
    return {bibcode for bibcode, items in values.items()
            if len(items) >= 15 and max(items.count(value) for value in set(items)) >= .85 * len(items)}


def objects():
    """Rows by id, and the catalogs each id appears in; an extending catalog counts with its base."""
    stars, catalogs = {}, {}
    for path in CATALOGS:
        manifest = path.with_name("catalog.json")
        catalog = json.loads(manifest.read_text()).get("extends") if manifest.exists() else None
        with path.open(newline="") as handle:
            for row in csv.DictReader(handle):
                stars.setdefault(row["id"], row)
                catalogs.setdefault(row["id"], set()).add(catalog or path.parent.name)
    for star in json.loads(COMPANIONS.read_text())["stars"]:
        stars.setdefault(star["id"], star)
        catalogs.setdefault(star["id"], set()).add("companions")
    return stars, catalogs


def build():
    designations = json.loads(DESIGNATIONS.read_text())["objects"]
    simbad_ids = {identifier: normalized_id(entry["simbadId"]) for identifier, entry in designations.items() if entry.get("simbadId")}
    owners = {}
    for identifier, simbad_id in simbad_ids.items():
        owners.setdefault(simbad_id, []).append(identifier)
    otypes = {}
    for path in SIMBAD:
        with path.open(newline="") as handle:
            for row in csv.DictReader(handle):
                otypes.setdefault(normalized_id(row["main_id"]), row.get("otype", ""))
    retired = {(entry["id"], entry["expectedPrevious"]) for entry in json.loads(RETIREMENTS.read_text())["retirements"]
               if entry["path"] == str(OUTPUT.relative_to(ROOT)) and entry["field"] == "log_g"}
    spectra = spectroscopy_index(True)
    assumed = assumed_sources(spectra)
    adopted, withheld = {}, {"shared-identity": 0, "conflicting": 0, "implausible": 0}
    stars, catalogs = objects()
    for identifier, star in sorted(stars.items()):
        simbad_id = simbad_ids.get(identifier)
        limits = bounds(star) if simbad_id else None
        observations = [item for item in spectra.get(simbad_id, []) if number(item.get("log_g")) is not None and item["bibcode"] not in assumed]
        if not limits or not observations:
            continue
        # One star listed by several catalogs keeps the value; components listed together do not.
        others = [owner for owner in owners[simbad_id] if owner != identifier]
        if any(catalogs.get(identifier, set()) & catalogs.get(owner, set()) for owner in others):
            withheld["shared-identity"] += 1
            continue
        observations = [item for item in observations if (identifier, item["log_g"]) not in retired]
        consistent = consistent_spectroscopy(observations, "log_g", star.get("spectral_type"), limits)
        if not consistent:
            plausible = any(limits[0] <= float(item["log_g"]) <= limits[1] for item in observations)
            withheld["conflicting" if plausible else "implausible"] += 1
            continue
        selected = newest_spectroscopy(consistent)
        papers = {}
        for item in consistent:
            papers.setdefault(item["bibcode"], []).append(float(item["log_g"]))
        entry = {"log_g": float(selected["log_g"]), "reference": selected["bibcode"],
                 "source_record_id": f"{simbad_id}:mesFe_h:{selected['mespos']}", "measurements": len(papers)}
        if len(papers) >= 3:
            # Spread between independent papers; SIMBAD lists no per-paper errors.
            entry["scatter_dex"] = round(pstdev(median(values) for values in papers.values()), 3)
        if otypes.get(simbad_id) in SYSTEM_TYPES:
            entry["scope"] = SYSTEM_SCOPE
        adopted[identifier] = entry
    inputs = [*CATALOGS, COMPANIONS, DESIGNATIONS, RETIREMENTS, *SIMBAD, *SPECTROSCOPY]
    data = {
        "schemaVersion": 1,
        "policy": " ".join(__doc__.split("\n\n")[1:3]).replace("\n", " "),
        "sourceChecksumsSha256": {str(path.relative_to(ROOT)): sha256(path) for path in inputs},
        "objects": adopted,
    }
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n", withheld


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    text, withheld = build()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != text:
            raise SystemExit("Surface gravity is stale. Run python3 scripts/author-surface-gravity.py.")
        return
    OUTPUT.write_text(text)
    print(f"{len(json.loads(text)['objects'])} objects with measured log g; withheld {withheld}")


if __name__ == "__main__":
    main()
