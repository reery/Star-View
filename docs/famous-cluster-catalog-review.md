# Famous cluster stars review — 19 October 2026

All reviewed records now ship in the constellation catalog. The separate catalog and filter were removed on 20 October 2026; see the [consolidation audit](cluster-catalog-consolidation.md). This document records the preceding scientific review.

Reviewed all 42 source landmarks and their 20 runtime companions: 62 non-solar objects. The review fills 67 previously unavailable physical/classification fields and 17 radial-velocity fields. Forty objects change. Availability includes model estimates, derived values and explicitly shared quantities; it does not mean every value is independently measured.

| Field | Before | After | Newly filled |
| --- | ---: | ---: | ---: |
| Spectral classification | 45 | 48 | 3 |
| Temperature | 37 | 45 | 9 |
| Mass | 22 | 43 | 22 |
| Luminosity | 32 | 40 | 9 |
| Radius | 32 | 41 | 10 |
| Metallicity | 29 | 30 | 2 |
| Age | 6 | 17 | 12 |
| Radial velocity | 35 | 52 | 17 |

Six former physical parameters of Phyllon Kissinou A are retained as unresolved **AB** source measurements instead of individual A adoptions. This accounts for the difference between net coverage and newly filled counts. No original source measurement is discarded.

## Astrometry and identity corrections

- **Phyllon Kissinou:** the official Gaia–2MASS crossmatch identifies C as Gaia DR3 3958707782341673216 / 2MASS J12350326+2237254. Its parallax is 10.5311588 ± 0.0184959 mas. AB now uses this preferred distance, approximately 309.7 ly, while keeping its source directions separately. The artificial 45.9-ly A–BC offset disappears; projected C separation is about 0.255 ly. RUWE(C)=1.523 is elevated: the formal precision is not a guarantee against systematic errors, and the physical line-of-sight depth is not measured independently. C retains its complete native astrometry, errors and RV; AB uses C's full motion basis as a labelled bulk-motion proxy. Individual A V=4.96 replaces the unresolved AB V=4.773; the latter remains retained.
- **Atlas:** the exact Aa1/Aa2 pair now uses the [2025 joint orbital solution](https://arxiv.org/abs/2507.15933), 136.2 ± 1.4 pc, replacing the inherited old Hipparcos/MSC distance of approximately 118.6 pc. The same solution supplies system parallax, proper motion and systemic RV, with their uncertainties. Component atmospheric parameters and dynamical masses come from the separately resolved/disentangled analysis.
- **HD 74146:** the wide B star has the better Gaia distance constraint: parallax error 0.0145 mas and RUWE 0.863, versus 0.0993 mas and RUWE 1.068 for the unresolved primary. The physical hierarchy uses the B distance as an approximate shared distance. B receives its own full Gaia astrometry and measured RV; the inner pair retains its separately scoped orbital systemic solution.
- **HD 74560:** the A source supplies the preferred common parallax; the BC source has a poorer fit and less precise parallax. C belongs to the 0.6-arcsecond **BC** pair and now uses B's approximate unresolved reference position, rather than inheriting A's position 76 arcseconds away. No C orbital phase or individual RV is fabricated. B retains its independent RV.

Shared parallaxes and reference positions are labelled approximations, not separate measurements of every member. Original component astrometry, uncertainties, velocities, photometry and provenance remain in retained source records.

The angular orbital solutions and their metadata remain unchanged. Their physical axes are recalculated where the adopted parallax changes: Atlas 1.5516 → 1.7820 AU; Phyllon Kissinou AB 21.0646 → 18.2316 AU. The orbit generator's scoped refresh preserves all other existing solutions verbatim.

## Physical and motion sources

Frozen inputs and exact identity guards are in [physical-review.json](../catalog-work/famous-cluster-stars/physical-review.json), [astrometry-review.json](../catalog-work/famous-cluster-stars/astrometry-review.json), [motion-review.json](../catalog-work/famous-cluster-stars/motion-review.json) and the accompanying `literature/` exports. They include:

- SIMBAD basic and atmospheric-parameter measurements, official Gaia DR3 identities/astrometry/astrophysical parameters and the MSC physical hierarchy/orbital records.
- [White et al. 2017](https://doi.org/10.1093/mnras/stx1050), Zorec & Royer 2012 and David & Hillenbrand 2015 for exact Pleiades/Hyades stars; [Stock et al. 2018](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/616/A33) and [Arentoft et al. 2019](https://doi.org/10.1051/0004-6361/201834690) for individual giant-star models/seismic mass.
- [Torres et al. 2025](https://arxiv.org/abs/2507.15933) for Atlas; [Marr et al. 2022](https://arxiv.org/abs/2202.05900) for the diskless Pleione primary; [Lam et al. 2023](https://arxiv.org/abs/2304.07397) for 12 Com; [Sandquist et al. 2022](https://arxiv.org/abs/2205.10690) for Meleph.
- [Nieva & Przybilla 2014](https://arxiv.org/abs/1412.1418), [Rzaev et al. 2021](https://doi.org/10.1093/mnras/stab1119), [GRAVITY Collaboration 2018](https://arxiv.org/abs/1809.10376), [Hubrig et al. 2008](https://arxiv.org/abs/0807.2067) and [Boyajian et al. 2009](https://chara.gsu.edu/files/papers/2009_Boyajian_ApJ_691_1243.pdf) for explicitly mapped components and coherent radius/temperature inputs.

The malformed HTML temperature cell for Theta1 Orionis C2 is not transcribed as a temperature. Its adopted temperature is transparently derived from that component's coherent published luminosity and radius. Pleione's scalar radius uses the same-source Stefan–Boltzmann equivalent; its polar and equatorial radii remain distinct source quantities.

Systemic RVs are restricted to their documented pair/subsystem. Wide companions are excluded from inner-pair RV assignments. The 12 Com secondary gamma differs from the primary by approximately 3 km/s; its shared motion therefore remains an explicit primary-based proxy, with the discrepancy recorded. A donor's formal fit error is not presented as the complete systematic uncertainty of the shared approximation.

## Remaining gaps and preservation

The [per-object audit](../catalog-work/famous-cluster-stars/gap-coverage-audit.json) records every object's adopted values, newly filled fields, remaining blanks, reasons and evidence locations. It verifies that every proposed physical adoption reaches the generated runtime catalog, including deferred source details.

No generic mass–luminosity relation, minimum companion mass, unresolved subsystem total, fixed solar composition or fractional main-sequence lifetime is substituted for an individual measurement. Theta Carinae's apparent single-star age is withheld because its mass-transfer history makes that an unsuitable chronological age. No common cluster age/abundance is applied merely from this visual landmark selection; distance consistency alone does not establish coeval membership. Remaining nulls mean no justified adoption in the reviewed sources, not proof that no publication exists.

Baseline comparisons cover all six source catalogs, all six effective generated catalogs and the complete 846-component pool, including physical fields, photometry, complete astrometric bundles, uncertainties and retained source records. All 302 existing orbital solutions retain their identities and non-distance measurements. Other regenerated constellation-chart changes are source checksums or the same exact-object supplements shared with their catalog counterparts.

## Verification

Catalog preservation, catalog validation, pinned-environment nearest-catalog reproduction, landmark/bright reproduction, type checking and focused Python/Vitest checks are used. The full test suite and browser suite are not run.

The report can be refreshed with `python3 scripts/audit-cluster-catalog.py --write`. Supplying `--before-dir` adds comparisons against a saved pre-edit source/pool/runtime snapshot. Scoped orbital reproduction uses `python3 scripts/author-stellar-orbits.py --system msc-12349+2238 --system msc-03492+2403 --system msc-08400-5303 --system msc-08424-5307`.
