# Frozen literature tables

Initial tables retrieved on 2026-10-11; later snapshots carry their own dates.
Regeneration uses these local files without network access.

- `piccotti-2020-*`: [CDS J/MNRAS/492/2709](https://cdsarc.cds.unistra.fr/ftp/J/MNRAS/492/2709/),
  Piccotti et al. (2020), `2020MNRAS.492.2709P`.
  The original ReadMe defines the fixed-width columns and physical quantities.
  Table 1 records the source pair/orbit identities, Table 3 the parallaxes,
  Table 5 the individual masses, Table 6 the decomposed V photometry, and
  Table 7 the classifications. Freezing a table does not approve every row.
- `debcat-20261011.dat`: [DEBCat linear/log parameter table](https://www.astro.keele.ac.uk/jkt/debcat/debs.dat),
  maintained by John Southworth. This is a review aid, with the original papers
  taking precedence; it contains unresolved-system magnitudes and named variables
  that must not be joined by case-insensitive names.
- `constellation-20261019-selected.json`: selected Spica, YY Gem, Nunki,
  B-star multiplicity and beta Aurigae source tables, with per-source retrieval
  dates, URLs and full-document hashes. Also preserves adopted-model assumptions,
  uncertainty conventions and the signed astrometric offsets used to validate
  orbital orientation. The new `reviewed-constellation-*.json` plans approve only
  the explicitly mapped components and fields; the frozen snapshot alone does
  not authorize a new adoption.

`../reviewed-companion-literature.json` maps the reviewed records to exact Star
View system/component IDs, preserves primary-paper values and uncertainty/model
qualifications, and hashes each raw input. Its `sourceReviews` records rejected
hierarchical totals, conflicting classifications and parallax/photometry issues.
The author rejects hash or member-identity drift. Updating a source requires a
new review of its component scope, not just replacing its checksum.
# Additional constellation data and motion review, 2026-10-19

`constellation-20261019-motion-selected.json` freezes selected component data and
RV solutions for Nusakan, Ashlesha, Nu Gem, Dubhe, Mizar A and Iota Pegasi, plus
the reason Porrima's total mass is not adopted for each component. It preserves
primary-paper document hashes, component mappings, estimates, model assumptions
and uncertainty conventions. `constellation-20261019-intermediate-adoptions.json`
retains earlier generated source adoptions during reconciliation; it is history,
not a set of independent new measurements. See
`docs/constellation-motion-enrichment.md` for the adoption and validation limits.

# Combined CNS5 component splits, 2026-11-02

`component-splits-20261102-selected.json` freezes the verbatim MSC rows (archive
hash identical to `catalog-companions-msc.json`) of the 13 systems whose CNS5
record combined two components, plus selected tables and passages from Rodet et
al. 2018 (GJ 2060), Muterspaugh et al. 2010 (Eta CrB), Tokovinin 2023
(HD 200525), Dupuy & Liu 2017 (Gl 417 BC, HD 130948 BC) and Burgasser et al.
2005 (Gl 337 CD) with document hashes. `../reviewed-component-splits.json`
approves the splits and records three deferred systems;
`../reviewed-component-split-data.json` maps the adopted values. See
`docs/combined-cns5-components.md`.
