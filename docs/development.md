# Development

## Build And Hosting

The development server port advances automatically if its default port is already occupied.

For everyday edits, run `npm run dev` once and leave it running. Open the URL it prints; Vite updates the page when source files change. Run `npm run typecheck:watch` in a second terminal for continuous TypeScript checks. Neither command needs a production build after each edit. Both generate derived catalog inputs at startup; after changing catalog source data or its authoring/generation code, run `npm run catalog:generate` again. Catalog data changes also require `npm run catalog:preservation` and the relevant catalog checks.

If automatic reloads interrupt an inspection session, use `npm run dev:manual` instead. It serves source files with hot reload disabled; refresh the browser yourself to see edits. File watching still invalidates Vite's transformed-module cache, so a manual refresh picks up changed source. It does not need a production build. Catalog generation leaves identical output files untouched, so running checks alongside the normal dev server does not trigger reloads solely by rewriting unchanged generated inputs.

Numbered duplicate files in generated data, such as `Andromeda 2.json`, are excluded from generated-payload wildcard imports and development file watching. They are not authored catalog inputs and are not removed by this exclusion.

Use `npm run build` when preparing a deployment or checking production behavior, then `npm run preview` to inspect it. Preview serves the existing `dist/` output, so source edits require another build to appear there. Browser regression tests continue to use a production build.

The production output is in `dist`. Builds validate every project catalog, generate deterministic browser-ready JSON from the authored CSV, and emit each catalog as a separate hashed asset. Version 2 payloads already contain the reviewed companion completion and original source measurements; `sourceObjectCount` records the authored catalog size before companion expansion. Catalogs load only when selected, directly from their hashed JSON URL, and each payload is fetched and parsed at most once per page session. Startup carries a compact component identity index rather than the full physical companion pool. Each constellation chart loads only its relevant companion records. Papa Parse remains an authoring/test dependency and is not shipped in the browser bundle. Normal builds never download astronomy data; validation uses Python.

The Python checks used by builds normalize calculated companion magnitudes, audit distances and constellation centers to nine decimal places with `catalog_sources.precision.calculated_float`. This avoids treating final-bit differences in platform math libraries as stale data. Original source measurements, uncertainties and frozen review values retain their precision; historical absolute-magnitude replacement guards compare at the calculation's storage precision. Existing coordinate, velocity and derived physical-property precision rules remain in their authoring code. After changing these calculations, regenerate with `npm run catalog:companions` and `python3 scripts/author-constellations.py --write`. The focused portability regression is `python3 -m unittest discover -s scripts/tests -p 'test_calculated_precision.py'`; it varies math results by one representable floating-point step in both directions and checks the companion pool, audit and all 88 chart files.

Vite also emits Brotli sidecars for compressible production assets. The local preview server negotiates those files and gives hashed `/assets/` responses a one-year immutable cache policy while keeping HTML revalidated. Hosts other than Cloudflare must provide the equivalent `Content-Encoding: br`, `Vary: Accept-Encoding`, `Content-Type`, and `Cache-Control` behavior; copying `.br` files alone is not sufficient.

Production is hosted as Cloudflare Workers static assets, deployed from `dist` by the dashboard Git integration (Workers Builds). The checked-in `wrangler.jsonc` configures the existing `star-view` Worker and disables the SPA fallback (`assets.not_found_handling: "none"`): missing assets return 404 rather than the entry HTML. Star View has no client-side path routes. Use `npm run build` as the build command and `npx wrangler deploy` as the deploy command so this configuration is applied. Cloudflare compresses responses at the edge and does not negotiate `.br` sidecars, so each build also writes `dist/.assetsignore`, which keeps the sidecars out of the upload. Each build also writes `dist/_headers`, generated in `vite.config.ts` from the same header table the preview server uses; neither file is served. It applies the security headers below to every response, the one-year immutable policy to `/assets/*` (every file there is content-hashed), and `X-Robots-Tag: noindex` on `*.workers.dev` hosts. The root document (`/` and `/index.html`) explicitly uses `Cache-Control: no-cache`, so browsers revalidate it before using its references to a deployment's hashed chunks. Keep any Cloudflare cache rules or Browser Cache TTL overrides from imposing a positive HTML lifetime.

Brotli compression uses up to four asynchronous encoders and caches the results in `node_modules/.vite/star-view-brotli/`. The cache is keyed by exact asset contents, encoder version and compression settings, so unchanged assets reuse their maximum-quality compressed bytes even if their filenames change. A first build or a cleared cache needs to populate this cache; later builds compress only changed contents. The cache is disposable and is never deployed. Every production build still runs catalog validation, catalog generation and TypeScript checks.

Production builds embed a strict Content Security Policy meta tag: same-origin scripts, styles, images, data and fonts only, no inline styles or scripts, no plugins, no base URL or form targets, and Trusted Types enforcement. Dynamic styles are applied through the CSSOM, never through `style` attributes. Glossary, Info, System, Distance, Radius, Temperature, Mass, Luminosity, constellation and planet content load on first use. White dwarf Mass card references are precomputed from the full Bédard et al. (2020) cooling grid, once for each atmosphere envelope and catalog temperature in the bundled catalogs. They are committed in `src/data/white-dwarf-class-references.json`. Neither the app nor the repository contains the grid. `npm run catalog:white-dwarf-references` downloads the original archive, verifies its recorded SHA-256, caches the grid under `node_modules/.cache/star-view/` and rewrites the table. Every `npm run catalog:generate` checks that the table holds exactly the references the bundled white dwarfs request. When white dwarf types or temperatures change, it fails with that instruction. Unit tests that evaluate the grid run only while it is cached. Lightweight counts keep System controls available before exoplanet and stellar-orbit data load. Planet Info and Moons have their own loading boundaries; moon data, textures and shape models are not initialized by opening the planet's Specs. Scene brightness and color helpers remain shared and immediately available.

A small startup entry loads the main app dynamically, so a missing core dependency can show the shared Retry / Reload app panel even before the viewer starts. Lazy cards and Glossary show the same recovery panel when a download fails. Retry repeats the requested load; Reload app is an explicit user action for failed module downloads or files removed by a deployment. Failures never trigger automatic reloads. Closed or superseded loads cannot replace current content. Already-loaded diagram and magnitude renderers update synchronously, without loading placeholders.

If a returning browser reports that `text/html` is not a valid JavaScript MIME type, inspect the failed module request's response. Star View HTML indicates an outdated asset URL reaching an HTML fallback; a Cloudflare Access login page indicates an authentication redirect instead. Do not change JavaScript MIME headers to disguise either response. An HTML fallback under `/assets/*` can itself be cached as immutable, so preventing that fallback also matters. After deploying a cache-policy fix, browsers that already stored an older document or an HTML response at an asset URL may still need one cache-bypassing reload (or clearing only cached files for this site). A CDN purge does not clear browser caches. Reauthenticate if the response is an Access login page. Verify the actual authenticated responses for `/` (`no-cache`) and a current `/assets/*.js` (JavaScript content type and one-year immutable caching); local preview cannot prove the deployed policy.

A meta tag cannot set every protection, so production responses also carry these headers (generated into `dist/_headers`):

| Header | Value |
|---|---|
| `Content-Security-Policy` | The meta policy plus `frame-ancestors 'none'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (HTTPS only) |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |

`vite preview` sends all of these except `Strict-Transport-Security` for local testing. The policy allows no third-party scripts, so Cloudflare features that inject scripts or rewrite HTML (Rocket Loader, Email Address Obfuscation, automatic Web Analytics, Zaraz) must stay disabled for the app's hostnames.

## Rendering Efficiency

The static star map renders on demand. Camera input, selection, display settings, resizing, pixel-density changes and font loading request a frame; requests within a frame are combined. Smooth focus and orbit damping keep rendering only until motion settles. An idle view performs no recurring WebGL draws or label updates, and hidden tabs suspend rendering until visible again. MSAA remains enabled.

Normal rendering caps the WebGL canvas at device-pixel ratio 1 and at 60 frames per second. A short `requestAnimationFrame` cadence sample promotes the cap to 120 FPS on displays measured at 100 Hz or faster. The optional session-only power-saving mode is off by default; it caps the canvas at device-pixel ratio 0.5 and sustained rendering at 30 FPS. The first dirty frame after an idle period may render immediately for input responsiveness. Orbit damping remains enabled, with its factor adjusted for elapsed time so settling takes approximately the same time at every cap.

These limits reduce canvas pixels and bound repeated projection, label-layout and draw work while the camera moves. Automated browser tests verify the selected backing resolution, draw spacing and complete suspension while idle. They do not prove lower hardware power on every browser or GPU; compare modes using the same scripted interaction over repeated, warmed-up runs and total energy rather than isolated watt spikes.

During rotation, each visible object is projected once into reusable storage shared by labels, arrows, collisions and picking. A screen-space grid bounds collision and pointer searches. Only budgeted names and the selected/observer labels own pooled DOM anchors instead of creating one subtree per catalog row; motion arrows are one instanced WebGL draw fed from the same projection storage. Name dimensions are cached per object and measured only when a name first appears, fonts change, or selection restyles it; unit changes remeasure only the distance label. Star and axis names drop their blurred text shadows while the camera rotates, pans, zooms or animates focus, and regain them on the settled frame, because repainting those shadows on every moving label was the largest remaining paint cost. Rotation regression tests cover all three catalogs, including nearest-1000, and record browser layout and main-thread timing metrics.

Only the visibility base and eligible objects submit halo points to the GPU; background dots keep their cores but do not draw transparent halos. A reusable index buffer updates this subset when visibility settings or selection change. The three colored axes share one draw call. Browser tests count point submissions and draw calls alongside the visual regression checks.

Nebulae add exactly one draw call, and none while every nebula is filtered out. Each nebula is a fixed number of soft, camera-facing puffs (64 to 512 for census nebulae, scaled with physical sky area; 200 for the Pleiades and 320 for Orion) sampled once, deterministically from its seed, inside its modeled shape; all puffs share one instanced quad geometry and one shader. There is no ray marching, per-frame CPU work, sorting or animation: additive blending is order-independent, depth testing hides puffs behind star cores and the layer never writes depth. Puff colors for both modes are stored per instance, so changing Colors only updates a uniform. The vertex shader bounds fill rate by fading puffs the camera is inside or about to enter and capping a puff at 20% of the viewport height; subpixel puffs grow to 1.5 device px with energy-preserving alpha so distant nebulae do not shimmer. Filtering repacks only the visible nebulae into the front of the instance buffers. Because puffs are independent samples, any prefix is an unbiased subset: power-saving mode draws the first half of each nebula with doubled alpha. The overlay is a small payload fetched only when the Interstellar medium or Stellar remnants category first shows a nebula type.

Molecular clouds use the same static, on-demand philosophy but preserve the catalog's measured voxel morphology. A stable quarter-sample retains 19,606 of 78,326 one-parsec source voxels. All visible clouds are repacked into one shared instanced quad buffer and rendered in two calls: a normal-blended smoky body for real opacity and an additive, lower-gain filamentary rim. The two passes share a tiny deterministic noise texture, screen-size bounds, near-camera fade, depth testing and no depth writes. Their color-mode palettes are per instance; selection is a shader attribute comparison, and filtering does no geometry allocation. Power-saving mode draws the first 40% of each spatially distributed sample with adjusted alpha. The payload is fetched only when Interstellar medium first makes Molecular clouds effective.

Bubble shells use one indexed latitude/longitude surface per object, merged into one geometry and one shader draw. The Local Bubble uses a `128 x 64` directional radius grid downsampled offline from the published Figure 3 point cloud; future objects may use smaller analytic surfaces. Geometry is generated only when the lazy overlay loads. Per-vertex visibility and selection attributes let filters and selection change without rebuilding the mesh; Real/Exaggerated colors are both resident and switch by uniform. Additive blending avoids transparent-triangle ordering artifacts, depth writes remain off, and the fragment shader combines very low base opacity with a grazing-angle lift so an observer inside the cavity can still read its wall. There is no volume texture, ray marching, animation or per-frame CPU shape work.

To compare power use in Safari, use `npm run build && npm run preview`, leave the map untouched for a few seconds, and observe Safari's CPU usage in Activity Monitor. Expect brief activity during interaction. The browser regression suite checks that WebGL draws and label mutations stop while idle in both catalogs and resume after changes; this measures rendering work, not a hardware-specific CPU percentage.

## Tests

Unit tests cover CSV parsing and validation, all supported object classes, coordinate and velocity handedness, sourced motion conversion, Sun-relative distances, motion travel conversion, temperature colors, bounded halo gain and missing-value fallback, focus easing, camera clipping, projected motion direction and scale, screen-space picking, gesture suppression, the object-filter taxonomy and availability, nebula and molecular-cloud overlay validation, deterministic volume sampling and level-of-detail packing. Browser scenarios run against the **production build** on desktop and touch-emulated mobile viewports, including 320 px and narrow landscape layouts. Extended-object scenarios verify on-demand loading, distance and subtype filtering, power-saving sample counts, sourced inspector facts, visual output and idle suspension.

`npm test` and `npm run typecheck` generate their derived catalog and loading-index inputs first. Before running focused checks directly with `npx vitest`, run `npm run catalog:generate` once if those ignored inputs are absent or stale.

```sh
npx playwright install chromium
npm run test:e2e
```

When a browser download is unavailable, installed Google Chrome can be used instead:

```sh
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Set `PLAYWRIGHT_PORT=4174` (or another unused port) if 4173 is occupied. Tests create and stop a preview server; they will not take over an existing server.

`npm run test:e2e` rebuilds before launching the preview server. The browser suite checks exact-black canvas background pixels, actual temperature-colored object pixels, near/far pixel occlusion after rotating overlapping stars, selected-object centering, all-catalog reset, pixel changes after orbit/pinch, fixed name offsets during damped orbit, foreground selected names through collisions and clipping, selectable travel horizons with fixed arrowheads and strokes, dashed transverse and solid full-motion shaft pixels, arrow visibility through overlaps, dot attachment and camera-dependent headings, known/unknown motion readouts, independent keyboard-operated disclosures, click/tap/keyboard selection and empty-sky deselection, clipped labels, layout boundaries, local assets, and usable catalog details when WebGL is unavailable. Screenshots are written under `test-results` and failure traces are retained. Generated test artifacts are ignored by Git.

The initial implementation was verified with installed Chrome on macOS, using desktop and touch-emulated mobile tests. The managed Chromium download timed out. Safari/WebKit, a physical mobile device, and packaged desktop behavior have not been verified.

Visual-polish regressions additionally sample the gap-free core-to-halo falloff, stronger unselected Sirius glow than Barnard's, reversible selection gain without changing core pixels, grid fade toward the edge, selected-name/ring styling, and arrow opacity. Sidebar tests verify that the height summary is absent while map measurements remain. Normal-motion tests record intermediate focus frames, reconstruct the expected camera position, and interrupt focus with reset, zoom, reselection, mouse/touch input, deselection, and a live reduced-motion change. Tooltip tests distinguish mouse hover, touch taps, and keyboard focus. Existing reduced-motion tests retain instantaneous selection expectations.

## Project Structure

- [src/catalog.ts](../src/catalog.ts): typed CSV contract and validation.
- [src/catalogs.ts](../src/catalogs.ts): package validation, selection retention, coverage and native builder.
- [src/registry.ts](../src/registry.ts): build-time project catalog discovery, isolated package errors.
- [Deferred star data](deferred-star-data.md): individual article/system loads and separate map/source payloads.
- [scripts/catalogs.ts](../scripts/catalogs.ts): offline native build/validation CLI.
- [src/astronomy.ts](../src/astronomy.ts): frame mapping, distances, and temperature colors.
- [src/viewer.ts](../src/viewer.ts): Three.js scene, camera, measurement guides, budgeted label placement, picking, and teardown.
- [src/object-filter.ts](../src/object-filter.ts): filter categories, subtypes, data availability and effective visible types.
- [src/nebula-overlay-model.ts](../src/nebula-overlay-model.ts) and [src/nebula-overlay.ts](../src/nebula-overlay.ts): nebula overlay validation and lazy loading.
- [src/nebula-layer.ts](../src/nebula-layer.ts): deterministic nebula puff sampling and the single instanced nebula draw.
- [src/molecular-cloud-overlay-model.ts](../src/molecular-cloud-overlay-model.ts) and [src/molecular-cloud-overlay.ts](../src/molecular-cloud-overlay.ts): Cahlon catalog validation and lazy loading.
- [src/molecular-cloud-layer.ts](../src/molecular-cloud-layer.ts): voxel-sampled smoky body and luminous-rim cloud rendering.
- [src/bubble-overlay-model.ts](../src/bubble-overlay-model.ts) and [src/bubble-overlay.ts](../src/bubble-overlay.ts): bubble validation and lazy loading.
- [src/bubble-layer.ts](../src/bubble-layer.ts): directional-grid and analytic shell generation plus the merged translucent draw.
- [src/object-list.ts](../src/object-list.ts): normalized search and fixed-row virtual object list.
- [src/main.ts](../src/main.ts): selected-object state and semantic DOM inspector.
- [src/style.css](../src/style.css): responsive, unframed map and inspector layout.

## Limits

All points remain rendered and pickable in the 1,001-row package. Ordinary map names are priority-budgeted to 120 on desktop and 60 on coarse-pointer/mobile views; selected and visibility-base labels remain eligible. On dense views, labels can still be suppressed when no collision-free position exists. Modern WebGL2 support is required for the 3D view; the catalog and inspector remain available if graphics initialization fails.

Deferred: calibrated photometric rendering, time controls, motion propagation, local CSV import, dark nebulae and the remaining object types, and Tauri. The output is a static frontend suitable for a later Tauri wrapper, but this project currently contains no Tauri/Rust dependencies or desktop integration.
