# Project instructions

- Never run the full test suite during development.
- Run the full test suite only after the user has inspected the result and explicitly authorized the run. Finishing a change does not imply authorization.
- Honor any additional request to skip tests entirely.

- Catalog changes must enrich without silently discarding existing data. Compare all affected catalogs and the effective component records before and after regeneration, including physical fields, photometry, astrometry, uncertainties and provenance. Preserve original source measurements with explicit scope when they cannot be adopted for an individual component. Run `npm run catalog:preservation` to detect missing records and known-to-missing fields; investigate every failure before completing a data change.

- Reuse existing UI styles and font sizes wherever possible. Keep new cards consistent with established cards and controls.
- Lay out multiple collapsible sections in a card side by side, wrapping them below each other when the card is too narrow.
- Use the separator below the first mass bar consistently for metric divider lines: `1px dashed var(--line)`. Reuse the shared `--mass-metric-divider` style; do not introduce dotted or other separator variants.
- Let charts, bars, and values communicate obvious comparisons. Avoid redundant commentary such as “Small for its class” or “Large for its class” throughout the app and in future designs. Add explanatory text only when it provides useful context, such as missing data or values outside a displayed range.

## Engineering principles

- Inspect existing implementations before writing code.
- Reuse existing functions, classes, types and utilities.
- Prefer the smallest maintainable implementation.
- Avoid introducing new abstractions for single-use cases.
- Do not duplicate network calls or calculations.
- Keep runtime, memory and bundle size minimal.
- Do not introduce dependencies or large data assets
  without demonstrating their necessity.
- Preserve existing architectural conventions.
- Avoid unrelated refactoring.

## Before completion

- Review the diff for duplication and unnecessary code.
- Run relevant tests and build validation.
- Report new dependencies and asset-size changes.
- Explain any new abstractions or significant files.