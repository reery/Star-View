import { svgNode } from './spectral-chart'
import { starComponentIdentity } from './star-systems'

/** The same small paired-star mark in compact and expanded object lists. */
export function companionIcon(id: string): SVGSVGElement | null {
  const component = starComponentIdentity(id)
  if (!component) return null
  const icon = svgNode('svg', { viewBox: '0 0 16 16', width: 13, height: 13,
    class: 'companion-icon', role: 'img', 'aria-label': `${component.name}, stellar component ${component.label}` })
  icon.append(svgNode('title', {}, `${component.name} · component ${component.label}`),
    svgNode('path', { d: 'M5 1.5 6.2 4.3 9 5.5 6.2 6.7 5 9.5 3.8 6.7 1 5.5 3.8 4.3ZM11.5 7 12.5 9.5 15 10.5 12.5 11.5 11.5 14 10.5 11.5 8 10.5 10.5 9.5Z', fill: 'currentColor' }))
  return icon
}
