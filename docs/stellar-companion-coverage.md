# Shared stellar companions

Every stellar catalog now uses the same component pool. Loading any exact member
loads all its reviewed stellar companions, irrespective of the catalog's original
distance, apparent magnitude, luminosity, or spectral-class limits. Source catalog
manifests still describe the original selection; the app adds companions when it
loads those records. Direct selection of B, C, or a hierarchical component retains
that component and its own measurements.

The 2026-10-09 pool contains **269 systems and 696 individual records**. It combines
the existing literature reviews with physical hierarchies from the [Multiple Star
Catalog](https://www.ctio.noirlab.edu/~atokovin/stars/) (2026-06-19), individual
components in [Cifuentes et al. 2025](https://arxiv.org/abs/2412.12264), and the
explicit multiple stellar spectra in the frozen SIMBAD catalog inputs. All
recognized composite classifications in the six source catalogs are covered.

Membership uses exact reviewed catalog, HIP, WDS, SIMBAD, or Gaia identities;
positions do not establish membership. Suspected/spurious MSC branches,
unresolved astrometric candidates, planets, and minimum-mass substellar candidates
without a stellar detection are withheld. The pool represents confirmed coverage
from these sources, rather than a claim that all possible companions have been
discovered or measured. A bare binary flag is not enough to identify its members.

Available individual fields: 409 temperatures, 245 masses, 261 luminosities,
267 radii, 276 metallicities, and 79 ages. Frozen SIMBAD atmosphere measurements,
quality-filtered exact-ID Gaia DR3 fields, Cifuentes component calibrations, and
reviewed literature provide the measurements or estimates. The existing
single-star temperature and Stefan–Boltzmann derivations remain explicitly
documented in provenance. Unsupported fields stay null; integrated fluxes,
system masses, minimum masses, and unresolved-parent physical estimates are not
copied into individual members. Close-component sky positions/distances can share
the system's approximate astrometry; no orbital phases or individual radial
velocities are invented.

Dubhe A has `G9III`, and Dubhe B has `A7.5`. A is positioned at luminosity class III
on M–K; B has no recorded luminosity class in this source and therefore cannot be
given a vertical M–K position. Its individual V magnitude is 4.86. The MSC also
records Ca, Cb, and D in the wider physical hierarchy. Dubhe A's physical override
uses [Guenther et al. 2000](https://doi.org/10.1086/312473): 4660 K, model mass
4.25 ± 0.25 solar masses, log luminosity 2.5, and [Fe/H] −0.19. Its radius is derived
from that luminosity and temperature. B's unsupported physical fields stay null.

## Reproduction

Run `npm run catalog:companions` to regenerate the pool and field/membership audit
from the frozen files in `catalog-work/star-systems/catalog-companions-*`. Then run
`npm run catalog:generate` to refresh class-reference samples. The audit records
input SHA-256 hashes, source records, adopted fields, integrated fields withheld,
and rejected branches. ADQL query files accompany the SIMBAD/Gaia downloads.
No live network lookup is needed to regenerate the pool.

The shared runtime helper is `src/stellar-companions.ts`; component identity and
system grouping are in `src/star-systems.ts`. Compact and expanded Objects views
show a paired-star icon with a component tooltip. Existing selected-object
pictograms and component buttons display the same systems.
