# Component-data repairs and remaining audit

Reviewed and repaired 2026-10-16 after the Kruger 60 enrichment. The initial
audit and source distinctions below are retained for context; its confirmed
gaps have now been filled through the shared component literature pipeline.
Existing Kruger 60 work and unrelated worktree edits are preserved.

## Applied repairs

All **25 confirmed missing fields on 14 components in eight systems** are now
available in the effective records used by every containing browser catalog.
This includes 14 dynamical masses, ten absolute Johnson V magnitudes derived
at the current component distances, and the 40 Eridani B radius. The deblended
apparent V values are retained too.

VB 24 A additionally receives its unflagged, exact-component SED/empirical mass,
radius and luminosity estimates. Six resolved luminosity classes are restored:
GX And, Struve 2398 A/B, GJ 412 A/B (BD+44 2051 A/WX UMa), and GJ 1245 B.
The 40 Eridani B luminosity is taken directly from Bond et al. section 4,
0.01349 ± 0.00054 solar. Its independent existing temperature remains unchanged.

The pass adds **39 numeric fields** (including both apparent and absolute V)
and completes six classifications. No previously known numeric property,
astrometry, motion, uncertainty or membership is replaced. Published model
inputs and uncertainties remain explicit, including VB 24 A's source 3400 K
versus the independently retained 3571 K spectroscopic temperature.

The 11 initially detected stale V-withholding warnings are gone. Other
superseded withholding statements are also reconciled only when the actual
individual field is available; all removed statements survive in the audit.
The legacy property-coverage report now uses effective component records and
reports raw CSV gaps separately, so it no longer counts completed app data as
missing.

The generic category filter remains conservative. Reviewed exceptions use
exact names, system/member labels, source hashes, and unique Gaia identities.
The importer rejects ambiguous/shared Gaia IDs and checks expected prior
classifications before a correction. This prevents a parent or pair value
from silently becoming an individual measurement.

Current remaining queues contain **25 physical-source candidates** (14 are
category 3) and **16 spectral candidates**. These include source quality flags,
unresolved hierarchies, competing classifications or inapplicable calibrations.
They remain unavailable pending appropriate individual evidence.

`catalog-work/star-systems/component-gap-adoptions.json` freezes the adopted
observations, original effective records, photometric inputs, and decisions
for held candidates. The existing `reviewed-companion-literature.json` applies
the reviewed values after component splitting.

The audit reads all six bundled stellar CSVs and all **844 effective component
records in 341 systems**. It compares raw CSV gaps with the shared records used
by the app, checks exact Gaia DR3 identifiers against the frozen Cifuentes table,
and verifies a targeted set of omissions against primary literature. It does
not claim an exhaustive literature search for every object or nullable field.

## Initial confirmed published coverage gaps, now repaired

The initial audit found **14 components in eight systems lacking 25 fields**
with component-specific published evidence. All entries below are now adopted.

| System / app names | Missing fields with published evidence | Published mass (solar) |
| --- | --- | --- |
| Ross 614 / V577 Mon A and B (GJ 234) | Both masses and absolute Johnson V | A 0.223 ± 0.002; B 0.109 ± 0.001 |
| Wolf 424 / FL Vir A and B (GJ 473) | Both masses and absolute Johnson V | A 0.124 ± 0.005; B 0.113 ± 0.005 |
| GJ 1245 A and C | Both masses and absolute Johnson V | A 0.111 ± 0.001; C 0.076 ± 0.001 |
| GJ 22 A and C | Both masses and absolute Johnson V | A 0.405 ± 0.008; C 0.157 ± 0.003 |
| GJ 623 / G 202-45 Aa and Ab | Both masses | Aa 0.379 ± 0.007; Ab 0.114 ± 0.002 |
| GJ 791.2 / G 24-16 A and B | Both masses and absolute Johnson V | A 0.237 ± 0.004; B 0.114 ± 0.002 |
| 40 Eridani B / GJ 166 B | Mass and radius | 0.573 ± 0.018 |
| 61 Cygni B | Mass | 0.6289 (+0.0094/−0.0092) |

The first six systems are in [Benedict et al. 2016, Table 10](https://www.astro.gsu.edu/RECONS/published37.pdf).
The publication's listed absolute V values use its own parallaxes. Adoption
retains those values as evidence and uses its system V and ΔV to derive apparent
component magnitudes and absolute V at the current catalog distance. Wolf 424
has a slight V-band brightness reversal: its component identities must not be
reordered by brightness. GJ 1245 A/C share an unresolved Gaia identifier, so
their published component labels and reviewed identities must control adoption.

[Bond et al. 2017, Table 1](https://arxiv.org/pdf/1709.00478) supplies the
40 Eridani B dynamical mass and radius 0.01308 ± 0.00020 solar radii; the mass is
attributed to Mason et al. 2017. The current record has a temperature and V
magnitude; the missing mass, radius and luminosity are now supplied from this
dedicated white-dwarf study. These retain their published distance/atmosphere
inputs; no generic M-dwarf calibration or shared cooling age is substituted.

[Giovinazzi et al. 2025, section V.2 and Table 6](https://arxiv.org/html/2505.12563v1)
supplies the 61 Cyg B mass. Its orbit fit calls B the primary and A the secondary;
copying the familiar primary/secondary columns without checking section V.2
would swap the measurements. This gap is especially clear because the same
paper is already used elsewhere in the repository for Achird B.

All exact IDs, expected names, system membership, published values,
uncertainties and source links are retained in
`catalog-work/star-systems/component-gap-literature-review.json`.

## Initial automatic-filter candidate queue

The frozen [Cifuentes et al. 2025 table](https://arxiv.org/html/2412.12264v1)
contains **49 candidate physical-field values on 29 exact Gaia matches** that
are absent from effective component records. **16 of these components have
category 3**, which the generic companion import excludes.

Category 3 describes the survey's available observational coverage. It does
not by itself establish that a known star's published properties are unusable.
It also does not guarantee the source resolves every inner companion. The
category filter needs a reviewed exception mechanism, rather than unconditional
removal.

Examples of category-3 gaps:

| Component | Missing source candidates | Further review needed |
| --- | --- | --- |
| Ross 52 A / GJ 568 A | Calibrated mass and radius | Confirm source/component applicability |
| G 39-29 A / GJ 3304 A | Calibrated mass and radius | Confirm source/component applicability |
| VB 24 A / GJ 1194 A | Mass, radius and luminosity | Confirm source/component applicability and uncertainties |
| EI Cnc A / GJ 1116 A | Reviewed mass and radius now adopted | [Dedicated A/B review](ei-cnc-enrichment.md); retain M7; use Winters masses and Pineda-based radii tabulated by Silverstein et al. |
| HD 32450 A | Calibrated mass and radius | Resolve K7 versus published M0V classification |
| G 250-31 A | Calibrated mass and radius | Resolve M6V versus published M4.5V classification |

Other candidates include white dwarfs, sources labeled AB/Aab, spectroscopic
binaries, candidate inner multiples and sources outside a calibration's valid
range. These remain review candidates. In particular, GJ 569 B's combined mass
must not become Ba's individual mass; HD 50281 B must not be copied into Ba;
G 148-48's brown-dwarf versus M5V classification needs investigation. Shared Gaia
IDs for GJ 1245 A/C and EZ Aquarii A/B/C are flagged separately.

There are also **22 missing or incomplete classifications with published source
candidates**, including Ross 52 A, GX And, Struve 2398 A/B and GJ 1245 B. Some
describe unresolved hierarchies, so this count is a review queue, not a list of
22 safe changes.

## Initial raw-file gaps that were already filled in the app

**75 distinct components have 199 fields supplied by the shared companion
pool across 107 raw catalog rows.** These are not missing displayed properties:
`completeCatalogCompanions()` supplies the effective record during browser
catalog generation.

| Catalog | Raw rows with fields already completed | Fields completed |
| --- | ---: | ---: |
| Default nearby stars | 0 | 0 |
| Nearest 100 | 16 | 26 |
| Nearest 1000 | 50 | 105 |
| Bright stars | 12 | 17 |
| Western constellations | 29 | 51 |
| Famous cluster stars | 0 | 0 |

Examples include visual magnitudes for 61 Cyg A/B and physical estimates for
GJ 1245 B, EI Cnc B and Stein 2051 A. Counting CSV blanks alone overstates the
app's data deficit.

The initial effective notes of **11 components** said their multi-star V was
withheld even though later enrichment supplied an individual V magnitude.
Affected records are Keid A/B/C, GJ 229 A, Epsilon Indi A/Ba/Bb, 70 Oph A/B and
61 Cyg A/B. These stale explanatory notes have now been reconciled and retained
as superseded source statements in the audit.

## Reproduction and validation

Run `python3 scripts/audit-component-source-gaps.py` to regenerate
`catalog-work/star-systems/component-source-gaps.json`, or add `--check` for a
read-only byte-for-byte comparison. The report hashes all catalog/source inputs
and validates exact names and component membership for the literature review.

The current source-gap report reproduces byte for byte and reports zero
remaining gaps from the 14-component literature review and zero stale V notes.
The catalog-preservation audit passes. A separate comparison against the
working-tree state immediately before these repairs verifies unchanged
membership, all existing numeric values, astrometry, motion and nested retained
source measurements. Original CSV source records are unchanged; generated
browser catalogs are completed from the reviewed shared pool.

Validation completed: production build (including catalog preservation,
cross-catalog validation and TypeScript), nine focused Python tests, five
focused component/Kruger 60 unit tests, and one desktop browser test passed.
The browser test checks exact component selection, mass and V magnitudes in
both Nearest 100 and Nearest 1000. The full test suite was not run.
