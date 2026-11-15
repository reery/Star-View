import type { Star } from './catalog-model'
import { significant } from './format'
import { solarBarScale } from './mass-properties'
import { type RadiusComparison } from './radius-comparison'
import { typicalRadiusPosition, typicalRadiusRange } from './radius-properties'


export function renderRadiusBars(card: HTMLElement, star: Star, comparison: RadiusComparison): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const set = (id: string, value: string) => { get(id).textContent = value }
  const { selected, reference } = comparison
  const referenceAvailable = selected.radiusKm !== null && reference.radiusKm !== null
  set('radius-reference-heading', `Radius vs ${reference.name}`)
  set('radius-reference-value', referenceAvailable ? `${significant(selected.radiusKm! / reference.radiusKm!)}×` : 'Not available')
  get('radius-reference-bar').hidden = !referenceAvailable
  if (referenceAvailable) {
    const ratio = selected.radiusKm! / reference.radiusKm!
    const { low, high, position } = solarBarScale(ratio)
    const bar = get('radius-reference-bar')
    bar.style.setProperty('--mass-ratio-position', `${Math.max(0, Math.min(100, position))}%`)
    set('radius-reference-low', `${significant(low)}×`)
    set('radius-reference-mid', `${reference.name} (1×)`)
    set('radius-reference-high', `${significant(high)}×`)
    bar.setAttribute('aria-label', `${star.name}: ${significant(ratio)} times the radius of ${reference.name}. Logarithmic scale from ${significant(low)} to ${significant(high)} times; ${reference.name} is the central tick.`)
    bar.title = bar.getAttribute('aria-label')!
  }

  const range = typicalRadiusRange(star)
  // Keep spectral letters capitalized: "G-type", but "white dwarf".
  const label = range?.label.replace(/^[A-Z](?=[a-z])/, (letter) => letter.toLowerCase())
  set('radius-typical-heading', range ? `Typical ${label} size` : 'Typical object size')
  const available = range !== null && selected.radiusKm !== null
  get('radius-typical-bar').hidden = !available
  get('radius-typical-source').hidden = range === null
  set('radius-typical-value', available ? `${significant(selected.radiusKm! / range.radiusKmPerUnit)} ${range.unit}` : 'Not available')
  set('radius-typical-method', range ? `${range.label}: approximately ${significant(range.low)}–${significant(range.high)} ${range.unit}. ${range.note}` : '')
  if (range) {
    const source = get('radius-typical-source') as HTMLAnchorElement
    source.href = range.source
    source.textContent = `${range.sourceLabel} ↗`
  }
  if (available) {
    const { position, low, high, rangeLowPosition, rangeHighPosition } = typicalRadiusPosition(selected.radiusKm!, range)
    const bar = get('radius-typical-bar')
    bar.style.setProperty('--mass-ratio-position', `${position}%`)
    bar.style.setProperty('--mass-range-low-position', `${rangeLowPosition}%`)
    bar.style.setProperty('--mass-range-high-position', `${rangeHighPosition}%`)
    const fillRangePosition = (bound: number) => position > 0 ? Math.min(100, Math.max(0, bound / position * 100)) : 0
    bar.style.setProperty('--mass-fill-range-low-position', `${fillRangePosition(rangeLowPosition)}%`)
    bar.style.setProperty('--mass-fill-range-high-position', `${fillRangePosition(rangeHighPosition)}%`)
    const rangeLow = bar.querySelector<HTMLElement>('.mass-typical-low')!
    const rangeHigh = bar.querySelector<HTMLElement>('.mass-typical-high')!
    rangeLow.style.left = `${rangeLowPosition}%`
    rangeHigh.style.left = `${rangeHighPosition}%`
    rangeLow.title = `Typical radius minimum: ${significant(range.low)} ${range.unit}`
    rangeHigh.title = `Typical radius maximum: ${significant(range.high)} ${range.unit}`
    set('radius-typical-low', significant(range.low))
    set('radius-typical-high', `${significant(range.high)} ${range.unit}`)
    set('radius-legend-object', star.name)
    bar.setAttribute('aria-label', `${star.name}: ${significant(selected.radiusKm! / range.radiusKmPerUnit)} ${range.unit}. Typical ${label} radius guide from ${significant(range.low)} to ${significant(range.high)} ${range.unit}. Logarithmic axis from ${significant(low)} to ${significant(high)} ${range.unit}; the line is thinner outside the typical range.`)
    bar.title = bar.getAttribute('aria-label')!
  }
}
