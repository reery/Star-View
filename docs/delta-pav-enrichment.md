# Delta Pavonis physical-data review

Reviewed 2026-10-16. Exact identity: SIMBAD `* del Pav`, HD 190248,
HIP 99240, CNS5 4994, Gaia DR3 `6427464123776727168`. The containing
catalog records are `cns5-4994` and `hip-99240`; this is not a reviewed
stellar multiple and has no effective companion-pool record.

| Property | Previous adopted value | Adopted literature value |
| --- | ---: | ---: |
| Mass (solar) | 0.94 | 1.07 ± 0.01 |
| Iron abundance [Fe/H] (dex) | +0.0321 **[M/H]** | +0.371 ± 0.008 **[Fe/H]** |
| Age (Gyr) | unavailable | 6.10 −0.26/+0.25 |
| Effective temperature (K) | 5438 | 5571 ± 48 |
| Radius (solar) | 1.2615935 | 1.197 ± 0.016 |
| Bolometric luminosity (solar) | 1.2535083 | 1.24 ± 0.03 |

The old mass came from Allende Prieto & Lambert (1999); the other old
physical values were Gaia DR3 broad catalog models. The abundance comparison
also involves different quantities: Gaia GSP-Phot overall [M/H] and
spectroscopic photospheric [Fe/H] must not share an incorrect label.

[Carvalho-Silva et al. (2025), Table 1](https://arxiv.org/abs/2504.17482)
is the newest source verified here for the adopted mass and iron abundance.
The published machine-readable table is frozen unchanged in
`catalog-work/shared-enrichment/delta-pav-2025-table1.txt`; its exact
**HIP 99240** row gives 5609 ± 8 K, log g = 4.29 ± 0.02,
[Fe/H] = +0.371 ± 0.008, mass = 1.07 −0.01/+0.01 and
age = 6.10 −0.26/+0.25 Gyr. The age errors follow the source's explicit
lower/upper columns; Wikipedia currently reverses these. Mass and age are
Yonsei–Yale isochrone inferences using differential HARPS spectroscopy,
Gaia DR3 parallax and V photometry. The age is not an extrapolation of the
paper's activity calibration, which stops at approximately +0.3 dex.
The 0.008 dex and 0.01 solar-mass errors describe internal precision,
not the full systematic uncertainty or an independently measured dynamical mass.

[Rains et al. (2020), Table 4](https://arxiv.org/html/2004.02343v1)
provides a more direct, mutually consistent angular-diameter/bolometric-flux
temperature, radius and luminosity. These are adopted together, retaining
the 2025 spectroscopic temperature as an alternative. Their 38 K difference
is within the interferometric temperature uncertainty. The published parallax
164.05 ± 0.36 mas agrees with the existing catalog 163.9544 mas; the published
physical solution is retained without a spurious precision-increasing rescale.
The abundance corresponds to `10^0.371 ≈ 2.35` times the solar iron/hydrogen
ratio, rather than 2.35 times the total heavy-element mass fraction.

`delta-pav-review.json` retains complete previous rows, astrometry,
photometry, uncertainties and provenance for both catalogs, the adopted
observations, exact source row and alternative temperature. The existing
shared-object authoring layer applies the same reviewed values to both IDs.
All other catalog rows and the entire effective companion pool remain unchanged.

Validation: catalog preservation compared 2887 records with no loss. Direct
before/after comparisons checked every CSV field and the complete effective
companion pool; only the two Delta Pav rows changed. Previous provenance is
retained in the frozen review. Regenerated provenance also refreshes shared
source hashes and adds the new references; four audit-only computed distances
differ by floating-point roundoff below 1e-14 pc. Both nearby catalogs and the
bright/landmark catalogs reproduce from their inputs. Five focused shared-object
tests passed, including comparison against the published table's abundance and
age-error columns. No full test suite was run.
The production build, TypeScript check and cross-catalog validation passed;
the latter compared 336 shared objects across six catalogs without conflicts.
