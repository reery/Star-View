# Shared stellar companions

Every stellar catalog now uses the same component pool. Loading any exact member
loads all its reviewed stellar companions, irrespective of the catalog's original
distance, apparent magnitude, luminosity, or spectral-class limits. Source catalog
manifests still describe the original selection; the app adds companions when it
loads those records. Direct selection of B, C, or a hierarchical component retains
that component and its own measurements.

The 2026-10-10 pool contains **341 systems and 842 individual records**. It combines
the existing literature reviews with physical hierarchies from the [Multiple Star
Catalog](https://www.ctio.noirlab.edu/~atokovin/stars/) (2026-06-19), individual
components in [Cifuentes et al. 2025](https://arxiv.org/abs/2412.12264), and the
explicit multiple stellar spectra in the frozen SIMBAD catalog inputs. All
recognized composite classifications in the six source catalogs are covered.

Ordinary detected binaries also come from the frozen
[USNO ORB6 catalog](https://crf.usno.navy.mil/wds-orb6), matched by exact HIP/WDS
identity and component scope. MSC covers systems with three or more stars, so it
cannot by itself cover ordinary A/B systems with a single primary classification.
The broader pass added 56 such pairs, including Achernar, Porrima, Sabik, Ascella,
Rasalhague, Mu Velorum, Alhena, Menkalinan and Chamukuy. Two independent binaries
under the same WDS root, such as Theta1/Theta2 Tauri, retain separate memberships
and orbit scopes. Every earlier reviewed component record remains unchanged.

Adhara has an additional explicit A/B review in
`catalog-companions-reviewed.json`. `bright-adhara` and `hip-33579` refer to A;
`adhara-b` is the separate SIMBAD `* eps CMa B`, WDS J06586-2858B, Gaia DR3
5608832155887268480 record. Its own parallax is 7.6159 ± 0.0223 mas. The frozen
SIMBAD ASCII record supplies individual astrometry; physical parameters, spectrum,
V magnitude and radial velocity remain unavailable. Gaia G is not used as V.
No orbit is invented for Adhara.

Membership uses exact reviewed catalog, HIP, WDS, SIMBAD, or Gaia identities;
positions do not establish membership. Suspected/spurious MSC branches,
unresolved astrometric candidates, planets, and minimum-mass substellar candidates
without a stellar detection are withheld. The pool represents confirmed coverage
from these sources, rather than a claim that all possible companions have been
discovered or measured. A bare binary flag is not enough to identify its members.

Available individual fields: 449 temperatures, 266 masses, 278 luminosities,
284 radii, 289 metallicities, and 86 ages. Frozen SIMBAD atmosphere measurements,
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

1 Gem's missing masses were a source-coverage gap: the importer withholds MSC
magnitude/spectral-type mass estimates, and the published dynamical solution had
not yet been reviewed. [Lane et al. 2014, Table 7](https://doi.org/10.1088/0004-637X/783/1/3)
now supplies A = 1.94 ± 0.01, Ba = 1.707 ± 0.005 and Bb = 1.012 ± 0.003 solar
masses. These are individual dynamical masses from joint astrometry and
three-component spectroscopy, retained at the paper's orbital parallax of
21.39 ± 0.03 mas; the app's existing distance is unchanged. Ba's F6IV classification
(reported in the introduction from Strassmeier & Fekel 1990) replaces MSC's A8V?.
Bb is marked G2V? because section 3.3 infers the subtype from its mass, rather than
measuring a spectral subtype. No individual Ba/Bb temperature, radius, bolometric
luminosity, abundance or age is adopted. K-band luminosity ratios and absolute K
magnitudes in the paper do not establish bolometric luminosities. Sources,
uncertainties and classification caveats are frozen in the component overrides
and reproduced in the audit.

## Reproduction

Run `npm run catalog:companions` to regenerate the pool and field/membership audit
from the frozen files in `catalog-work/star-systems/catalog-companions-*`. Then run
`npm run catalog:generate` to refresh class-reference samples. The audit records
input SHA-256 hashes, source records, adopted fields, integrated fields withheld,
and rejected branches. ADQL query files accompany the SIMBAD/Gaia downloads.
No live network lookup is needed to regenerate the pool.

Catalog validation and generation run the author's `--check` first and fail if
either the component pool or its audit differs from the frozen sources. This also
applies to development startup and production builds. The check requires Python 3
and only uses the standard library and frozen local files. The audit's
`ordinaryBinaryCoverage` records every matched ORB6 decision, and
`unreviewedMultiplicityRecords` exposes unresolved source flags/WDS identifiers.
These are review candidates, not automatically physical pairs: the WDS also
contains optical alignments. Astrometric-only fits, unconnected subsystems and the
planet Beta Pictoris b are not promoted to stellar companions. Unresolved source
spectra are split only when the adopted sources establish individual components;
the detected ultracool ORB6 pairs can retain their separate L/T classifications.

Newly split ORB6 primaries do not retain integrated parent physical values,
photometry or radial velocities. Individual SIMBAD fields require a distinct,
explicitly named component. ORB6 magnitudes are withheld because their band is not
guaranteed to be Johnson V, even when an infrared flag is absent. Shared distances
used for orbit scales are explicitly recorded separately from individual motion.

The shared runtime helper is `src/stellar-companions.ts`; component identity and
system grouping are in `src/star-systems.ts`. Compact and expanded Objects views
show a paired-star icon with a component tooltip. Existing selected-object
pictograms and component buttons display the same systems.
