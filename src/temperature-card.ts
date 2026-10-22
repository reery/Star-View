import { Sun, Thermometer, createElement } from 'lucide'
import { starDisplayColor, type StarColorMode } from './astronomy'
import type { Star } from './catalog-model'
import { MISSING_VALUE } from './format'
import { svgNode } from './spectral-chart'
import {
  relativeSpectralEmission, SOLAR_TEMPERATURE_K, spectrumRegion, temperatureAppearance,
  temperatureCardAvailable, temperaturePosition, TEMPERATURE_MAX_K, TEMPERATURE_MIN_K, WIEN_NM_K,
} from './temperature-properties'

const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 })
const compact = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: 3 })
const classes = [
  { letter: 'M', low: 2400, high: 3700, color: '#ed986c' },
  { letter: 'K', low: 3700, high: 5200, color: '#f4bf84' },
  { letter: 'G', low: 5200, high: 6000, color: '#ffe6bc' },
  { letter: 'F', low: 6000, high: 7500, color: '#f4f1e6' },
  { letter: 'A', low: 7500, high: 10000, color: '#d2e1ff' },
  { letter: 'B', low: 10000, high: 30000, color: '#9fbfff' },
  { letter: 'O', low: 30000, high: 30000, color: '#82a8ff' },
]

function renderScale(root: HTMLElement, selected: Star, origin: Star, sun: Star, mode: StarColorMode, comparing: boolean): void {
  const scale = root.querySelector<HTMLElement>('#temperature-scale')!
  const track = scale.querySelector<HTMLElement>('.temperature-track')!
  const labels = scale.querySelector<HTMLElement>('.temperature-classes')!
  track.replaceChildren()
  labels.replaceChildren()
  track.style.background = `linear-gradient(90deg, ${classes.map((entry) => `${entry.color} ${temperaturePosition(entry.low)}%`).join(', ')})`
  for (const entry of classes) {
    const label = document.createElement('span')
    label.textContent = entry.letter
    label.style.left = `${temperaturePosition(Math.sqrt(entry.low * entry.high))}%`
    label.title = entry.letter === 'O' ? 'O: roughly 30,000 K and above' : `${entry.letter}: roughly ${format(entry.low)}–${format(entry.high)} K`
    labels.append(label)
  }

  const points: { star: Star; selected: boolean; origin: boolean; sun: boolean }[] = []
  const add = (star: Star, role: 'selected' | 'origin' | 'sun') => {
    if (!temperatureCardAvailable(star)) return
    let point = points.find((point) => point.star.id === star.id)
    if (!point) { point = { star, selected: false, origin: false, sun: false }; points.push(point) }
    point[role] = true
  }
  add(selected, 'selected')
  if (!comparing) add(sun, 'sun')
  if (comparing || selected.id !== sun.id) add(origin, 'origin')
  const occupied: { left: number; right: number; lane: number }[] = []
  const width = track.getBoundingClientRect().width
  let lanes = 1
  for (const point of points) {
    const kelvin = point.star.temperature_k!
    const position = temperaturePosition(kelvin)
    const marker = document.createElement('span')
    marker.className = `temperature-marker${point.selected ? ' is-selected' : ''}`
    marker.dataset.objectId = point.star.id
    marker.dataset.selected = String(point.selected)
    marker.dataset.origin = String(point.origin)
    marker.style.left = `${position}%`
    marker.style.setProperty('--temperature-marker-color', starDisplayColor(point.star, mode).getStyle())
    const label = document.createElement('span')
    const name = `${point.star.name}${!comparing && point.origin && point.star.id !== sun.id ? ' · origin' : ''}`
    const overflow = kelvin < TEMPERATURE_MIN_K ? '↓ ' : kelvin > TEMPERATURE_MAX_K ? '↑ ' : ''
    label.textContent = point.selected && !comparing ? `${name}${overflow ? ` · ${overflow.trim()}` : ''}` : `${name} · ${overflow}${format(kelvin)} K`
    marker.title = `${name} · ${format(kelvin)} K`
    marker.append(label)
    track.append(marker)
    label.style.maxWidth = `${width}px`
    const labelWidth = label.getBoundingClientRect().width
    const center = position / 100 * width
    const left = Math.max(0, Math.min(width - labelWidth, center - labelWidth / 2))
    let lane = 0
    while (occupied.some((box) => box.lane === lane && left < box.right + 8 && left + labelWidth + 8 > box.left)) lane++
    occupied.push({ left, right: left + labelWidth, lane })
    label.style.left = `${left - center}px`
    marker.style.setProperty('--temperature-label-lane', String(lane))
    lanes = Math.max(lanes, lane + 1)
  }
  scale.style.setProperty('--temperature-label-lanes', String(lanes))
  scale.setAttribute('aria-label', `Temperature scale, logarithmic, 2,400 to 30,000 kelvin. ${points.map((point) => `${point.star.name}${point.selected ? ', selected' : ''}${point.origin ? comparing ? ', comparison' : ', origin' : ''}: ${format(point.star.temperature_k!)} K${point.star.temperature_k! < TEMPERATURE_MIN_K || point.star.temperature_k! > TEMPERATURE_MAX_K ? ', outside displayed range' : ''}`).join('; ')}`)
  const outside = points.filter((point) => point.star.temperature_k! < TEMPERATURE_MIN_K || point.star.temperature_k! > TEMPERATURE_MAX_K)
  const note = root.querySelector<HTMLElement>('#temperature-scale-note')!
  note.hidden = outside.length === 0
  note.textContent = outside.map((point) => `${point.star.name} is ${point.star.temperature_k! < TEMPERATURE_MIN_K ? 'below' : 'above'} this scale.`).join(' ')
  const missing = root.querySelector<HTMLElement>('#temperature-origin-note')!
  missing.hidden = !comparing && selected.id === sun.id || temperatureCardAvailable(origin)
  missing.textContent = `${origin.name}${comparing ? '' : ' origin'}: individual temperature unavailable.`
}

function renderSpectrum(root: HTMLElement, star: Star, origin: Star, sun: Star, mode: StarColorMode, comparing: boolean): void {
  const host = root.querySelector<HTMLElement>('#temperature-spectrum')!
  const temperature = star.temperature_k!
  const reference = temperatureCardAvailable(origin) && origin.id !== star.id ? origin
    : !comparing && temperatureCardAvailable(sun) && sun.id !== star.id ? sun : null
  const legend = root.querySelector<HTMLElement>('#temperature-spectrum-legend')!
  legend.replaceChildren()
  legend.hidden = false
  if (reference) root.style.setProperty('--temperature-reference-color', starDisplayColor(reference, mode).getStyle())
  for (const object of reference ? [star, reference] : [star]) {
    const key = document.createElement('span')
    key.className = `temperature-spectrum-key${object === reference ? ' is-reference' : ''}`
    const line = document.createElement('i')
    line.setAttribute('aria-hidden', 'true')
    const name = document.createElement('span')
    name.textContent = `${object.name}${!comparing && object === reference && object.id === origin.id && origin.id !== sun.id ? ' · origin' : ''}, peak ${compact(WIEN_NM_K / object.temperature_k!)} nm`
    key.append(line, name)
    legend.append(key)
  }
  const width = Math.max(240, host.getBoundingClientRect().width)
  const height = 212, left = 24, right = width - 12, top = 44, bottom = 158
  const peak = WIEN_NM_K / temperature
  const peaks = [peak, ...(reference ? [WIEN_NM_K / reference.temperature_k!] : [])]
  const low = Math.min(100, ...peaks.map((value) => value / 4)), high = Math.max(2500, ...peaks.map((value) => value * 2.5))
  const x = (nm: number) => left + Math.log(nm / low) / Math.log(high / low) * (right - left)
  const y = (emission: number) => bottom - emission * (bottom - top)
  const comparison = reference ? ` Dashed comparison: ${reference.name}, ${format(reference.temperature_k!)} K, peak ${compact(WIEN_NM_K / reference.temperature_k!)} nanometers. Each curve is normalized to its own peak; heights do not compare brightness.` : ''
  const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `Blackbody emission per wavelength at ${format(temperature)} K, normalized to its peak. Peak ${compact(peak)} nanometers in ${spectrumRegion(peak)}.${comparison} Visible light spans 380–780 nanometers. Logarithmic wavelength axis.` })
  const defs = svgNode('defs')
  const gradient = svgNode('linearGradient', { id: 'temperature-visible-gradient' })
  for (const [offset, color] of [[0, '#8646e9'], [0.2, '#456dff'], [0.4, '#49c4be'], [0.6, '#c8dc64'], [0.8, '#efaa55'], [1, '#e85550']] as const) {
    gradient.append(svgNode('stop', { offset, 'stop-color': color }))
  }
  const fill = svgNode('linearGradient', { id: 'temperature-spectrum-fill', x1: '0', x2: '0', y1: '0', y2: '1' })
  fill.append(svgNode('stop', { offset: 0, 'stop-color': 'var(--temperature-color)', 'stop-opacity': 0.22 }), svgNode('stop', { offset: 1, 'stop-color': 'var(--temperature-color)', 'stop-opacity': 0.01 }))
  defs.append(gradient, fill)
  svg.append(defs)
  svg.append(svgNode('text', { x: left, y: 13, class: 'temperature-graph-caption' }, 'Relative emission / nm'))
  svg.append(svgNode('rect', { x: x(380), y: top - 5, width: x(780) - x(380), height: bottom - top + 5, fill: 'url(#temperature-visible-gradient)', opacity: 0.17 }))
  for (const [from, to, label] of [[low, 380, 'UV'], [380, 780, 'Visible'], [780, high, 'Infrared']] as const) {
    svg.append(svgNode('text', { x: (x(from) + x(to)) / 2, y: 31, 'text-anchor': 'middle', class: 'temperature-graph-caption' }, label))
  }
  for (const value of [0, 0.5, 1]) {
    svg.append(svgNode('line', { x1: left, x2: right, y1: y(value), y2: y(value), class: 'temperature-graph-grid' }))
  }
  const curve = (kelvin: number) => `M${Array.from({ length: 241 }, (_, index) => {
    const nm = low * (high / low) ** (index / 240)
    return `${x(nm).toFixed(2)},${y(relativeSpectralEmission(nm, kelvin)).toFixed(2)}`
  }).join(' L')}`
  const path = curve(temperature)
  svg.append(svgNode('path', { d: `${path} L${right},${bottom} L${left},${bottom} Z`, fill: 'url(#temperature-spectrum-fill)' }))
  svg.append(svgNode('path', { d: path, class: 'temperature-spectrum-curve', fill: 'none', 'data-object-id': star.id }))
  if (reference) svg.append(svgNode('path', { d: curve(reference.temperature_k!), class: 'temperature-spectrum-reference', fill: 'none', 'data-object-id': reference.id }))
  let lastTick = -Infinity
  for (const nm of [10, 30, 100, 200, 380, 780, 1500, 2500, 5000, 10000, 30000, 100000]) {
    if (nm < low || nm > high || x(nm) - lastTick < 38) continue
    svg.append(svgNode('line', { x1: x(nm), x2: x(nm), y1: bottom, y2: bottom + 4, class: 'temperature-graph-grid' }), svgNode('text', { x: x(nm), y: bottom + 19, 'text-anchor': 'middle', class: 'temperature-graph-caption' }, nm >= 1000 ? `${nm / 1000}k` : String(nm)))
    lastTick = x(nm)
  }
  svg.append(svgNode('text', { x: (left + right) / 2, y: height - 5, 'text-anchor': 'middle', class: 'temperature-graph-caption' }, 'Wavelength · nm (log scale)'))
  host.replaceChildren(svg)
}

function renderComparisonTiles(root: HTMLElement, main: Star, other: Star, mode: StarColorMode, comparing: boolean): void {
  root.querySelector<HTMLElement>('.temperature-overview')!.hidden = comparing
  root.querySelector<HTMLElement>('.temperature-facts')!.hidden = comparing
  const values = root.querySelector<HTMLElement>('#temperature-comparison-values')!
  const facts = root.querySelector<HTMLElement>('#temperature-comparison-facts')!
  for (const grid of [values, facts]) {
    grid.hidden = !comparing
    grid.replaceChildren()
  }
  if (!comparing) return

  for (const metric of ['temperature', 'appearance', 'ratio'] as const) {
    for (const [star, reference] of [[main, other], [other, main]] as const) {
      const available = temperatureCardAvailable(star)
      const tile = document.createElement('div')
      tile.className = 'planet-fact-tile temperature-comparison-tile'
      tile.dataset.objectId = star.id
      tile.dataset.metric = metric
      const heading = document.createElement('dt')
      const swatch = document.createElement('i')
      swatch.className = 'star-swatch'
      swatch.style.background = starDisplayColor(star, mode).getStyle()
      swatch.setAttribute('aria-hidden', 'true')
      const name = document.createElement('span')
      name.textContent = star.name
      const label = document.createElement('span')
      label.className = 'sr-only'
      label.textContent = ` · ${metric === 'temperature' ? 'Effective temperature' : metric === 'appearance' ? 'Perceived color' : 'Kelvin comparison'}`
      heading.append(swatch, name, label)
      const value = document.createElement('dd')
      const metricIcon = document.createElement('span')
      metricIcon.className = 'temperature-tile-metric-icon'
      metricIcon.setAttribute('aria-hidden', 'true')
      if (metric === 'appearance') {
        metricIcon.classList.add('temperature-appearance-star')
        metricIcon.style.setProperty('--temperature-swatch-color', starDisplayColor(star, 'real').getStyle())
      } else metricIcon.append(createElement(metric === 'temperature' ? Thermometer : Sun, { width: 20, height: 20, 'stroke-width': 1.7, 'aria-hidden': 'true' }))
      const copy = document.createElement('div')
      copy.className = 'temperature-tile-value'
      const strong = document.createElement('strong')
      strong.className = 'planet-fact-value'
      strong.textContent = !available ? MISSING_VALUE : metric === 'temperature' ? `${format(star.temperature_k!)} K`
        : metric === 'appearance' ? temperatureAppearance(star.temperature_k!)
          : temperatureCardAvailable(reference) ? `${compact(star.temperature_k! / reference.temperature_k!)}× ${reference.name}’s temperature` : MISSING_VALUE
      copy.append(strong)
      value.append(metricIcon, copy)
      if ((metric === 'temperature' && !available) || (metric === 'appearance' && available && star.temperature_k! < 2400)) {
        const note = document.createElement('small')
        note.className = 'planet-fact-note'
        note.textContent = !available ? 'Individual temperature unavailable.' : 'Faint glow; most emission is infrared.'
        copy.append(note)
      }
      tile.append(heading, value)
      const grid = metric === 'temperature' ? values : facts
      grid.append(tile)
    }
  }
}

export function renderTemperatureCard(root: HTMLElement, star: Star, origin: Star, sun: Star, mode: StarColorMode, comparing = false): void {
  if (!temperatureCardAvailable(star)) return
  const temperature = star.temperature_k!
  const set = (id: string, value: string) => { root.querySelector<HTMLElement>(`#${id}`)!.textContent = value }
  root.style.setProperty('--temperature-color', starDisplayColor(star, mode).getStyle())
  set('temperature-value', `${format(temperature)} K`)
  set('temperature-celsius', `${format(temperature - 273.15)} °C`)
  set('temperature-fahrenheit', `${format((temperature - 273.15) * 9 / 5 + 32)} °F`)
  set('temperature-appearance', temperatureAppearance(temperature))
  const referenceTemperature = comparing ? temperatureCardAvailable(origin) ? origin.temperature_k! : null : SOLAR_TEMPERATURE_K
  set('temperature-solar-ratio', referenceTemperature === null ? `${origin.name}: unavailable` : `${compact(temperature / referenceTemperature)}× ${comparing ? `${origin.name}’s` : 'Sun’s'} temperature`)
  set('temperature-appearance-note', 'Faint glow; most emission is infrared.')
  root.querySelector<HTMLElement>('#temperature-appearance-note')!.hidden = temperature >= 2400
  const swatch = root.querySelector<HTMLElement>('#temperature-color-star')!
  // Use the app’s real-color mode for perceived color, independently of the
  // exaggerated scene setting used by the selected marker and spectrum curve.
  swatch.style.setProperty('--temperature-swatch-color', starDisplayColor(star, 'real').getStyle())
  for (const [id, shape] of [['temperature-value-icon', Thermometer], ['temperature-ratio-icon', comparing ? Thermometer : Sun]] as const) {
    root.querySelector(`#${id}`)!.replaceChildren(createElement(shape, { width: 20, height: 20, 'stroke-width': 1.7, 'aria-hidden': 'true' }))
  }
  renderComparisonTiles(root, star, origin, mode, comparing)
  renderScale(root, star, origin, sun, mode, comparing)
  renderSpectrum(root, star, origin, sun, mode, comparing)
}
