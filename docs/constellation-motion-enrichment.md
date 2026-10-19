# Constellation data and shared motion — 2026-10-19

This pass adds component data for Nusakan, Ashlesha and Nu Geminorum, and adopts
common linear motion for 519 records in all 197 represented reviewed systems.
No Info articles were edited by this pass. This is an additional source review,
not certification that every existing physical value is current.

## Data adopted

- **Nusakan A/B:** temperatures 7980 ± 180 / 6750 ± 230 K, radii
  2.63 ± 0.09 / 1.56 ± 0.07 solar radii, luminosities, component visual
  photometry and a shared model age from [Bruntt et al. 2010](https://www.chara.gsu.edu/files/papers/2010_Bruntt_AA_512_A55.pdf).
  The secondary radius uses the authors' preferred surface-brightness model;
  it is not their noisier direct interferometric result. Adopt the newer
  conditional mass estimates 1.982 / 1.635 from the joint-prior solution of
  [Anguita-Aguero et al. 2023](https://arxiv.org/html/2309.06394), retaining the
  earlier evolutionary masses as alternatives.
- **Ashlesha A/B:** masses 2.094 / 1.661 solar masses from the same 2023 paper.
  These are Bayesian estimates conditional on parallax and primary-mass priors.
  The posterior bounds and the secondary's products-of-marginal-bounds
  convention are retained; they are not relabeled as one-sigma errors.
- **Nu Gem close triple:** masses 3.34 ± 0.15 / 3.28 ± 0.10 / 3.33 ± 0.10,
  conservative temperature estimates 15000 ± 3000 / 15000 ± 3000 /
  12000 ± 3000 K, approximate component photometry and coeval model age from
  [Klement et al. 2021](https://arxiv.org/html/2105.13437), preferred solution C4.
  The paper's Aa/Ab/B explicitly map to catalog Aa1/Aa2/Ab. Inner luminosities
  600 / 400 solar luminosities are rough rotating-star models. Catalog radii
  are explicitly derived equivalent spherical radii, not the paper's different
  polar radii. No independent radius precision is claimed. The unresolved Gaia
  abundance formerly attached to Aa1 remains source evidence rather than an
  individual metallicity.

Across the constellation overlay, available temperature/mass/radius/luminosity/
age/absolute-V/classification counts change by +4/+6/+3/+3/+5/+3/+2.
Individual metallicity availability decreases by one because of the scoped
Nu Gem correction; the original value, error, quantity and provenance survive.

## Motion adoption

RV availability rises from **666 to 1013 of 1016** records. The 197 system
reviews comprise eight published systemic solutions, two published subsystem
proxies, and 187 compiled primary/source RV proxies. This is not 347 new
independent component RV measurements. Some source measurements are from the
existing October 2026 frozen compilation rather than newly acquired spectra.

All listed targets use one Cartesian velocity computed from an explicit
primary astrometric basis. Native positions, distances and proper motions stay
unchanged. Earlier RVs, errors and velocity vectors survive in scoped source
records. The existing application labels these adoptions **System bulk motion**
and distinguishes RV proxies. Orbital phase motion is not integrated.

New reviewed velocities include Nu Gem 29.8 ± 0.1 km/s, Ashlesha 35.526 km/s,
Nusakan -19.856 km/s, and Dubhe's inner-system proxy -9.681 km/s. The latter
three retain their asymmetric 95 percent posterior intervals without a
fabricated one-sigma error. [Behr et al. 2011](https://arxiv.org/html/1104.1447)
supplies Iota Pegasi -4.229 ± 0.015 and the Mizar A subsystem proxy
-7.309 ± 0.081 km/s, using its scaled-error solutions and noting RV zero-point
differences. A subsystem gamma need not equal the larger system barycenter RV.

Proxima retains its independently measured motion, as previously requested.
Nu Gem's wide Ba/Bb pair is excluded from the close triple's measurements and
motion pending a separate physical-association review. These two records and
Deneb Algedi remain without an adopted RV. Porrima gains a compiled common RV
of -19.8 km/s; its published total mass is not split into fabricated individual
masses.

## Evidence and validation

`reviewed-constellation-data.json` and `reviewed-constellation-motion.json` hold
exact identities, input guards, methods and uncertainty conventions. The new
selected-source snapshot freezes numerical tables, interpretation and downloaded
document hashes. Prior intermediate source adoptions are retained explicitly.
`motion-enrichment-summary.json` compares this pass with its working-tree
baseline: 2467 effective records, 59168 scientific field values and 570 prior
source snapshots across six catalogs, with no missing records or measurements.
All source CSVs and provenance files are unchanged. An unrelated concurrent
Info edit is recorded separately and was not overwritten.

Production build, typecheck, catalog preservation, authoring reproducibility,
all-88-chart consistency, 17 focused Python tests, 67 focused Vitest tests and
one desktop browser test passed. The browser selects both components of Nusakan,
Ashlesha, Nu Gem and Porrima and verifies adopted RVs and motion labels.

A broader focused run also exposed six existing failures in `catalogs.test.ts`
and `astronomy.test.ts`: older raw-catalog coverage counts, an older provenance
estimate count, raw Rigel companion RV expectations, and a color fallback
expectation. All six reproduce against an isolated pre-pass source/data
snapshot. They were not altered to hide those failures. The full suite was not
run. The legacy Astropy-dependent Python motion test could not import Astropy
in the available environment; the new motion/preservation tests passed.
