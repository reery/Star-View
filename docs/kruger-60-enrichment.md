# Kruger 60 A/B property review

Reviewed 2026-10-16. The stable component IDs are `10pc-0061` (A, Gaia DR3
`2007876324466455040`) and `10pc-0062` (DO Cep/B, Gaia DR3
`2007876324472098432`).

The nearest-100 pipeline withheld V for new multiple-system members until a
component passband review, and supplied only M3/M4 class temperatures. A separate
companion-pool pass supplied B's calibrated mass/radius and compiled abundance;
A was excluded by its Cifuentes survey category 3. That category describes the
survey's available observations, rather than invalidating this known binary.
Neither star had a dedicated nearest-1000 property review.

| Adopted property | A | B / DO Cep |
| --- | ---: | ---: |
| Mass (solar) | 0.268 ± 0.020 | 0.172 ± 0.008 |
| Radius (solar) | 0.3085 ± 0.0154 | 0.2085 ± 0.0174 |
| Effective temperature (K) | 3342 ± 111 | 3097 ± 111 |
| Bolometric luminosity (solar) | 0.00983 ± 0.000254 | 0.00393 ± 0.000116 |
| Deblended Johnson V | 9.7921 ± 0.0324 | 11.4021 ± 0.0574 |
| Resolved spectrum | M3V | M4V |

The dynamical masses are the individual entries in [Benedict et al. 2016,
Table 11](https://www.astro.gsu.edu/RECONS/published37.pdf), attributed to
Tamazian et al. 2006 and Henry et al. 1999. They supersede the less direct
photometric mass estimates; previous values remain in the frozen review.

Radii are the exact component rows 2457/2458 of [Cifuentes et al. 2025,
Table A.1](https://arxiv.org/html/2412.12264v1). These use the section 4.2
absolute-G calibration within its valid 7.5–14 mag range. They are estimates,
not direct diameter measurements. The existing B abundance of −0.25 dex [Fe/H]
is retained from that compilation (Zbo98); no uncertainty is invented.

Temperatures and luminosities are the exact Gaia component entries in
[Hardegree-Ullman et al. 2023, Table 1](https://arxiv.org/html/2304.12490v1),
frozen in `catalog-work/shared-enrichment/kruger-60-bioverse.tsv`. Temperatures
use the Gaia BP−RP empirical calibration and luminosities use absolute Gaia G
plus bolometric corrections. They remain photometric estimates, with possible
close-companion contamination/systematics beyond the formal errors. Independent
calibrated radii are retained without forcing exact Stefan–Boltzmann agreement.
The compilation's false binary flags are not used as membership evidence, and
its suspicious A V=11.410 entry is not adopted or used in these T/L estimates.

Individual V is deblended using [Henry et al. 1999, Table 3 and footnote h](https://www.as.utexas.edu/~fritz/astrometry/Papers_in_pdf/%7BHen99%7DMLR.pdf):
system Johnson V=9.57 ± 0.03 and adopted ΔV=1.61 ± 0.06. With
`r = 10^(-0.4 ΔV)`, `V_A = V_AB + 2.5 log10(1+r)` and `V_B = V_A + ΔV`.
First-order errors assume independent system V and ΔV; the derived A/B values
are correlated. Absolute V uses each unchanged catalog distance. This is
published deblended baseline photometry with no supplied observation date or
flare light curve. Henry et al. section 3.1 also explicitly documents the
individually resolved M3V/M4V spectra, observed at MMT on 1990-09-13.

No age is adopted. The often-cited A abundance −0.04 ± 0.12 dex appears in
[Newton et al. 2014](https://arxiv.org/abs/1310.1087)'s comparison sample under
**Gl 860 AB** (LSPM J2227+5741a), so it is not adopted
as an independent A abundance or copied to B. Existing raw astrometry,
component RVs, errors, positions and velocities are retained.

`catalog-work/shared-enrichment/kruger-60-review.json` retains previous catalog
and effective component records, provenance, source rows, uncertainty inputs and
withholding decisions. The authored physical overrides feed both nearby catalogs;
the companion pool restores each explicitly resolved luminosity class.

Validation: both catalog packages reproduce byte for byte. Catalog preservation
compared 2887 catalog/component records with no unexplained loss; only these two
stars changed. A direct before/after comparison confirmed unchanged membership,
unrelated rows, component astrometry, velocities and their uncertainties.
Two focused component tests and one desktop browser test passed, including
A/B selection and specs in both nearby catalogs. Production build (including
TypeScript and catalog validation) passed. Screenshots were inspected. No full
test suite was run.
