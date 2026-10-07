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
  set('radius-typical-context', !range ? 'No typical radius range is assigned to this catalog classification.'
    : selected.radiusKm === null ? 'A catalog radius is needed for the typical-size comparison.'
      : typicalRadiusPosition(selected.radiusKm, range).description)
  get('radius-typical-context').hidden = !get('radius-typical-context').textContent
  set('radius-typical-method', range ? `${range.label}: approximately ${number(range.low)}–${number(range.high)} ${range.unit}. ${range.note}` : '')
  if (range) {
    const source = get('radius-typical-source') as HTMLAnchorElement
    source.href = range.source
    source.textContent = `${range.sourceLabel} ↗`
  }
  if (available) {
    const { position, description } = typicalRadiusPosition(selected.radiusKm!, range)
    const bar = get('radius-typical-bar')
    bar.style.setProperty('--mass-ratio-position', `${position}%`)
    set('radius-typical-low', `${number(range.low)} ${range.unit}`)
    set('radius-typical-mid', `${number(Math.sqrt(range.low * range.high))} ${range.unit}`)
    set('radius-typical-high', `${number(range.high)} ${range.unit}`)
    bar.setAttribute('aria-label', `${star.name}: ${number(selected.radiusKm! / range.radiusKmPerUnit)} ${range.unit}.${description ? ` ${description}.` : ''} Typical ${range.label.toLowerCase()} radius guide from ${number(range.low)} to ${number(range.high)} ${range.unit} on a logarithmic scale; outside values are marked at the nearest end.`)
    bar.title = bar.getAttribute('aria-label')!
  }
}
