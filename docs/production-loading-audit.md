# Production loading audit — 2026-10-19

The spectral H–R/M–K renderers, magnitude card, and object-type introduction
now load on activation. Classification and availability checks stay independent
of those renderers. Magnitude visibility controls initialize once, on first use.
Delayed renders are discarded after a close, selection change, or newer render.

Fresh Vite production builds, using the same generated catalogs:

| Startup JavaScript | Before | After |
| --- | ---: | ---: |
| Minified bytes to parse | 1,053,700 | 1,024,054 |
| Brotli transfer bodies, or raw for tiny uncompressed chunks | 223,212 | 213,821 |
| JavaScript requests | 13 | 11 |

This removes 29,646 bytes of JavaScript and 9,391 transfer bytes (4.2%). It
does not establish a device startup-time improvement. Optional code is fetched
once when first needed. HTML, CSS, the selected catalog, and enabled imagery
are additional costs.

## Images

The Milky Way is unchanged at 5120 × 2560, 3,845,379 bytes. It loads
asynchronously when enabled; its shared texture is reused after catalog changes.
A production-preview check confirmed the hashed image response uses
`Cache-Control: public, max-age=31536000, immutable`. The deployed host's
headers were not checked.

Object-type and glossary photos request asynchronous decoding, matching existing
article, planet, and moon images. Their URLs are assigned on activation.

The image follow-up replaced the following delivery assets. These load on demand,
so savings improve first feature use rather than default startup:

| Asset | Before, bytes | After, bytes | Delivery change |
| --- | ---: | ---: | --- |
| Jupiter map | 6,720,450 | 759,552 | PNG → WebP, quality 94; still 3600 × 1800 |
| Saturn cloud atlas | 5,374,880 | 386,220 | PNG → WebP, quality 94; still 4096 × 3072 |
| Sun Info photo | 4,698,387 | 127,109 | JPEG resized from 6272 × 6272 to 760 × 760, quality 88 |
| WISE 0855 | 587,625 | 86,737 | One 2023-04-27 Webb frame, resized to 760 × 496 JPEG, quality 88 |
| Barnard's Star field photo | 633,054 | 0 | Omitted; article retained |

Together these save 16,654,778 bytes (92.5%). Jupiter's WebP is shared by the
radius comparison and the planet globe. Saturn's ring texture and mesh are
unchanged; every decoded alpha value in the cloud atlas is preserved. Texture
conversion uses the browser canvas WebP encoder at quality 0.94, without
resampling, cropping, or intentional recoloring. Compared in browser-decoded
RGB, Jupiter measures 42.95 dB PSNR and Saturn 49.11 dB over nontransparent
pixels; visual globe checks complement these numerical comparisons.

The Sun and WISE still were resized with macOS `sips`, JPEG format quality 88.
The WISE still is extracted from the previously credited animation; the object
is the orange point near the center, and the embedded date is April 27, 2023.
Attribution and derivative notices remain in the image credit tooltips and
asset READMEs. No generated catalog payload, measurement, source-note record,
or class reference changed during regeneration; only the WISE article's
reference to plural images was revised. The 2048 × 1024 Earth comparison PNG
remains a possible later optimization.

## Verification

TypeScript and 30 focused unit checks passed. Focused desktop/mobile browser
checks covered startup deferral, both spectral diagrams, magnitude controls,
object-type cards, image reuse, and delayed first loads. Three spectral
screenshots matched the unchanged build pixel for pixel. Two stale spectral
test expectations were updated for existing resolved Luhman 16 V photometry
and the current origin-button label. No catalog data changed. The full test
suite was not run.

Image follow-up: TypeScript, 21 focused unit checks, catalog preservation,
and focused browser checks passed for Info imagery, texture loading and
rotation, and unchanged Milky Way delivery. Regeneration hashes confirmed
that only `star-article-wise-0855-0714.json` changed among the 2,956 canonical
generated JSON and class-reference files audited. The full suite was not run.

## Follow-up — 2026-10-20

| Item | Before | After |
| --- | ---: | ---: |
| Milky Way panorama, AVIF-capable browsers | 3,845,379 B JPEG | 2,649,608 B AVIF (−31%) |
| Source-note URL lookup, first selection | 335,680 B chunk + `json-data` chunk | none; URL derived from the record's key |
| Source-note files | 2,216 | 2,077 (identical snapshots share one file) |
| First white dwarf class comparison | 360,190 B cooling-grid chunk | none; 9 precomputed references inside the 20.9 kB Mass card chunk |

Startup JavaScript grew by about 1.4 kB: the source-note loader is now part of
the entry chunk, removing two serial requests from the first selection.

**Milky Way.** The AVIF is a fresh Lanczos-3 resize of ESO's 6000 × 3000
download, encoded at AVIF quality 70 (8-bit 4:2:0). Resolution is unchanged at
5120 × 2560. Against that resized source, the AVIF measures 38.42 dB PSNR and
0.99536 mean SSIM. The previous JPEG measures 35.05 dB and 0.99515. WebP needed
quality 86 (3,189,484 B) to match the JPEG; a lossless progressive repack of the
JPEG saved only 6.6%. Close crops of the galactic plane and of brightened dark
sky retain the faint stars, with less block noise than the JPEG. A 1 × 1 AVIF
probe selects the format before download. Browsers without AVIF receive the
unchanged JPEG, and a failed AVIF download falls back to it. The image is
decoded before the WebGL upload, so decoding no longer blocks the main thread
at upload time. Decoding in desktop Chrome measured about 130 ms for the AVIF
and 50 ms for the JPEG.

**White dwarfs.** The 46 bundled white dwarfs needed only 9 distinct grid
evaluations at the time. Six had catalog temperatures; the other 40 used one of
three temperature-independent atmosphere envelopes. The 407 KB grid
(`src/data/white-dwarf-references.json`) was then removed from the repository.
The small precomputed table is committed instead and regenerated from the
checksummed original archive only when white dwarf inputs change; see
[Development](development.md#build-and-hosting). Card values are identical to
browser-side evaluation. A missing reference states that only the mass
benchmark is available, instead of extrapolating. The later
[white dwarf enrichment](white-dwarf-enrichment.md) gave most of them
individual temperatures.

Verified with Wrangler's local static-assets runtime: header rules, immutable
caching for `assets/catalog-details/`, AVIF selection, both JPEG fallbacks,
source notes, and Sirius B's white dwarf Mass card. There were no console
errors. Six pre-existing `src/catalogs.test.ts` count assertions fail
identically on the unmodified commit and are unrelated.

## Oversized assets — 2026-10-20

| Asset | Before | After | Loaded |
| --- | ---: | ---: | --- |
| Saturn mesh | 282,612 B JSON inside the planet-globe chunk (every globe) | 164,256 B JSON (≈39 KB compressed), Saturn only | planet-globe chunk 307 → 41 kB |
| Phobos / Deimos shape | 719,580 / 728,808 B, 32,040 / 32,512 triangles | 86,064 / 53,824 B, 3,740 / 2,266 triangles | moon globe |
| Earth map (radius comparison) | 1,511,379 B PNG | 368,096 B WebP q94 | Earth reference |
| Venus Info photo | 888,186 B PNG | 65,120 B WebP q100 | planet Info |
| Mercury globe map | 550,976 B PNG | 323,804 B WebP q94 | Mercury globe |
| 14 Info / object-type photos | 3,895,111 B, up to 3545 px wide | 1,802,302 B, at most 1080 px wide | Info, object-type cards |
| Class references chunk | 127 kB (29.8 kB gzip) | 104 kB (19.0 kB gzip) | Mass, Luminosity cards |

- **Saturn.** Saturn's mesh values are written as the shortest decimals that round-trip
  to the identical float32. Its globe rendered bit-identically before and after.
  Raw binary was rejected: Cloudflare edge-compresses JSON but not `.bin`.
- **Globes.** The shared globe sphere uses 48 × 32 instead of 64 × 48 segments. On
  the 172 px globe at 3× density, silhouette faceting stays below one device pixel.
- **Moon shapes.** The Phobos and Deimos meshes use meshoptimizer simplification at 0.002 of
  the mesh extent, which preserves UV seams.
- **Fidelity.** Rendered globes at 3× matched the previous build at 46–50 dB. Phobos and
  Deimos matched at 38–40 dB, with differences along shaded silhouettes.
- **Photo widths.** Display photos are sized for the measured maximum of 1050 device pixels:
  350 CSS px on a 3× phone. Files that would shrink by less than 10% keep their
  original encoding.
- **Not changed.** Constellation companion chunks still embed notes and source records.
  The runtime companion merge reads those records, so deferring them would change
  which source measurements Specs displays. The chunks are 5–10 KB compressed
  each and load only for the opened constellation.
