# Shared adopted catalog details

Reviewed 2026-10-08. The audit covers all six bundled catalogs, including the default nearest-neighbors catalog: 2,043 rows, 1,733 distinct objects, and 255 objects shared across catalogs. Exact stable IDs, reviewed component aliases, and unambiguous SIMBAD IDs are used. No name or positional matching is used.

128 shared objects had differences. These include source-reference and numerical-precision differences, not just conflicting physical measurements. The shared record resolves adopted scientific fields while catalog membership, IDs, display names, aliases, and original selection/source evidence remain catalog-specific.

The frozen review is [reviewed-objects.json](../catalog-work/shared-enrichment/reviewed-objects.json). It contains the selected values, bundle decisions, original source rows, source-input fingerprints, and original per-object provenance. All authoring recipes apply it after their existing source/component enrichment. The original published measurements remain evidence; the shared adoption controls the exported values.

Spectral corrections:

| Object | Shared adopted type | Evidence |
| --- | --- | --- |
| Altair | A7Vn | Gray et al. 2003; SIMBAD full classification |
| Sirius A | A0mA1Va | Gray et al. 2003; includes metallic-line morphology |
| Procyon A | F5IV-V | Kervella et al. 2004; remove the companion DQZ from primary rows |
| Tau Ceti | G8.5V | Gray et al. 2006 Table 2, HIP 8102 / HD 10700; preserve the census subtype and restore luminosity class |

Physical corrections:

| Object | Adopted temperature (K) | Decision |
| --- | ---: | --- |
| Epsilon Eridani | 5002 | Adopt the exact-ID Gaia DR3 model temperature and mass already used by the constellation catalog instead of legacy class estimates; retain the existing Gaia model radius, luminosity, abundance and age. |
| Altair | 7586 | Retain the individually adopted bright-star temperature/luminosity/radius bundle rather than the A7 mean-dwarf estimate; the temperature is the 1999 evolutionary-model value, not an individual spectroscopic measurement. The frozen automatic 6246 K temperature is not adopted for this rapidly rotating A star. |
| Vega | 9375 | Prefer the frozen 2026 measured temperature over the 1999 model temperature, retaining the precise adopted radius and its Stefan-Boltzmann luminosity. Preserve the previously curated 1999 model mass separately; it is not a new dynamical mass measurement. |
| Fomalhaut | 8745 | Prefer the frozen 2021 measured temperature over the 1999 model temperature, retaining the precise interferometric radius and its Stefan-Boltzmann luminosity. Preserve the previously curated 1999 model mass separately; it is not a new dynamical mass measurement. |
| Pollux | 4868 | Prefer the frozen 2025 spectroscopic temperature over the 1999 model temperature; retain the precise interferometric radius and recomputed Stefan-Boltzmann luminosity. |
| Denebola | 8421 | Prefer the published 2013 object-specific temperature over the 1999 model temperature; retain the precise adopted radius and its Stefan-Boltzmann luminosity. |
| Arcturus | 4236 | Prefer the frozen 2024 spectroscopic temperature over the 1999 model temperature. Withhold the automatic near-solar-metallicity evolutionary mass consistently for this metal-poor giant, as the bright/nearest catalogs already do; retain the adopted radius and its Stefan-Boltzmann luminosity. |
| Muphrid | 6220 | Prefer the frozen 2025 spectroscopic temperature over the 1999 model temperature; retain primary-dominated spectral scope and withhold individual mass, radius, luminosity and age as in the existing reviewed catalogs. |

Coordinate and motion bundles keep positions, velocities, raw ICRS coordinates, reference epochs, parallaxes, proper motions, radial velocities, uncertainties, and bibliographies together. Curated nearest-catalog records take priority over automatic landmark snapshots. For eleven reviewed stellar objects whose CNS5 rows lack RV, the already-adopted Western SIMBAD full-motion bundle supplies the shared record. Muphrid, Deneb Algedi, and composite Porrima retain the nearest-catalog RV withholding. Component or barycentric reviews are not replaced with aggregate-system measurements.

Johnson V absolute magnitudes follow the adopted coordinate/distance and component scope. Procyon uses its reviewed primary V=0.34. Acrux retains its specifically reviewed Bright Star Catalogue V=0.76. This reconciliation selects among frozen vetted inputs; it is not a live refresh of every published measurement.

`npm run catalog:validate` and `npm run catalog:generate` now compare every shared scientific detail and fail on drift, including blank versus known values, raw astrometric uncertainties, subtype labels, known-planet counts, and generated apparent magnitudes. Whitespace in spectral notation and different display names are allowed; distinct components sharing a SIMBAD system identifier are kept separate.

Sources: [Gray et al. 2003](https://doi.org/10.1086/378365), [Gray et al. 2006 Table 2](https://arxiv.org/html/astro-ph/0603770), [Kervella et al. 2004](https://arxiv.org/abs/astro-ph/0309148). Other physical sources, uncertainties, and model/derived caveats are preserved in the frozen review.

Validation: all 255 shared objects agree across all six catalogs. Membership, stable IDs, names, aliases, object types, epochs and constellations are unchanged. The focused catalog/consistency tests passed (28 TypeScript tests and 3 Python tests); all four catalog-authoring recipes reproduce their outputs, identity/stat supplements reproduce exactly, typecheck passes, and the diff check is clean. The full test suite and browser checks were not run.
