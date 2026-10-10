# Constellation charts

The reviewed charts are Canis Major and Centaurus. `src/constellations.ts` registers available
charts in a name-keyed map; other constellation names remain visible in Specs, with their
chart button disabled until coverage is reviewed. Figure data loads only when a
card is opened, independently of the Western constellation star overlay toggle.

## Source path

`scripts/author-constellations.py` extracts the reviewed figure from the pinned
Stellarium Western sky culture already used by the landmark-star overlay:

- `catalog-work/western-constellation-stars/stellarium-western-index.json`
- `catalog-work/western-constellation-stars/source-manifest.json`, including the
  Stellarium commit and SHA-256 checksums of frozen source inputs
- `src/data/catalogs/western-constellation-stars/stars.csv` for adopted ICRS sky
  coordinates and display names, authored from the frozen SIMBAD/Hipparcos chain
- `catalog-work/western-constellation-stars/hipparcos-v.csv` for Johnson V point sizes
- `catalog-work/western-constellation-stars/simbad.csv` for Greek Bayer designations
- `catalog-work/constellation-charts/boundaries-j2000.dat.gz` and its source
  manifest for sampled CDS VI/49 J2000 region boundaries and neighboring names
- `catalog-work/constellation-charts/boundary-contours-b1875.dat` and its
  documentation for ordered contours and the neighbor across each segment

Generate with `python3 scripts/author-constellations.py --write`; run the script
without `--write` to check reproduction. The generated chart records source URLs,
paths, and checksums. Regenerate charts after changing their underlying catalog.
Stellarium polyline style tokens are not star identifiers. Figure lines are a
sky-culture choice, distinct from official IAU regions and physical star systems.

## Coordinates and future coverage

Membership currently follows the object's catalogued constellation. A missing
constellation is not inferred from figure stars. The selected position uses raw
astrometry, nebula/compact-object sky coordinates, or the inverse shared
Galactic-to-ICRS rotation. This supports non-star objects without making them
figure members. Extended objects are shown at their catalogued center.

The card is a static catalogue view from Earth (north up, east left), independent
of the map's origin, observer, and motion simulation. The gnomonic projection
handles the RA wrap and keeps angular geometry; point sizes are illustrative.
Canonical component identities prevent Sirius B from replacing Sirius A's label.

The chart uses the map's shared star materials, textures, shaders, and selected
color mode. All markers have a fixed full-strength virtual viewing distance;
the selected star's physical distance does not dim the figure stars. Core size,
glow size, and glow strength follow Earth-view apparent magnitude, using the same
value as the tooltip. Brighter stars appear larger, with bounded sizes that keep
faint stars visible. Line cutouts match each core, leaving lines visible through
the glow. Tooltips use
distance from the Sun in the current distance unit and apparent magnitude.
Only the selected object's name appears on the chart; other figure stars keep
their Greek Bayer designations when available. Tooltips identify each object
with its colored icon and name, show distance with one decimal place below 50 ly
(using the same physical cutoff in parsec mode) and whole numbers at greater distances,
and show apparent magnitude with one decimal place.
The figure fills the chart, with neighboring regions indicated at the corners
and a narrow margin keeping the full IAU outline visible.
Clicks and Enter/Space select exact star components. Stars absent from the active
catalog are retained as explicit selections across refreshes, independently of
overlay switches, so selection history and origin controls keep working.

Spaced dashed lines show IAU regions; solid lines show the Western figure.
Boundary coordinates are already J2000, so B1875 borders are never plotted as
ICRS coordinates. CDS samples are sorted by RA. The authoring script uses the
ordered B1875 contour to identify each meridian/parallel segment, match its
original J2000 samples, and retain the source neighbor labels. The inverse
precession is used only for matching; plotted coordinates remain untouched.
Duplicate samples are merged, preferring original corners. Generation rejects
unmatched samples, missing endpoints, and disconnected contours. This preserves
Centaurus's inward notch around Crux without a constellation-specific sorting
rule. Each additional constellation still needs a chart review before enabling
coverage, especially for polar regions and the two Serpens contours.

Add reviewed abbreviations to the authoring script's `REVIEWED` map, then register
their lazy loaders in `src/constellations.ts`. Chart content, sky projection,
label placement, visibility guide, and card controls are shared. Each chart stays
in its own lazy-loaded chunk; concurrent requests share one cached promise. The
renderer resolves all figure identities in one catalog pass and caches only
those matches per chart/catalog pair, using weak references so replaced catalogs
can be collected. Authoring parses and checksums the shared source files once
per run. A locked card follows selection across reviewed constellations.

## Visibility guide

The compact world map shades land black wherever the selected object's catalogue
declination permits it to rise above a level geometric horizon. Latitude lines
are spaced every 20°; the orange line tracks the latitude selector in 10° steps, initially
40° N. Latitude bounds are declination ±90°, clipped to Earth's poles. At a
limiting latitude the object only grazes the horizon. This is sky geometry rather
than a naked-eye visibility or weather prediction, and applies to non-stellar
selections at their catalogue centers too.

The 16 px month bar and month summary update for the selected latitude. A month
is highlighted when the object is above the horizon at 10 pm apparent local
solar time on the 15th and the Sun is at least 18° below the horizon. This excludes
astronomical twilight and polar daylight. Local solar time is independent of
civil time zones and daylight saving. The guide uses a representative J2000 year
to match the catalogue coordinate frame; it is an approximate annual season,
independent of the 3D observer and motion simulation. It does not model refraction,
terrain, extinction, limiting magnitude, or weather. A December–April season is
shown as one range across the year boundary. A selected latitude is preserved
when selecting another figure star; latitudes where it never rises show no months.

The calculation reuses the shared low-order solar longitude in `earth-orbit.ts`
and the [USNO altitude relation](https://aa.usno.navy.mil/faq/alt_az),
[solar coordinate formula](https://aa.usno.navy.mil/faq/sun_approx), and
[astronomical twilight definition](https://aa.usno.navy.mil/faq/RST_defs).
`src/data/world-land.json` contains public-domain Natural Earth v5.1.2 1:110m land
outlines, simplified with a 0.65° Douglas–Peucker tolerance and expressed in
equirectangular coordinates (`x = longitude + 180`, `y = 90 − latitude`). The
derived file retains the pinned upstream URL, input SHA-256, and tolerance.
