# Van Maanen's star property review

Reviewed 2026-10-17. The exact object is `10pc-0073`, WD 0046+051 / Wolf 28 /
HIP 3829, Gaia DR3 `2552928187080872832`. Both nearby catalogs previously
exported its Johnson V and Gaia astrometry but no adopted physical parameters
or radial velocity. It is a solitary object, with no separate component-pool
record.

| Adopted quantity | Value | Basis |
| --- | ---: | --- |
| Effective temperature | 6215 ± 183 K | Atmospheric fit |
| Mass | 0.68 ± 0.02 solar | Atmospheric/evolutionary model |
| Bolometric luminosity | 0.000169824 solar | Published log(L/Lsun) = −3.77 |
| Radius | 0.0112401 solar | Derived from the same fit's luminosity and temperature |
| Total age | 4.1 ± 1.0 Gyr | Separate, older progenitor plus cooling model |
| Radial velocity | −11.74 ± 7.11 km/s | Astrometric perspective acceleration |

The first four quantities use [Giammichele et al. 2012, Table 2, WD
0046+051](https://arxiv.org/pdf/1202.5581). The published analysis includes metals
and hydrogen in the helium-dominated atmosphere, rather than a
generic main-sequence calibration. It retains the source's pre-Gaia parallax;
these values are not claimed to be a new Gaia-based fit. Radius uses
`sqrt(L/Lsun) * (5772 / Teff)^2`. The paper does not provide a luminosity error;
no radius uncertainty is invented from correlated fit parameters. Its 3.30 Gyr
cooling age is retained in the review as context, not adopted as total age.

[Burleigh et al. 2008, Table 1 and section
4.1](https://arxiv.org/pdf/0801.2917) estimate a 2.6-solar-mass progenitor, about
0.9 Gyr on the main sequence and 3.17 ± 0.29 Gyr of cooling, giving a total
4.1 Gyr with a deliberately conservative ±1 Gyr uncertainty. Their remnant fit
has mass 0.633 ± 0.022 solar and temperature 6030 ± 240 K; the progenitor and
total age belong to that older evolutionary model, rather than a recalculation
from the adopted 2012 mass. Their estimated maximum giant radius is 4.6 AU.
The Info article explicitly identifies this as a 2008 model estimate.

[Lindegren & Dravins 2021, Table 1 and section
5.1](https://arxiv.org/pdf/2105.09014) derive the radial velocity from Hipparcos
and Gaia EDR3 astrometry at J2016.0, with formal 1-sigma error 7.11 km/s and
chi-squared 1.7 for four degrees of freedom. It avoids gravitational redshift
and pressure shifts in white-dwarf spectra, assuming unperturbed rectilinear
motion. The paper traces the often repeated +263 km/s to a single unreliable
1920s observation; it must not drive space motion or a close-encounter claim.

Authoritative values and method are in
`catalog-work/nearest-100/physical-overrides.json`. The authoring helper requires
the exact name, stable record and Gaia identity, a white-dwarf type and an
explicit perspective-acceleration method before bypassing the usual spectral
RV withholding. Existing astrometry, uncertainties, frozen J2000 position,
membership and Johnson V remain intact; Galactic velocity is derived from
the adopted source astrometry plus the reviewed RV. Original measurements and
their references remain in provenance. No ordinary stellar [Fe/H] is inferred
from accreted rocky material.

LAWD 37's article now leads with its first isolated-white-dwarf microlensing
mass measurement, with the uncertainty and [McGill et al. 2023 research
source](https://arxiv.org/abs/2206.01814). Its catalog parameters are unchanged.

Validation: both nearby catalog packages reproduce byte for byte. Preservation
compared 2887 catalog/component records without losses. A separate before/after
comparison confirmed that only Van Maanen's catalog row changed in each nearby
catalog, while all 844 effective companion records and all original source
measurements, astrometric errors, photometry and J2000 positions were retained.
Unrelated per-object provenance changed only in its shared review-file checksum.
Two focused Python motion checks and ten Info unit checks passed. Desktop and
mobile browser checks passed in both catalogs, including visible radial velocity,
full-motion status and both revised articles; screenshots were inspected.
The production build passed, including TypeScript and catalog validation.
No full test suite was run.
