# Deferred star data

`npm run catalog:generate` keeps the reviewed source files intact and writes separate browser payloads:

- `generated/catalogs/`: schema 3 map records, without `notes` or `catalog_sources`.
- `generated/catalog-details/`: one content-keyed notes/source snapshot per distinct effective record. Shared IDs with different catalog source records retain separate snapshots. Each key ends in the first 16 hex digits of the snapshot's SHA-256, and builds emit the snapshot as `assets/catalog-details/<hash>.json`. The browser derives that URL from the map record's key, with no lookup table. Objects with identical snapshots share one file, and the build rejects any file whose content does not match its key.
- `generated/star-articles/`: one article per reviewed article identity, including its review date and section sources.
- `generated/stellar-orbits/`: one orbit array per reviewed stellar system, including systems with no adopted orbit.
- `generated/planetary-systems/`: one exact planet host and its planet measurements. Opening a planet card does not import the full exoplanet archive.

The map loads only the selected catalog and enabled overlays. Small system-identity, planet-count and article-availability indexes remain available at startup. Article and system URL lookups live in optional modules; source-note URLs are derived from content hashes. Their JSON bodies load only when needed.

Info loads the selected article, sharing its cached content across reviewed component aliases. System loads the selected stellar system and the exact selected planet host. Specs loads the selected star's notes and retained source measurements, including scoped fallback values and tooltips. Constellation charts continue loading one chart and its companions at a time.

Map records retain compact flags for withheld fields, explicit barycenter matching and retained source radial velocities. These preserve merge rules and motion labels before full source notes arrive. When a catalog layer supplements physical values, its source-note references follow the merged record. Details hydrate only scene-owned copies, leaving memoized map payloads unchanged.

Concurrent requests share a promise. Successful loads are reused, and failures clear their pending entries so the existing Retry control can fetch again. JSON requests avoid retaining failed payloads in the browser's JavaScript module cache. Selection and closed-card guards prevent delayed results from replacing another object's content.

Generation verifies that every map record plus its details reconstructs the complete effective input exactly. `npm run catalog:preservation` continues auditing the original catalogs and companion pool. Focused coverage is in `src/deferred-data.test.ts` and `e2e/startup-loading.spec.ts`; existing article, orbit and exoplanet tests exercise every generated article/system through these loaders. Full-suite authorization remains governed by `AGENTS.md`.
