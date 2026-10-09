# Stellar orbits

Reviewed 2026-10-09. All **269 reviewed multiple-star systems** were checked
against the downloaded [USNO Sixth Catalog of Orbits of Visual Binary Stars
(ORB6)](https://www.astro.gsu.edu/wds/orb6.html) and the frozen June 2026
[Multiple Star Catalog (MSC)](https://www.ctio.noirlab.edu/~atokovin/stars/index.html).
The adopted dataset contains **221 solutions for 169 systems**. The other 100
systems have no safely matched solution in these inputs; this does not mean that
no orbit has ever been published. Some adopted solutions have only partial
elements, so not every orbit has a drawable path.

## Reproduce and review

Run `python3 scripts/author-stellar-orbits.py` to regenerate
`src/data/stellar-orbits.json` and
`catalog-work/star-systems/stellar-orbits-audit.json`. The audit lists source
URLs, retrieval date, input checksums, rejected scopes and all unavailable systems.
The original download is `catalog-work/star-systems/orb6-20261009.txt`.
MSC inputs and their format are already frozen in
`catalog-work/star-systems/catalog-companions-msc.json` and
`catalog-work/star-systems/msc-20260619.Readme`.

Matching requires exact HIP/WDS cross-references belonging to the reviewed
system. Coordinates and similar display names never establish an orbit match.
Each pair identifies individual component IDs or the combined center of mass of
an explicitly defined inner group. Reversed duplicate pairs are deduplicated.
ORB6 takes precedence over a compiled alternative for the same scoped pair.
Published component naming differences for Capella, Mu Cassiopeiae, Chi
Draconis, Iota Pegasi, Gamma Persei and GJ 105 are reconciled explicitly in the
generator. Proxima's ORB6 AC solution is scoped to AB–C, consistent with the
source's orbit around the Alpha Centauri AB center of mass.

The axis in AU is the **relative** semi-major axis, computed as
`angular axis in arcseconds * 1000 / parallax in mas`. Each conversion records the
exact angular axis, parallax and catalog star used. It is neither an instantaneous
separation nor an individual star's barycentric axis. The distance may be the
catalog's shared system distance. Estimated wide-system periods from MSC
`sys.tsv` are not promoted to solved orbits. Unavailable values remain null.
MSC's zero placeholders for unknown angular elements are withheld, including
ambiguous circular-orbit zeros. Nonpositive periods and hyperbolic fits are not
rendered as closed orbits.

Periastron epochs preserve the source's Besselian/Julian-year or JD/MJD
convention. ORB6's century and truncated-JD flags are converted explicitly;
large MSC epoch values use its documented JD−2400000 convention. Julian dates
are formatted without significant-digit rounding that could discard days.
Grade 9 astrometric solutions describe the photocenter: their angular axis is
withheld from the relative stellar-axis field and their limitation is displayed.
Grade 8 denotes an interferometric solution, not grade 8 out of 5. Grade 4/5
relative solutions carry a visible preliminary/poorly constrained note.

## System view

The view uses the existing planetary diagram, subgroup-heading, property-row,
component-button and tooltip styles. It supplies the requested eight orbit
fields with mouse, keyboard-focus and touch tooltips, plus a source link.
The header's component controls select the individual catalog record. New scene/Object
Browser selections start at the system primary A (or Aa); history/saved views
retain the actual component.

Nested pairs have separate views and independent scales. The system-heading icon
switches between the sky projection and a face-on view of the orbital plane.
Sky projection uses the adopted orientation, north up and east left; the top view
preserves eccentricity and shows periastron to the right. The view choice persists
while switching pairs and components. Missing geometry disables the toggle. Displayed
star sizes, within-group offsets and orbital phase are illustrative. A fixed
eccentric anomaly avoids implying today's position or an N-body simulation.
Unknown orbital geometry shows the available components without invented paths.

When both sides have catalog masses, the relative ellipse is split into two
barycentric ellipses using `M_secondary / (M_primary + M_secondary)`. All masses
of a grouped side must be available. The center marker appears only when its
offset is greater than two primary radii even at periastron, or when the primary
is an inner group. Missing masses suppress a calculated barycenter; the companion
is drawn in the primary-relative frame and the diagram tooltip explains this.
These masses may be published estimates; this is not a dynamical mass refit.

Stellar-orbit data loads in a separate lazy chunk alongside the planetary dataset.
Catalog geometry, component membership and the main map's stellar motion are
unmodified.
