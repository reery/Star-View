# Constellation and cluster catalog consolidation — 20 October 2026

The constellation catalog now contains all former Famous cluster stars records with their existing scientific data and provenance. The separate application catalog, browser payload and filter switch have been removed. The retained control is **Western constellation stars**.

| Non-solar records | Before | After |
| --- | ---: | ---: |
| Constellation source rows | 713 | 748 |
| Constellation effective stars/components | 1,016 | 1,068 |
| Former cluster source rows represented in constellation catalog | 7 / 42 | 42 / 42 |
| Former cluster effective records represented in constellation catalog | 10 / 62 | 62 / 62 |

The 691 original figure vertices and all 88 constellation charts remain covered. Thirty-five cluster source rows add 52 effective records after the existing reviewed companion completion. The ten previously shared effective records had matching scientific measurements. Their different catalog notes are combined, and both selection contexts are retained in per-object provenance. All seven landmark groups remain identified, without implying that every star is a resolved single star or that this is a complete membership census.

The source package is archived verbatim under `catalog-work/famous-cluster-stars/retired-catalog/`, outside the application registry and browser bundle. Frozen SIMBAD/Gaia inputs, component reviews, source observations and orbit data remain available to the authoring pipeline. No new physical values are inferred. Fifteen component records gain additional retained source records; their adopted measurements do not change. Class reference statistics retain exactly the same 2,074 distinct objects and numerical results.

Older saved views with the cluster switch enabled load the combined constellation catalog and retain their selected component. New saved views use the constellation switch and write the legacy cluster flag as false.

The [machine-readable comparison](../catalog-work/famous-cluster-stars/consolidation-audit.json) compares all six original source catalogs, all six original hydrated effective catalogs and all 846 component records: **5,356 records checked**, with no record, measurement, uncertainty, photometry or provenance loss. All old constellation records survive as well as all former cluster records. Chart changes are source checksums and appended notes for seven shared landmarks; chart measurements and geometry are unchanged.

Validation passed: `npm run catalog:preservation`, the consolidation comparison, the existing cluster review audit, production build, seven focused Vitest checks, fourteen focused Python checks and four desktop/mobile browser checks. Browser checks cover former cluster searches, exact Trapezium selection and properties, filter removal and legacy saved views; filter screenshots were inspected at both sizes. The full test suite was not run.

A broader run of `src/catalogs.test.ts` exposed unrelated stale expectations for nearby-catalog radial-velocity/estimate counts, Rigel companion values, preferred-name completion and bright-source reproduction. These remain outside this migration; the unchanged source/effective measurements are covered by the preservation comparison.

Reproduce the migration comparison against a snapshot containing the original source CSV/provenance files, hydrated generated catalogs and component pool under their original `src/data` paths:

```sh
python3 scripts/audit-landmark-consolidation.py --before-dir /path/to/before --write
```

The normal preservation audit understands the explicit catalog relocation in `catalog-work/catalog-migrations.json`: it verifies the archived source against the git baseline and checks every original row against the combined destination. The focused consolidation tests continue to verify all 42 source landmarks and all 62 effective components after subsequent regeneration.
