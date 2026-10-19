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
