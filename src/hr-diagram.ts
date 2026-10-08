import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model'
import { placeSpectralMarkerLabels, spectralMarker, svgNode } from './spectral-chart'

export type HrMagnitudeMode = 'visual' | 'bolometric'
type HrStar = Pick<Star, 'type' | 'temperature_k' | 'absolute_mag' | 'luminosity_solar'>
export interface HrPoint { temperature: number; magnitude: number }
export interface HrAxes { hot: number; cool: number; bright: number; faint: number }

// IAU 2015 B2, rounded solar bolometric zero point. Visual magnitudes remain
// Johnson V: a bolometric magnitude must never fill a missing catalog M_V.
export const HR_SUN = { temperature: 5772, visual: 4.83, bolometric: 4.74 } as const
const positive = (value: number | null): value is number => value !== null && Number.isFinite(value) && value > 0

export function hrCardAvailable(star: Pick<Star, 'type'>): boolean {
  return STELLAR_OBJECT_TYPES.some((type) => type === star.type)
}

export function hrMagnitude(star: HrStar, mode: HrMagnitudeMode): number | null {
  if (!hrCardAvailable(star)) return null
  if (mode === 'visual') return star.absolute_mag !== null && Number.isFinite(star.absolute_mag) ? star.absolute_mag : null
  return positive(star.luminosity_solar) ? HR_SUN.bolometric - 2.5 * Math.log10(star.luminosity_solar) : null
}

export function hrPoint(star: HrStar, mode: HrMagnitudeMode): HrPoint | null {
  const magnitude = hrMagnitude(star, mode)
  return positive(star.temperature_k) && magnitude !== null ? { temperature: star.temperature_k, magnitude } : null
}

export function hrAxes(point: HrPoint | null, reference: HrPoint | null = null): HrAxes {
  // Expand for outliers, rather than pinning a marker to an incorrect edge.
  return {
    hot: Math.max(50_000, (point?.temperature ?? 0) * 1.15, (reference?.temperature ?? 0) * 1.15),
    cool: Math.min(250, (point?.temperature ?? 1000) / 1.15, (reference?.temperature ?? 1000) / 1.15),
    bright: Math.min(-10, Math.floor(((point?.magnitude ?? 0) - 1) / 5) * 5, Math.floor(((reference?.magnitude ?? 0) - 1) / 5) * 5),
    faint: Math.max(25, Math.ceil(((point?.magnitude ?? 0) + 1) / 5) * 5, Math.ceil(((reference?.magnitude ?? 0) + 1) / 5) * 5),
  }
}

export function hrPosition(point: HrPoint, axes: HrAxes): { x: number; y: number } {
  return {
    x: Math.log10(axes.hot / point.temperature) / Math.log10(axes.hot / axes.cool),
    y: (point.magnitude - axes.bright) / (axes.faint - axes.bright),
  }
}

// Teff, M_V, M_bol: sparse anchors from Mamajek's mean dwarf sequence,
// version 2022.04.16. Illustrative locus only, never used to infer star data.
// https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt
const mainSequence = [
  [44900, -5.80, -9.81], [33300, -4.20, -7.31], [26000, -3.00, -5.58],
  [20600, -1.80, -3.83], [15700, -0.85, -2.19], [10700, 0.50, 0.08],
  [9700, 0.99, 0.78], [8100, 2.01, 2.01], [7220, 2.57, 2.58],
  [6550, 3.37, 3.35], [5930, 4.48, 4.42], [5770, 4.80, 4.72],
  [5270, 5.78, 5.59], [4440, 7.28, 6.65], [3850, 8.80, 7.65],
  [3430, 11.15, 9.21], [3060, 14.15, 11.04], [2810, 16.32, 12.19],
  [2570, 18.60, 12.95], [2380, 19.40, 13.54],
] as const
const coolDwarfs = [
  [2380, 19.40, 13.54], [2270, 20.0, 13.75], [2060, 20.9, 14.28],
  [1920, 21.7, 14.65], [1870, 22.3, 14.77], [1710, null, 15.23],
  [1420, null, 16.12], [1255, null, 16.39], [1160, null, 17.12],
  [950, null, 17.54], [825, null, 18.17], [750, null, 18.59],
] as const
const spectralGuides = [
  ['O', 40000], ['B', 18000], ['A', 8500], ['F', 6600], ['G', 5550],
  ['K', 4500], ['M', 3100], ['L', 1750], ['T', 950], ['Y', 350],
] as const
const colors = [
  [50000, '#648cff'], [18000, '#91b7ff'], [8500, '#d9e5ff'],
  [6600, '#fff3d3'], [5550, '#ffe291'], [4500, '#ffa95e'],
  [3100, '#ee5b42'], [1750, '#aa362b'], [950, '#702a2a'], [250, '#442026'],
] as const

const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })

export function renderHrDiagram(card: HTMLElement, star: Star, reference: Star, mode: HrMagnitudeMode): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const point = hrPoint(star, mode)
  const referencePoint = hrPoint(reference, mode)
  const magnitude = hrMagnitude(star, mode)
  const axes = hrAxes(point, referencePoint)
  const magnitudeLabel = mode === 'visual' ? 'Abs. mag. (V)' : 'Abs. mag. (bol.)'
  get('spectral-selected-name').textContent = star.name
  card.querySelector('.spectral-stats')!.classList.toggle('is-reference', star.id === reference.id)
  get('spectral-selected-type').textContent = star.spectral_type ?? 'Not available'
  get('spectral-selected-temperature').textContent = positive(star.temperature_k) ? `${Math.round(star.temperature_k).toLocaleString('en-US')} K` : 'Not available'
  get('spectral-magnitude-label').textContent = magnitudeLabel
  get('spectral-selected-magnitude').textContent = magnitude !== null ? number(magnitude) : 'Not available'
  get('spectral-reference-name').textContent = reference.name
  get('spectral-reference-type').textContent = reference.spectral_type ?? 'Not available'
  get('spectral-reference-temperature').textContent = positive(reference.temperature_k) ? `${Math.round(reference.temperature_k).toLocaleString('en-US')} K` : 'Not available'
  const referenceMagnitude = hrMagnitude(reference, mode)
  get('spectral-reference-magnitude').textContent = referenceMagnitude !== null ? number(referenceMagnitude) : 'Not available'
  for (const candidate of ['visual', 'bolometric'] as const) get(`spectral-${candidate}`).setAttribute('aria-pressed', String(candidate === mode))
  const missing = (object: Star): string => {
    const fields: string[] = []
    if (!positive(object.temperature_k)) fields.push('temperature')
    if (hrMagnitude(object, mode) === null) fields.push(mode === 'visual' ? 'visual magnitude' : 'bolometric luminosity')
    return fields.length ? `${object.name} cannot be plotted: no catalog ${fields.join(' or ')}.${mode === 'visual' && hrPoint(object, 'bolometric') ? ' Choose Bolometric to show its position.' : ''}` : ''
  }
  const note = get('spectral-missing')
  note.textContent = [...new Set([missing(star), missing(reference)])].filter(Boolean).join(' ')
  note.hidden = !note.textContent

  const svg = svgNode('svg', { viewBox: '0 0 400 430', role: 'img', 'aria-labelledby': 'hr-title', 'aria-describedby': 'hr-description' })
  svg.append(svgNode('title', { id: 'hr-title' }, `Hertzsprung–Russell diagram: ${star.name}${star.id === reference.id ? '' : ` and ${reference.name}`}`))
  const describePoint = (object: Star, position: HrPoint | null) => position ? `${object.name}: ${number(position.temperature)} K, magnitude ${number(position.magnitude)}.` : missing(object)
  svg.append(svgNode('desc', { id: 'hr-description' }, `Temperature decreases from ${number(axes.hot)} to ${number(axes.cool)} kelvin, left to right. ${magnitudeLabel} increases from ${axes.bright} to ${axes.faint}, top to bottom. Regions are schematic. ${[...new Set([describePoint(star, point), describePoint(reference, referencePoint)])].join(' ')}`))
  const left = 54, top = 50, size = 330, bottom = top + size
  const x = (temperature: number) => left + size * hrPosition({ temperature, magnitude: 0 }, axes).x
  const y = (value: number) => top + size * hrPosition({ temperature: 5772, magnitude: value }, axes).y
  const defs = svgNode('defs')
  const gradient = svgNode('linearGradient', { id: 'hr-temperature-gradient', x1: 0, x2: 1, y1: 0, y2: 0 })
  for (const [temperature, color] of colors) gradient.append(svgNode('stop', { offset: `${Math.max(0, Math.min(100, (x(temperature) - left) / size * 100))}%`, 'stop-color': color }))
  defs.append(gradient)
  const clip = svgNode('clipPath', { id: 'hr-plot-clip' })
  clip.append(svgNode('rect', { x: left, y: top, width: size, height: size }))
  defs.append(clip)
  svg.append(defs, svgNode('rect', { x: left, y: top, width: size, height: size, fill: '#0b0e14' }),
    svgNode('rect', { x: left, y: top, width: size, height: size, fill: 'url(#hr-temperature-gradient)', opacity: 0.20 }))
  const plot = svgNode('g', { 'clip-path': 'url(#hr-plot-clip)' })
  const label = (parent: SVGElement, content: string, px: number, py: number, className = 'hr-axis-text', anchor = 'middle') => {
    const text = svgNode('text', { x: px, y: py, class: className, 'text-anchor': anchor }, content)
    parent.append(text)
    return text
  }
  for (let value = axes.bright; value <= axes.faint; value += 5) {
    plot.append(svgNode('line', { x1: left, x2: left + size, y1: y(value), y2: y(value), class: 'hr-grid' }))
    label(svg, value > 0 ? `+${value}` : String(value).replace('-', '−'), left - 9, y(value) + 4, 'hr-axis-text', 'end')
  }
  const temperatureTicks = [axes.hot, 10000, 5000, 2000, 1000, 500, axes.cool]
  let lastTickX = -Infinity
  for (const temperature of temperatureTicks) {
    const px = x(temperature)
    if (px < left || px > left + size || px - lastTickX < 37) continue
    lastTickX = px
    plot.append(svgNode('line', { x1: px, x2: px, y1: top, y2: bottom, class: 'hr-grid' }))
    label(svg, Math.round(temperature).toLocaleString('en-US'), px, top - 10, 'hr-axis-text', temperature === axes.hot ? 'start' : temperature === axes.cool ? 'end' : 'middle')
  }
  label(svg, 'Temperature (K)', left + size / 2, 17)
  const vertical = label(svg, magnitudeLabel, 14, top + size / 2)
  vertical.setAttribute('transform', `rotate(-90 14 ${top + size / 2})`)

  const locus = (rows: ReadonlyArray<readonly [number, number | null, number]>, className: string) => {
    const points = rows.flatMap(([temperature, visual, bolometric]) => {
      const value = mode === 'visual' ? visual : bolometric
      return value === null ? [] : [`${x(temperature)},${y(value)}`]
    }).join(' ')
    plot.append(svgNode('polyline', { points, class: `hr-region-band ${className}` }), svgNode('polyline', { points, class: `hr-region-line ${className}` }))
  }
  locus(mainSequence, 'hr-main-sequence')
  locus(coolDwarfs, 'hr-cool-dwarfs')
  // Broad schematic regions in physical coordinates. They are deliberately
  // not used to classify the selected object or overwrite its spectral type.
  const region = (coordinates: [number, number][], className: string) => {
    plot.append(svgNode('polygon', { points: coordinates.map(([temperature, value]) => `${x(temperature)},${y(value)}`).join(' '), class: `hr-region ${className}` }))
  }
  region(mode === 'visual' ? [[30000, -7], [10000, -6], [6500, -5], [3000, -4], [2800, -9], [30000, -9]]
    : [[30000, -10], [10000, -7], [6500, -6], [3000, -6], [2800, -10], [30000, -12]], 'hr-supergiants')
  region(mode === 'visual' ? [[7000, 0], [5500, 2], [3500, 0], [2800, -2], [3500, -4], [5500, -2]]
    : [[7000, 0], [5500, 2], [3500, -1], [2800, -4], [3500, -5], [5500, -2]], 'hr-giants')
  region([[7000, 2], [6000, 3.5], [4500, 4], [4500, 1.5], [5500, 1]], 'hr-subgiants')
  region(mode === 'visual' ? [[40000, 8], [25000, 10], [12000, 13], [6000, 16], [4500, 17], [6000, 14], [12000, 10], [25000, 7]]
    : [[40000, 5], [25000, 8], [12000, 12], [6000, 16], [4500, 17], [6000, 14], [12000, 10], [25000, 5]], 'hr-white-dwarfs')
  label(plot, 'Supergiants', x(8000), y(-6.8), 'hr-region-text')
  label(plot, 'Giants', x(3800), y(-0.8), 'hr-region-text')
  label(plot, 'Subgiants', x(4500) + 16, y(1.7), 'hr-region-text', 'start')
  const mainLabelX = x(5000) - 12, mainLabelY = y(mode === 'visual' ? 7.4 : 6.5)
  const mainLabel = label(plot, 'Main sequence', mainLabelX, mainLabelY, 'hr-region-text', 'start')
  mainLabel.setAttribute('transform', `rotate(${mode === 'visual' ? 68 : 55} ${mainLabelX} ${mainLabelY})`)
  label(plot, 'White dwarfs', x(17000), y(13.7), 'hr-region-text')
  if (mode === 'bolometric') {
    label(plot, 'Brown dwarfs', x(1000), y(20.6), 'hr-region-text')
    // Broad cooling continuation, not a hard stellar/substellar boundary.
    const cooling = [[750, 18.59], [500, 20.5], [250, 24]]
    plot.append(svgNode('polyline', { points: cooling.map(([t, m]) => `${x(t!)},${y(m!)}`).join(' '), class: 'hr-region-line hr-cooling' }))
  }
  svg.append(plot, svgNode('rect', { x: left, y: top, width: size, height: size, class: 'hr-frame' }))
  let previousLabelX = left - 20
  for (const [spectral, temperature] of spectralGuides) {
    const px = x(temperature)
    const labelX = Math.max(px, previousLabelX + 14)
    previousLabelX = labelX
    svg.append(svgNode('path', { d: `M ${px} ${bottom} v 5 L ${labelX} ${bottom + 12}`, class: 'hr-spectral-tick' }))
    label(svg, spectral, labelX, bottom + 26, 'hr-spectral-text')
  }
  label(svg, 'Spectral type', left + size / 2, 423)

  const referenceX = referencePoint ? x(referencePoint.temperature) : null
  const referenceY = referencePoint ? y(referencePoint.magnitude) : null
  const sameAsReference = star.id === reference.id
  const mark = (object: Star, { temperature, magnitude: value }: HrPoint, selected: boolean) => {
    const px = x(temperature), py = y(value)
    const group = spectralMarker(object, px, py, selected, 'hr', `${number(temperature)} K · ${number(value)} mag`)
    if (!selected && point && Math.hypot(x(point.temperature) - px, y(point.magnitude) - py) < 20) group.querySelector('circle')!.setAttribute('r', '19')
    const nearby = selected && !sameAsReference && referenceX !== null && referenceY !== null && Math.hypot(px - referenceX, py - referenceY) < 65
    const labelY = !selected ? py + 26 : nearby ? referenceY! - 13 : py < top + 30 ? py + 29 : py - 19
    const shortName = object.name.length > 22 ? `${object.name.slice(0, 21)}…` : object.name
    const rightAligned = px > left + size * 0.65
    const labelX = nearby ? referenceX! + (rightAligned ? -20 : 20) : rightAligned ? px - 17 : px + 17
    label(group, shortName, labelX, labelY, 'hr-marker-text', rightAligned ? 'end' : 'start')
    svg.append(group)
  }
  if (!sameAsReference && referencePoint) mark(reference, referencePoint, false)
  if (point) mark(star, point, true)
  get('hr-diagram').replaceChildren(svg)
  placeSpectralMarkerLabels(svg, { left, top, right: left + size, bottom })
}
