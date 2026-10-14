# Solar System small bodies

When the Sun is selected, System keeps the eight major planets and adds two
initially closed native disclosures: **Asteroid belt** (Ceres, Vesta, Pallas,
Hygiea) and **Dwarf planets** (the fourteen requested trans-Neptunian objects).
The second heading groups recognized dwarf planets and candidates; each Info
article states the relevant status. Ceres appears once, in the asteroid belt.

Rows open the existing planet dock card with the same Specs, Info, lock and
moon-selection controls. The asteroid cards hide Moons. Missing measurements
remain `—`. There are three sourced Info topics per object. One selected small
body is added to the System diagram; changing or clearing selection removes
its extra orbit. The eight major-planet orbits retain their normal behavior.

`src/data/solar-small-bodies.json` is additive: no existing planetary, moon,
extrasolar or stellar catalog is regenerated from this new dataset. Exact
numbered identities, original JPL physical parameters, uncertainties, orbital
epochs, rejected older values, unresolved system photometry, and reference
strings are frozen in `catalog-work/solar-small-bodies/*-sbdb.json`.
`author-data.py` compiles the adopted measurements and satellite records.

Individual and combined measurements are kept separate. In particular, the
Chiminigagua, Salacia and Orcus sizes account for their companions; total
binary masses are not assigned to primaries. Projected occultation diameters
and model-dependent ellipsoids are identified in metric tooltips. Quaoar uses
the 2026 volumetric size analysis. Older Eris rotation data remain in the
original response, while its adopted period follows the synchronous-rotation
paper. Ambiguous rotation solutions and uncertain moon parameters are withheld.

The moon lists distinguish secure satellites from the reported Achlys
companion, the indirectly suggested Máni companion, and the Quaoar feature
which may be a satellite or ring arc. Unknown or nonunique orbits are not drawn.
The four outer Pluto moon orbits use the Pluto–Charon barycenter; Charon’s
distance is relative to Pluto. This scope is stated in the metric tooltips.

Pluto has a rotatable NASA model texture in approximate visible color, with
the unobserved southern cap masked to plain gray. Its Info photograph uses
the refined 2018 natural-color processing. Ceres and Vesta use natural-color
Dawn photographs because the reviewed global model textures do not provide
calibrated true-color coverage. Other portraits use genuine observations,
explicitly identifying monochrome or infrared images and unresolved surfaces.
No artist impressions or generated terrain are used. Image sources, reuse
terms and coverage limits are in `src/assets/small-bodies/README.md`.

The focused browser coverage is `e2e/solar-small-bodies.spec.ts`. Full suites
require the separate user authorization described in `AGENTS.md`.
