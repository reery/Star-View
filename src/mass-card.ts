import type { Star } from './catalog-model'
import { massEvolution, massGravityContext, massProperties, solarBarScale } from './mass-properties'
import { massComparison, typicalMassRangePosition, type MassMetric, type MassReference } from './mass-comparison'

const number = (value: number, digits = 3) => value.toLocaleString('en-US', { maximumSignificantDigits: digits })
const fixed = (value: number, digits = 1) => value.toLocaleString('en-US', { maximumFractionDigits: digits })
const superscript = (value: string) => value.replace(/[-\d]/g, (digit) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(digit)]!)

export function renderMassCardContent(card: HTMLElement, star: Star, origin: Star, mode: MassReference): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const set = (id: string, content: string) => { get(id).textContent = content }
  const properties = massProperties(star)
  const comparison = massComparison(star, origin, mode)
  const referenceLabel = mode === 'class' ? 'class' : mode === 'origin' ? origin.name : 'Sun'
  const ratioLabel = (ratio: number) => ratio < 1 ? `${number(ratio * 100)}% of ${referenceLabel}` : `${number(ratio)}× ${referenceLabel}`
  set('mass-reference-context', mode === 'class'
    ? comparison.typical ? `${comparison.typical.fallbackLabel ?? comparison.typical.label} · ${comparison.typical.rangeLabel ?? 'Typical mass reference'}`
      : comparison.classLabel ? `${comparison.classLabel} · No class guide assigned` : 'A spectral and luminosity class is needed for a class comparison.'
    : `Reference: ${comparison.label}`)
  set('mass-class-method', comparison.typical?.note ?? 'No usable published or catalog class reference is available for this classification. Composite spectra need individual component measurements. No generic mass reference is assigned to black holes or sub-brown dwarfs.')
  get('mass-class-method').hidden = mode !== 'class'
  const source = get('mass-class-source') as HTMLAnchorElement
  source.hidden = !comparison.typical?.source
  if (comparison.typical?.source) {
    source.href = comparison.typical.source
    source.textContent = `${comparison.typical.sourceLabel} ↗`
  }
  const { mass, kilograms, earthMasses } = properties
  set('mass-card-value', mass === null ? 'Mass not available' : `${fixed(mass, 6)} M☉`)
  const uncertainty = star.compact?.mass_error_solar
  set('mass-card-uncertainty', uncertainty !== null && uncertainty !== undefined && Number.isFinite(uncertainty) && uncertainty >= 0 && mass !== null ? `± ${number(uncertainty)} M☉` : '')
  get('mass-card-uncertainty').hidden = !get('mass-card-uncertainty').textContent
  const [mantissa, exponent] = kilograms === null ? [] : kilograms.toExponential(3).split('e')
  set('mass-conversions', kilograms === null ? '' : `${mantissa} × 10${superscript(String(Number(exponent)))} kg`)
  set('mass-earth-masses', earthMasses === null ? '' : `≈ ${earthMasses.toLocaleString('en-US', { notation: 'compact', maximumSignificantDigits: 3 }).replace('K', 'k')}× Earth`)

  // Keep the familiar stellar range; extend only for an outlying selected mass.
  const low = mass !== null && mass < 0.08 ? 10 ** Math.floor(Math.log10(mass)) : 0.08
  const high = mass !== null && mass > 100 ? 10 ** Math.ceil(Math.log10(mass)) : 100
  const scalePosition = (value: number) => (Math.log10(value) - Math.log10(low)) / (Math.log10(high) - Math.log10(low)) * 100
  const position = mass === null ? 50 : scalePosition(mass)
  get('mass-scale').style.setProperty('--mass-ratio-position', `${position}%`)
  get('mass-scale').setAttribute('aria-label', `Mass scale from ${number(low)} to ${number(high)} solar masses. Hydrogen-burning limit approximately 0.08, Sun 1, core-collapse initial-mass boundary approximately 8. ${mass === null ? 'Selected mass unavailable.' : `${star.name}: ${fixed(mass, 6)} solar masses.`}`)
  get('mass-scale-marker').hidden = mass === null
  get('mass-scale').querySelector<HTMLElement>('.mass-ratio-fill')!.hidden = mass === null
  set('mass-scale-selected', star.name)
  get('mass-scale-ticks').replaceChildren(...[...new Set([low, 0.08, 1, 8, high])].sort((a, b) => a - b).map((value) => {
    const tick = document.createElement('span')
    tick.className = 'mass-scale-tick'
    const percent = scalePosition(value)
    tick.style.left = `${percent}%`
    tick.style.setProperty('--mass-tick-offset', percent === 0 ? '0%' : percent === 100 ? '-100%' : '-50%')
    const label = document.createElement('span')
    label.textContent = `${number(value)} M☉`
    if (value === 0.08 || value === 8) {
      label.classList.add('mass-metric-copy', 'mass-scale-help')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'mass-metric-help'
      button.textContent = label.textContent
      const tooltip = document.createElement('span')
      tooltip.id = value === 0.08 ? 'mass-hydrogen-tooltip' : 'mass-collapse-tooltip'
      tooltip.className = 'tooltip mass-metric-tooltip'
      tooltip.setAttribute('role', 'tooltip')
      tooltip.textContent = value === 0.08 ? 'Hydrogen-burning limit' : 'Core-collapse boundary (initial mass)'
      button.setAttribute('aria-describedby', tooltip.id)
      label.replaceChildren(button, tooltip)
    }
    if (value === 1) {
      tick.classList.add('mass-sun-tick')
    }
    tick.append(label)
    return tick
  }))
  // Very broad remnant ranges can crowd the benchmark labels: use a second row as needed.
  const rowEnds: number[] = []
  const overviewBounds = card.querySelector<HTMLElement>('.mass-overview')!.getBoundingClientRect()
  for (const tick of get('mass-scale-ticks').children) {
    const label = tick.firstElementChild as HTMLElement
    const bounds = label.getBoundingClientRect()
    let row = rowEnds.findIndex((end) => bounds.left >= end + 8)
    if (row < 0) row = rowEnds.length
    rowEnds[row] = bounds.right
    label.style.setProperty('--mass-tick-row', String(row))
    if (label.classList.contains('mass-scale-help')) {
      // Keep the popup inside the card while its triangle points at the tick label.
      const width = Math.min(220, overviewBounds.width)
      const left = Math.max(overviewBounds.left, Math.min(bounds.left, overviewBounds.right - width))
      label.style.setProperty('--mass-tooltip-width', `${width}px`)
      label.style.setProperty('--mass-tooltip-offset', `${left - bounds.left}px`)
      label.style.setProperty('--mass-tooltip-arrow', `${Math.max(10, Math.min((bounds.left + bounds.right) / 2 - left - 4, width - 18))}px`)
    }
  }
  get('mass-scale').style.setProperty('--mass-tick-rows', String(Math.max(1, rowEnds.length)))
  // The bars explain comparisons; keep prose for missing data and model limitations.
  const gravityContext = properties.gravity === null ? massGravityContext(star) : ''
  set('mass-gravity-context', gravityContext)
  get('mass-gravity-context').hidden = !gravityContext

  get('mass-reference-metric').hidden = mode !== 'class' || comparison.typical === null
  set('mass-reference-heading', `Mass range for ${comparison.label}`)

  function metric(id: string, key: MassMetric, value: number | null, unit: string, extra = '', digits = 1): void {
    const { ratio, value: reference, range } = comparison.metrics[key]
    set(`${id}-value`, value === null ? 'Not available' : `${value !== 0 && (value < 0.01 || value >= 1e6) ? number(value) : fixed(value, digits)} ${unit}`)
    const ratioText = mode === 'class' ? '' : ratio === null ? value === null ? '' : 'Reference unavailable' : ratioLabel(ratio)
    set(`${id}-ratio`, ratioText)
    get(`${id}-ratio`).hidden = !ratioText || id === 'mass-reference'
    const metricReference = comparison.typical?.metrics[key]
    const benchmarkClass = metricReference?.referenceLabel && metricReference.referenceLabel !== comparison.label ? ` (${metricReference.referenceLabel})` : ''
    const referenceText = reference === null
      ? mode === 'class' ? '' : 'Catalog reference data missing'
      : `${mode === 'class' ? `${comparison.typical?.benchmarkLabel ?? 'Typical'}${benchmarkClass}` : referenceLabel}: ${number(reference)} ${unit}`
    const lowerBound = value !== null && range !== null && value < range[0] ? `Lower: ${number(range[0])} ${unit}` : ''
    const upperBound = range !== null ? `Upper: ${number(range[1])} ${unit}` : ''
    const benchmark = [referenceText, lowerBound, upperBound].filter(Boolean).join(', ')
    set(`${id}-benchmark`, benchmark)
    set(`${id}-extra`, extra)
    get(`${id}-extra`).hidden = !extra
    get(`${id}-benchmark`).hidden = !benchmark
    get(`${id}-benchmark`).title = mode === 'class' ? `${benchmark}. ${comparison.typical?.sourceLabel ?? ''}` : benchmark
    if (id === 'mass-reference') {
      set(`${id}-value`, '')
      get(`${id}-value`).hidden = true
    }
    const bar = get(`${id}-bar`)
    const typicalMarker = bar.querySelector<HTMLElement>('.mass-ratio-sun')!
    const selectedMarker = bar.querySelector<HTMLElement>('.mass-ratio-marker')!
    const rangeLow = bar.querySelector<HTMLElement>('.mass-typical-low')!
    const rangeHigh = bar.querySelector<HTMLElement>('.mass-typical-high')!
    bar.classList.toggle('has-class-range', range !== null)
    bar.hidden = ratio === null && range === null
    selectedMarker.hidden = value === null
    typicalMarker.hidden = reference === null
    bar.querySelector<HTMLElement>('.mass-ratio-fill')!.hidden = value === null
    rangeLow.hidden = rangeHigh.hidden = range === null
    typicalMarker.style.left = '50%'
    typicalMarker.title = benchmark
    if (range !== null) {
      const rangeKind = comparison.typical?.benchmarkLabel === 'Catalog average' ? 'Catalog range' : 'Typical range'
      const { position, low, high, rangeLowPosition, rangeHighPosition, typicalPosition } = typicalMassRangePosition(value, range, reference)
      bar.style.setProperty('--mass-ratio-position', `${position ?? 0}%`)
      bar.style.setProperty('--mass-range-low-position', `${rangeLowPosition}%`)
      bar.style.setProperty('--mass-range-high-position', `${rangeHighPosition}%`)
      // The fill's percentages use its own width; the track's use the whole axis.
      const fillRangePosition = (bound: number) => position !== null && position > 0 ? Math.min(100, Math.max(0, bound / position * 100)) : 0
      bar.style.setProperty('--mass-fill-range-low-position', `${fillRangePosition(rangeLowPosition)}%`)
      bar.style.setProperty('--mass-fill-range-high-position', `${fillRangePosition(rangeHighPosition)}%`)
      rangeLow.style.left = `${rangeLowPosition}%`
      rangeHigh.style.left = `${rangeHighPosition}%`
      rangeLow.title = `${rangeKind} minimum: ${number(range[0])} ${unit}`
      rangeHigh.title = `${rangeKind} maximum: ${number(range[1])} ${unit}`
      if (typicalPosition !== null) typicalMarker.style.left = `${typicalPosition}%`
      set(`${id}-low`, number(low))
      set(`${id}-mid`, unit)
      set(`${id}-high`, number(high))
      bar.setAttribute('aria-label', `${star.name}: ${value === null ? 'not available' : `${number(value)} ${unit}`}. ${rangeKind} (${metricReference?.rangeLabel ?? comparison.typical!.rangeLabel}): ${number(range[0])} to ${number(range[1])} ${unit}. Logarithmic axis from ${number(low)} to ${number(high)} ${unit}. ${benchmark}.`)
      bar.title = bar.getAttribute('aria-label')!
    } else if (ratio !== null) {
      const { position, low, high } = solarBarScale(ratio)
      bar.style.setProperty('--mass-ratio-position', `${position}%`)
      bar.setAttribute('aria-label', mode === 'class'
        ? `${star.name}: ${number(value!)} ${unit}. ${benchmark}. Logarithmic axis from ${number(low * reference!)} to ${number(high * reference!)} ${unit}.`
        : `${ratioLabel(ratio)}. ${benchmark}. Logarithmic comparison from ${number(low)} to ${number(high)} times reference; ${comparison.label} is the central tick at 1 times.`)
      bar.title = bar.getAttribute('aria-label')!
      set(`${id}-low`, mode === 'class' ? number(low * reference!) : `${number(low)}×`)
      set(`${id}-mid`, mode === 'class' ? unit : referenceLabel)
      set(`${id}-high`, mode === 'class' ? number(high * reference!) : `${number(high)}×`)
    }
  }
  metric('mass-reference', 'mass', mass, 'M☉')
  metric('mass-gravity', 'gravity', properties.gravity, 'm/s²', properties.gravity === null ? '' : `${fixed(properties.gravity / 9.80665)}× Earth`)
  metric('mass-escape', 'escapeKms', properties.escapeKms, 'km/s', properties.escapeKms === null ? '' : `${fixed(properties.escapeKms / 11.186)}× Earth`)
  metric('mass-density', 'density', properties.density, 'g/cm³', properties.density === null ? '' : `≈ ${number(properties.density, 2)}× water`, properties.density !== null && properties.density < 0.01 ? 6 : 3)
  const evolution = massEvolution(star)
  metric('mass-efficiency', 'luminosityPerMass', properties.luminosityPerMass, 'L☉ / M☉')
  set('mass-efficiency-detail', properties.luminosityPerMass === null ? 'Catalog luminosity and mass are both needed for this comparison.' : '')
  get('mass-efficiency-detail').hidden = properties.luminosityPerMass !== null
  set('mass-end-state', evolution.outcome)
  set('mass-end-state-comment', evolution.comment)
}
