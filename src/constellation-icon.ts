import type { IconNode } from 'lucide'

// A compact Little Dipper with oversized round stars. Polaris marks the
// end of the handle; the figure is illustrative rather than to angular scale.
export const ConstellationIcon: IconNode = [
  ['path', { d: 'M5 4 6.3 8.4 8.9 13.1 13.8 15.9 13.2 19 19.4 20.2 19.3 16.5 13.8 15.9', 'stroke-width': 0.8 }],
  ['circle', { cx: 5, cy: 4, r: 2, fill: 'currentColor', stroke: 'none' }],
  ['circle', { cx: 6.3, cy: 8.4, r: 1.5, fill: 'currentColor', stroke: 'none' }],
  ['circle', { cx: 8.9, cy: 13.1, r: 1.5, fill: 'currentColor', stroke: 'none' }],
  ['circle', { cx: 13.8, cy: 15.9, r: 1.5, fill: 'currentColor', stroke: 'none' }],
  ['circle', { cx: 13.2, cy: 19, r: 1.4, fill: 'currentColor', stroke: 'none' }],
  ['circle', { cx: 19.4, cy: 20.2, r: 1.5, fill: 'currentColor', stroke: 'none' }],
  ['circle', { cx: 19.3, cy: 16.5, r: 1.7, fill: 'currentColor', stroke: 'none' }],
]
