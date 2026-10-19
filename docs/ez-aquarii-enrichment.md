# EZ Aquarii component review, 18 October 2026

The three stable identities remain A = Aa, C = Ab (the inner 3.786516-day
pair), and outer B. The same adopted values reach the default, nearest-100,
nearest-1000 and effective companion records.

| Component | Dynamical mass (solar) | Absolute Johnson V | Spectral type |
| --- | --- | --- | --- |
| A / Aa | 0.1187 ± 0.0011 | 15.39 ± 0.07 | M5.5 V |
| B | 0.1145 ± 0.0012 | 15.64 ± 0.08 | M5.5: V |
| C / Ab | 0.0930 ± 0.0008 | 17.43 ± 0.40 | M7: V |

Masses are from [Ségransan et al. 2000, Table 3](https://arxiv.org/abs/astro-ph/0010585).
Magnitudes are the internally consistent [Delfosse et al. 2000, Table 3](https://arxiv.org/abs/astro-ph/0010586)
values, replacing the mixed earlier photometry. A/C light separation is
approximate; C's large error is retained. Infrared absolute H = 9.29 ± 0.04 and
K = 8.96 ± 0.04 for B remain in the review with their actual passbands.
Spectral types follow [González-Payo et al. 2026, Table 4](https://arxiv.org/html/2605.04094v1);
colons explicitly mark B/C estimates. No temperature is inferred from them.

[Torres et al. 2010, Table 5](https://arxiv.org/abs/0908.2624) lists approximate
bolometric log10(L/Lsun) = -3.11: for Aa and -3.92: for Ab. The catalog converts
these to linear luminosities while retaining the colon uncertainty flags and
the absence of numerical errors. These are estimates, not precise luminosity
measurements, and no radius or temperature is derived from them.

The same table's B row gives log10(L/Lsun) = -2.720 ± 0.054,
2650 ± 200 K and 0.21 ± 0.04 solar radii. These remain non-adopted evidence:
the B-only flux/temperature lineage has not been established sufficiently.
[Casagrande et al. 2008, section 7.2](https://arxiv.org/abs/0806.2471) explicitly
discusses 2650 K for unresolved LHS 68 with a triple-system photometry caveat;
Torres section 9 says these radii are indirect and temperature-scale dependent.
[Taylor et al. 2024, Table 3](https://arxiv.org/html/2402.00934v1) supplies a newer
single-atmosphere photometric model for EZ Aqr, but does not separate A/B/C.
Its temperature, metallicity, radius, mass and age cannot be adopted as
individual component values. No shared age or abundance is inferred.

The previous 3060 K was an unresolved system class estimate. It is removed
from individual temperature fields and retained with explicit scope in source
records. All earlier catalog/effective records, raw astrometry, uncertainties,
notes and provenance are frozen in
[ez-aquarii-review.json](../catalog-work/shared-enrichment/ez-aquarii-review.json).
The existing 293.6 ± 0.9 mas parallax, positions, proper motions, shared
-50.08 ± 0.01 km/s systemic velocity, and orbital solutions remain unchanged.
