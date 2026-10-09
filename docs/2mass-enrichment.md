# Nearby 2MASS object enrichment

Reviewed 2026-10-09. The nearest-1000 catalog contains 90 objects with
2MASS-style display names: 87 brown dwarfs and three ordinary stars. Their
names identify an infrared survey detection, not a lack of identification.
Most are very faint cool objects with good astrometry but sparse optical
spectroscopy. The previous shared literature branch accepted only `star`
records; brown dwarfs received, at most, a spectral-class temperature estimate.
Gaia's ordinary-star physical models were intentionally not used for them.

The review adds physical information for 53 distinct objects and new radial
velocities/full Galactic velocities for five, affecting 55 objects in total.
Four of these objects also occur in nearest-100 and receive identical physical
values there. Membership, IDs, names, types, spectral classifications, positions,
parallaxes and proper motions remain unchanged.

| Property | Nearest-1000 changes |
| --- | ---: |
| Mass | 51 previously missing values |
| Bolometric luminosity | 52 previously missing values |
| Radius | 52 previously missing values |
| Effective temperature | 52 additions or upgrades from class estimates |
| Radial velocity and Galactic vx/vy/vz | 5 previously missing sets |

## Sources and adoption policy

- [UltracoolSheet v2.1.0](https://zenodo.org/records/15802304), frozen release
  2025-07-03: exact identifiers, multiplicity, radial velocities and the
  FundamentalProperties tab containing
  [Sanghi et al. 2023](https://arxiv.org/abs/2309.03082) parameters.
- [Filippazzo et al. 2015, Tables 1 and 9](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/810/158):
  explicit fallback only for objects absent from the newer physical table.
- Original velocity papers are recorded individually by bibcode and URL in
  the reviewed records, including Hsu et al. 2021, Tannock et al. 2021 and
  Faherty et al. 2018 for newly adopted measurements.

Matching uses unique exact SIMBAD aliases and source designations, never sky
proximity or truncated coordinate names. The frozen target list maps both
nearest-100 and CNS5 IDs to the same exact object. Source subsets preserve
the original rows; the source manifest retains full-download hashes, URLs,
selection policy and subset checksums.

Luminosities convert published log10(L/Lsun), retaining asymmetric uncertainty.
Masses, radii and temperatures are published evolutionary/SED model estimates,
conditional on the authors' age distributions. Their uncertainties, source
distances, model names and age assumptions survive in provenance. Jupiter
units use IAU 2015 nominal conversion factors. Source luminosities and model
radii are retained together, not recomputed from a different catalog temperature.

Existing curated values win. Only a temperature explicitly marked in the
existing notes as a Pecaut-Mamajek class estimate can be superseded. Its old
value and estimated status remain in provenance. Generic field/gravity age
priors are not individual age measurements: no scalar ages or metallicities
are invented. Tentative moving-group membership supplies luminosity only.

Unresolved/suspected multiples, spectral blends, overluminosity flags,
problematic SED fits, parallax discrepancies and subdwarfs are excluded from
physical adoption. Every target has an inclusion or exclusion decision in
[reviewed-ultracool.json](../catalog-work/shared-enrichment/reviewed-ultracool.json).
This is a review of the frozen nearby 2MASS objects, not a new complete census.

## Motion

| Object | Newly adopted RV (km/s) | Reference |
| --- | ---: | --- |
| 2MASS J03480772-6022270 | -14.1 ± 3.7 | Tannock et al. 2021 |
| 2MASS J06272007-1114241 | +1.2 ± 1.0 | Hsu et al. 2021 |
| 2MASS J16241436+0029158 | -24.3 ± 0.5 | Hsu et al. 2021 |
| 2MASS J19251275+0700362 | -9.0 ± 7.0 | Faherty et al. 2018 |
| 2MASS J22361685+5105487 | -1.2 ± 0.3 | Hsu et al. 2021 |

Only finite referenced velocities with a positive published uncertainty at
most 10 km/s are eligible. Existing radial velocities or Cartesian velocities
are preserved. Component/system ambiguity withholds new RV adoption. Full
Galactic velocities are calculated from the retained raw ICRS astrometry,
proper motions and adopted RV. Frozen J2000 positions and ranking are retained;
this is the app's static linear-motion approximation, not an orbital model.

The named example, 2MASS J18283572-4849046 (CNS5 4566), now has 985 ± 79 K,
21.67 ± 18.93 Jupiter masses, 1.07 ± 0.17 Jupiter radii, and
log10(L/Lsun) = -5.01 ± 0.05. Mass, radius and temperature are conditional
evolutionary-model estimates, with a particularly broad mass uncertainty.
The reviewed sources supply no usable RV for this object; full velocity, age
and metallicity remain missing.

## Reproduction and validation

`python3 scripts/author-ultracool-enrichment.py --write` builds the reviewed
decisions from frozen inputs. Without `--write` it checks byte-for-byte
reproduction. Regenerate nearest-100 before nearest-1000 through their existing
authoring scripts, then run `npm run catalog:generate`.

Focused Python enrichment/motion checks, relevant formatter/card checks,
catalog validation, deterministic regeneration and TypeScript checking were
used. The full test suite and browser checks were not run.
