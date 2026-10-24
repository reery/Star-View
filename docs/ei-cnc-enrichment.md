# EI Cancri A/B mass and radius review

Reviewed 2026-10-17. Adopt only the individual mass and radius estimates from
[Silverstein et al. 2025, Table 1](https://arxiv.org/html/2512.11120v1#S1.T1)
(arXiv preprint):

| Component | Stable ID | Gaia DR3 ID | Mass (solar) | Radius (solar) |
| --- | --- | --- | ---: | ---: |
| A | `10pc-0113` | `660597997696173440` | 0.120 ± 0.014 | 0.148 ± 0.013 |
| B | `10pc-0114` | `660597997697274752` | 0.103 ± 0.014 | 0.132 ± 0.013 |

The masses are attributed to [Winters et al. 2021](https://arxiv.org/abs/2011.09409)
and use an empirical mass–luminosity relation. Silverstein et al. calculate the
radii using the [Pineda et al. 2021](https://arxiv.org/abs/2106.07656) empirical
mass–radius relation. Neither quantity is a direct dynamical mass or a measured
diameter. Radius depends on mass; their errors are not independent. Retain the
published uncertainties rather than inventing more precise values.

These agree with the less precise Cifuentes et al. 2025 absolute-G estimates:
A mass 0.1266 ± 0.0438, radius 0.1362 ± 0.0196; B mass 0.1112 ± 0.0458,
radius 0.1189 ± 0.0205. A's category 3 describes observational coverage for the
multiplicity survey. This dedicated review does not relax the generic filter.

The existing M7 classifications and 2680 K mean-class estimates are retained.
The companion pipeline derives luminosities from the new radii and the unchanged
class temperature by Stefan–Boltzmann scaling. These remain dependent estimates,
not measured individual bolometric luminosities. The review does not adopt
unresolved 2MASS/UV/X-ray photometry, disputed individual V, rotation periods,
new metallicities, ages, or a fitted orbit. Astrometry, component RVs, motion,
photometry and their uncertainties are preserved.

`catalog-work/shared-enrichment/ei-cnc-review.json` freezes both prior nearby
catalog rows and provenance, both prior effective component records and their
audits, and the complete alternative Cifuentes rows. The reviewed physical
overrides feed both nearby catalogs and the common component pool.

Validation: both catalog packages reproduce byte for byte. Catalog preservation
passed for 2887 catalog/component records. A separate comparison against the
pre-change worktree checked all 2043 catalog rows and 844 effective components:
only these two stars' mass, radius, dependent luminosity and notes changed.
Unrelated per-object provenance is unchanged apart from the shared override-file
checksum. Astrometry, photometry, uncertainties and other physical fields remain
unchanged. Three focused data tests, one desktop browser test covering both stars
in both nearby catalogs, and the production build passed. Browser screenshots
were inspected. No full test suite was run.
