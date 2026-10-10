# Selected-object statistics

All six stellar catalogs and all four overlay families receive the same frozen
`src/data/object-stats.json` supplement during `catalog:generate`. Stable object
IDs are retained. `src/data/object-designations.json` now records the exact
reviewed SIMBAD identity used by the authoring step.

The Specs card hides Designations when its alternate-name list is empty and
hides Constellation for the Sun. Known planets follows Object type; Sub-type
follows the planet count. Apparent mag. (V) follows Absolute mag. (V). Existing
card styles and font sizes are retained; long sub-type lists wrap inside the
value column. Sub-types also participate in object search.

## Sub-types

[SIMBAD physical and variability classifications](https://simbad.cds.unistra.fr/Pages/guide/otypes.htx)
were retrieved on **2026-10-08** for 1,961 distinct reviewed identities. Secondary
types are included, so a star whose primary type is a binary can still show
Wolf–Rayet or a variability class. Generic stars, wavelength detections, proper
motion and association membership are omitted. Candidate classes retain the
word “candidate”. These are recorded catalog classifications, rather than a new
assessment of conflicting literature.

Unambiguous luminosity classes in the adopted spectral string also provide
Main-sequence, Subgiant, Giant or Supergiant labels. Brown-dwarf spectra can
provide L-, T- or Y-type labels. Composite spectra can describe more than one
component of an unresolved marker. Missing classifications stay unavailable.

## Known planets

The frozen [NASA Planetary Systems Composite table](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html)
contains one row per confirmed planet. We count distinct `pl_name` values for
each host, matched by unique exact host names, HD, HIP, TIC or Gaia identifiers.
We deliberately do **not** use the `stellarhosts.sy_pnum` value: that gives the
entire system's count even for companion stars that do not host the planets.
For example, the adopted snapshot gives Proxima two planets and Alpha Centauri
A/B zero matched confirmed planets.

The Sun has eight. Zero means no confirmed host match in this archive snapshot;
it does not establish an absence of planets. Unresolved identities and missing
coverage remain null / Not available. Circumbinary counts are withheld from
individual components. The count does not create an orbital model or populate
the separate curated System tab. Extended objects do not display this row.

## Apparent V magnitude

For every row with reviewed absolute Johnson V photometry, runtime payload
generation reverses the distance modulus at that row's adopted Sun-relative
distance: `V = M_V + 5 log10(d_pc / 10)`. The source's extinction assumptions
are retained. This is an Earth-view catalog snapshot, independent of the map's
selected observer, camera, reference object or units. Variable-star magnitudes
are not a live light curve.

Missing absolute V photometry remains unavailable; no infrared, Gaia G or
bolometric substitute is used. Component photometry deliberately withheld in
the source rows is not replaced by a blended SIMBAD magnitude. The Sun's
**−26.74** apparent V comes separately from the
[NASA Sun fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html).

## Coverage (including each catalog's Sun)

| Catalog | Objects | With sub-types | Planet-count coverage | Planet hosts | Apparent V |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nearest neighbors | 22 | 21 | 22 | 8 | 19 |
| Nearest 100 | 101 | 81 | 101 | 29 | 50 |
| Nearest 1000 + reviewed components | 1,037 | 880 | 1,009 | 110 | 553 |
| Bright stars | 126 | 118 | 122 | 7 | 122 |
| Western constellation stars | 714 | 667 | 704 | 29 | 698 |
| Famous cluster stars | 43 | 42 | 43 | 2 | 43 |

The supplement covers 2,227 distinct stable object IDs including overlays:
1,678 have sub-types, 2,091 have planet-count coverage, and 143 are planet-host
rows. Objects repeated under different stable IDs in different catalogs count
separately in that inventory. Catalog generation merges their shared metadata
using the existing component identity rules.

## Reproduction

Network access is only used by the explicit acquisition step:

```sh
python3 scripts/refresh-object-stats.py --retrieved YYYY-MM-DD
python3 scripts/author-object-stats.py
npm run catalog:generate
```

Raw CSVs, exact queries and SHA-256 hashes are retained in
`catalog-work/object-stats/`. `author-object-stats.py --check` verifies offline
reproducibility. Builds use the checked-in supplement without network requests.
Custom CSVs may supply optional `subtypes` (pipe-separated), `known_planets`
(nonnegative integer) and `apparent_mag` columns independently. Custom payloads
may omit these fields, and explicit row values retain precedence.
