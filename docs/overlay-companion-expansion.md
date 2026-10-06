# Companion expansion for stellar overlays

Reviewed 2026-10-06. Bright and Western constellation overlays now carry reviewed
individual companions themselves, so their multiple-star cards do not depend on
selecting nearest-1000. Original landmark selection remains frozen. Companion
records are additive and exempt from the individual bright cutoff or figure-vertex
requirement. This is an initial reviewed expansion, not a complete multiplicity census.

| Overlay | Original non-Sun landmarks | Added companions | Current non-Sun records | Expanded systems |
| --- | ---: | ---: | ---: | ---: |
| Bright stars | 114 | 11 | 125 | 6 |
| Western constellation stars | 691 | 22 | 713 | 14 |
| Famous cluster stars | 42 | 0 | 42 | 0 |

Each package also includes Sun. The baseline neighbor/nearest-100/nearest-1000
memberships are unchanged by this overlay pass.

## Implemented systems

| System | Component buttons | Bright | Western |
| --- | --- | --- | --- |
| Alpha Centauri | A / B / C | Yes | Yes |
| Sirius | A / B | Yes | Yes |
| Procyon | A / B | Yes | Yes |
| Fomalhaut | A / B / C | Yes | Yes |
| Chi Draconis | A / B | — | Yes |
| Mu Her | Aa / Ab / B / C | — | Yes |
| Chi1 Orionis | A / B | — | Yes |
| Gamma Lep | A / B | — | Yes |
| Zeta Herculis | A / B | — | Yes |
| Iota Pegasi | A / B | — | Yes |
| Capella | Aa / Ab / H / L | Yes | Yes |
| Alshain | A / B | — | Yes |
| Gamma Cephei | A / B | — | Yes |
| Rigel | A / Ba / Bb / C | Yes | Yes |

The nearby members reuse the existing reviewed nearest-1000 rows and their
component-specific source decisions. Original HIP/bright landmark IDs remain
stable; explicit alternate IDs link them to the same individual component across
catalogs. The merge retains distinct components even when they share an approximate
position, while collapsing duplicate records of the same component in either
layer order. Aliases retain older landmark names when a reviewed aggregate primary
is replaced by its individual record.

## Rigel

Rigel has **four represented individual stars: A, Ba, Bb and C**. The secondary
region is itself a triple: B is the Ba/Bb spectroscopic pair, accompanied by visual
C. This is the grade-5 hierarchy in the [June 19, 2026 Multiple Star Catalog](https://www.ctio.noirlab.edu/~atokovin/stars/).
The exact WDS `05145-0812` source rows are frozen in
[msc-20260619-rigel.json](../catalog-work/star-systems/msc-20260619-rigel.json), with
archive and Readme fingerprints. [Mason et al. 2009, Table 2](https://arxiv.org/abs/0811.0492)
independently resolves the visual BC pair.

Rigel A keeps its existing landmark properties. Ba, Bb and C use the MSC BC sky
direction and Rigel A's parallax/proper motion as documented shared approximations.
Their inner separation, orbital phase and individual radial velocity are unknown.
The catalog's photometric/mass-ratio mass estimates are withheld. Ba and C retain
MSC B9V classifications; Bb's individual classification is blank. C uses the
individual V=7.60 from the visual B,C row; B/BC combined V is not divided between
Ba and Bb. No primary luminosity, mass, temperature, radius, metallicity or age is
copied to a companion. D and the contested old spectroscopic companion of A are
not admitted. These choices are frozen in
[overlay-individual-components.json](../catalog-work/star-systems/overlay-individual-components.json).

## Remaining review

The [structured audit](../catalog-work/star-systems/overlay-companion-audit.json)
retains **37 Bright**, **213 Western** and **16 Famous cluster** source candidates.
These counts overlap across catalogs; they are not numbers of newly discovered
systems or missing individual stars. Each record retains its stable overlay ID,
SIMBAD identity/flag, exact HIP match where available, MSC grade and hierarchy.

The audit uses the full 2026 MSC download to freeze every system matched by the
Western source HIP identifiers (135 WDS systems), then reproduces the research
queue from that [source subset](../catalog-work/star-systems/msc-20260619-overlay-matches.json).
MSC includes triples and higher, so it cannot establish binary completeness.
SIMBAD `**`, `SB*` and `EB*` flags are research leads, not sufficient evidence to
invent an individual star, assign blended measurements, or accept an uncertain
MSC hierarchy. Remaining examples include Castor, Algol, Almach, Alnitak,
Mintaka, Mizar, Acrux and Polaris. The field review must establish the individual
classification and labeling scope before admission; the current MSC counts can
include additional wide members beyond traditional names.

Famous-cluster inner companions still require individual source review. The four
Theta1 Orionis A–D landmarks remain separate Trapezium systems and are not grouped
as four components of one star. Existing physical properties and selection remain.

## Reproduction and validation

- `python3 scripts/author-bright-stars.py --write`
- `python3 scripts/author-landmark-stars.py --write`
- `python3 scripts/audit-overlay-systems.py`
- `python3 scripts/author-object-designations.py`
- `npm run catalog:generate`

The authoring helper hashes its membership plan, system definitions, source catalog,
source provenance, individual-component decisions and Rigel snapshots into generated
provenance. Replacing a reviewed aggregate uses its full individual row, avoiding
restoration of blended flux, spectrum, age or velocity. Original landmark selection
provenance is retained separately from the adopted component provenance.

Validation: six targeted catalog checks and two targeted name/alias checks passed,
including source reproduction, component measurements, both merge orders and
retention of individual names in the browser payload. TypeScript check and diff
whitespace check passed. The designation supplement reproduces from frozen inputs. Browser expectations were updated from checked catalog composition.
No browser run, production build or full test suite was run.
