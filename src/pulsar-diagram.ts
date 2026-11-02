import type { Star } from './catalog-model'
import { preciseMeasurement, quantity, scientificQuantity } from './format'
import { placeSpectralMarkerLabels, spectralMarker, svgNode } from './spectral-chart'

interface SpinPoint { period: number; derivative: number }

/** Period and positive period derivative, the coordinates of the P–Ṗ diagram. */
export function spinPoint(star: Pick<Star, 'compact'>): SpinPoint | null {
  const period = star.compact?.rotation_period_s ?? null
  const derivative = star.compact?.period_derivative ?? null
  return period !== null && period > 0 && derivative !== null && derivative > 0 ? { period, derivative } : null
}

// Same magnetic-dipole braking model as the catalog's derived values (psrcat).
const FIELD_GAUSS = 3.2e19
const YEAR_S = 365.25 * 86400
// Chen & Ruderman 1993 death line, B/P² = 0.17 × 10¹² G s⁻², written as Ṗ(P).
const DEATH_LINE = (0.17e12 / FIELD_GAUSS) ** 2
const superscript = (exponent: number) => String(exponent).replace('-', '⁻').replace(/\d/g, (digit) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(digit)]!)
const power = (exponent: number) => `10${superscript(exponent)}`

export function renderPulsarDiagram(card: HTMLElement, star: Star, reference: Star | null, population: readonly Star[]): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const compared = reference && reference.id !== star.id && spinPoint(reference) ? reference : null
  const row = (object: Star | null, prefix: string) => {
    get(`pulsar-${prefix}-name`).textContent = object?.name ?? ''
    get(`pulsar-${prefix}-period`).textContent = object ? preciseMeasurement(object.compact?.rotation_period_s ?? null, null, 's') : ''
    get(`pulsar-${prefix}-derivative`).textContent = object ? preciseMeasurement(object.compact?.period_derivative ?? null, null, 's/s') : ''
    get(`pulsar-${prefix}-age`).textContent = object ? quantity(object.compact?.characteristic_age_yr ?? null, 'yr', 0) : ''
    get(`pulsar-${prefix}-field`).textContent = object ? scientificQuantity(object.compact?.surface_magnetic_field_gauss ?? null, 'G') : ''
  }
  row(star, 'selected')
  row(compared, 'reference')
  card.querySelector('.spectral-stats')!.classList.toggle('is-reference', !compared)

  const points = population.flatMap((object) => {
    const point = spinPoint(object)
    return point ? [{ object, point }] : []
  })
  const selected = spinPoint(star)
  const all = [...points.map(({ point }) => point), ...(selected ? [selected] : [])]
  // Decades that hold every plotted pulsar, with the classic 1 ms–10 s span as the minimum.
  const minPeriod = Math.min(-3, Math.floor(Math.log10(Math.min(...all.map((point) => point.period)))))
  const maxPeriod = Math.max(1, Math.ceil(Math.log10(Math.max(...all.map((point) => point.period)))))
  const minDerivative = Math.min(-21, Math.floor(Math.log10(Math.min(...all.map((point) => point.derivative)))))
  const maxDerivative = Math.max(-11, Math.ceil(Math.log10(Math.max(...all.map((point) => point.derivative)))))
  const left = 58, top = 24, size = 330, bottom = top + size
  const x = (period: number) => left + size * (Math.log10(period) - minPeriod) / (maxPeriod - minPeriod)
  const y = (derivative: number) => bottom - size * (Math.log10(derivative) - minDerivative) / (maxDerivative - minDerivative)

  const svg = svgNode('svg', { viewBox: '0 0 400 400', role: 'img', 'aria-labelledby': 'pulsar-diagram-title', 'aria-describedby': 'pulsar-diagram-description' })
  svg.append(svgNode('title', { id: 'pulsar-diagram-title' }, `P–Ṗ diagram: ${star.name} among ${points.length} catalog pulsars`))
  const describe = (object: Star, point: SpinPoint | null) => point ? `${object.name}: period ${point.period.toPrecision(4)} s, spin-down rate ${point.derivative.toExponential(2)}.` : ''
  svg.append(svgNode('desc', { id: 'pulsar-diagram-description' }, `Spin period increases from ${power(minPeriod)} to ${power(maxPeriod)} seconds, left to right; spin-down rate increases from ${power(minDerivative)} to ${power(maxDerivative)}, bottom to top, both on logarithmic scales. Dashed lines mark constant characteristic age, dotted lines constant surface magnetic field. ${describe(star, selected)} ${compared ? describe(compared, spinPoint(compared)) : ''}`.trim()))
  const defs = svgNode('defs')
  const clip = svgNode('clipPath', { id: 'pulsar-plot-clip' })
  clip.append(svgNode('rect', { x: left, y: top, width: size, height: size }))
  defs.append(clip)
  svg.append(defs, svgNode('rect', { x: left, y: top, width: size, height: size, fill: '#0b0e14' }))
  const plot = svgNode('g', { 'clip-path': 'url(#pulsar-plot-clip)' })
  const label = (parent: SVGElement, content: string, px: number, py: number, className = 'hr-axis-text', anchor = 'middle') => {
    const text = svgNode('text', { x: px, y: py, class: className, 'text-anchor': anchor }, content)
    parent.append(text)
    return text
  }
  for (let exponent = minPeriod; exponent <= maxPeriod; exponent++) {
    plot.append(svgNode('line', { x1: x(10 ** exponent), x2: x(10 ** exponent), y1: top, y2: bottom, class: 'hr-grid' }))
    label(svg, power(exponent), x(10 ** exponent), bottom + 18)
  }
  for (let exponent = minDerivative; exponent <= maxDerivative; exponent += 2) {
    plot.append(svgNode('line', { x1: left, x2: left + size, y1: y(10 ** exponent), y2: y(10 ** exponent), class: 'hr-grid' }))
    label(svg, power(exponent), left - 7, y(10 ** exponent) + 4, 'hr-axis-text', 'end')
  }
  label(svg, 'Spin period (s)', left + size / 2, 394)
  const vertical = label(svg, 'Spin-down rate Ṗ (s/s)', 14, top + size / 2)
  vertical.setAttribute('transform', `rotate(-90 14 ${top + size / 2})`)

  // Guide lines across the full period range: Ṗ = P / 2τ for age τ, Ṗ = (B / 3.2 × 10¹⁹)² / P for field B.
  const periods = [10 ** minPeriod, 10 ** maxPeriod]
  const guide = (derivative: (period: number) => number, className: string, text: string, labelPeriod: number) => {
    plot.append(svgNode('line', { x1: x(periods[0]!), y1: y(derivative(periods[0]!)), x2: x(periods[1]!), y2: y(derivative(periods[1]!)), class: `hr-region-line ${className}` }))
    const py = y(derivative(labelPeriod))
    if (py > top + 10 && py < bottom - 24) label(plot, text, x(labelPeriod), py - 4, 'pulsar-guide-text')
  }
  for (const exponent of [4, 6, 8, 10]) guide((period) => period / (2 * 10 ** exponent * YEAR_S), 'pulsar-age-line', `${power(exponent)} yr`, 10 ** (maxPeriod - 0.6))
  for (const exponent of [8, 10, 12, 14]) guide((period) => (10 ** exponent / FIELD_GAUSS) ** 2 / period, 'pulsar-field-line', `${power(exponent)} G`, 10 ** (minPeriod + 0.45))
  // Label the death line where it crosses the lower plot, clear of the age labels at the right edge.
  guide((period) => DEATH_LINE * period ** 3, 'pulsar-death-line', 'Death line', (10 ** (minDerivative + 2.5) / DEATH_LINE) ** (1 / 3))
  label(plot, 'Millisecond pulsars', left + 6, y(10 ** (minDerivative + 0.25)), 'hr-region-text', 'start')
  label(plot, 'Young pulsars', x(0.08), y(3e-12), 'hr-region-text')
  label(plot, 'Graveyard', x(10 ** (maxPeriod - 0.55)), y(10 ** (minDerivative + 0.6)), 'hr-region-text')

  for (const { object, point } of points) {
    if (object.id === star.id || object.id === compared?.id) continue
    const dot = svgNode('circle', { cx: x(point.period), cy: y(point.derivative), r: 2.4, class: 'pulsar-dot' })
    dot.append(svgNode('title', {}, object.name))
    plot.append(dot)
  }
  svg.append(plot, svgNode('rect', { x: left, y: top, width: size, height: size, class: 'hr-frame' }))
  const mark = (object: Star, point: SpinPoint, isSelected: boolean) => {
    const px = x(point.period), py = y(point.derivative)
    const group = spectralMarker(object, px, py, isSelected, 'hr', `${point.period.toPrecision(4)} s · Ṗ ${point.derivative.toExponential(2)}`)
    const rightAligned = px > left + size * 0.65
    label(group, object.name.length > 22 ? `${object.name.slice(0, 21)}…` : object.name, rightAligned ? px - 17 : px + 17, py - 19, 'hr-marker-text', rightAligned ? 'end' : 'start')
    svg.append(group)
  }
  if (compared) mark(compared, spinPoint(compared)!, false)
  if (selected) mark(star, selected, true)
  const missing = get('pulsar-missing')
  missing.textContent = selected ? '' : `${star.name} cannot be plotted: no catalog spin-down rate.`
  missing.hidden = Boolean(selected)
  get('pulsar-diagram').replaceChildren(svg)
  placeSpectralMarkerLabels(svg, { left, top, right: left + size, bottom })
}
