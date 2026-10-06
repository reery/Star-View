"""Abundance identifiers are source quantities, never interchangeable labels."""

KINDS = ("[M/H]", "[Fe/H]")


def metallicity_kind(quantity):
    matches = [kind for kind in KINDS if kind in (quantity or "")]
    if len(matches) != 1:
        raise ValueError(f"Metallicity requires one explicit source quantity: {quantity!r}")
    return matches[0]
