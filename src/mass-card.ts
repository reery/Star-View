import type { Star } from './catalog-model'
import { massEvolution, massGravityContext, massProperties, solarBarScale } from './mass-properties'

const number = (value: number, digits = 3) => value.toLocaleString('en-US', { maximumSignificantDigits: digits })
const fixed = (value: number, digits = 1) => value.toLocaleString('en-US', { maximumFractionDigits: digits })
const solarComparison = (ratio: number) => ratio < 1 ? `${number(ratio * 100)}% of Sun` : `${number(ratio)}× Sun`
const superscript = (value: string) => value.replace(/[-\d]/g, (digit) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(digit)]!)

export function renderMassCardContent(card: HTMLElement, star: Star): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const set = (id: string, content: string) => { get(id).textContent = content }
  const properties = massProperties(star)
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
  set('mass-gravity-context', massGravityContext(star))

  function metric(id: string, value: number | null, unit: string, ratio: number | null, extra = '', digits = 1): void {
    set(`${id}-value`, value === null ? 'Not available' : `${value !== 0 && (value < 0.01 || value >= 1e6) ? number(value) : fixed(value, digits)} ${unit}`)
    set(`${id}-ratio`, ratio === null ? '' : solarComparison(ratio))
    set(`${id}-extra`, extra)
    const bar = get(`${id}-bar`)
    bar.hidden = ratio === null
    if (ratio !== null) {
      const { position, low, high } = solarBarScale(ratio)
      bar.style.setProperty('--mass-ratio-position', `${position}%`)
      bar.setAttribute('aria-label', `${solarComparison(ratio)}. Comparison from ${number(low)} to ${number(high)} times Sun; Sun is the central tick.`)
      bar.title = bar.getAttribute('aria-label')!
      set(`${id}-low`, `${number(low)}×`)
      set(`${id}-high`, `${number(high)}×`)
    }
  }
  metric('mass-gravity', properties.gravity, 'm/s²', properties.gravityRatio, properties.gravity === null ? '' : `${fixed(properties.gravity / 9.80665)}× Earth`)
  // Earth surface escape speed: https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
  metric('mass-escape', properties.escapeKms, 'km/s', properties.escapeRatio, properties.escapeKms === null ? '' : `${fixed(properties.escapeKms / 11.186)}× Earth`)
  // Water is approximately 1 g/cm³; this is a bulk-density comparison, not surface density.
  metric('mass-density', properties.density, 'g/cm³', properties.densityRatio, properties.density === null ? '' : `≈ ${number(properties.density, 2)}× water`, properties.density !== null && properties.density < 0.01 ? 6 : 3)
  const evolution = massEvolution(star)
  metric('mass-efficiency', properties.luminosityPerMass, 'L☉ / M☉', properties.luminosityPerMass)
  set('mass-efficiency-detail', properties.luminosityPerMass === null ? 'Catalog luminosity and mass are both needed for this comparison.' : `${number(properties.luminosity!, 5)} L☉ ÷ ${number(mass!, 5)} M☉. Each solar mass of ${star.name} is associated with ${solarComparison(properties.luminosityPerMass).replace('Sun', 'the Sun’s energy output per solar mass')}.`)
  set('mass-end-state', evolution.outcome)
  set('mass-end-state-comment', evolution.comment)
}
