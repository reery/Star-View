# Project instructions

- Never run the full test suite during development.
- Run the full test suite only after the user has inspected the result and explicitly authorized the run. Finishing a change does not imply authorization.
- Honor any additional request to skip tests entirely.

- Catalog changes must enrich without silently discarding existing data. Compare all affected catalogs and the effective component records before and after regeneration, including physical fields, photometry, astrometry, uncertainties and provenance. Preserve original source measurements with explicit scope when they cannot be adopted for an individual component. Run `npm run catalog:preservation` to detect missing records and known-to-missing fields; investigate every failure before completing a data change.

- Reuse existing UI styles and font sizes wherever possible. Keep new cards consistent with established cards and controls.
- Use the separator below the first mass bar consistently for metric divider lines: `1px dashed var(--line)`. Reuse the shared `--mass-metric-divider` style; do not introduce dotted or other separator variants.
- Let charts, bars, and values communicate obvious comparisons. Avoid redundant commentary such as “Small for its class” or “Large for its class” throughout the app and in future designs. Add explanatory text only when it provides useful context, such as missing data or values outside a displayed range.
