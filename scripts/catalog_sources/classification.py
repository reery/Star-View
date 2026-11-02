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
