import type { Star } from './catalog-model'
import dwarfSequence from './data/stellar-class-references.json'
import { massProperties } from './mass-properties'
import { hrCardAvailable } from './spectral-properties'
export { hrCardAvailable } from './spectral-properties'
import { placeSpectralMarkerLabels, spectralMarker, svgNode, temperaturePalette } from './spectral-chart'
export { renderSpectralFeatures } from './spectral-type'

export type HrMagnitudeMode = 'visual' | 'bolometric'
type HrStar = Pick<Star, 'type' | 'temperature_k' | 'absolute_mag' | 'luminosity_solar'>
export interface HrPoint { temperature: number; magnitude: number }
export interface HrAxes { hot: number; cool: number; bright: number; faint: number }

// IAU 2015 B2, rounded solar bolometric zero point. Visual magnitudes remain
// Johnson V: a bolometric magnitude must never fill a missing catalog M_V.
export const HR_SUN = { temperature: 5772, visual: 4.83, bolometric: 4.74 } as const
const positive = (value: number | null): value is number => value !== null && Number.isFinite(value) && value > 0

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
// Teff, M_V, M_bol centerlines of broad schematic regions: typical class I and
// III magnitudes, the subgiant branch, and a 0.6 M☉ (≈0.0125 R☉) white-dwarf
// cooling sequence. Guides only, never used to classify the selected object.
const regions = [
  ['hr-supergiants', [[35000, -6.5, -8.8], [12000, -7, -7.8], [6000, -6.5, -6.6], [3600, -5.7, -6.9]]],
  ['hr-giants', [[5700, 1.4, 1.3], [4800, 0.6, 0.25], [4100, -0.3, -1.1], [3500, -0.9, -2.6], [3100, -1, -3.8]]],
  ['hr-subgiants', [[6900, 2.3, 2.3], [6000, 2.9, 2.85], [5100, 3.5, 3.25]]],
  ['hr-white-dwarfs', [[40000, 9.7, 5.85], [20000, 10.9, 8.86], [10000, 12.1, 11.87], [6000, 14.3, 14.09], [4500, 15.6, 15.34]]],
] as const
const spectralGuides = [
  ['O', 40000], ['B', 18000], ['A', 8500], ['F', 6600], ['G', 5550],
  ['K', 4500], ['M', 3100], ['L', 1750], ['T', 950], ['Y', 350],
] as const

const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })
const temperatureText = (object: Star) => positive(object.temperature_k) ? `${Math.round(object.temperature_k).toLocaleString('en-US')} K` : 'Not available'

// Plot frame shared by the H-R and Kiel diagrams, in SVG user units.
const left = 54, top = 50, size = 330, bottom = top + size
type Point = readonly [number, number]
// Catmull–Rom spline through the points, as cubic Bézier segments.
const curve = (p: readonly Point[]) => p.slice(1).map(([ex, ey], index) => {
  const [ax, ay] = p[Math.max(0, index - 1)]!, [sx, sy] = p[index]!, [bx, by] = p[Math.min(p.length - 1, index + 2)]!
  return `C ${sx + (ex - ax) / 6},${sy + (ey - ay) / 6} ${ex - (bx - sx) / 6},${ey - (by - sy) / 6} ${ex},${ey}`
})
interface ChartMarker { object: Star; x: number; y: number; description: string }

/** Background, temperature axis and spectral-type guides; `finish` closes the frame once the plot is drawn. */
function temperatureChart(svg: SVGSVGElement, id: 'hr' | 'kiel', hot: number, cool: number) {
  const x = (temperature: number) => left + size * Math.log10(hot / temperature) / Math.log10(hot / cool)
  const defs = svgNode('defs')
  const gradient = svgNode('linearGradient', { id: `${id}-temperature-gradient`, x1: 0, x2: 1, y1: 0, y2: 0 })
  for (const [temperature, color] of temperaturePalette) gradient.append(svgNode('stop', { offset: `${Math.max(0, Math.min(100, (x(temperature) - left) / size * 100))}%`, 'stop-color': color }))
  defs.append(gradient)
  const clip = svgNode('clipPath', { id: `${id}-plot-clip` })
  clip.append(svgNode('rect', { x: left, y: top, width: size, height: size }))
  defs.append(clip)
  svg.append(defs, svgNode('rect', { x: left, y: top, width: size, height: size, fill: '#0b0e14' }),
    svgNode('rect', { x: left, y: top, width: size, height: size, fill: `url(#${id}-temperature-gradient)`, opacity: 0.20 }))
  const plot = svgNode('g', { 'clip-path': `url(#${id}-plot-clip)` })
  const label = (parent: SVGElement, content: string, px: number, py: number, className = 'hr-axis-text', anchor = 'middle') => {
    const text = svgNode('text', { x: px, y: py, class: className, 'text-anchor': anchor }, content)
    parent.append(text)
    return text
  }
  let lastTickX = -Infinity
  for (const temperature of [hot, 10000, 5000, 2000, 1000, 500, cool]) {
    const px = x(temperature)
    if (px < left || px > left + size || px - lastTickX < 37) continue
    lastTickX = px
    plot.append(svgNode('line', { x1: px, x2: px, y1: top, y2: bottom, class: 'hr-grid' }))
    label(svg, Math.round(temperature).toLocaleString('en-US'), px, top - 10, 'hr-axis-text', temperature === hot ? 'start' : temperature === cool ? 'end' : 'middle')
  }
  label(svg, 'Temperature (K)', left + size / 2, 17)
  const path = (className: string, points: readonly Point[], segments = curve(points)) => plot.append(svgNode('path', { d: `M ${points[0]![0]},${points[0]![1]} ${segments.join(' ')}`, class: className }))
  const finish = (yTitle: string, selected: ChartMarker | null, reference: ChartMarker | null) => {
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
    label(svg, yTitle, 14, top + size / 2).setAttribute('transform', `rotate(-90 14 ${top + size / 2})`)
    const mark = ({ object, x: px, y: py, description }: ChartMarker, isSelected: boolean) => {
      const group = spectralMarker(object, px, py, isSelected, 'hr', description)
      if (!isSelected && selected && Math.hypot(selected.x - px, selected.y - py) < 20) group.querySelector('circle')!.setAttribute('r', '19')
      const nearby = isSelected && reference !== null && Math.hypot(px - reference.x, py - reference.y) < 65
      const labelY = !isSelected ? py + 26 : nearby ? reference.y - 13 : py < top + 30 ? py + 29 : py - 19
      const shortName = object.name.length > 22 ? `${object.name.slice(0, 21)}…` : object.name
      const rightAligned = px > left + size * 0.65
      const labelX = nearby ? reference.x + (rightAligned ? -20 : 20) : rightAligned ? px - 17 : px + 17
      label(group, shortName, labelX, labelY, 'hr-marker-text', rightAligned ? 'end' : 'start')
      svg.append(group)
    }
    if (reference) mark(reference, false)
    if (selected) mark(selected, true)
  }
  return { x, plot, label, path, finish }
}

/** `population`, when given, adds every plottable catalog star as a faint dot. */
export function renderHrDiagram(card: HTMLElement, star: Star, reference: Star, mode: HrMagnitudeMode, population: readonly Star[] | null = null): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const point = hrPoint(star, mode)
  const referencePoint = hrPoint(reference, mode)
  const magnitude = hrMagnitude(star, mode)
  const axes = hrAxes(point, referencePoint)
  const magnitudeLabel = mode === 'visual' ? 'Abs. mag. (V)' : 'Abs. mag. (bol.)'
  get('spectral-selected-name').textContent = star.name
  card.querySelector('.spectral-stats')!.classList.toggle('is-reference', star.id === reference.id)
  get('spectral-selected-type').textContent = star.spectral_type ?? 'Not available'
  get('spectral-selected-temperature').textContent = temperatureText(star)
  get('spectral-magnitude-label').textContent = magnitudeLabel
  get('spectral-selected-magnitude').textContent = magnitude !== null ? number(magnitude) : 'Not available'
  get('spectral-reference-name').textContent = reference.name
  get('spectral-reference-type').textContent = reference.spectral_type ?? 'Not available'
  get('spectral-reference-temperature').textContent = temperatureText(reference)
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
  svg.append(svgNode('title', { id: 'hr-title' }, `Hertzsprung–Russell diagram: ${star.name}${star.id === reference.id ? '' : ` and ${reference.name}`}${population ? ' among loaded catalog stars' : ''}`))
  const describePoint = (object: Star, position: HrPoint | null) => position ? `${object.name}: ${number(position.temperature)} K, magnitude ${number(position.magnitude)}.` : missing(object)
  svg.append(svgNode('desc', { id: 'hr-description' }, `Temperature decreases from ${number(axes.hot)} to ${number(axes.cool)} kelvin, left to right. ${magnitudeLabel} increases from ${axes.bright} to ${axes.faint}, top to bottom. Regions are schematic. ${[...new Set([describePoint(star, point), describePoint(reference, referencePoint)])].join(' ')}`))
  const { x, plot, label, path, finish } = temperatureChart(svg, 'hr', axes.hot, axes.cool)
  const y = (value: number) => top + size * hrPosition({ temperature: 5772, magnitude: value }, axes).y
  for (let value = axes.bright; value <= axes.faint; value += 5) {
    plot.append(svgNode('line', { x1: left, x2: left + size, y1: y(value), y2: y(value), class: 'hr-grid' }))
    label(svg, value > 0 ? `+${value}` : String(value).replace('-', '−'), left - 9, y(value) + 4, 'hr-axis-text', 'end')
  }

  const points = (rows: ReadonlyArray<readonly [number, number | null, number]>) => rows.flatMap(([temperature, visual, bolometric]): Point[] => {
    const value = mode === 'visual' ? visual : bolometric
    return value === null ? [] : [[x(temperature), y(value)]]
  })
  for (const [className, rows] of regions) path(`hr-region-band ${className}`, points(rows))
  // One band for the whole dwarf sequence; only its centerline changes style
  // where the ultracool and substellar continuation begins.
  const dwarfs = points([...mainSequence, ...coolDwarfs.slice(1)]), dwarfCurve = curve(dwarfs), split = mainSequence.length - 1
  path('hr-region-band hr-main-sequence', dwarfs, dwarfCurve)
  path('hr-region-line hr-main-sequence', dwarfs, dwarfCurve.slice(0, split))
  path('hr-region-line hr-cool-dwarfs', dwarfs.slice(split), dwarfCurve.slice(split))
  // One path for all dots keeps thousands of catalog stars cheap to draw.
  const dots = (population ?? []).flatMap((object) => {
    const position = object.id === star.id || object.id === reference.id ? null : hrPoint(object, mode)
    return position ? [`M ${x(position.temperature)},${y(position.magnitude)} h 0`] : []
  })
  if (dots.length) plot.append(svgNode('path', { d: dots.join(' '), class: 'hr-dot' }))
  const visual = mode === 'visual'
  label(plot, 'Supergiants', x(9000), y(visual ? -7 : -7.6) + 5, 'hr-region-text')
  label(plot, 'Giants', x(3100) + 16, y(visual ? -1 : -3.8) + 5, 'hr-region-text', 'start')
  label(plot, 'Subgiants', x(5100) + 14, y(visual ? 3.3 : 3.1) + 5, 'hr-region-text', 'start')
  const mainLabelX = x(5000) - 12, mainLabelY = y(visual ? 7.4 : 6.5)
  const mainLabel = label(plot, 'Main sequence', mainLabelX, mainLabelY, 'hr-region-text', 'start')
  mainLabel.setAttribute('transform', `rotate(${visual ? 68 : 55} ${mainLabelX} ${mainLabelY})`)
  // Follow the white-dwarf band around 10,000 K, just below it.
  const whiteDwarfs = points(regions[3][1])
  const [ax, ay] = whiteDwarfs[1]!, [cx, cy] = whiteDwarfs[2]!, [bx, by] = whiteDwarfs[3]!
  const angle = Math.atan2(by - ay, bx - ax)
  const whiteDwarfX = cx - Math.sin(angle) * 21, whiteDwarfY = cy + Math.cos(angle) * 21 + 5
  label(plot, 'White dwarfs', whiteDwarfX, whiteDwarfY, 'hr-region-text')
    .setAttribute('transform', `rotate(${angle * 180 / Math.PI} ${whiteDwarfX} ${whiteDwarfY})`)
  if (mode === 'bolometric') {
    label(plot, 'Brown dwarfs', x(1000), y(20.6), 'hr-region-text')
    // Broad cooling continuation, not a hard stellar/substellar boundary.
    const cooling = [[750, 18.59], [500, 20.5], [250, 24]]
    plot.append(svgNode('polyline', { points: cooling.map(([t, m]) => `${x(t!)},${y(m!)}`).join(' '), class: 'hr-region-line hr-cooling' }))
  }
  const marker = (object: Star, position: HrPoint | null): ChartMarker | null => position
    ? { object, x: x(position.temperature), y: y(position.magnitude), description: `${number(position.temperature)} K · ${number(position.magnitude)} mag` } : null
  finish(magnitudeLabel, marker(star, point), star.id === reference.id ? null : marker(reference, referencePoint))
  get('hr-diagram').replaceChildren(svg)
  placeSpectralMarkerLabels(svg, { left, top, right: left + size, bottom })
}

type KielStar = Pick<Star, 'type' | 'temperature_k' | 'mass_solar' | 'radius_solar' | 'luminosity_solar' | 'stellar_observations'>
export interface KielPoint { temperature: number; logG: number; measured: boolean; derived: number | null }

/** log g (cgs) from catalog mass and radius, g = GM/R². */
export function derivedLogG(star: KielStar): number | null {
  if (!hrCardAvailable(star)) return null
  const { gravity } = massProperties(star)
  return gravity === null ? null : Math.log10(gravity * 100)
}

/** Measured spectroscopic log g wins; the mass/radius value is kept for comparison. */
export function kielPoint(star: KielStar): KielPoint | null {
  if (!hrCardAvailable(star) || !positive(star.temperature_k)) return null
  const measured = star.stellar_observations?.surface_gravity?.log_g ?? null
  const derived = derivedLogG(star)
  const logG = measured ?? derived
  return logG === null ? null : { temperature: star.temperature_k, logG, measured: measured !== null, derived }
}

// Teff and log g of the dwarf sequence, from the same Mamajek rows as the Mass card.
// Sparse anchors: rounded masses and radii make neighboring rows jitter.
const kielAnchors = new Set(['O5V', 'O9V', 'B2V', 'B5V', 'A0V', 'A5V', 'F0V', 'F5V', 'G0V', 'G5V', 'K0V', 'K5V', 'M0V', 'M3V', 'M5V', 'M7V', 'M9V'])
const kielMainSequence = dwarfSequence.rows.filter(([type]) => kielAnchors.has(String(type))).map(([, mass, radius, logLuminosity]) => [
  HR_SUN.temperature * (10 ** Number(logLuminosity) / Number(radius) ** 2) ** 0.25,
  derivedLogG({ type: 'star', temperature_k: null, mass_solar: Number(mass), radius_solar: Number(radius), luminosity_solar: null })!,
] as const)
// The H-R band's typical white dwarf: 0.6 M☉, ≈0.0125 R☉.
const whiteDwarfLogG = derivedLogG({ type: 'white_dwarf', temperature_k: null, mass_solar: 0.6, radius_solar: 0.0125, luminosity_solar: null })!
// Teff, log g centerlines of broad schematic regions; guides only.
const kielRegions = [
  ['hr-supergiants', [[35000, 3.4], [20000, 2.6], [10000, 1.8], [6000, 1.0], [3600, 0]]],
  ['hr-giants', [[5700, 3.4], [4800, 2.7], [4100, 1.9], [3500, 1.0], [3100, 0.5]]],
  ['hr-subgiants', [[6900, 3.9], [6000, 3.8], [5100, 3.6]]],
  ['hr-white-dwarfs', [[40000, whiteDwarfLogG], [4500, whiteDwarfLogG]]],
] as const

const logGText = (value: number | null) => value === null ? 'Not available' : value.toFixed(2)

/** Surface gravity against temperature. `population`, when given, adds catalog stars: filled dots are spectroscopic, hollow dots use catalog mass and radius. */
export function renderKielDiagram(card: HTMLElement, star: Star, reference: Star, population: readonly Star[] | null = null): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const same = star.id === reference.id
  const point = kielPoint(star), referencePoint = same ? null : kielPoint(reference)
  card.querySelector('.kiel-stats')!.classList.toggle('is-reference', same)
  for (const [prefix, object] of [['selected', star], ['reference', reference]] as const) {
    const gravity = object.stellar_observations?.surface_gravity
    get(`kiel-${prefix}-name`).textContent = object.name
    get(`kiel-${prefix}-type`).textContent = object.spectral_type ?? 'Not available'
    get(`kiel-${prefix}-temperature`).textContent = temperatureText(object)
    const measured = get(`kiel-${prefix}-measured`)
    measured.textContent = logGText(gravity?.log_g ?? null)
    measured.title = gravity ? [gravity.reference, `${gravity.measurements} ${gravity.measurements === 1 ? 'paper' : 'papers agree within 0.3 dex'}`,
      ...(gravity.scatter_dex === undefined ? [] : [`scatter ${gravity.scatter_dex.toFixed(2)} dex`]), ...(gravity.scope ? [gravity.scope] : [])].join(' · ') : ''
    get(`kiel-${prefix}-derived`).textContent = logGText(derivedLogG(object))
  }
  const missing = (object: Star) => kielPoint(object) ? ''
    : !positive(object.temperature_k) ? `${object.name} cannot be plotted: no catalog temperature.`
      : `${object.name} cannot be plotted: no spectroscopic log g, and no catalog mass and radius.`
  const note = get('kiel-missing')
  note.textContent = [...new Set([missing(star), same ? '' : missing(reference)])].filter(Boolean).join(' ')
  note.hidden = !note.textContent

  const temperatures = [point, referencePoint].flatMap((value) => value ? [value.temperature] : [])
  const hot = Math.max(50_000, ...temperatures.map((value) => value * 1.15)), cool = Math.min(250, ...temperatures.map((value) => value / 1.15))
  const gravities = [point, referencePoint].flatMap((value) => value ? [value.logG, value.derived ?? value.logG] : [])
  const low = Math.min(-1, ...gravities.map((value) => Math.floor(value - 0.5))), high = Math.max(9.5, ...gravities.map((value) => Math.ceil(value + 0.5)))
  const svg = svgNode('svg', { viewBox: '0 0 400 430', role: 'img', 'aria-labelledby': 'kiel-title', 'aria-describedby': 'kiel-description' })
  const describe = (object: Star, value: KielPoint | null) => value ? `${object.name}: ${number(value.temperature)} K, log g ${value.logG.toFixed(2)}${value.measured ? ' from spectra' : ' from mass and radius'}.` : missing(object)
  svg.append(svgNode('title', { id: 'kiel-title' }, `Kiel diagram: ${star.name}${same ? '' : ` and ${reference.name}`}${population ? ' among loaded catalog stars' : ''}`),
    svgNode('desc', { id: 'kiel-description' }, `Temperature decreases from ${number(hot)} to ${number(cool)} kelvin, left to right. Surface gravity log g increases from ${low} to ${high}, top to bottom.${population ? ' Filled dots are measured from spectra; hollow dots use catalog mass and radius.' : ''} Regions are schematic. ${[...new Set([describe(star, point), same ? '' : describe(reference, referencePoint)])].join(' ')}`))
  const { x, plot, label, path, finish } = temperatureChart(svg, 'kiel', hot, cool)
  const y = (value: number) => top + size * (value - low) / (high - low)
  for (let value = Math.ceil(low); value <= high; value++) {
    plot.append(svgNode('line', { x1: left, x2: left + size, y1: y(value), y2: y(value), class: 'hr-grid' }))
    label(svg, String(value).replace('-', '−'), left - 9, y(value) + 4, 'hr-axis-text', 'end')
  }
  for (const [className, rows] of kielRegions) path(`hr-region-band ${className}`, rows.map(([temperature, value]) => [x(temperature), y(value)] as const))
  const dwarfs = kielMainSequence.map(([temperature, value]) => [x(temperature), y(value)] as const)
  path('hr-region-band hr-main-sequence', dwarfs)
  path('hr-region-line hr-main-sequence', dwarfs)
  // Two paths keep thousands of dots cheap: round caps for measured, small rings for derived.
  const measuredDots: string[] = [], derivedDots: string[] = []
  for (const object of population ?? []) {
    const value = object.id === star.id || object.id === reference.id ? null : kielPoint(object)
    if (!value) continue
    const px = x(value.temperature), py = y(value.logG)
    if (value.measured) measuredDots.push(`M ${px},${py} h 0`)
    else derivedDots.push(`M ${px - 1.5},${py} a 1.5,1.5 0 1,0 3,0 a 1.5,1.5 0 1,0 -3,0`)
  }
  if (derivedDots.length) plot.append(svgNode('path', { d: derivedDots.join(' '), class: 'kiel-derived-dot' }))
  if (measuredDots.length) plot.append(svgNode('path', { d: measuredDots.join(' '), class: 'kiel-dot' }))
  label(plot, 'Supergiants', x(12000), y(1.6) + 5, 'hr-region-text')
  label(plot, 'Giants', x(3100) + 16, y(0.5) + 5, 'hr-region-text', 'start')
  label(plot, 'Subgiants', x(5100) + 14, y(3.6) + 5, 'hr-region-text', 'start')
  label(plot, 'Main sequence', x(16000), y(4.3) + 22, 'hr-region-text', 'start')
  label(plot, 'Brown dwarfs', x(1100), y(6.2), 'hr-region-text')
  label(plot, 'White dwarfs', x(15000), y(whiteDwarfLogG) - 16, 'hr-region-text')
  const marker = (object: Star, value: KielPoint | null): ChartMarker | null => value
    ? { object, x: x(value.temperature), y: y(value.logG), description: `${number(value.temperature)} K · log g ${value.logG.toFixed(2)}` } : null
  finish('Surface gravity (log g)', marker(star, point), marker(reference, referencePoint))
  // Where both exist, a ring above the star glyphs shows the mass/radius value, dashed-linked once clear of the marker.
  for (const [object, value] of [[star, point], [reference, referencePoint]] as const) {
    if (!value?.measured || value.derived === null || Math.abs(value.derived - value.logG) < 0.05) continue
    const px = x(value.temperature), from = y(value.logG), to = y(value.derived), direction = Math.sign(to - from)
    const group = svgNode('g', { class: 'kiel-derived-marker' })
    group.append(svgNode('title', {}, `${object.name}: log g ${value.derived.toFixed(2)} from catalog mass and radius`))
    if (Math.abs(to - from) > 18) group.append(svgNode('line', { x1: px, x2: px, y1: from + direction * 13, y2: to - direction * 5 }))
    group.append(svgNode('circle', { cx: px, cy: to, r: 5 }))
    svg.append(group)
  }
  get('kiel-diagram').replaceChildren(svg)
  placeSpectralMarkerLabels(svg, { left, top, right: left + size, bottom })
}
