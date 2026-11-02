"""Find SB9 spectroscopic orbits by exact catalog identity, never by position."""
import collections

FILES = ("Main.dta", "Orbits.dta", "Alias.dta", "ReadMe.txt")
# SB9 alias catalogs whose identifiers have the same form in SIMBAD.
PREFIXES = {"HIP": "HIP {}", "HD": "HD {}", "HR": "HR {}", "BD": "BD{}", "CD": "CD{}", "CPD": "CPD{}",
            "GAIADR3": "Gaia DR3 {}", "GJ": "GJ {}", "GCVS": "V* {}", "Misc": "{}"}


def rows(path):
    return [line.split("|") for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def sb9_systems(directory, identity_ids, identities):
    main = {row[0]: row for row in rows(directory / "Main.dta")}
    orbits, aliases = collections.defaultdict(list), collections.defaultdict(list)
    for row in rows(directory / "Orbits.dta"):
        orbits[row[0]].append(row)
    for row in rows(directory / "Alias.dta"):
        aliases[row[0]].append((row[1], row[2].strip()))
    results = []
    for number, entry in main.items():
        names = {" ".join(PREFIXES[catalog].format(value).split()) for catalog, value in aliases[number] if catalog in PREFIXES}
        names |= {"GJ " + name[3:] for name in names if name.startswith("Gl ")}
        matched = set().union(*(identity_ids.get(name, set()) for name in names))
        if not matched:
            continue
        simbad = {identities.get(identifier, {}).get("simbadId") for identifier in matched} - {None}
        results.append({"sb9": number, "component": entry[3].strip(),
            "spectra": [entry[8].strip(), entry[9].strip()],
            "doubleLined": any(orbit[13].strip() for orbit in orbits[number]),
            "orbits": [{"orbit": orbit[1], "periodDays": orbit[2], "k1Kms": orbit[11], "k2Kms": orbit[13] or None,
                        "eccentricity": orbit[7], "grade": orbit[21] or None, "bibcode": orbit[22]} for orbit in orbits[number]],
            "catalogIds": sorted(matched, key=lambda identifier: (identifier.startswith("hip-"), identifier)),
            "uniqueIdentity": len(simbad) <= 1})
    # One catalog object in several SB9 systems needs a reviewed component scope.
    counts = collections.Counter(identifier for result in results for identifier in result["catalogIds"])
    for result in results:
        result["uniqueIdentity"] &= all(counts[identifier] == 1 for identifier in result["catalogIds"])
    return results
