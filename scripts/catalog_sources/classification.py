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
SUPERGIANTS = {"Red supergiant", "Yellow supergiant", "Blue supergiant", "Evolved supergiant"}
PRE_MAIN_SEQUENCE = {"T Tauri", "Herbig Ae/Be", "Orion variable", "FU Orionis variable", "Young stellar object", "Pre-main-sequence"}
# Classes defined for a spectral range: Herbig Ae/Be, Delta Scuti, Beta Cephei, Alpha² CVn.
SPECTRAL_RANGE = {"Herbig Ae/Be": "BAF", "Delta Scuti variable": "AF", "Beta Cephei variable": "OB", "Alpha² CVn variable": "BAF",
                  "Cepheid variable": "FGK", "Classical Cepheid": "FGK", "Type II Cepheid": "FGK", "RR Lyrae variable": "AF", "Mira variable": "KM"}
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
    # Sub-classes (IIIb, Iab) and abundance notes (VFe-0.8, IIIFe-0.5, IIIBa0.5) follow the class directly.
    classes = set(re.findall(r"(?<![A-Za-z])(III|II|IV|I|VI|V)(?:ab|a|b)?(?![IVab])", re.sub(r"^[a-z]*[OBAFGKM][\d.]*", "", spectrum)))
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
    # A giant, subgiant or dwarf luminosity class rules out a supergiant class.
    if base in SUPERGIANTS and classes and classes <= {"III", "IV", "V", "VI"}:
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


# GCVS variability types (Samus et al. 2017) as card labels; a trailing ":" marks an uncertain type.
GCVS_TYPES = {
    **dict.fromkeys(("DCEP", "DCEPS", "DCEP(B)", "DCEPS(B)"), "Classical Cepheid"), **dict.fromkeys(("CEP", "CEP(B)"), "Cepheid variable"),
    **dict.fromkeys(("CW", "CWA", "CWB"), "Type II Cepheid"), **dict.fromkeys(("RR", "RRAB", "RRC", "RR(B)"), "RR Lyrae variable"),
    "M": "Mira variable", **dict.fromkeys(("SR", "SRA", "SRB", "SRC", "SRD", "SRS"), "Semiregular variable"),
    **dict.fromkeys(("L", "LB", "LC"), "Irregular variable"), **dict.fromkeys(("DSCT", "DSCTC"), "Delta Scuti variable"),
    **dict.fromkeys(("BCEP", "BCEPS"), "Beta Cephei variable"), "GDOR": "Gamma Doradus variable",
    **dict.fromkeys(("ACV", "ACVO"), "Alpha² CVn variable"), "BY": "BY Draconis variable", "RS": "RS CVn variable",
    **dict.fromkeys(("UV", "UVN"), "Flare star"), **dict.fromkeys(("E", "EA", "EB", "EW"), "Eclipsing binary"),
    "ELL": "Ellipsoidal variable", "RCB": "R Coronae Borealis variable", **dict.fromkeys(("RV", "RVA", "RVB"), "RV Tauri variable"),
    "FU": "FU Orionis variable", "GCAS": "Eruptive variable", **dict.fromkeys(("IN", "INA", "INB", "INT", "INS"), "Orion variable"),
    **dict.fromkeys(("N", "NA", "NB", "NC", "NL", "NR"), "Nova"), "ZAND": "Symbiotic star", "ROT": "Rotating variable",
}


def gcvs_labels(kind):
    """Card labels of a GCVS type, and whether GCVS firmly lists the star as constant. Alternatives (A|B) assign nothing."""
    labels, constant = [], False
    for part in kind.split("+"):
        code = part.removesuffix(":")
        # "CST:" is only a suspicion of constancy, too weak against later detections.
        if part == "CST":
            constant = True
        elif code == "CST":
            continue
        elif "|" not in code and code in GCVS_TYPES:
            labels.append(GCVS_TYPES[code] + (" candidate" if part.endswith(":") else ""))
    return labels, constant


def gcvs_contradicted(label, gcvs, constant):
    """A SIMBAD class that the star's GCVS entry rules out: any variability once GCVS lists the star as constant,
    or a pulsation class beside another one from GCVS."""
    base = label.removesuffix(" candidate")
    # Eclipses are often found after a GCVS "constant" entry (Delta Cas by Hipparcos); they stay.
    if constant:
        return base != "Eclipsing binary" and (base in PULSATING | VARIABLE_CLASSES or "variable" in base.lower())
    definite = {other for other in gcvs if other in PULSATING}
    # A broader GCVS class (CEP) still allows its subclasses (Type II Cepheid), and a broader SIMBAD class its GCVS subclass.
    related = {base} | IMPLIED_BY.get(base, set()) | {other for other in definite if base in IMPLIED_BY.get(other, set())}
    return base in PULSATING and bool(definite) and not related & definite


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
