# Bright and constellation catalog consolidation — 23 October 2026

The constellation catalog now contains every former Bright stars record with its existing scientific data and provenance. The separate application catalog, browser payload and **Always show bright stars** switch have been removed. The retained control is **Western constellation stars**.

| Non-solar records | Before | After |
| --- | ---: | ---: |
| Constellation source rows | 748 | 749 |
| Constellation effective stars/components | 1,068 | 1,069 |
| Former bright effective records represented in constellation catalog | 200 / 201 | 201 / 201 |

200 of the 201 bright effective records were already in the constellation catalog: 88 under the same ID and 112 under a different ID for the same object; the one-to-one map in [legacy-star-ids.json](../src/data/legacy-star-ids.json) was derived once from the runtime identity merge. The constellation IDs survive. Lesath was the only missing record and keeps its `bright-lesath` ID.

Additive changes only:

- Lesath is added with its source row and provenance.
- Mizar Aa's source row gains the spectral type `A1.5Vas`, which its effective record already showed.
- Bright notes not yet contained are appended to the surviving source row. Reviewed components already retain their complete bright source record in the companion pool.
- Bright provenance is retained per object under `brightStar`, and package-level selection review, coverage and companion expansion under `brightLandmarks`.
- Retired names and designations remain designations of the surviving record; no preferred names change.
- Bright-star articles keyed by retired IDs are served from the surviving record. Live IDs shared with nearest catalogs (`sharedIds`) are never redirected.

Class reference statistics retain exactly the same 2,074 distinct objects and numerical results. Constellation charts change only in source checksums and Mizar Aa's filled spectral type.

Older saved views and filters with the bright switch enabled load the constellation catalog, and their selected, origin and observer IDs are restored on the surviving records. New saved views write the legacy flag as false.

The source package is archived verbatim under `catalog-work/bright-stars/retired-catalog/`, outside the application registry and browser bundle, and remains the authoring source for `author-bright-stars.py`, companion completion, designations and statistics. The relocation and ID map are declared in `catalog-work/catalog-migrations.json`; `npm run catalog:preservation` checks every original row against its surviving record.

The [machine-readable comparison](../catalog-work/bright-stars/consolidation-audit.json) compares all original source catalogs, hydrated effective catalogs and the 846 component records: **5,337 records checked**, with no record, measurement, uncertainty, photometry or provenance loss. Reproduce it against a pre-migration snapshot of `src/data`:

```sh
python3 scripts/audit-landmark-consolidation.py --catalog bright-stars --before-dir /path/to/before --write
```
