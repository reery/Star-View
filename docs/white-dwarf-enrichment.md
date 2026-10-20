# White dwarf enrichment

Reviewed 2026-10-20. Before this review, 40 of the 46 bundled white dwarfs had no
adopted temperature, mass, radius or luminosity. Their Mass cards fell back to
temperature-independent model envelopes. 37 now have object-specific values;
3 remain withheld, each for a documented reason. The six previously reviewed white dwarfs
(Sirius B, Procyon B, 40 Eri B, Van Maanen's Star, LAWD 37 and Stein 2051 B)
are unchanged.

## Source

[O'Brien et al. 2024](https://arxiv.org/abs/2312.02735), *The 40 pc sample of
white dwarfs from Gaia*, MNRAS 527, 8687, Table A1 ([CDS
J/MNRAS/527/8687](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/527/8687),
version of 2024-11-14). It is volume-complete and spectroscopically confirmed,
with one uniform method for every object: model atmospheres fitted to Gaia DR3
photometry and parallax, with the Bédard et al. (2020) mass–radius relation.
Those are the same cooling models behind the Mass card's class references. 38
objects match by exact Gaia DR3 identity, and 36 are adopted. The frozen table, ReadMe, targets and
checksums are in `catalog-work/shared-enrichment/white-dwarfs/`.

| Quantity | Adoption |
| --- | --- |
| Temperature, mass | Published per-object fit with its uncertainty (`model-derived`) |
| Radius | `sqrt(G M / g)` from the same fit's mass and log g, IAU 2015 nominal constants (`derived`) |
| Luminosity | Stefan–Boltzmann from that radius and temperature (`derived`) |
| Age | Not adopted: cooling ages exclude the progenitor lifetime; they are kept in provenance as context |

Mass, log g and temperature are correlated fit parameters, so no radius or
luminosity uncertainty is propagated, following the
[Van Maanen's Star](van-maanen-enrichment.md) precedent.

## Policy decisions

- **Below 6000 K (17 objects).** The paper finds photometric masses
  systematically low there because of model opacities, and applies an ad-hoc
  population-level correction toward the canonical median mass (section 2.1).
  The direct per-object fit is adopted. The corrected Teff and mass, and the
  caveat, are recorded with each value.
- **Double degenerates.** LAWD 10 is a confirmed unresolved double (ESO SPY), and
  CD-32 5613 is a double-degenerate candidate. A single-star fit of combined light
  describes neither component, so all values are withheld for both.
- **DQ/DZ atmospheres (8 objects).** The uniform fits use pure-helium models
  without carbon or metals. The values are kept for consistency and Gaia DR3
  astrometry; a caveat notes that tailored fits can differ.

## Individual literature

- **Gliese 86 B** (HD 13445 B) lies about 2″ from its K dwarf and has no
  uncontaminated Table A1 fit. [Farihi et al. 2013](https://arxiv.org/abs/1212.5601),
  Table 3, fitted HST photometry and STIS spectroscopy with DQ models: Teff 8180 ± 120 K,
  log g 8.02 ± 0.02, mass 0.59 ± 0.01 M☉ and radius 0.01245 R☉. Luminosity is
  derived from these. The radius uncertainty (± 0.0015) is retained as printed.
  The dynamical mass of [Brandt et al. 2019](https://arxiv.org/abs/1811.07285),
  0.595 ± 0.010 M☉, agrees; [Zeng et al. 2022](https://arxiv.org/abs/2112.06394) find
  0.5425 ± 0.0042 M☉. Both are reported in the notes, not adopted.
- **Theta Hya B** is withheld. It is seen only in the EUV/UV, unresolved from its
  B9.5V primary. Its temperature depends on an assumed gravity: 25,800–30,800 K
  for log g 7.5–9.0 in [Burleigh & Barstow 1999](https://arxiv.org/abs/astro-ph/9810113)
  Table 3, and 28,700–32,700 K at log g 9.0 in Vennes et al. 1998. No gravity,
  mass or radius has been measured. The frequently tabulated 30,700 K / 1.21 M☉
  (Holberg et al. 2013) has no uncertainty or stated source, and matches an
  assumed log g of about 9.

## Implementation

`python3 scripts/author-white-dwarf-enrichment.py` reproduces two reviewed files
from the frozen inputs; `--write` regenerates them.

- `catalog-work/shared-enrichment/reviewed-white-dwarfs.json` feeds catalog
  rows through the shared exact-identity enrichment. White dwarf rows accept
  only reviews explicitly typed `white_dwarf`.
- `catalog-work/star-systems/reviewed-white-dwarf-components.json` feeds the
  seven white dwarfs that are reviewed system components, through the
  component literature plan. Their component records are what the map shows.

Values only fill blank fields; notes are appended with the reference, the
values and every caveat. The Mass card's white dwarf references were
regenerated for the new temperatures with `npm run catalog:white-dwarf-references`.

## Validation

- nearest-1000 reproduced byte for byte with the review emptied, before adoption.
- After adoption, exactly 36 catalog rows changed. Only blank temperature,
  mass, radius and luminosity fields were filled, and notes were appended. Exactly
  seven component records changed in the same way.
- In the browser payloads, 37 white dwarf records changed, all in nearest-1000,
  with no other record and no non-empty value altered.
- `npm run catalog:preservation` compared 2889 records without loss. Catalog
  validation, the companion pool check, the constellation chart check, TypeScript,
  focused unit tests and the production build passed. The full test suite was not run.
