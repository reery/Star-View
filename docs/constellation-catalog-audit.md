# Constellation catalog audit — 2026-10-19

Follow-up literature updates have now been adopted for Castor, Spica, Nunki and
Menkalinan. See [the enrichment record](constellation-enrichment.md) for the
changes and remaining limits. The counts and issue descriptions below document
the **initial audit baseline**; the machine-readable coverage report contains
the current effective records.

The constellation catalog is substantially incomplete for multiple systems. It
cannot currently be described as containing the best available properties for
every represented star. Some gaps are justified by unresolved observations;
others have published component evidence awaiting adoption, and some reflect
an incomplete hierarchy. A recently downloaded compilation alone does not
establish that its underlying measurements are current or appropriate.

This audit inventories all 88 charts, all 691 unique figure vertices, and all
six bundled stellar catalogs after the application's actual identity, statistics,
observation and companion completion steps. The initial Western overlay contained 713
non-Sun input records and expands to **1,014 effective records**, including
**520 records in 197 explicitly identified multiple systems**. A record can
still represent an unresolved subsystem; these are not 1,014 independently
resolved stars. Records without a reviewed system identity are not certified
single stars.

The coverage census is comprehensive for these inputs. The live literature
review is targeted (Castor, Spica, Nunki and Gaia release status), **not an
exhaustive search of all publications for all 691 figure stars**. The initial
audit adopted no new measurements; the linked follow-up records the subsequent adoptions.

## Initial availability in effective records

| Property | All records, available / 1,014 | Multiple-system records, available / 520 |
| --- | ---: | ---: |
| Temperature | 728 | 237 |
| Mass | 445 | 147 |
| Radius | 595 | 134 |
| Bolometric luminosity | 593 | 132 |
| Metallicity | 525 | 127 |
| Age | 122 | 54 |
| Absolute visual magnitude | 843 | 349 |
| Spectral classification | 821 | 327 |

**252 of the 520 multiple-system records have none of temperature, mass,
radius or luminosity.** Only three records without a reviewed system identity
have the same four-field gap. Availability includes estimates, derived values,
model results and shared quantities; it does not certify an independent
measurement. Ages and abundances cannot safely be filled using generic defaults.

The raw CSV also understates actual coverage: completion supplies 59 otherwise
blank fields on 35 existing overlay rows, as well as 301 additional records.
Those completed values are already available to the application.

Uncertainty coverage deserves its own review. Of 664 effective records with an
adopted radial velocity, only 35 carry its numerical uncertainty in raw
astrometry. Only 43 records have both proper-motion error fields. Some motion
values are explicitly shared approximations; a small formal error would not
remove orbital, pulsation or source-scope uncertainty. The report retains the
raw astrometry and links each record to its detailed source evidence.

## A user-visible inconsistency repaired

Embedded chart snapshots were stale relative to the adopted overlay. Before
regeneration there were **62 scientific-field differences across 26 figure
stars**. Examples included missing masses for Hassaleh and Canopus, missing
properties for Muphrid and Aldebaran, and superseded temperatures for several
hot stars. Zeta1 Scorpii's embedded temperature was 5,830 K while the adopted
catalog already held its reviewed 17,200 K value.

All charts have been regenerated from the existing adopted catalog; the audit
now finds **zero** such differences. This exposes existing enrichment and
corrections through chart selection; it does not introduce new measurements.
The six source CSVs and shared component pool are unchanged, including their
physical values, motion, uncertainties and retained source records. The updated
charts retain links and refreshed checksums to their source catalog. Previously
rejected source measurements remain in the frozen inputs and existing provenance.

`catalog:validate` now also checks chart reproducibility. A focused regression
compares unloaded chart selections with the current effective catalog for every
figure vertex, including physical fields, photometry, position and motion.

## Initial literature and hierarchy findings

| System | Current issue | Evidence and required treatment |
| --- | --- | --- |
| Castor | Five represented records; C still combines the YY Gem binary | [Torres et al. 2022](https://arxiv.org/html/2210.16322) confirms six stars. Review Ca/Cb before splitting C and preserve its blended observations. The four A/B component masses are already present. |
| Spica | Aa/Ab remain one `Aab` record, separate from Ac | [Tkachenko et al. 2016, Table 7](https://arxiv.org/html/1601.08069) publishes separate close-binary masses, radii, temperatures and luminosities. Reconcile newer hierarchy/literature and explicit component identities before adoption. |
| Nunki | Aa/Ab exist, but both lack mass, radius and luminosity | [Waisberg 2026](https://arxiv.org/html/2603.17011) supplies a newer binary analysis. Its total dynamical mass, approximate individual model masses and combined-spectrum temperature need different scopes. |

Exact current IDs/names, source URLs, sections, candidate values, uncertainty
conventions and the required next decisions are frozen in
[`source-review.json`](../catalog-work/constellation-audit/source-review.json).
These candidates establish that some blanks are import/review gaps, rather
than the absence of published information. They do not establish that the
first located paper should automatically replace every existing measurement.

The full report ranks all 197 systems by the number of records lacking the
four core physical fields. Large gaps include Ashlesha (5/5), Nu Gem (4/5),
Dubhe (4/5), Mizar (3/6), Acrab (3/6), and Shaula (3/3). These are research
priorities, not promises that every field has a defensible published value.
Porrima A is another prominent target: all eight inventoried properties,
including its spectrum and individual visual magnitude, are absent after
blended parent measurements are correctly withheld.

## Source freshness and explanatory coverage

The main SIMBAD/landmark snapshots were retrieved on 2026-10-01; the shared
enrichment manifest was reviewed on 2026-10-11. Their inputs span several
publication generations, including 1999 evolutionary models, 2012 SED results,
Gaia DR3 and object-specific later literature. Retrieval and publication dates
must remain distinct. Prefer an applicable resolved study over an older generic
fit, while comparing methods, errors, extinction, variability and adopted distance.

Gaia DR4 is planned for **2 December 2026**, so DR3 remains the appropriate full
public Gaia release at this audit date. The [Lohrmann Observatory release
announcement](https://tu-dresden.de/bu/umwelt/geo/ipg/astro/observatorium/news/gaia-data-release-4?set_language=en)
was accessible; ESA's direct DR4 overview did not load in the research tool.
This does not verify every DR3 field or imply that Gaia resolves every bright binary.

Only **44 of 691 figure stars** currently resolve to an in-app Info article.
Counting all represented companions, 130 of 1,014 records have Info access;
several components share one system article. Existing bright-star articles
therefore do not cover most constellation landmarks. Expanding short,
primary-source-backed system articles alongside physical enrichment would
directly address the need to leave the application for more information.

Recommended work order:

1. Repair the confirmed Castor/Spica hierarchy gaps and review Nunki's newer
   results, preserving every original source observation with its scope.
2. Work through the complete system gap queue, seeking resolved spectroscopy,
   interferometry, eclipsing-binary and dynamical studies. Treat ORB6/MSC
   membership/orbits separately from evidence for individual physical properties.
3. Add compact Info articles for the remaining figure landmarks, sharing one
   article across explicitly identified system components. Include useful
   published rotation, variability and orbital facts when available, rather
   than padding missing physical fields with generic class values.
4. Track each field's source, uncertainty, method and scope, with explicit
   unavailable/inapplicable/review-needed reasons. Review Gaia DR4 after release
   using release-specific identity crossmatches.

## Reproduction and verification

`node scripts/audit-constellation-catalog.ts` regenerates
[`coverage.json`](../catalog-work/constellation-audit/coverage.json); `--check`
compares it byte for byte and rejects remaining chart differences. The report
contains every effective record, every missing field, per-constellation and
per-system coverage, source evidence locations, raw astrometric errors, retained
source counts and SHA-256 fingerprints. It verifies component closure, reviewed
literature identities and source-to-component measurement retention.

`python3 scripts/author-constellations.py --write` refreshes embedded snapshots;
running without `--write` checks all 88 for reproducibility.

Catalog validation (including preservation), focused constellation tests and
TypeScript validation passed. The all-catalog comparison found 336 shared
objects across six catalogs with no conflicting effective scientific fields.
The full test suite and browser tests were not run.
