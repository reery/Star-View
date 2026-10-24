"""Storage precision for calculated catalog values, never source measurements."""

import math


def calculated_float(value: float) -> float:
    """Keep nine decimal places for derived magnitudes, distances and angles.

    Platform libm functions may differ in their final binary digits. Normalize
    these calculations before storing them in JSON or comparing reviewed
    replacements. Do not recursively round payloads: source values, errors and
    frozen provenance must retain their original precision.
    """
    if not math.isfinite(value):
        raise ValueError("Calculated catalog values must be finite")
    rounded = round(value, 9)
    return 0.0 if rounded == 0 else rounded
