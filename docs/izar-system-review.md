# Izar component review — 2026-10-20

Izar is explicitly indexed as MSC/WDS `14450+2704`: A is `bright-izar`
(also `hip-72105`, HD 129989), B is `msc-14450+2704-b` (HD 129988,
Gaia DR3 1279798789901591168), and MSC D is `msc-14450+2704-d`.

The previous effective positions used distances of 72.414, 62.112, and
63.573 pc respectively. B also inherited A's sky direction instead of its
resolved position. These incompatible reference choices produced spurious
light-year separations within the close pair.

## Geometry and membership

The adopted **approximate shared distance** is 1000/16.10 = 62.112 pc
(202.58 light-years), from HIP 72105's Hipparcos parallax, 16.10 ±0.66 mas.
The native solutions remain in frozen sources. A is saturated in Gaia DR3
(RUWE 3.529), B has no DR3 parallax, and D has 15.73049 ±0.60769 mas.
The Hipparcos distance is compatible with D and the MSC system reference.
It is a preferred working system distance, not a precise new determination.

Use measured individual directions and proper motions, propagated to J2000;
set unknown relative depths to zero for common-distance map geometry.
A–B becomes approximately 179.7 AU and A–D 4868.4 AU. These are projected
separations; the true three-dimensional separations and orbital phases remain
unknown. A/B retain a common compiled-primary RV propagation approximation.
D has no adopted radial velocity or full space-motion vector.

[Kervella et al. (2022), section 5.1.5](https://arxiv.org/html/2109.10912#S5.SS1.SSS5)
identifies Gaia EDR3/DR3 **1279752168030730496** as a **candidate brown dwarf**
at 4.9 kau. This is MSC D, not an ordinary confirmed third star. Its native
G=19.509863 is not Johnson V. MSC's V=21.05 is retained as source photometry
without asserting an independently measured Johnson V or using it for derived
individual properties. No spectral type, mass, temperature, bolometric
luminosity, radius, metallicity, or age is invented. The record's `brown_dwarf`
type follows the published candidate interpretation; the Info article and notes
explicitly retain the provisional status.

The same paper identifies **1267607615425592448**,
**2MASS J14454000+2615167**, as a much wider CPM candidate at 186 kau
(2.94 light-years). This distinct object is documented in the Info article and
review source. It is not assigned an invented component letter or adopted as a
confirmed member/distance donor. Its DR3 RUWE=3.089 also cautions against
treating its small formal parallax error as an unqualified system distance.
No reliable orbit is available in the frozen orbit pool, so none is invented.

## Physical measurements

- A: use the updated diameter/temperature solution in
  [Baines et al. (2025), Tables 6–7](https://arxiv.org/html/2506.02912):
  4341 ±39 K, source radius 37.85 (+1.30/−1.39) solar radii, source luminosity
  459 solar luminosities at source parallax 13.83 mas. Rescaling radius linearly
  and luminosity quadratically to the adopted distance gives 32.513 solar radii
  and 338.692 solar luminosities. Source luminosity's printed ±0.1 is not a
  complete error budget; the shared parallax uncertainty is correlated.
  Preserve the previously published 2026 seismic mass 5.36 ±0.48 solar masses
  with its original 4755 K / 37.61 solar-radius assumptions and scaling
  systematics. It is not a dynamical mass or silently recalculated mass.
- B: exact [TIC v8.2](https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=IV/38/tic)
  entry **1101424611**, matched to Gaia DR2 **1279798789901591168**, has
  9009 K (+381/−368.3), empirical/catalog mass 2.270 (+0.401/−0.263) solar
  masses, source radius 2.747 (+0.185/−0.156), and source luminosity 44.77494
  (+4.49719/−3.49781) at 67.1558 pc. Distance rescaling gives radius 2.541
  and luminosity 38.302. The mass retains the catalog's original empirical
  scope. The conflicting 4826 K and [Fe/H]=+0.05 atmosphere record is retained
  as ambiguous/misattributed; it is not B's adopted atmosphere. No independent
  metallicity or age is adopted.

All source catalog CSVs remain byte-identical to the pre-change snapshot.
Only the three Izar effective records change; system membership is unchanged.
Complete earlier effective records and every earlier source snapshot survive.
`withheld_source_fields` prevents scientifically rejected photometry/metallicity
from reappearing through the UI's retained-source fallback.

Frozen source rows, source uncertainties, decisions, and checksums are in
`catalog-work/star-systems/izar-review.json` and
`catalog-work/star-systems/literature-components/izar-20261020-sources.json`.

## Validation

- Catalog preservation: 2,889 catalog/component records checked; no unexplained loss.
- Authoring consistency and production build passed; shared-details validation
  checked 328 objects across five catalogs without inconsistencies.
- Four focused Python scientific guards and 47 focused TypeScript tests passed.
- Two focused Playwright checks passed (desktop and mobile); screenshots inspected.
- Pre-change snapshot comparison: exactly three effective records changed,
  every source catalog CSV unchanged, system definitions unchanged.
- Full test suite not run; user authorization is required by `AGENTS.md`.
