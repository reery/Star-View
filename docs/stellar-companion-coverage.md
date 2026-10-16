# Shared stellar companions

Every stellar catalog now uses the same component pool. Loading any exact member
loads all its reviewed stellar companions, irrespective of the catalog's original
distance, apparent magnitude, luminosity, or spectral-class limits. Source catalog
manifests still describe the original selection; the app adds companions when it
loads those records. Direct selection of B, C, or a hierarchical component retains
that component and its own measurements.

The 2026-10-11 pool contains **341 systems and 842 individual records**. It combines
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
and orbit scopes. Existing individual values retain priority; additional reviews
fill their missing fields.

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

Available individual fields: 592 spectral classifications, 467 temperatures,
301 masses, 289 luminosities, 295 radii, 289 metallicities, 91 ages, and 516
absolute visual magnitudes. Frozen SIMBAD atmosphere measurements,
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

## Individual literature enrichment

`catalog-work/star-systems/reviewed-companion-literature.json` adds an exact-member
review after system splitting and the earlier overrides. Every entry guards the
system ID, star ID, component label and expected name. Each value records its
source, table/section, measurement or model status, and published uncertainty where
available. Existing values win; unused literature alternatives remain in the audit.
The final pass then runs the established dwarf-temperature and Stefan–Boltzmann
derivations on the adopted individual inputs, while honoring explicit withheld
fields. A spectral range does not become a precise scalar temperature.
It also does not enter an exact-subtype class comparison or catalog class sample.
The `m` annotation in Menkalinan's A1mIV spectra preserves its stated IV stage.

The first pass reviewed 46 individual records and filled **136 fields across 41
stars**, without changing membership or any pre-existing non-null value. This
includes 35 masses, 18 temperatures, 11 luminosities, 11 radii, 5 ages, 16 spectral
classifications and 20 apparent/absolute V pairs. Some additions come from final
derivations on earlier reviews, such as the B8V temperatures of Rigel Ba and C.

Dschubba A now has primary-only model values from
[Suffak et al. 2020, Table 4](https://arxiv.org/abs/2001.04966): 29700 K,
15.3 solar masses, 28000 solar luminosities and 7.3 Myr. Its scalar radius is the
Stefan–Boltzmann equivalent (about 6.32 solar radii); the published polar and
equatorial radii remain separate audit constraints. B has the 8.2 ± 0.6 solar-mass
model estimate from [Miroshnichenko et al. 2013, Section 3.4](https://arxiv.org/abs/1302.4021)
and its B1–B3 main-sequence classification. Its published temperature and age ranges
are preserved in provenance, rather than reduced to invented precise scalars.
The A model errors exclude some distance, inclination and reddening systematics.
Both components retain the app's shared approximate distance; unresolved parent
fluxes and velocities are not restored.

Further primary-paper reviews cover
[Achernar](https://arxiv.org/abs/2209.07537),
[Rasalhague](https://arxiv.org/abs/2107.02844),
[Delta Delphini](https://arxiv.org/abs/1802.00468),
[Thuban](https://arxiv.org/abs/2111.03887),
[Menkalinan](https://arxiv.org/abs/astro-ph/0703634) and
[Alhena](https://arxiv.org/abs/1912.08688).
The adopted radius and temperature of a rapid rotator retain their mean/surface
scope; independently fitted component ages are not forced to agree. Original
Thuban log luminosities take precedence over a conflicting DEBCat transcription.

The frozen [Piccotti et al. 2020 tables](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/492/2709)
provide an additional reviewed set of 17 exact pairs. Orbital-parallax masses
normally require agreement with independent Hipparcos parallax within three
combined standard errors. That screen alone is insufficient: Delta Tri's uncertain
orbital solution and M-dwarf classifications are rejected in favor of its
Hipparcos-parallax masses and the separate two-component SED model of
[Kim et al. 2005, Section 5.3](https://arxiv.org/abs/astro-ph/0506434).
Alaybasan's conflicting primary/secondary light ordering is withheld. The full
Table 7 classifications and Tables 11/12 evolution estimates are not imported
blindly; several conflict with known stellar classes. Johnson V decompositions
use the paper's explicitly described V photometry, with absolute V recomputed at
the app's adopted distance and no extinction correction.

Algol, Mu Ori and GJ 644 subsystem-total masses cannot be assigned to their leaf
components. DEBCat's uppercase variable MU Cas is not mu Cassiopeiae. YY Gem's two
measurements cannot be attached to the still-unresolved Castor C record as if it
were one star. These exclusions and all raw table hashes are frozen with the review.

The audit's `propertyCoverage` contains available counts, missing fields for each
component, and a queue of 123 records without any classification, scalar physical
property or absolute V. These are remaining review gaps, not evidence that no
measurements exist in the literature. Membership coverage and property coverage
are separate: a detected star stays selectable even when its measurements remain
unavailable. Improving completeness means resolving those exact-member gaps,
while retaining source scope and uncertainty.

## Reproduction

Run `npm run catalog:companions` to regenerate the pool and field/membership audit
from the frozen files in `catalog-work/star-systems/catalog-companions-*`, the
individual literature review, and `literature-components/`. Then run
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
