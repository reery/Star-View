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
