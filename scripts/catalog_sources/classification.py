"""Conservative physical labels from a record's own spectral classification."""

import re


def spectral_labels(row):
    spectrum = re.sub(r"\s+", "", row.get("spectral_type") or "")
    if row["type"] in {"brown_dwarf", "sub_brown_dwarf"}:
        match = re.match(r"([LTY])\d", spectrum)
        return [f"{match[1]}-type"] if match else []
    if row["type"] != "star":
        return []
    # An aggregate spectrum does not establish one star's evolutionary class.
    unknown_companion = spectrum.endswith("+") and not re.search(r"(?:Ia|f)\+$", spectrum)
    if re.search(r"\+(?:[OBAFGKMLTY]|D[A-Z]|W[NC])", spectrum) or unknown_companion:
        return []
    if re.match(r"W[NCOR]\d", spectrum):
        return ["Wolf–Rayet"]
    classes = {"I": "Supergiant", "Ia": "Supergiant", "Iab": "Supergiant", "Ib": "Supergiant",
               "II": "Bright giant", "III": "Giant", "IV": "Subgiant",
               "V": "Main-sequence", "VI": "Subdwarf"}
    # Temperature ranges can still have an explicit, unambiguous luminosity
    # class. Conversely IV-V / II/III are not exact evolutionary classes.
    luminosity = r"(Iab|Ia|Ib|III|IV|VII|VI|II|V|I)(?:ab|a|b)?"
    pattern = (r"[OBAFGKM]\d(?:\.\d+)?(?:[-/](?:[OBAFGKM])?\d(?:\.\d+)?)?"
               r"[m?:+-]*\(?" + luminosity + r"(?:[-/]" + luminosity + r")?\)?")
    for match in re.finditer(pattern, spectrum):
        tail = spectrum[match.end():]
        if re.match(r"(?:[-/](?:I|V)|[IV])", tail):
            continue
        label = classes.get(match[1])
        if match[2] and classes.get(match[2]) != label:
            continue
        if label:
            return [label + (" candidate" if "?" in spectrum or tail.startswith(":") else "")]
    return []


# SIMBAD secondary types also repeat literature misclassifications. Withhold a
# class the record's own type or spectrum rules out; sourceTypes keeps the code.
EVOLVED = {
    "Red giant", "Asymptotic giant branch", "Horizontal-branch", "Carbon star", "S-type star", "Symbiotic star",
    "Long-period variable", "Mira variable", "Semiregular variable", "Red supergiant", "Yellow supergiant",
    "Blue supergiant", "Evolved supergiant", "Cepheid variable", "Classical Cepheid", "Type II Cepheid",
    "RV Tauri variable", "RR Lyrae variable", "R Coronae Borealis variable", "Hot subdwarf", "Wolf–Rayet",
}
PRE_MAIN_SEQUENCE = {"T Tauri", "Herbig Ae/Be", "Orion variable", "FU Orionis variable", "Young stellar object", "Pre-main-sequence"}
# Classes defined for a spectral range: Herbig Ae/Be, Delta Scuti, Beta Cephei, Alpha² CVn.
SPECTRAL_RANGE = {"Herbig Ae/Be": "BAF", "Delta Scuti variable": "AF", "Beta Cephei variable": "OB", "Alpha² CVn variable": "BAF"}
INTERACTING = {"Cataclysmic variable", "Nova", "Symbiotic star", "X-ray binary", "Low-mass X-ray binary", "High-mass X-ray binary"}


def contradicted(label, row):
    """True when the record's own object type or single-star spectrum rules out a SIMBAD class."""
    base = label.removesuffix(" candidate")
    if row["type"] in {"white_dwarf", "brown_dwarf", "sub_brown_dwarf"}:
        return base in EVOLVED | PRE_MAIN_SEQUENCE | INTERACTING | set(SPECTRAL_RANGE) | {"Chemically peculiar"}
    if row["type"] != "star":
        return False
    # A bare trailing "+" only notes an unseen companion; a named second spectrum is composite.
    spectrum = re.sub(r"\s+", "", row.get("spectral_type") or "").removesuffix("+")
    if "+" in spectrum:
        return False
    match = re.match(r"(?:esd|usd|sd|d)?([OBAFGKMLTY])", spectrum)
    letter = match[1] if match else None
    classes = set(re.findall(r"(?<![A-Za-z])(?:I[abV]?|II|III|V|VI)(?![A-Za-z])", re.sub(r"^[a-z]*[OBAFGKM][\d.]*", "", spectrum)))
    magnitude, luminosity = (float(row[field]) if row.get(field) else None for field in ("absolute_mag", "luminosity_solar"))
    # Giants and subgiants are brighter than M_V = +5 and 0.1 solar luminosities.
    faint = magnitude is not None and magnitude > 5 or luminosity is not None and luminosity < 0.1
    dwarf = faint or bool(re.match(r"(?:esd|usd|sd|d)[OBAFGKM]", spectrum)) or (
        classes <= {"IV", "V", "VI"} and bool(classes & {"V", "VI"})
        # A G-M "dwarf" brighter than M_V = +4 has a doubtful class; do not judge it.
        and not (letter in {"G", "K", "M"} and magnitude is not None and magnitude < 4))
    # Hot subdwarfs are subluminous (M_V of about +3 to +6).
    if base == "Hot subdwarf" and magnitude is not None and magnitude < 2:
        return True
    if base in EVOLVED and dwarf:
        return True
    if base in SPECTRAL_RANGE and letter and letter not in SPECTRAL_RANGE[base]:
        return True
    if base == "Chemically peculiar" and dwarf and (letter in {"K", "M"} or faint):
        return True
    # Solar-type main-sequence stars in these catalogs are past the pre-main-sequence stage.
    return base in PRE_MAIN_SEQUENCE and letter in {"F", "G", "K"} and classes == {"V"}


# Labels that add nothing beside a more specific one, following the SIMBAD
# hierarchy and the VSX variability classes.
PULSATING = {
    "Cepheid variable", "Classical Cepheid", "Type II Cepheid", "RR Lyrae variable", "Delta Scuti variable",
    "Beta Cephei variable", "Gamma Doradus variable", "RV Tauri variable", "Long-period variable",
    "Mira variable", "Semiregular variable",
}
IMPLIED_BY = {
    "Supergiant": {"Red supergiant", "Yellow supergiant", "Blue supergiant", "Evolved supergiant"},
    "Giant": {"Red giant", "Asymptotic giant branch"},
    "Horizontal-branch": {"RR Lyrae variable"},
    "Emission-line star": {"Be star", "Herbig Ae/Be", "Wolf–Rayet"},
    "Chemically peculiar": {"Alpha² CVn variable", "R Coronae Borealis variable"},
    "Young stellar object": {"T Tauri", "Herbig Ae/Be", "Orion variable"},
    "X-ray binary": {"Low-mass X-ray binary", "High-mass X-ray binary"},
    "Cataclysmic variable": {"Nova"},
    "Neutron star": {"Pulsar"},
    "Cepheid variable": {"Classical Cepheid", "Type II Cepheid"},
    "Long-period variable": {"Mira variable", "Semiregular variable"},
    "Pulsating variable": PULSATING,
    "Rotating variable": {"Alpha² CVn variable", "BY Draconis variable", "RS CVn variable", "Ellipsoidal variable"},
    "Eruptive variable": {"Flare star", "FU Orionis variable", "Orion variable", "R Coronae Borealis variable"},
}
# Variable classes whose names do not say "variable".
VARIABLE_CLASSES = {"Classical Cepheid", "Type II Cepheid", "Eclipsing binary", "Nova", "Flare star"}


def implied(label, others):
    if label == "Variable star":
        return any(other in VARIABLE_CLASSES or "variable" in other.lower() and other != label for other in others)
    return bool(IMPLIED_BY.get(label, set()) & others)


def prune_subtypes(labels):
    """Drop a candidate once confirmed, and a broad class beside a more specific one that is at least as certain."""
    confirmed = {label for label in labels if not label.endswith(" candidate")}
    bases = {label.removesuffix(" candidate") for label in labels}
    return [label for label in labels if not (
        implied(label, confirmed) if label in confirmed
        else label.removesuffix(" candidate") in confirmed or implied(label.removesuffix(" candidate"), bases))]
