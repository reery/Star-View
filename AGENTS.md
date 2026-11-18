# Project instructions

- Never run the full test suite during development.
- Run the full test suite only after the user has inspected the result and explicitly authorized the run. Finishing a change does not imply authorization.
- Honor any additional request to skip tests entirely.

- Catalog changes must enrich without silently discarding existing data. Compare all affected catalogs and the effective component records before and after regeneration, including physical fields, photometry, astrometry, uncertainties and provenance. Preserve original source measurements with explicit scope when they cannot be adopted for an individual component. Run `npm run catalog:preservation` to detect missing records and known-to-missing fields; investigate every failure before completing a data change.
- Wrong data has no place in the app. A value a review rejects as wrong belongs in `catalog-work/reviewed-data-retirements.json` and the review files only; it must never ship, not even as a retained source value. Catalog generation strips retired values from every shipped record. Superseded but valid measurements and component-scoped source values may still be retained with explicit scope.

- Read `docs/info-writing-guide.md` before writing or editing any Info article text.

- Reuse existing UI styles and font sizes wherever possible. Keep new cards consistent with established cards and controls.
- Lay out multiple collapsible sections in a card side by side, wrapping them below each other when the card is too narrow.
- Use the separator below the first mass bar consistently for metric divider lines: `1px dashed var(--line)`. Reuse the shared `--mass-metric-divider` style; do not introduce dotted or other separator variants.
- Let charts, bars, and values communicate obvious comparisons. Avoid redundant commentary such as “Small for its class” or “Large for its class” throughout the app and in future designs. Add explanatory text only when it provides useful context, such as missing data or values outside a displayed range.

## Debugging in a browser

Open the app with every object type and catalog on and no welcome tile, tips or swipe hints. Then reproduce bugs directly in WebKit (Safari's engine) and Chromium. Doing this is not running the test suite.

1. Start the dev server in the background: `npm run dev -- --host 127.0.0.1 --port 5199 --strictPort`. It regenerates the catalogs first. If the generated data is current, `npx vite --host 127.0.0.1 --port 5199 --strictPort` starts faster.
2. Drive it with Playwright's bundled browsers, both already installed (`npx playwright install webkit chromium` if missing). A script outside the repo must import Playwright by its absolute path: `<repo>/node_modules/@playwright/test/index.mjs`.
3. Seed localStorage before the page loads:

```js
import { webkit, chromium } from '<repo>/node_modules/@playwright/test/index.mjs'
const seed = {
  'star-view-welcome-answered': 'true',
  'star-view-tips': 'off',
  'star-view-swipe-hint-object-card': 'seen',
  'star-view-swipe-hint-detail-card': 'seen',
  // Largest catalog, all landmark catalogs, every object type, no magnitude or distance limit (null = Infinite).
  'star-view-saved-filter': JSON.stringify({
    version: 1, catalogId: 'nearest-5000', showAlwaysBright: false,
    showWesternConstellationStars: true, showNakedEyeStars: true, showNotableDistantStars: true,
    filterCategories: ['compact_objects', 'interstellar_medium', 'stellar_remnants', 'large_scale_structures', 'star_clusters'],
    filterSubtypes: ['sun', 'star', 'brown_dwarf', 'white_dwarf', 'neutron_star', 'pulsar', 'black_hole', 'molecular_cloud', 'dark_nebula',
      'reflection_nebula', 'hii_region', 'planetary_nebula', 'supernova_remnant', 'pulsar_wind_nebula', 'bubble', 'dust_sheet', 'open_cluster'],
    magnitudeLimit: 30, hideFainterObjects: false, objectDistanceLimitLy: null,
  }),
}
for (const browserType of [webkit, chromium]) {
  const browser = await browserType.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.addInitScript((entries) => { for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value) }, seed)
  await page.goto('http://127.0.0.1:5199/objects/milky-way')
  await page.locator('#scene[data-ready="true"]').waitFor({ timeout: 180000 })
  // ... reproduce, then page.screenshot({ path: '<scratchpad>/name.png' }) and read the image
  await browser.close()
}
```

- `/objects/<id>` opens the app with that object selected. `#star-name` shows the selection.
- `#object-specs-toggle` expands the selected-object card. `#object-specs` is the card body for element screenshots.
- `.map-anchor[data-star-id="<id>"]` gives an object's screen position for `page.mouse.click`. `page.mouse.wheel(0, ±delta)` over the canvas zooms.
- Keep scripts and screenshots in the scratchpad, never in the repo. Stop the dev server when done.

## Engineering principles

- Inspect existing implementations before writing code.
- Reuse existing functions, classes, types and utilities.
- Prefer the smallest maintainable implementation.
- Avoid introducing new abstractions for single-use cases.
- Do not duplicate network calls or calculations.
- Keep runtime, memory and bundle size minimal.
- Do not introduce dependencies or large data assets
  without demonstrating their necessity.
- Preserve existing architectural conventions.
- Avoid unrelated refactoring.

## Before completion

- Review the diff for duplication and unnecessary code.
- Run relevant tests and build validation.
- Report new dependencies and asset-size changes.
- Explain any new abstractions or significant files.