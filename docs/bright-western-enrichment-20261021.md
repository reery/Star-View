# Bright and Western stars: 151-target enrichment

Reviewed 2026-10-21 against baseline commit `b23fad878af9907cf350e91531c2bc238987884b`.

All **151 frozen targets** have a source-review decision. **56 targets gained 125 individual-star scalar values**: 35 masses, 28 radii, 27 luminosities, 25 ages, six temperatures, and four metallicities. The other 95 targets have no additional accepted values in this review. This does not establish that no dedicated publication exists; those fields remain blank where the reviewed evidence is absent, blended, ambiguous, or inconsistent.

The changes fill **116 previously empty displayed fields**. Nine of the new individual values replace a displayed system-source fallback or model range, so they improve component specificity without filling an empty display slot. Of the original 151 stars, **53 now have at most two displayed gaps; 98 still have more than two**.

| Field | Missing before | Missing after | Newly displayed |
| --- | ---: | ---: | ---: |
| Temperature | 8 | 4 | 4 |
| Mass | 142 | 107 | 35 |
| Luminosity | 62 | 38 | 24 |
| Radius | 62 | 38 | 24 |
| Metallicity | 110 | 106 | 4 |
| Age | 151 | 126 | 25 |

## Scope and adoption rules

The target set is the previously reported union of Bright stars and Western constellation stars, including the consolidated cluster landmarks. Exact HIP/HD/Gaia identifiers and reviewed canonical component IDs deduplicate the catalogs. Only unassigned stellar records and the primary branches A, Aa, and Aa1 qualify. The Sun and all secondary/higher components are excluded. The six audited fields are temperature, mass, luminosity, radius, metallicity, and age; selection required more than two missing displayed fields.

Existing non-null measurements win. New component values require an exact system/member/label match. Unresolved luminosity, system mass, blended spectroscopy, initial composition, generic spectral-type masses, minimum companion masses, and assumed model-grid inputs are not promoted into individual-star measurements. Model estimates retain their status, formal errors or asymmetric bounds, alternate solutions, and material assumptions. A missing published uncertainty remains null.

The broad crossmatch covers 127 targets in 15 source families. Dedicated papers supplement selected exact primaries. Target-matched raw CDS rows, their original ReadMe column definitions, selected factual paper tables, reference URLs, and SHA-256 digests are frozen under [the review inputs](../catalog-work/bright-western-enrichment-20261021/). Rejected alternatives are retained alongside accepted values.

## Notable adoptions and limitations

- **Eta Sagittarii:** mass 2.1 ± 0.7 solar masses, radius 66 ± 12 solar radii, and luminosity approximately 525 solar luminosities. The mass is a granulation-scaling estimate; radius and luminosity retain their independent published distance assumptions. Age remains unknown. [Kallinger et al. 2019, Tables 2–3](https://arxiv.org/html/1902.07531).
- **Chi Draconis A:** disentangled spectroscopic temperature and [Fe/H], interferometric radius, and the source-derived luminosity. Its existing dynamical mass stays unchanged. Nine seismic pipelines yield different ages, so this review does not select an arbitrary one. [Rudrasingam et al. 2026, Table 1](https://arxiv.org/html/2609.25343).
- **Mu Herculis Aa:** observed temperature, photospheric [Fe/H], luminosity, and seismic radius/age. The initial model composition is not substituted for the observed abundance; the existing dynamical mass is preserved. [2025 helium-glitch analysis](https://arxiv.org/html/2509.01577).
- **Mu Ceti A:** primary mass and model age, secondary-subtracted IRFM radius, coherent Stefan–Boltzmann luminosity, and the published hot-atmosphere Fe abundance. The initial photometric +0.06 [M/H] is not treated as the final spectroscopic abundance. [Dyachenko et al. 2024](https://arxiv.org/html/2409.15063).
- **Mintaka Aa1:** dynamical/model mass and radius, with luminosity calculated from the same publication's primary radius and temperature. The dimensionless V-band light fraction is not a bolometric luminosity. [2023 three-body analysis](https://arxiv.org/html/2301.10290).
- **Alnitak Aa:** the authors' preferred distance-constrained mass/radius, with the alternative orbital-only result and distance sensitivity retained. This is not a precise distance-independent dynamical mass. [Hummel et al. 2013](https://arxiv.org/html/1306.0330).
- **Mira Aa:** phase-0.13 Rosseland temperature and radius, plus a luminosity derived coherently at that phase. These are not cycle means or predictions for the current phase. Assumed model-grid masses are withheld. [Woodruff et al. 2004](https://arxiv.org/html/astro-ph/0404248).
- **Alsephina Aa:** individual mass/luminosity and a volume-equivalent radius of the rotating star. Its pole and equator are retained separately in the derivation inputs. Shared system metallicity is withheld. [Mérand et al. 2011](https://arxiv.org/html/1106.2383).

The source review also rejects the fractional-main-sequence age column as a Gyr age, weak or competing giant evolutionary-stage solutions, the Be envelope size of Gamma Cassiopeiae as a photospheric radius, classification-conflicting young-star fits, and inconsistent primary/secondary labels in the Piccotti binary tables. Some accepted giant masses and luminosities have broad source uncertainties; the frozen review preserves them without implying precision beyond the paper.

## Preservation and validation

The comparison covers **2,035 raw catalog records, 846 shared component records, 979 historical component source snapshots, and 2,013 object provenance records**. A separate comparison covers all **2,456 hydrated effective records across five shipped catalogs**. There are **156 added scalar occurrences** across those catalogs, representing the 125 unique target/field additions. No existing adopted value, record, retained source, astrometric value/error, or unrelated record changed. Secondary components are unchanged.

Enrichment runs after motion and resolved-observation reviews so historical source snapshots remain verbatim. The original pre-enrichment primary record is retained separately. Source catalogs, shared components, browser payloads, constellation chart snapshots, class-reference data, and source checksums have been regenerated.

Validation: `npm run catalog:preservation`; the focused 151-target audit; 25 focused Python checks; 40 focused Vitest checks; byte-for-byte catalog authoring checks; and `npm run build`. The full test suite was not run.

Machine-readable results and exact per-field provenance: [results.json](../catalog-work/bright-western-enrichment-20261021/results.json), [review-decisions.json](../catalog-work/bright-western-enrichment-20261021/review-decisions.json), and [physical-review.json](../catalog-work/bright-western-enrichment-20261021/physical-review.json).

## All 151 targets

Names below follow the frozen scope report. Technical IDs and any later preferred display aliases remain in the machine-readable records. “Added” counts individual scalar values, including values whose system fallback was already visible. “Remaining” counts displayed gaps after enrichment.

| Target | Added individual fields | Remaining displayed gaps | Review outcome |
| --- | --- | --- | --- |
| 10 UMa A | — | Mass, Luminosity, Radius, Age | Source/component inconsistencies; withheld |
| 5 Lac A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| 5 Ori | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Acamar | — | Mass, Luminosity, Radius, Metallicity, Age | No accepted additional value in the reviewed source set |
| Acrab Aa | — | Mass, Luminosity, Radius, Metallicity, Age | Unresolved/system survey values; withheld |
| Acrux Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Ahadi | — | Mass, Metallicity, Age | Conflicting or degenerate source estimates; withheld |
| Alaybasan A | — | Luminosity, Radius, Age | Source/component inconsistencies; withheld |
| Aldhibah A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Algieba A | Luminosity, Radius | Mass, Age | Applied; exact sources and uncertainties in review |
| Alkaphrah A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Alnitak Aa | Mass, Radius | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Alpha Cam | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Alpha Lupi | Age | Mass, Metallicity | Applied; exact sources and uncertainties in review |
| Alpha Lyn | Luminosity, Radius | Mass, Age | Applied; exact sources and uncertainties in review |
| Alpha Muscae Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Alsciaukat | Luminosity, Radius | Mass, Age | Applied; exact sources and uncertainties in review |
| Alsephina Aa | Luminosity, Mass, Radius | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Ascella A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Asellus Australis | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Ashlesha A | — | Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Atik Aa | — | Mass, Luminosity, Radius, Metallicity, Age | Unresolved/system survey values; withheld |
| Beta CrA | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Beta Crt | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Beta Hya | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Beta LMi A | Luminosity, Mass, Radius | Age | Applied; exact sources and uncertainties in review |
| Beta Lupi Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Beta Mon A | — | Mass, Luminosity, Radius, Metallicity, Age | Unresolved/system survey values; withheld |
| Beta Mus Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Beta Phe A | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Beta Ret Aa | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Beta Sex | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Bharani | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| c Oph | Mass | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Chi Draconis A | Luminosity, Metallicity, Radius, Temperature | Age | Applied; exact sources and uncertainties in review |
| Chi Eri | — | Mass, Luminosity, Radius, Age | No accepted additional value in the reviewed source set |
| d Car | Age | Mass, Metallicity | Applied; exact sources and uncertainties in review |
| Delta And Aa | Luminosity, Radius | Mass, Age | Applied; exact sources and uncertainties in review |
| Delta Aql | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Delta Centauri Aa | — | Mass, Luminosity, Radius, Metallicity, Age | Unresolved/system survey values; withheld |
| Delta Equ A | Age, Luminosity, Radius | Metallicity | Applied; exact sources and uncertainties in review |
| Delta Lup | Age, Mass | Metallicity | Applied; exact sources and uncertainties in review |
| Delta Mon | Mass | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Delta Per | Age | Mass, Metallicity | Applied; exact sources and uncertainties in review |
| Delta Ret | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Delta Ser A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Delta Sge A | Luminosity, Mass, Radius, Temperature | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Deneb Algedi | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Diadem A | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Epsilon Cet A | — | Luminosity, Radius, Age | Source/component inconsistencies; withheld |
| Epsilon Gru | — | Mass, Luminosity, Radius, Metallicity, Age | Unresolved/system survey values; withheld |
| Epsilon Nor Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Eta PsA A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Eta Sgr | Luminosity, Mass, Radius | Age | Applied; exact sources and uncertainties in review |
| f Eri Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Fang Aa1 | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Furud Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Gacrux | Mass | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Gamma Ara | Age | Mass, Metallicity | Applied; exact sources and uncertainties in review |
| Gamma Cam | Mass | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Gamma Cassiopeiae A | — | Mass, Luminosity, Radius, Metallicity, Age | Unresolved/system survey values; withheld |
| Gamma Centauri A | — | Mass, Luminosity, Radius, Metallicity, Age | Unresolved/system survey values; withheld |
| Gamma Cephei A | Age, Luminosity, Metallicity, Radius, Temperature | None | Applied; exact sources and uncertainties in review |
| Gamma Cir A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Gamma CrA A | — | Mass, Luminosity, Radius, Age | No accepted additional value in the reviewed source set |
| Gamma CrB A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Gamma Hyi | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Gamma Lup Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Gamma Phe | — | Temperature, Mass, Luminosity, Radius, Metallicity, Age | Unresolved/system survey values; withheld |
| Gamma Sge A | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Gudja | Luminosity, Mass, Radius | Age | Applied; exact sources and uncertainties in review |
| Hadir Aa | — | Temperature, Mass, Luminosity, Radius, Metallicity, Age | Unresolved/system survey values; withheld |
| HD 175156 | Age | Mass, Luminosity, Radius | Applied; exact sources and uncertainties in review |
| HD 21291 | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| HD 24479 | Mass | Metallicity, Age | Applied; exact sources and uncertainties in review |
| HD 42111 | Mass | Metallicity, Age | Applied; exact sources and uncertainties in review |
| HD 93194 | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Imai | Age, Mass | Metallicity | Applied; exact sources and uncertainties in review |
| Iota Aqr | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Iota CMa | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Iota Gru | — | Mass, Luminosity, Radius, Age | No accepted additional value in the reviewed source set |
| Kaffaljidhma A | — | Mass, Luminosity, Radius, Metallicity, Age | Unresolved/system survey values; withheld |
| Kappa Cen Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Kappa Lep | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Kappa Scorpii | Age | Mass, Metallicity | Applied; exact sources and uncertainties in review |
| Kitalpha A | Luminosity, Radius, Temperature | Age | Applied; exact sources and uncertainties in review |
| Lambda Cet | Mass | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Lambda Eri | Age | Mass, Metallicity | Applied; exact sources and uncertainties in review |
| Lambda Gru | — | Temperature, Mass, Luminosity, Radius, Metallicity, Age | No accepted additional value in the reviewed source set |
| Lambda Pav | Age, Mass | Metallicity | Applied; exact sources and uncertainties in review |
| Leepwal | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Lesath | Age, Mass | Metallicity | Applied; exact sources and uncertainties in review |
| Markeb | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Menkib | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Minelauva | Luminosity, Mass, Radius | Age | Applied; exact sources and uncertainties in review |
| Minkar | Age, Luminosity, Mass, Radius | None | Applied; exact sources and uncertainties in review |
| Mintaka Aa1 | Luminosity, Mass, Radius | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Mira Aa | Luminosity, Radius, Temperature | Mass, Metallicity, Age | Applied; exact sources and uncertainties in review |
| Mirach | Luminosity, Mass, Radius | Age | Applied; exact sources and uncertainties in review |
| Mizar Aa | Luminosity, Radius | Age | Applied; exact sources and uncertainties in review |
| Mothallah | — | Mass, Luminosity, Radius, Age | No accepted additional value in the reviewed source set |
| Mu Cet A | Age, Luminosity, Mass, Metallicity, Radius | None | Applied; exact sources and uncertainties in review |
| Mu Her Aa | Age, Luminosity, Metallicity, Radius, Temperature | None | Applied; exact sources and uncertainties in review |
| Mu Hya | Luminosity, Radius | Mass, Age | Applied; exact sources and uncertainties in review |
| Mu Psc | Age, Luminosity, Mass, Radius | None | Applied; exact sources and uncertainties in review |
| Mu Ser A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Nu Lep | Mass | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Nu Oct | Age, Luminosity, Mass, Radius | None | Applied; exact sources and uncertainties in review |
| Nu Vir | Luminosity, Radius | Mass, Age | Applied; exact sources and uncertainties in review |
| Omega CMa | Age, Mass | Metallicity | Applied; exact sources and uncertainties in review |
| Omega Eri | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Omega Lup | — | Temperature, Mass, Luminosity, Radius, Metallicity, Age | No accepted additional value in the reviewed source set |
| Omicron Her | Mass | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Omicron2 CMa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Peacock | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Phecda | Age, Mass | Metallicity | Applied; exact sources and uncertainties in review |
| Pherkad | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Phi Vel | Age | Mass, Metallicity | Applied; exact sources and uncertainties in review |
| Phi1 Lup | Luminosity, Mass, Radius | Age | Applied; exact sources and uncertainties in review |
| Pipit | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Polis | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Psi Phe | Luminosity, Mass, Radius | Age | Applied; exact sources and uncertainties in review |
| Psi Vel A | — | Mass, Luminosity, Radius, Metallicity, Age | Unresolved/system survey values; withheld |
| Rasalgethi A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Rho Cet | Mass | Metallicity, Age | Applied; exact sources and uncertainties in review |
| Rho Her Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Ruchbah | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| s Eri A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Sabik A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Sarin Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Shatabhisha | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Sualocin A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Tau Aqr | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Tau2 Hya A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Tau2 Lup A | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Tau4 Eri | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Theta Hya A | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Theta PsA A | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Theta1 Sgr | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Tianguan | Age, Mass | Luminosity, Radius | Applied; exact sources and uncertainties in review |
| Upsilon Gem | Age, Mass | Metallicity | Applied; exact sources and uncertainties in review |
| Upsilon1 Cen | Age, Mass | Metallicity | Applied; exact sources and uncertainties in review |
| w Car | — | Mass, Metallicity, Age | Conflicting or degenerate source estimates; withheld |
| Wasat Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Xi Hya | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Xi2 CMa | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Zeta Aqr Aa | — | Mass, Metallicity, Age | Unresolved/system survey values; withheld |
| Zeta Boo A | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
| Zeta Ophiuchi | Age, Mass | Luminosity, Radius, Metallicity | Applied; exact sources and uncertainties in review |
| Zeta Per | — | Mass, Luminosity, Radius, Age | Unresolved/system survey values; withheld |
| Zibal | — | Mass, Metallicity, Age | No accepted additional value in the reviewed source set |
