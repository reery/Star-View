# Literature-conflict review

Reviewed 2026-10-28. Some catalog values contradicted object-specific literature, often visibly: Info articles called stars young while the spec sheet showed old Gaia model ages. Candidates came from comparing article age statements with catalog ages, and catalog temperatures and metallicities with the frozen SIMBAD `mesFe_h` pool. This is a reviewed candidate set, not a full catalog audit.

The ledger is [literature-conflict-review.json](../catalog-work/shared-enrichment/literature-conflict-review.json). It records the previous values, the Gaia or literature evidence, and each adopted or withheld field. Shared values are mirrored into `reviewed-objects.json` under `physicalLiteratureReview`; withheld fields are listed in `catalog-work/reviewed-data-retirements.json`. Epsilon Eridani was corrected separately, through `catalog-work/nearest-100/physical-overrides.json`.

## Policy

- A published value is adopted only after it was checked in the primary paper. Wikipedia infobox values are used to find a source, never as the source.
- Gaia DR3 FLAME masses and ages use solar-metallicity BaSTI tracks (Gaia DR3 documentation 11.3.6). The catalog already withholds them when an adopted metallicity lies beyond 0.3 dex (`flame_withheld`). This review applies the same limit when Gaia's own GSP-Phot [M/H] lies beyond it and the age contradicts the literature.
- Uncalibrated GSP-Phot metallicities are only qualitative ([Andrae et al. 2023](https://ui.adsabs.harvard.edu/abs/2023A%26A...674A..27A)). For hot stars without a spectroscopic abundance in the frozen pool, they are withheld instead of being shown as measurements.
- When no verified replacement exists, the contradicted value is withheld; nothing is inferred.

## Changes

| Catalog object | IDs | Change |
| --- | --- | --- |
| Beta Pic | hip-27321 | age 0.449 → 0.023 ± 0.003 Gyr, moving-group age ([2014MNRAS.445.2169M](https://arxiv.org/abs/1409.2737)) |
| Zeta Dor | cns5-1279 | age 3.70 → 0.575 Gyr, activity age, Table 1 log age 8.76 ([2012A&A...541A..40M](https://arxiv.org/abs/1202.5884)); FLAME mass withheld |
| Beta Com | cns5-3247, hip-64394 | age 6.35 → 2.0 ± 0.5 Gyr, spanning the activity (2.5) and rotation (1.5 Gyr) ages in Table 13 ([2008ApJ...687.1264M](https://arxiv.org/abs/0807.1686)) |
| e Her | hip-84606 | FLAME age withheld |
| Zeta CrA | hip-93542 | FLAME age and GSP-Phot [M/H] −1.17 withheld |
| Theta Crt | hip-56633 | FLAME age and GSP-Phot [M/H] −0.69 withheld |
| Epsilon Hyi | hip-12394 | FLAME age and GSP-Phot [M/H] −0.54 withheld |
| Tau PsA | hip-109422 | FLAME age withheld |
| Aldebaran | hip-21421 | [Fe/H] −0.93 → −0.2 ([2025A&A...698A..93J](https://ui.adsabs.harvard.edu/abs/2025A%26A...698A..93J)); the old value was an isolated outlier in a pool of 68 |
| HD 97101 | cns5-2724 | GSP-Phot [M/H] −0.74 withheld; it lies below every catalogued value (−0.20 to +0.65), which do not agree well enough to adopt one |
| Chi Her | hip-77760 | Teff 6,310 → 5,820 K ([2022A&A...663A...4S](https://ui.adsabs.harvard.edu/abs/2022A%26A...663A...4S)); replaces an Allende Prieto & Lambert 1999 model value |
| 41 Ara | cns5-4255 | Teff 4,759 → 5,242 K ([2024A&A...683A.125P](https://ui.adsabs.harvard.edu/abs/2024A%26A...683A.125P)); radius rescaled from the retained luminosity, 0.997 → 0.822 R☉ |
| HD 36003 | cns5-1361 | Teff 4,971 → 4,565 K ([2022A&A...663A...4S](https://ui.adsabs.harvard.edu/abs/2022A%26A...663A...4S)) |

The withheld ages conflict with published values that could not be verified on 2026-10-28, because VizieR was unreachable: Strömgren ages of about 76, 117 and 133 Myr from David & Hillenbrand (2015) for Zeta CrA, Theta Crt and Epsilon Hyi, and 1.3 Gyr from the Geneva-Copenhagen survey for Tau PsA. The 155 Myr often quoted for e Her is attributed to a 2012 review of rapid rotators that gives no age for this star. These values can be adopted once their primary tables are checked.

For 41 Ara and HD 36003, the automatic rule (newest value within 10 percent of the pool median) had selected an edge value from a recent survey (2024A&A...690A..97C and 2024A&A...683A.125P). The review adopts the newest value within 2 percent of the median instead. Aldebaran's −0.93 came from the same survey as 41 Ara's edge value.

## Not changed

- Phyllon Kissinou (23 Com): its catalog row is the unresolved AB source. The component review in `famous-cluster-stars/physical-review.json` already withholds all six individual fields for component A.
- g Lup: the Gaia age (1.85 Gyr) is consistent with the only individual estimate found (1.11 ± 1.40 Gyr, 2018AJ....155..111L); Hercules–Lyra membership alone does not fix its age.
- Alpha Vol: the Gaia age (0.78 Gyr) fits an unresolved near-equal binary, as does the 427 Myr Strömgren age; neither describes one star.
- Naos [Fe/H] +0.49: a single catalogued value, kept.

## Pipeline rule

The per-object review above found the pattern; the authoring pipeline now applies it everywhere. `flame_withheld` takes Gaia's own GSP-Phot [M/H] (`gaia_metallicity`) and withholds FLAME mass and age when it lies beyond 0.3 dex, in every path that adopts Gaia values: nearest-100, nearest-1000/5000, the Western landmark build, shared enrichment and the companion pool. Withheld values stay in provenance (status `withheld-gaia-metallicity` in the Western build).

The 2026-10-28 rebuild withheld 209 catalog fields (mass and age across nearest-1000, nearest-5000 and Western rows), each verified against the frozen Gaia snapshot and listed in `reviewed-data-retirements.json`. Component records keep their earlier values with explicit scope in `catalog-work/star-systems/retained-flame-metallicity-adoptions.json`, which the companion builder loads next to `retained-gsp-phot-adoptions.json`. Where a reviewed component literature value previously replaced such a FLAME value, it now fills the blank instead. 113 FLAME ages and 105 FLAME masses remain adopted, all with GSP-Phot [M/H] within 0.3 dex.
