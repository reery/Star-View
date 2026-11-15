import { Lightbulb, Radio, createElement, type IconNode } from 'lucide'

/** A lightbulb holding a four-point star; the plain lightbulb is Tips. */
export const InsightsIcon: IconNode = [
  ...Lightbulb,
  ['path', { d: 'M12 4.4 13 7 15.6 8 13 9 12 11.6 11 9 8.4 8 11 7Z', fill: 'currentColor', stroke: 'none' }],
]

/** A niche topic shown on the map. Each insight is data; the Insights card lists them as tiles. */
export interface Insight {
  id: string
  title: string
  description: string
  icon: IconNode
  /** Tints the tile. */
  color: string
}

export const INSIGHTS: readonly Insight[] = [
  {
    id: 'sn-1987a-light', title: 'Light of SN 1987A', icon: Radio, color: '#8fb8ff',
    description: 'This supernova’s light passed Earth in 1987. See which stars it has reached since.',
  },
]

/** Fills the Insights card with one tile per insight. One insight is on at a time; `onChange` gets it, or null when none is. */
export function initializeInsights(list: HTMLElement, onChange: (active: Insight | null) => void, signal: AbortSignal): void {
  let active: Insight | null = null
  const tiles = INSIGHTS.map((insight) => {
    const tile = document.createElement('button')
    Object.assign(tile, { type: 'button', className: 'planet-fact-tile mass-fact luminosity-result insight-tile' })
    tile.setAttribute('aria-pressed', 'false')
    tile.style.setProperty('--luminosity-real-color', insight.color)
    const icon = document.createElement('span')
    icon.className = 'luminosity-factor-icon mass-fact-icon'
    icon.append(createElement(insight.icon, { width: 28, height: 28, 'stroke-width': 1.3, 'aria-hidden': 'true' }))
    const title = Object.assign(document.createElement('strong'), { className: 'mass-fact-title', textContent: insight.title })
    const description = Object.assign(document.createElement('small'), { className: 'mass-benchmark', textContent: insight.description })
    tile.append(icon, title, description)
    tile.addEventListener('click', () => {
      active = active === insight ? null : insight
      tiles.forEach((other, index) => other.setAttribute('aria-pressed', String(INSIGHTS[index] === active)))
      onChange(active)
    }, { signal })
    return tile
  })
  list.replaceChildren(...tiles)
}
