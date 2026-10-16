# Resolved companion properties

Reviewed 2026-10-06. The initial broad pass filled **110 missing fields on 54 represented system members**, including primaries, after aggregate records have been split. Membership and stable IDs are unchanged. The supplemented nearest-1000 rows also reach the Bright and Western overlays wherever those individual components are represented.

## Mu Cassiopeiae

| Property | A | B |
| --- | ---: | ---: |
| Absolute Johnson V magnitude | 5.784 | 11.6 |
| Effective temperature (K) | 5346 | 3034 |
| Mass (solar) | 0.744 | 0.1728 |
| Radius (solar) | 0.789 | 0.26 |
| Bolometric luminosity (solar) | 0.458 | 0.0051 |
| Adopted radial velocity (km/s) | approximately −97 | approximately −97 |

A's physical properties and both dynamical masses retain the existing [Bond et al. 2020](https://arxiv.org/abs/2010.06609) review. The primary absolute magnitude is calculated from its model-deblended V=5.170 and the paper's distance modulus −0.614 (§9.1). B's visual absolute magnitude is the individual value in [Jao et al. 2016, Table 1](https://arxiv.org/abs/1607.01304).

B's temperature, radius and luminosity come from the resolved Planck SED fit in [McCarthy et al. 1993, §4.3](https://articles.adsabs.harvard.edu/pdf/1993AJ....105..652M). These are older model estimates, retained at the source parallax of 136.8 ±3.3 mas: T=3034 ±160 K, R=0.26 ±0.0063 solar radii, L=0.0051 ±0.0011 solar luminosities. Formal errors do not cover all atmosphere-model systematics. The full text identifies 0.26 as a **radius** despite the abstract calling it a diameter.

The RV is the approximate system velocity quoted by Bond et al.; no formal error is invented. Both components combine it with their existing positional/proper-motion snapshots to restore approximate bulk space motion. Provenance explicitly says this is a shared systemic approximation, without individual orbital velocity or orbital phase. The resulting Sun-relative speed is approximately 169 km/s with the retained Gaia snapshot; it need not exactly reproduce the paper's 167 km/s computed with a different astrometric solution. The shared 12.7 ±2.7 Gyr age is a coeval-system inference from A, not an independently measured B age. B's individual metallicity remains unavailable.

## Achird (Eta Cassiopeiae)

The earlier A value −0.972 was Gaia GSP-Phot **[M/H]**, while the earlier B value −0.1798 was a catalogued **[Fe/H]** measurement. They are different quantities. All bundled catalogs now carry an explicit `metallicity_kind`, preserve it when merging overlays, and use it in the inspector heading, explanation and accessible scale description. Unlabelled numeric abundance inputs fail parsing; no [M/H]↔[Fe/H] conversion is assumed. The distinction follows [Gaia's GSP-Phot analysis documentation](https://gea.esac.esa.int/archive/documentation/GDR3/Data_analysis/chap_cu8par/sec_cu8par_apsis/ssec_cu8par_apsis_gspphot.html) and each iron-abundance source.

[Aleo et al. 2017, Table 1](https://arxiv.org/abs/1709.01244) measures both resolved components with the same analysis: **A [Fe/H] = −0.230 ±0.047 dex; B = −0.305 ±0.448 dex**. These measurements agree within their uncertainties; they are independently sourced and are not forced to be equal. B's abundance is poorly constrained, with no accurate Fe II measurements because of blends (the table's phi footnote). B's temperature is **4011 ±38 K**, replacing the incompatible 5921 K generic supplement.

B's newly supplied mass is **0.5487 ±0.0056 solar masses**, from [Giovinazzi et al. 2025, Table 6](https://arxiv.org/abs/2505.12563). Radius **0.57 (+0.02/−0.03) solar radii** and luminosity **0.082 solar luminosities** are Gaia DR2 Apsis-FLAME model estimates for exact source **425040000959067008**, crossmatched in the frozen SIMBAD identity. The [retrieved source record](../catalog-work/star-systems/achird-b-gaia-dr2.tsv) is hashed in the review plan. The radius retains DR2's original temperature 4091.89 K; it is not recomputed with the separate Aleo temperature. VizieR rounds the luminosity and both percentile bounds to 0.082, so no zero uncertainty or extra precision is invented. No independent B age is supplied. Superseded abundance/temperature sources remain in provenance as alternatives.

Achird A's missing radial velocity is supplied separately through the nearest-1000 reviewed RV tier: **+8.397 km/s**, from [Chubak et al. 2012 preprint, Table 3](https://arxiv.org/abs/1207.6212), resolved **HD 4614**, distinct from the paper's HD 4614b row. It is a Solar System barycentric mean of 37 observations, mean JD 2455017, over 789 days. The published **0.117 km/s** is observation scatter, combining measurement errors and intrinsic variation; the authors do not give a formal uncertainty on this mean, so that field remains blank. This observed component RV includes orbital motion and is not an orbital systemic solution. Combined with A's retained CNS5 astrometry, it restores a full Sun-relative velocity vector with speed **35.031 km/s** for the app's static linear approximation. The pipeline also reapplies the existing J2000 propagation with full space motion, causing a small position/distance correction and changing the derived absolute V by 0.00005 mag. B retains its separate existing Gaia/CNS5 RV; A's measurement is not copied to it.

## Wider review

The frozen [Cifuentes et al. 2025 Table A.1 subset](../catalog-work/star-systems/cifuentes-2025-component-properties.json) contains 89 exact Gaia DR3 matches to represented component-card members. Newly split aggregate identities are excluded from that matching. Of these matches, 25 members receive missing properties from the publication. Adoption excludes composite component labels, spectroscopic/ambiguous aggregate records, candidate inner multiples and source quality flags. Photometric mass/radius calibration values are restricted to the published absolute-G range 7.5–14 when no SED luminosity is available. These are estimates, not dynamical masses. Compiled metallicities and RVs are not adopted from this table. Exact source IDs, uncertainties and methods remain in provenance.

Individual literature adds visual magnitudes for GJ 570 B/C, GJ 644 A/Ba/Bb and GJ 661 A/B; physical properties for Zeta Her A/B, Iota Peg A/B, Gamma Cep A/B, Chi1 Ori A and GJ 569 Ba/Bb; and shared orbital systemic velocities for GJ 570 BC, GJ 644 A/Ba/Bb, Gamma Cep A/B and Capella Aa/Ab. Published system ages are identified as shared model ages. The [Reyle census subset](../catalog-work/star-systems/reyle-2023-component-photometry.json) supplies resolved GJ 667 A/B Johnson V photometry. Sources and table/section references are in the [review plan](../catalog-work/star-systems/reviewed-component-properties.json).

EZ Aquarii A/B/C share the **−50.08 ± 0.01 km/s** systemic velocity from [Ségransan et al. 2000, Table 2](https://arxiv.org/abs/astro-ph/0010585), row `Gl 866AC-B`, parameter `V0`. The uncertainty is the published orbital-fit uncertainty on the system velocity. The [shared-object review](../catalog-work/shared-enrichment/reviewed-objects.json) applies this explicitly scoped bulk-motion approximation to all three exact component IDs in the default, nearest-100 and nearest-1000 catalogs. Galactic velocities use the retained system position, parallax and proper motion; frozen J2000 markers and all physical/photometric fields remain unchanged. Individual orbital velocities and orbital phase are not modeled. The inspector labels this as system bulk motion and exposes the scope in existing tooltips.

Explicitly reviewed spectra can supply a mean-dwarf temperature estimate when an individual temperature is unavailable. Existing temperatures, radii and luminosities can complete a missing field through the Stefan–Boltzmann law. These fallbacks retain estimated/derived status. Existing curated values are preserved. Combined flux, Gaia G or K magnitudes are never substituted for individual Johnson V; primary photospheric abundances are not copied to companions.

Coverage of the initial broad pass (before the subsequent Achird correction):

| Nearest-1000 non-Sun field | Before | After | Added |
| --- | ---: | ---: | ---: |
| Absolute Johnson V magnitude | 539 | 552 | 13 |
| Radial velocity | 673 | 684 | 11 |
| Temperature | 855 | 872 | 17 |
| Mass | 575 | 601 | 26 |
| Bolometric luminosity | 599 | 610 | 11 |
| Radius | 611 | 631 | 20 |
| Metallicity | 609 | 611 | 2 |
| Age | 85 | 90 | 5 |
| Spectral type | 971 | 976 | 5 |

## Remaining gaps and reproduction

The [property coverage report](../catalog-work/star-systems/companion-property-coverage.json) lists every missing field for the 284 represented members of 128 nearest-1000 component-card systems. This is a research queue, not a claim that every published measurement has been exhausted. Unresolved individual properties remain blank; for example, HD 50281 Bb has no adopted individual temperature or visual magnitude, and GJ 569 Bb has no adopted individual mass.

The review is applied by `scripts/catalog_sources/component_enrichment.py` after splitting and before catalog serialization. It guards stable names and exact Gaia identities, verifies frozen input hashes, fills blank fields, permits explicit corrections only when the expected previous value and abundance kind match, and records superseded values/sources and withholding decisions. Reproduce with:

```sh
/tmp/star-view-catalog-venv311/bin/python scripts/author-nearest1000.py build --force
python3 scripts/author-bright-stars.py --write
python3 scripts/author-landmark-stars.py --write
python3 scripts/audit-star-systems.py
python3 scripts/audit-overlay-systems.py
python3 scripts/audit-companion-properties.py
python3 scripts/author-object-designations.py
npm run catalog:generate
```

Validation of the Achird/abundance-type correction: six focused Python enrichment tests, eight focused catalog/parser tests and one desktop browser regression passed. Nearest-1000 reproduces byte for byte; catalog validation, TypeScript checking, production build and diff whitespace checking passed. No full test suite was run.

Validation of the subsequent Achird A velocity addition: two focused Achird catalog tests passed; nearest-1000 reproduced byte for byte, and catalog validation, TypeScript checking and production build passed. Browser behavior was not rechecked and no full test suite was run.

### 70 Ophiuchi A/B review (2026-10-15)

Exact components `10pc-0115` / Gaia DR3 `4468557611984384512` and `10pc-0116` / Gaia DR3 `4468557611977674496` now use the individual dynamical masses from [Li et al. 2026, revised v2 Table 2](https://arxiv.org/html/2603.20044v2): 0.8827 (+0.0044/-0.0043) and 0.7319 +/- 0.0031 solar masses. Component temperatures (5301 +/- 67 / 4465 +/- 65 K) and radii (0.831 +/- 0.004 / 0.670 +/- 0.009 solar radii) are the published compilation in its Table 1; bolometric luminosities (0.53 +/- 0.02 / 0.15 +/- 0.02 solar luminosities) come from [Eggenberger et al. 2008, Table 2 and section 2.3](https://arxiv.org/pdf/0802.3576). These independent constraints are retained as published rather than recomputed into an artificially exact Stefan-Boltzmann match.

The displayed ages are Li et al.'s separate activity-model medians, 2.81 (+1.65/-0.80) / 2.99 (+0.66/-0.51) Gyr. The older 6.2 +/- 1.0 Gyr seismic system age is retained as a conflicting alternative, not treated as a precise measured age. The model's scalar uncertainty uses the larger side; both sides survive in the review. B's K4V class is restored explicitly from Table 1 (the text notes K4-K5V); MSC's blank secondary spectrum no longer erases its main-sequence class.

Existing component photometry, metallicity quantities and values, astrometry, uncertainties and velocities are unchanged. No shared mean abundance is copied to B, and the 2008 Geneva-system V measurements are not substituted for Johnson V. `catalog-work/shared-enrichment/70-ophiuchi-review.json` retains the full previous effective component records, source snapshots and the new uncertainty/age decisions. Nearest-100 physical overrides feed nearest-1000 and the shared component pool; the focused browser regression checks A/B switching in both catalogs.
