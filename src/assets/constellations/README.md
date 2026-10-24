# Constellation Info schematics

Original Star View SVG drawings for the constellation Info articles in
`src/data/constellation-info/`. `scripts/author-constellation-diagrams.py`
generates them from the bundled chart positions in `src/data/constellations/`,
using the same gnomonic projection as the constellation card (north up, east
left). A few reference points come from fixed J2000 coordinates in the script:
Arcturus, Altair, the Pleiades, the Hyades centre, M31 and Sagittarius A*.
Star dot sizes follow the V magnitude only roughly, and labels are placed by
hand. Every image is 840 × 480 and has a text alternative.

| Asset | Purpose |
| --- | --- |
| `orion-signpost.svg` | Orion’s Belt points to Sirius one way and to Aldebaran and the Pleiades the other. |
| `big-dipper-pointers.svg` | Merak–Dubhe pointers to Polaris; the handle arcs to Arcturus. |
| `pole-precession.svg` | The north celestial pole’s ~26,000-year circle around the ecliptic pole. The stars do not lie exactly on the circle, and the epochs are approximate. |
| `southern-pole.svg` | The Southern Cross and the Pointers lead to the south celestial pole. The Coalsack outline is schematic. |
| `summer-triangle.svg` | Vega, Deneb and Altair with catalogue-rounded distances. |
| `antares-scale.svg` | Antares’ catalogue radius against planetary orbits, all drawn as circles to one scale. |
| `sagittarius-teapot.svg` | The Teapot asterism and the direction of the Galactic Centre. |
| `taurus-depth.svg` | Sky positions against true distances for Aldebaran, the Hyades and the Pleiades. |
| `andromeda-galaxy.svg` | Star-hop from Mirach to M31; the galaxy outline is its approximate 3° × 1° extent. |
