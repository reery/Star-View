# Hot-star temperature review

Reviewed 2026-10-11. This covers the 13 remaining distinct O/early-B (B0-B5), non-composite catalog entries with temperatures below 10,000 K flagged after correcting Zeta1 Scorpii. Late-B borderline cases and explicitly composite spectra are outside this candidate set.

The old temperatures came from the zero-reddening McDonald et al. 2012 broadband SED models, inherited through the bright catalog or selected before object-specific spectroscopy. Reddening and Be-disk contamination can bias these fits. The published source data are retained; the reviewed adoption takes precedence through the existing shared-object pipeline.

| Catalog object | Exact identity | Previous K | Adopted K | Source |
| --- | --- | ---: | ---: | --- |
| Beta1 Sco | HIP 78820 / HD 144217 | 9546 | 30,540 | [2009A&A...501..297Z](https://arxiv.org/abs/0903.5134) |
| Tianguan | HIP 26451 / HD 37202 | 9124 | 21,478 | [2001A&A...378..861C](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/378/861) |
| Zeta Oph | HIP 81377 / HD 149757 | 9199 | 30,700 | [2024A&A...687A.228D](https://arxiv.org/abs/2312.00241) |
| Dschubba | HIP 78401 / HD 143275 | 8798 | 30,900 | [2018MNRAS.474.5287A](https://arxiv.org/abs/1711.08675) |
| Tiansi | HIP 4427 / HD 5394 | 7664 | 27,990 | [2001A&A...378..861C](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/378/861) |
| Delta Cen | HIP 59196 / HD 105435 | 8850 | 22,150 | [2018MNRAS.474.5287A](https://arxiv.org/abs/1711.08675) |
| Zeta Per | HIP 18246 / HD 24398 | 7725 | 23,500 | [2024A&A...687A.228D](https://arxiv.org/abs/2312.00241) |
| Omega CMa | HIP 35037 / HD 56139 | 9061 | 17,170 | [2018MNRAS.474.5287A](https://arxiv.org/abs/1711.08675) |
| Atik | HIP 17448 / HD 23180 | 8200 | 22,840 | [2009A&A...501..297Z](https://arxiv.org/abs/0903.5134) |
| Menkib | HIP 18614 / HD 24912 | 8648 | 35,900 | [2022A&A...665A.150H](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/665/A150) |
| HD 175156 | HIP 92814 / HD 175156 | 7292 | 14,001 | [2008ApJ...683.1045H](https://arxiv.org/abs/0805.2133) |
| Iota CMa | HIP 33347 / HD 51309 | 9800 | 16,800 | [2024A&A...687A.228D](https://arxiv.org/abs/2312.00241) |
| Alpha Cam | HIP 22783 / HD 30614 | 9200 | 29,000 | [2024A&A...687A.228D](https://arxiv.org/abs/2312.00241) |

Object-specific errors, method assumptions, original table rows, and exact catalog IDs are recorded in [the review ledger](../catalog-work/shared-enrichment/hot-star-temperature-review.json). Binary temperatures are explicitly primary-dominated apparent values; they are not copied into individually resolved companions. Rapidly rotating Be-star temperatures do not describe the much cooler disk or separately resolved polar/equatorial surfaces.

The rejected fit also supplied luminosity and dependent radius. Both are withheld for 12 objects instead of combining the new temperature with a rejected luminosity or assigning blended angular diameters to components. Omega CMa retains the same BeSOS model's 10.5-solar-radius photosphere at its published 279-pc distance; its luminosity is derived from that model's own temperature and radius. The BeSOS temperature/radius errors are assumed percentages, not independently determined statistical errors.

HD 175156 retains the directly inspected Huang & Gies 2008 H-gamma fit (14,001 K, formal error 77 K). Other frozen library entries report roughly 15,750-16,361 K; this review does not average heterogeneous determinations or claim that the formal error captures that disagreement. Menkib uses the 35.9-kK IACOB spectroscopic value; the table's spectroscopic luminosity parameter T^4/g is not a bolometric luminosity.

Shared values are authored in `catalog-work/shared-enrichment/reviewed-objects.json`; the review ledger and reviewed-object checksum are frozen in `source-manifest.json`. Catalog membership, spectral classifications, astrometry, motion, mass, age and metallicity remain unchanged.

## 2026-10-26 extension

A comparison of every McDonald et al. 2012 temperature in the Western constellation catalog with the frozen SIMBAD `mesFe_h` literature pool found 42 further O/B/A entries whose SED temperature lies more than 20 percent below the spectroscopic consensus. All 42 took temperature and luminosity from that fit and derived their radius from it.

Each adopted value is the existing automatic selection from that pool: the newest catalogued value within 10 percent of the pool median, held by a strict majority. Gaia DR3 republications are excluded, and the selection omits outliers such as Maia's 8000 K RAVE grid-edge value. `mesFe_h` records no uncertainties, so none are given. Fourteen objects rest on a single catalogued value, nine of them from Sokolov 1995. The policy matches the original review: object-specific evidence replaces the fit, no temperature is inferred from the spectral label, and luminosity and dependent radius are withheld.

| Catalog object | Exact identity | Spectral type | Previous K | Adopted K | Source |
| --- | --- | --- | ---: | ---: | --- |
| 6 Lac | HIP 111104 / HD 213420 | B2IV | 12,500 | 19,750 | [2009A&A...501..297Z](https://ui.adsabs.harvard.edu/abs/2009A%26A...501..297Z) |
| Alcyone | HIP 17702 / HD 23630 | B7III | 10,168 | 13,490 | [2001A&A...378..861C](https://ui.adsabs.harvard.edu/abs/2001A%26A...378..861C) |
| Alfirk | HIP 106032 / HD 205021 | B0.5IIIs | 13,871 | 27,800 | [2021MNRAS.505.4496G](https://ui.adsabs.harvard.edu/abs/2021MNRAS.505.4496G) |
| Alpha Pyx | HIP 42828 / HD 74575 | B1.5III | 18,226 | 23,400 | [2024A&A...687A.228D](https://ui.adsabs.harvard.edu/abs/2024A%26A...687A.228D) |
| Celaeno | HIP 17489 / HD 23288 | B7V | 9,599 | 12,246 | [2012A&A...537A.120Z](https://ui.adsabs.harvard.edu/abs/2012A%26A...537A.120Z) |
| Delta Per | HIP 17358 / HD 22928 | B5III | 10,806 | 14,890 | [2009A&A...501..297Z](https://ui.adsabs.harvard.edu/abs/2009A%26A...501..297Z) |
| Epsilon Per | HIP 18532 / HD 24760 | B0.5III | 21,001 | 27,160 | [2009A&A...501..297Z](https://ui.adsabs.harvard.edu/abs/2009A%26A...501..297Z) |
| Eta Hya | HIP 42799 / HD 74280 | B3V | 15,680 | 20,000 | [2023MNRAS.519.5472M](https://ui.adsabs.harvard.edu/abs/2023MNRAS.519.5472M) |
| Eta Lup | HIP 78384 / HD 143118 | B2.5IV | 14,668 | 21,490 | [1995A&AS..110..553S](https://ui.adsabs.harvard.edu/abs/1995A%26AS..110..553S) |
| Furud | HIP 30122 / HD 44402 | B2.5V | 15,227 | 20,950 | [1995A&AS..110..553S](https://ui.adsabs.harvard.edu/abs/1995A%26AS..110..553S) |
| Gamma Ara | HIP 85267 / HD 157246 | B1Ib | 11,503 | 23,700 | [2024A&A...687A.228D](https://ui.adsabs.harvard.edu/abs/2024A%26A...687A.228D) |
| Gamma Col | HIP 28199 / HD 40494 | B2.5IV | 12,904 | 16,870 | [1995A&AS..110..553S](https://ui.adsabs.harvard.edu/abs/1995A%26AS..110..553S) |
| Gamma Lup | HIP 76297 / HD 138690 | B2IV | 15,288 | 22,210 | [1995A&AS..110..553S](https://ui.adsabs.harvard.edu/abs/1995A%26AS..110..553S) |
| HD 21291 | HIP 16228 / HD 21291 | B9Ia | 5,888 | 10,800 | [2012A&A...543A..80F](https://ui.adsabs.harvard.edu/abs/2012A%26A...543A..80F) |
| HD 92938 | HIP 52370 / HD 92938 | B3V | 11,558 | 19,000 | [2018MNRAS.474.5287A](https://ui.adsabs.harvard.edu/abs/2018MNRAS.474.5287A) |
| HD 93549 | HIP 52701 / HD 93549 | B6-7V | 10,471 | 13,300 | [2021MNRAS.502.3670G](https://ui.adsabs.harvard.edu/abs/2021MNRAS.502.3670G) |
| Imai | HIP 59747 / HD 106490 | B2IV | 14,078 | 22,570 | [1995A&AS..110..553S](https://ui.adsabs.harvard.edu/abs/1995A%26AS..110..553S) |
| Iota Her | HIP 86414 / HD 160762 | B3IV | 13,692 | 18,000 | [2023MNRAS.519.5472M](https://ui.adsabs.harvard.edu/abs/2023MNRAS.519.5472M) |
| Kappa Cen | HIP 73334 / HD 132200 | B2IV | 12,463 | 19,890 | [1995A&AS..110..553S](https://ui.adsabs.harvard.edu/abs/1995A%26AS..110..553S) |
| Kappa Dra | HIP 61281 / HD 109387 | B6IIIe | 9,744 | 16,906 | [2023ApJS..266...41P](https://ui.adsabs.harvard.edu/abs/2023ApJS..266...41P) |
| Lambda Cet | HIP 13954 / HD 18604 | B6III | 10,799 | 13,940 | [2009A&A...501..297Z](https://ui.adsabs.harvard.edu/abs/2009A%26A...501..297Z) |
| Lambda Eri | HIP 23972 / HD 33328 | B2III(e)p | 12,000 | 22,803 | [2001A&A...378..861C](https://ui.adsabs.harvard.edu/abs/2001A%26A...378..861C) |
| Lambda Lep | HIP 24845 / HD 34816 | B0.5V | 22,237 | 30,000 | [2022ApJ...937..110L](https://ui.adsabs.harvard.edu/abs/2022ApJ...937..110L) |
| Lambda Pav | HIP 92609 / HD 173948 | B2Ve | 11,282 | 22,000 | [2006MNRAS.371..252L](https://ui.adsabs.harvard.edu/abs/2006MNRAS.371..252L) |
| Lambda Tau | HIP 18724 / HD 25204 | B4IV | 10,673 | 16,970 | [2009A&A...501..297Z](https://ui.adsabs.harvard.edu/abs/2009A%26A...501..297Z) |
| Maia | HIP 17573 / HD 23408 | B7III | 9,530 | 12,250 | [2021ApJ...921..117T](https://ui.adsabs.harvard.edu/abs/2021ApJ...921..117T) |
| Mu Cen | HIP 67472 / HD 120324 | B2Vnpe | 14,498 | 23,950 | [2018MNRAS.474.5287A](https://ui.adsabs.harvard.edu/abs/2018MNRAS.474.5287A) |
| Nu Eri | HIP 21444 / HD 29248 | B2III | 15,538 | 22,000 | [2012A&A...539A.143N](https://ui.adsabs.harvard.edu/abs/2012A%26A...539A.143N) |
| Nu Ori | HIP 29038 / HD 41753 | B3IV | 13,773 | 18,800 | [2009A&A...501..297Z](https://ui.adsabs.harvard.edu/abs/2009A%26A...501..297Z) |
| Omega Car | HIP 50099 / HD 89080 | B7III | 9,199 | 11,600 | [2018MNRAS.474.5287A](https://ui.adsabs.harvard.edu/abs/2018MNRAS.474.5287A) |
| Omicron2 CMa | HIP 33977 / HD 53138 | B3Ia | 11,200 | 17,000 | [2024ApJ...971..166M](https://ui.adsabs.harvard.edu/abs/2024ApJ...971..166M) |
| Paikauhale | HIP 81266 / HD 149438 | B0V | 21,001 | 31,660 | [2023ApJS..266...11B](https://ui.adsabs.harvard.edu/abs/2023ApJS..266...11B) |
| Pi Cet | HIP 12770 / HD 17081 | B8IV | 11,141 | 14,000 | [2023MNRAS.519.5472M](https://ui.adsabs.harvard.edu/abs/2023MNRAS.519.5472M) |
| Pi4 Ori | HIP 22549 / HD 30836 | B2III | 12,705 | 21,200 | [2024A&A...687A.228D](https://ui.adsabs.harvard.edu/abs/2024A%26A...687A.228D) |
| Sheliak | HIP 92420 / HD 174638 | B8.5Ib-II | 8,200 | 13,263 | [1986MNRAS.219..479B](https://ui.adsabs.harvard.edu/abs/1986MNRAS.219..479B) |
| Sigma Cen | HIP 60823 / HD 108483 | B2V | 15,744 | 22,350 | [1995A&AS..110..553S](https://ui.adsabs.harvard.edu/abs/1995A%26AS..110..553S) |
| Theta Ara | HIP 88714 / HD 165024 | B0.5Iab | 11,056 | 22,500 | [2024A&A...687A.228D](https://ui.adsabs.harvard.edu/abs/2024A%26A...687A.228D) |
| Theta Car | HIP 52419 / HD 93030 | B0Vp | 21,001 | 31,103 | [2023A&A...676A.129H](https://ui.adsabs.harvard.edu/abs/2023A%26A...676A.129H) |
| V686 CrA | HIP 92989 / HD 175362 | B3V | 13,500 | 17,600 | [2019MNRAS.485.1508S](https://ui.adsabs.harvard.edu/abs/2019MNRAS.485.1508S) |
| a Car | HIP 45080 / HD 79351 | B2IV-V | 15,416 | 20,880 | [1995A&AS..110..553S](https://ui.adsabs.harvard.edu/abs/1995A%26AS..110..553S) |
| c Oph | HIP 85755 / HD 158643 | A0V | 7,308 | 10,500 | [2023MNRAS.519.3958I](https://ui.adsabs.harvard.edu/abs/2023MNRAS.519.3958I) |
| d Car | HIP 42568 / HD 74375 | B2III | 14,843 | 27,600 | [1995A&AS..110..553S](https://ui.adsabs.harvard.edu/abs/1995A%26AS..110..553S) |

Unresolved named multiples (SIMBAD `SB*`, `EB*` or `**`) carry primary-dominated apparent temperatures. Sheliak is an interacting eclipsing binary; its value describes the catalogued light, not a resolved component. Be-star temperatures describe the star, not its disk.

### Failed hot fits

Two cooler stars had the opposite failure: the SED fit returned a temperature far hotter than every catalogued spectroscopic value. Nu Hya, a K giant, had 17,296 K against 19 measurements of 4,202-4,456 K. Wasat had 11,994 K against three measurements of 6,865-6,966 K. Their radii from the fit, 1.5 and 1.1 solar radii, were also impossible for these stars.

| Catalog object | Exact identity | Spectral type | Previous K | Adopted K | Source |
| --- | --- | --- | ---: | ---: | --- |
| Nu Hya | HIP 52943 / HD 93813 | K1.5IIIHdel-0.5 | 17,296 | 4,202 | [2024A&A...690A..97C](https://ui.adsabs.harvard.edu/abs/2024A%26A...690A..97C) |
| Wasat | HIP 35550 / HD 56986 | F2VkF0mF0 | 11,994 | 6,966 | [2012A&A...537A.120Z](https://ui.adsabs.harvard.edu/abs/2012A%26A...537A.120Z) |

Their luminosity and radius are withheld in the same way. Wasat is an unresolved spectroscopic binary, so its temperature is primary-dominated.

Thirteen of these stars also have component records in the companion pool. Their original catalog source records, including the rejected luminosity and radius, are kept with explicit scope as `retainedCatalogSources` in the shared review. Every withheld catalog field is listed with its reason in `catalog-work/reviewed-data-retirements.json`.

## 2026-10-28 extension

The 2026-10-26 comparison covered temperatures selected directly from McDonald et al. 2012. Fourteen more O/B stars carried the same kind of failure through other routes: values inherited from the retired bright catalog, or temperatures from the Allende Prieto & Lambert 1999 evolutionary-model solutions (logTeff from Hipparcos absolute magnitude and colour). Each lies more than 20 percent from the frozen SIMBAD `mesFe_h` median, and each adopted value is the same automatic pool selection as in the previous extension.

| Catalog object | Exact identity | Spectral type | Rejected model | Previous K | Adopted K | Source | Withheld |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| Naos | HIP 39429 / HD 66811 | O4I(n)fp | SED | 24,684 | 36,630 | [2023ApJS..266...11B](https://ui.adsabs.harvard.edu/abs/2023ApJS..266...11B) | luminosity, radius |
| Mintaka | HIP 25930 / HD 36486 | O9.5IINwk | SED | 18,063 | 30,000 | [2024ApJ...971..166M](https://ui.adsabs.harvard.edu/abs/2024ApJ...971..166M) | luminosity, radius |
| Alnilam | HIP 26311 / HD 37128 | B0Ia | SED | 18,341 | 28,000 | [2024ApJ...971..166M](https://ui.adsabs.harvard.edu/abs/2024ApJ...971..166M) | luminosity, radius |
| Saiph | HIP 27366 / HD 38771 | B0.5Ia | SED | 18,292 | 26,000 | [2024ApJ...971..166M](https://ui.adsabs.harvard.edu/abs/2024ApJ...971..166M) | luminosity, radius |
| Uridim | HIP 71860 / HD 129056 | B1.5III | SED | 11,594 | 23,200 | [2024A&A...687A.228D](https://ui.adsabs.harvard.edu/abs/2024A%26A...687A.228D) | luminosity, radius |
| Aludra | HIP 35904 / HD 58350 | B5Ia | SED | 10,000 | 16,000 | [2024ApJ...971..166M](https://ui.adsabs.harvard.edu/abs/2024ApJ...971..166M) | luminosity, radius |
| Kappa Lep | HIP 24327 / HD 33949 | B7V | SED | 10,138 | 11,588 | [2012A&A...537A.120Z](https://ui.adsabs.harvard.edu/abs/2012A%26A...537A.120Z) | luminosity, radius |
| Algenib | HIP 1067 / HD 886 | B2IV | SED (too hot) | 27,008 | 21,631 | [2023A&A...676A.129H](https://ui.adsabs.harvard.edu/abs/2023A%26A...676A.129H) | luminosity, radius |
| Eta Cen | HIP 71352 / HD 127972 | B2Ve | APL99 | 14,454 | 21,000 | [2018MNRAS.474.5287A](https://ui.adsabs.harvard.edu/abs/2018MNRAS.474.5287A) | luminosity, radius |
| Alpha Ara | HIP 85792 / HD 158427 | B2Vne | APL99 | 13,183 | 22,150 | [2006MNRAS.371..252L](https://ui.adsabs.harvard.edu/abs/2006MNRAS.371..252L) | luminosity, radius |
| Theta CrB | HIP 76127 / HD 138749 | B6Vnne | APL99 | 12,589 | 17,000 | [2023MNRAS.519.5472M](https://ui.adsabs.harvard.edu/abs/2023MNRAS.519.5472M) | luminosity, radius |
| Sirrah | HIP 677 / HD 358 | B8IV-VHgMn | APL99 | 9,550 | 14,000 | [2023MNRAS.519.5472M](https://ui.adsabs.harvard.edu/abs/2023MNRAS.519.5472M) | luminosity, radius |
| Alnair | HIP 109268 / HD 209952 | B6V | APL99 | 10,233 | 12,882 | [2012A&A...537A.120Z](https://ui.adsabs.harvard.edu/abs/2012A%26A...537A.120Z) | luminosity, radius |
| Alkaid | HIP 67301 / HD 120315 | B3V | APL99 | 11,220 | 17,870 | [2009A&A...501..297Z](https://ui.adsabs.harvard.edu/abs/2009A%26A...501..297Z) | — |

An APL99 radius came from the rejected solution and is withheld. Its luminosity is withheld when it was either derived from that solution (Sirrah, Alnair) or taken from a McDonald fit that is itself far too cool (Eta Cen 13,511 K, Alpha Ara 7,905 K, Theta CrB 10,799 K). Alkaid keeps its luminosity, whose McDonald fit (15,716 K) is close to the adopted value, and its interferometric radius (2018AJ....155...30B). As before, masses are unchanged, including the APL99 masses fitted with the rejected temperatures.

Because the Western catalog refills blank fields from the retired bright archive, that archive was regenerated with the same shared adoption. Mintaka, Sirrah and Theta CrB have component records; their earlier catalog source records are kept as `retainedCatalogSources`. 4 Lac and Merope also lie more than 20 percent from their pool medians, but their pools have no strict-majority consensus, so they are unchanged.
