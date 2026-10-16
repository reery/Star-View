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
