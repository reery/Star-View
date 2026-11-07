"""Find SB9 spectroscopic orbits by exact catalog identity, never by position."""
import collections

FILES = ("Main.dta", "Orbits.dta", "Alias.dta", "ReadMe.txt")
# SB9 alias catalogs whose identifiers have the same form in SIMBAD.
PREFIXES = {"HIP": "HIP {}", "HD": "HD {}", "HR": "HR {}", "BD": "BD{}", "CD": "CD{}", "CPD": "CPD{}",
            "GAIADR3": "Gaia DR3 {}", "GJ": "GJ {}", "GCVS": "V* {}", "Misc": "{}"}


def rows(path):
    return [line.split("|") for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def orbit_record(row):
    # Some SB9 rows omit their trailing empty fields.
    orbit = row + [""] * (26 - len(row))
    return {"orbit": orbit[1], "periodDays": orbit[2], "periodErrorDays": orbit[3] or None, "periastron": orbit[4] or None, "periastronFlag": orbit[6] or None,
            "k1Kms": orbit[11], "k2Kms": orbit[13] or None, "eccentricity": orbit[7], "eccentricityError": orbit[8] or None,
            "argumentDeg": orbit[9] or None, "argumentErrorDeg": orbit[10] or None, "systemicKms": orbit[15] or None, "systemicErrorKms": orbit[16] or None,
            "grade": orbit[21] or None, "bibcode": orbit[22], "timeReference": orbit[25].strip() or None}


def sb9_orbits(directory):
    orbits = collections.defaultdict(list)
    for row in rows(directory / "Orbits.dta"):
        orbits[row[0]].append(orbit_record(row))
    return orbits


def best_orbit(orbits):
    """Most accurate solution: SB9 grade, then fractional period error, then the newer paper."""
    def period_error(orbit):
        try:
            return float(orbit["periodErrorDays"]) / float(orbit["periodDays"])
        except (TypeError, ValueError, ZeroDivisionError):
            return float("inf")
    def grade(orbit):
        return int(orbit["grade"]) if (orbit["grade"] or "").isdigit() else -1
    return min(orbits, key=lambda orbit: (-grade(orbit), period_error(orbit), [-ord(c) for c in orbit["bibcode"][:4]]), default=None)


def sb9_systems(directory, identity_ids, identities):
    main = {row[0]: row for row in rows(directory / "Main.dta")}
    orbits, aliases = sb9_orbits(directory), collections.defaultdict(list)
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
            "doubleLined": any((orbit["k2Kms"] or "").strip() for orbit in orbits[number]),
            "orbits": orbits[number],
            "catalogIds": sorted(matched, key=lambda identifier: (identifier.startswith("hip-"), identifier)),
            "uniqueIdentity": len(simbad) <= 1})
    # One catalog object in several SB9 systems needs a reviewed component scope.
    counts = collections.Counter(identifier for result in results for identifier in result["catalogIds"])
    for result in results:
        result["uniqueIdentity"] &= all(counts[identifier] == 1 for identifier in result["catalogIds"])
    return results
