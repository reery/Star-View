# Project instructions

- Never run the full test suite during development.
- Run the full test suite only after the user has inspected the result and explicitly authorized the run. Finishing a change does not imply authorization.
- Honor any additional request to skip tests entirely.

- Reuse existing UI styles and font sizes wherever possible. Keep new cards consistent with established cards and controls.
- Use the separator below the first mass bar consistently for metric divider lines: `1px dashed var(--line)`. Reuse the shared `--mass-metric-divider` style; do not introduce dotted or other separator variants.
- Let charts, bars, and values communicate obvious comparisons. Avoid redundant commentary such as “Small for its class” or “Large for its class” throughout the app and in future designs. Add explanatory text only when it provides useful context, such as missing data or values outside a displayed range.
