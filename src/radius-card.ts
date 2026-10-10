import type { Star } from './catalog-model'
import { solarBarScale } from './mass-properties'
import { type RadiusComparison } from './radius-comparison'
import { typicalRadiusPosition, typicalRadiusRange } from './radius-properties'

const number = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: 3 })

export function renderRadiusBars(card: HTMLElement, star: Star, comparison: RadiusComparison): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const set = (id: string, value: string) => { get(id).textContent = value }
  const { selected, reference } = comparison
  const referenceAvailable = selected.radiusKm !== null && reference.radiusKm !== null
  set('radius-reference-heading', `Radius vs ${reference.name}`)
  set('radius-reference-value', referenceAvailable ? `${number(selected.radiusKm! / reference.radiusKm!)}×` : 'Not available')
  get('radius-reference-bar').hidden = !referenceAvailable
  if (referenceAvailable) {
    const ratio = selected.radiusKm! / reference.radiusKm!
    const { low, high, position } = solarBarScale(ratio)
    const bar = get('radius-reference-bar')
    bar.style.setProperty('--mass-ratio-position', `${Math.max(0, Math.min(100, position))}%`)
    set('radius-reference-low', `${number(low)}×`)
    set('radius-reference-mid', `${reference.name} (1×)`)
    set('radius-reference-high', `${number(high)}×`)
    bar.setAttribute('aria-label', `${star.name}: ${number(ratio)} times the radius of ${reference.name}. Logarithmic scale from ${number(low)} to ${number(high)} times; ${reference.name} is the central tick.`)
    bar.title = bar.getAttribute('aria-label')!
  }

  const range = typicalRadiusRange(star)
  set('radius-typical-heading', range ? `Typical ${range.label.toLowerCase()} size` : 'Typical object size')
  const available = range !== null && selected.radiusKm !== null
  get('radius-typical-bar').hidden = !available
  get('radius-typical-source').hidden = range === null
  set('radius-typical-value', available ? `${number(selected.radiusKm! / range.radiusKmPerUnit)} ${range.unit}` : 'Not available')
  set('radius-typical-method', range ? `${range.label}: approximately ${number(range.low)}–${number(range.high)} ${range.unit}. ${range.note}` : '')
  if (range) {
    const source = get('radius-typical-source') as HTMLAnchorElement
    source.href = range.source
    source.textContent = `${range.sourceLabel} ↗`
  }
  if (available) {
    const { position, low, high, rangeLowPosition, rangeHighPosition, typicalPosition } = typicalRadiusPosition(selected.radiusKm!, range)
    const bar = get('radius-typical-bar')
    bar.style.setProperty('--mass-ratio-position', `${position}%`)
    bar.style.setProperty('--mass-range-low-position', `${rangeLowPosition}%`)
    bar.style.setProperty('--mass-range-high-position', `${rangeHighPosition}%`)
    const fillRangePosition = (bound: number) => position !== null && position > 0 ? Math.min(100, Math.max(0, bound / position * 100)) : 0
    bar.style.setProperty('--mass-fill-range-low-position', `${fillRangePosition(rangeLowPosition)}%`)
    bar.style.setProperty('--mass-fill-range-high-position', `${fillRangePosition(rangeHighPosition)}%`)
    const rangeLow = bar.querySelector<HTMLElement>('.mass-typical-low')!
    const rangeHigh = bar.querySelector<HTMLElement>('.mass-typical-high')!
    rangeLow.style.left = `${rangeLowPosition}%`
    rangeHigh.style.left = `${rangeHighPosition}%`
    rangeLow.title = `Typical radius minimum: ${number(range.low)} ${range.unit}`
    rangeHigh.title = `Typical radius maximum: ${number(range.high)} ${range.unit}`
    bar.querySelector<HTMLElement>('.mass-ratio-sun')!.style.left = `${typicalPosition}%`
    set('radius-typical-low', `${number(low)} ${range.unit}`)
    set('radius-typical-mid', `${number(Math.sqrt(low * high))} ${range.unit}`)
    set('radius-typical-high', `${number(high)} ${range.unit}`)
    bar.setAttribute('aria-label', `${star.name}: ${number(selected.radiusKm! / range.radiusKmPerUnit)} ${range.unit}. Typical ${range.label.toLowerCase()} radius guide from ${number(range.low)} to ${number(range.high)} ${range.unit}. Logarithmic axis from ${number(low)} to ${number(high)} ${range.unit}; the line is thinner outside the typical range.`)
    bar.title = bar.getAttribute('aria-label')!
  }
}
