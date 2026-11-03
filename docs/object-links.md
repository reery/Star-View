# Selected-object links

The Specs card shows a Links row above Designations. Its icons open further
reading in a new tab, ordered by importance from right to left: Wikipedia (a
serif W) on the right, then Aladin Lite, Jim Kaler’s STARS, the ATNF Pulsar
Catalogue and ESA/Hubble. An icon appears only when that object has a link; the row is hidden
when it has none. While comparing two stars, each star's links sit in its own
column. Each icon names its destination in a tooltip; on touch screens the
first tap shows the tooltip and highlights the icon, and a second tap opens the
link. The collapsed card is unchanged.

`scripts/author-object-links.py` builds `src/data/object-links.json` offline
from frozen sources in `catalog-work/object-links/`, retrieved on
**2026-11-01** and extended on **2026-11-03** with Wikidata and Wikipedia
records for the naked-eye stars. The app loads the file once, on the first
selection. `npm run catalog:validate` runs `--check` to keep it in step with the
identity supplement. Refresh the sources explicitly with
`python3 scripts/author-object-links.py --refresh --retrieved YYYY-MM-DD --cache DIR`;
the response cache lets an interrupted refresh resume. `--extend` instead
queries only SIMBAD identifiers without a Wikidata record and resolves only new
Wikipedia titles, leaving earlier records untouched. `--review` prints
rejected, ambiguous and unmatched sources.

## Matching

Only exact identifiers are used; there is no positional or fuzzy matching.

- **Wikipedia.** A Wikidata item carrying the object’s exact SIMBAD identifier
  (P3083) supplies its English article. Redirects are resolved, so Sirius A
  opens the Sirius A section of *Sirius*. Redirects into “List of …” pages,
  missing pages and disambiguation pages are rejected. A component without
  its own article uses its system’s: the Wikidata “part of” parent when that
  parent is a binary, double, multiple or triple star, or the SIMBAD identifier
  without its component suffix (`* 61 Cyg A` → *61 Cygni*). Asterisms, moving
  groups and clusters are never used. Reviewed star systems share that
  article with components that have none.
- **Aladin Lite.** Built at runtime from the catalogue sky position, so every
  object with one gets a sky-survey view. Nebulae and molecular clouds open at
  their catalogued extent. The Sun and the Local Bubble have no link.
- **Jim Kaler’s STARS.** Each page’s lead names its Bayer or Flamsteed
  designation, for example “SIRIUS (Alpha Canis Majoris)”, which is matched to
  the object’s designations. The pages describe whole systems, so components
  share them. `KALER_DESIGNATIONS` lists eight reviewed pages whose leads
  misspell the designation or list several stars.
- **ATNF.** Every pulsar in the frozen ATNF subset links to its ephemeris by
  PSRJ name.
- **ESA/Hubble.** Hubble observations whose object names exactly match a
  designation, matched case-sensitively (*Fomalhaut b* is a planet, not
  Fomalhaut B). Artwork and ground-based context images are excluded. Images
  titled after the object come first, then a release’s main image, then press
  releases.

The 2026-11-01 build links 1,725 objects: 1,447 Wikipedia articles, 659 Kaler
pages, 272 ATNF entries and 17 Hubble images, plus Aladin Lite for objects with
a sky position.
