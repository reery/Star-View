# Development

## Build And Hosting

The development server port advances automatically if its default port is already occupied.

The production output is in `dist`. Builds validate every project catalog, generate deterministic browser-ready JSON from the authored CSV, and emit each catalog as a separate hashed asset. Catalogs load only when selected and each payload is fetched and parsed at most once per page session. Papa Parse remains an authoring/test dependency and is not shipped in the browser bundle. Normal builds never download astronomy data or require Python.

Vite also emits Brotli sidecars for compressible production assets. The local preview server negotiates those files and gives hashed `/assets/` responses a one-year immutable cache policy while keeping HTML revalidated. Production hosting must provide the equivalent `Content-Encoding: br`, `Vary: Accept-Encoding`, `Content-Type`, and `Cache-Control` behavior; copying `.br` files alone is not sufficient.

## Rendering Efficiency

The static star map renders on demand. Camera input, selection, display settings, resizing, pixel-density changes and font loading request a frame; requests within a frame are combined. Smooth focus and orbit damping keep rendering only until motion settles. An idle view performs no recurring WebGL draws or label updates, and hidden tabs suspend rendering until visible again. MSAA remains enabled.

Normal rendering caps the WebGL canvas at device-pixel ratio 1 and at 60 frames per second. A short `requestAnimationFrame` cadence sample promotes the cap to 120 FPS on displays measured at 100 Hz or faster. The optional session-only power-saving mode is off by default; it caps the canvas at device-pixel ratio 0.5 and sustained rendering at 30 FPS. The first dirty frame after an idle period may render immediately for input responsiveness. Orbit damping remains enabled, with its factor adjusted for elapsed time so settling takes approximately the same time at every cap.

These limits reduce canvas pixels and bound repeated projection, label-layout and draw work while the camera moves. Automated browser tests verify the selected backing resolution, draw spacing and complete suspension while idle. They do not prove lower hardware power on every browser or GPU; compare modes using the same scripted interaction over repeated, warmed-up runs and total energy rather than isolated watt spikes.

During rotation, each visible object is projected once into reusable storage shared by labels, arrows, collisions and picking. A screen-space grid bounds collision and pointer searches. Only budgeted names and the selected/observer labels own pooled DOM anchors instead of creating one subtree per catalog row; motion arrows are one instanced WebGL draw fed from the same projection storage. Name dimensions are cached per object and measured only when a name first appears, fonts change, or selection restyles it; unit changes remeasure only the distance label. Star and axis names drop their blurred text shadows while the camera rotates, pans, zooms or animates focus, and regain them on the settled frame, because repainting those shadows on every moving label was the largest remaining paint cost. Rotation regression tests cover all three catalogs, including nearest-1000, and record browser layout and main-thread timing metrics.

Only the visibility base and eligible objects submit halo points to the GPU; background dots keep their cores but do not draw transparent halos. A reusable index buffer updates this subset when visibility settings or selection change. The three colored axes share one draw call. Browser tests count point submissions and draw calls alongside the visual regression checks.

Nebulae add exactly one draw call, and none while every nebula is filtered out. Each nebula is a fixed number of soft, camera-facing puffs (64 to 512 for census nebulae, scaled with physical sky area; 200 for the Pleiades and 320 for Orion) sampled once, deterministically from its seed, inside its modeled shape; all puffs share one instanced quad geometry and one shader. There is no ray marching, per-frame CPU work, sorting or animation: additive blending is order-independent, depth testing hides puffs behind star cores and the layer never writes depth. Puff colors for both modes are stored per instance, so changing Colors only updates a uniform. The vertex shader bounds fill rate by fading puffs the camera is inside or about to enter and capping a puff at 20% of the viewport height; subpixel puffs grow to 1.5 device px with energy-preserving alpha so distant nebulae do not shimmer. Filtering repacks only the visible nebulae into the front of the instance buffers. Because puffs are independent samples, any prefix is an unbiased subset: power-saving mode draws the first half of each nebula with doubled alpha. The overlay is a small payload fetched only when the Interstellar medium or Stellar remnants category first shows a nebula type.

Bubble shells use one indexed latitude/longitude surface per object, merged into one geometry and one shader draw. The Local Bubble uses a `128 x 64` directional radius grid downsampled offline from the published Figure 3 point cloud; future objects may use smaller analytic surfaces. Geometry is generated only when the lazy overlay loads. Per-vertex visibility and selection attributes let filters and selection change without rebuilding the mesh; Real/Exaggerated colors are both resident and switch by uniform. Additive blending avoids transparent-triangle ordering artifacts, depth writes remain off, and the fragment shader combines very low base opacity with a grazing-angle lift so an observer inside the cavity can still read its wall. There is no volume texture, ray marching, animation or per-frame CPU shape work.

To compare power use in Safari, use `npm run build && npm run preview`, leave the map untouched for a few seconds, and observe Safari's CPU usage in Activity Monitor. Expect brief activity during interaction. The browser regression suite checks that WebGL draws and label mutations stop while idle in both catalogs and resume after changes; this measures rendering work, not a hardware-specific CPU percentage.

## Tests

Unit tests cover CSV parsing and validation, all supported object classes, coordinate and velocity handedness, sourced motion conversion, Sun-relative distances, motion travel conversion, temperature colors, bounded halo gain and missing-value fallback, focus easing, camera clipping, projected motion direction and scale, screen-space picking, gesture suppression, the object-filter taxonomy and availability, nebula overlay validation (including position consistency with RA, Dec and distance), deterministic nebula sampling inside each modeled shape and level-of-detail packing. Browser scenarios run against the **production build** on desktop and touch-emulated mobile viewports, including 320 px and narrow landscape layouts. Nebula scenarios verify on-demand loading, distance and subtype filtering, power-saving puff counts, the inspector, a single extra draw call, color-mode saturation and idle suspension.

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
- [scripts/catalogs.ts](../scripts/catalogs.ts): offline native build/validation CLI.
- [src/astronomy.ts](../src/astronomy.ts): frame mapping, distances, and temperature colors.
- [src/viewer.ts](../src/viewer.ts): Three.js scene, camera, measurement guides, budgeted label placement, picking, and teardown.
- [src/object-filter.ts](../src/object-filter.ts): filter categories, subtypes, data availability and effective visible types.
- [src/nebula-overlay-model.ts](../src/nebula-overlay-model.ts) and [src/nebula-overlay.ts](../src/nebula-overlay.ts): nebula overlay validation and lazy loading.
- [src/nebula-layer.ts](../src/nebula-layer.ts): deterministic nebula puff sampling and the single instanced nebula draw.
- [src/bubble-overlay-model.ts](../src/bubble-overlay-model.ts) and [src/bubble-overlay.ts](../src/bubble-overlay.ts): bubble validation and lazy loading.
- [src/bubble-layer.ts](../src/bubble-layer.ts): directional-grid and analytic shell generation plus the merged translucent draw.
- [src/object-list.ts](../src/object-list.ts): normalized search and fixed-row virtual object list.
- [src/main.ts](../src/main.ts): selected-object state and semantic DOM inspector.
- [src/style.css](../src/style.css): responsive, unframed map and inspector layout.

## Limits

All points remain rendered and pickable in the 1,001-row package. Ordinary map names are priority-budgeted to 120 on desktop and 60 on coarse-pointer/mobile views; selected and visibility-base labels remain eligible. On dense views, labels can still be suppressed when no collision-free position exists. Modern WebGL2 support is required for the 3D view; the catalog and inspector remain available if graphics initialization fails.

Deferred: calibrated photometric rendering, time controls, motion propagation, local CSV import, dark nebulae and the remaining object types, and Tauri. The output is a static frontend suitable for a later Tauri wrapper, but this project currently contains no Tauri/Rust dependencies or desktop integration.
