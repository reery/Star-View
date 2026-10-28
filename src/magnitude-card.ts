import { MAGNITUDE_VISIBILITY_GUIDES } from './magnitude-properties'
export { magnitudeCardAvailable, MAGNITUDE_VISIBILITY_GUIDES, NAKED_EYE_MAGNITUDE } from './magnitude-properties'
import { Eye, Sun, createElement } from 'lucide'
import { starDisplayColor, type StarColorMode } from './astronomy'
import type { Star } from './catalog-model'
import { catalogSourceFor } from './catalog-source'
import { renderComparisonName } from './comparison-tiles'
import { MISSING_VALUE } from './format'
import { attachPopoverTooltip } from './popover-tooltips'

type MagnitudeKind = 'absolute' | 'apparent'
const CITY_VISIBILITY_STORAGE_KEY = 'star-view-magnitude-city'
type VisibilityGuide = typeof MAGNITUDE_VISIBILITY_GUIDES[number]
const DEFAULT_VISIBILITY_GUIDE = MAGNITUDE_VISIBILITY_GUIDES[1]

export function initializeMagnitudeVisibility(card: HTMLElement, onChange: () => void, signal: AbortSignal): void {
  let city = false
  try { city = localStorage.getItem(CITY_VISIBILITY_STORAGE_KEY) === 'true' } catch {}
  card.dataset.defaultVisibilityGuide = city ? 'city' : 'eye'
  card.dataset.visibilityGuide = card.dataset.defaultVisibilityGuide
  const controls = card.querySelector<HTMLElement>('#magnitude-visibility-controls')!
  controls.replaceChildren(...MAGNITUDE_VISIBILITY_GUIDES.map((guide) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'icon-button magnitude-visibility-button'
    button.dataset.visibility = guide.id
    const label = `${guide.name} visibility (about +${guide.limit})`
    button.setAttribute('aria-label', label)
    button.setAttribute('aria-pressed', String(guide.id === card.dataset.visibilityGuide))
    button.setAttribute('aria-controls', 'magnitude-apparent-scale')
    const tooltip = document.createElement('span')
    tooltip.id = `magnitude-${guide.id}-tooltip`
    tooltip.className = 'tooltip mass-metric-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    tooltip.textContent = `${label}. ${guide.detail}`
    attachPopoverTooltip(button, tooltip, true)
    button.append(createElement(guide.icon, { width: 20, height: 20, 'stroke-width': 1.7, 'aria-hidden': 'true' }), tooltip)
    button.addEventListener('click', () => {
      card.dataset.visibilityGuide = guide.id
      // Remember city observing conditions; instrument guides remain per-object choices.
      card.dataset.defaultVisibilityGuide = guide.id === 'city' ? 'city' : 'eye'
      try { localStorage.setItem(CITY_VISIBILITY_STORAGE_KEY, String(guide.id === 'city')) } catch {}
      onChange()
    }, { signal })
    return button
  }))
}
const finiteMagnitude = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)
export const magnitudeNumber = (value: number | null | undefined): string => !finiteMagnitude(value) ? MISSING_VALUE
  : `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

/** Equal-distance visible brightness, using adopted V magnitudes rather than bolometric L. */
export function magnitudeBrightnessRatio(selected: number | null | undefined, reference: number | null | undefined): number | null {
  if (!finiteMagnitude(selected) || !finiteMagnitude(reference)) return null
  const ratio = 10 ** (0.4 * (reference - selected))
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null
}

type Variability = NonNullable<NonNullable<Star['stellar_observations']>['variability']>
// GCVS 5.1 variability classes; suffixes such as /SD only refine eclipsing geometry.
const VARIABILITY_TYPES: Readonly<Record<string, string>> = {
  ACV: 'α² CVn magnetic star', ACVO: 'Rapidly oscillating Ap star', ACYG: 'α Cygni pulsation', BCEP: 'β Cephei pulsation',
  BE: 'Be star', BY: 'BY Draconis starspots', CEP: 'Cepheid', DCEP: 'Classical Cepheid', DCEPS: 'Overtone Cepheid',
  DSCT: 'δ Scuti pulsation', DSCTC: 'Low-amplitude δ Scuti', E: 'Eclipsing binary', EA: 'Algol-type eclipsing binary',
  EB: 'β Lyrae-type eclipsing binary', EW: 'W UMa-type eclipsing binary', ELL: 'Ellipsoidal binary', FKCOM: 'FK Comae rapid rotator',
  GCAS: 'γ Cassiopeiae eruptive star', GDOR: 'γ Doradus pulsation', INS: 'Orion-type young star', L: 'Slow irregular',
  LB: 'Slow irregular giant', LC: 'Irregular supergiant', LPB: 'Slowly pulsating B star', M: 'Mira', NL: 'Nova-like binary',
  RS: 'RS CVn active binary', SRA: 'Semiregular giant', SRB: 'Semiregular giant', SRC: 'Semiregular supergiant',
  SRD: 'Semiregular yellow giant', SXARI: 'SX Arietis magnetic star', UG: 'Dwarf nova', UV: 'Flare star',
  ZZA: 'ZZ Ceti pulsating white dwarf', unique: 'Unique variable',
}
const PHOTOMETRIC_SYSTEMS: Readonly<Record<string, string>> = { Hp: 'Hipparcos Hp', Ic: 'Cousins I' }
const uncertain = (flag: true | undefined) => flag ? ' (uncertain)' : ''

/** V-band brightest and faintest GCVS magnitudes, the only range drawn on the apparent V scale. */
export function variabilityRange(variability: Variability | undefined): [number, number] | null {
  if (!variability || variability.system !== 'V' || variability.min_system) return null
  const faint = variability.min_mag ?? variability.max_mag + variability.amplitude_mag!
  return [variability.max_mag, faint]
}

export function variabilitySummary(variability: Variability): { range: string; detail: string } {
  const system = (code: string) => PHOTOMETRIC_SYSTEMS[code] ?? code
  const range = variability.min_mag === undefined
    ? `${magnitudeNumber(variability.max_mag)}${uncertain(variability.max_uncertain)}, amplitude ${variability.amplitude_mag!.toLocaleString('en-US')} mag`
    : `${magnitudeNumber(variability.max_mag)}${uncertain(variability.max_uncertain)} to ${magnitudeNumber(variability.min_mag)}${uncertain(variability.min_uncertain)}`
  const type = variability.type.split('+').map((part) => {
    const code = part.replace(':', '').split('/')[0]!
    return `${VARIABILITY_TYPES[code] ?? code}${uncertain(part.endsWith(':') || undefined)}`
  }).join(' + ')
  const period = variability.period_days
  const periodText = period === undefined ? '' : ` · period ${period < 1
    ? `${(period * 24).toLocaleString('en-US', { maximumSignificantDigits: 3 })} h`
    : `${period.toLocaleString('en-US', { maximumSignificantDigits: 4 })} days`}${uncertain(variability.period_uncertain)}`
  return { range, detail: ` ${system(variability.system)}${variability.min_system ? ` (minimum in ${system(variability.min_system)})` : ''} · ${type}${periodText}` }
}

export interface MagnitudePoint {
  id: string
  name: string
  value: number
  object?: Star
  selected?: boolean
  origin?: boolean
}

/** Only adopted individual magnitudes can enter a comparison scale. */
/** With a comparison star, it replaces the origin and is never labeled as the origin. */
export function magnitudePoints(kind: MagnitudeKind, star: Star, mapOrigin: Star, sun: Star, sirius?: Star, other?: Star): MagnitudePoint[] {
  const comparing = other !== undefined
  const origin = other ?? mapOrigin
  const field = kind === 'absolute' ? 'absolute_mag' : 'apparent_mag'
  const objects = [sun, ...(origin.id !== sun.id ? [origin] : []), star]
  const points = new Map<string, MagnitudePoint>()
  for (const object of objects) {
    if (kind === 'apparent' && object.id === sun.id && (!comparing || star.id !== sun.id && origin.id !== sun.id)) continue
    const value = object[field]
    if (!finiteMagnitude(value)) continue
    points.set(object.id, { id: object.id, name: object.name, value, object,
      selected: object.id === star.id, origin: !comparing && object.id === origin.id && origin.id !== sun.id })
  }
  if (kind === 'apparent') {
    // Fixed Earth-view benchmarks, independent of the active catalog.
    if (!points.has('sirius-a')) points.set('sirius-a', { id: 'sirius-a', name: 'Sirius', value: -1.46, object: sirius })
    points.set('venus', { id: 'venus', name: 'Venus', value: -4.9 })
  }
  return [...points.values()]
}

export function magnitudeAxis(kind: MagnitudeKind, values: number[]) {
  const valid = values.filter(Number.isFinite)
  const step = kind === 'absolute' ? 5 : 2
  const faint = Math.max(kind === 'absolute' ? 25 : 16, ...valid.map((value) => Math.ceil((value + 1) / step) * step))
  const bright = Math.min(kind === 'absolute' ? -10 : -6, ...valid.map((value) => Math.floor((value - 1) / step) * step))
  return { faint, bright, position: (value: number) => (faint - value) / (faint - bright) * 100 }
}

function renderScale(card: HTMLElement, kind: MagnitudeKind, points: MagnitudePoint[], sun: Star, colorMode: StarColorMode, visibility: VisibilityGuide): void {
  const scale = card.querySelector<HTMLElement>(`#magnitude-${kind}-scale`)!
  const plot = scale.querySelector<HTMLElement>('.magnitude-plot')!
  plot.replaceChildren()
  const track = document.createElement('div')
  track.className = 'mass-ratio-track'
  plot.append(track)
  const ranges = kind === 'apparent' ? points.flatMap((point) => {
    const range = variabilityRange(point.object?.stellar_observations?.variability)
    return range ? [{ point, range }] : []
  }) : []
  const axis = magnitudeAxis(kind, [...points.map(({ value }) => value), ...ranges.flatMap(({ range }) => range), ...(kind === 'apparent' ? [visibility.limit] : [])])
  const set = (suffix: string, label: string, value: number) => {
    const caption = document.createElement('span')
    caption.textContent = label
    const number = document.createElement('span')
    number.textContent = magnitudeNumber(value)
    card.querySelector<HTMLElement>(`#magnitude-${kind}-${suffix}`)!.replaceChildren(caption, number)
  }
  set('faint', 'Fainter', axis.faint)
  set('bright', 'Brighter', axis.bright)
  if (kind === 'apparent') {
    const band = document.createElement('span')
    band.className = 'magnitude-visible-band'
    const faintPosition = axis.position(visibility.limit)
    band.style.left = `${faintPosition}%`
    band.style.setProperty('--magnitude-visibility-fade-end', `${(axis.position(visibility.fadeStart) - faintPosition) / (100 - faintPosition) * 100}%`)
    band.setAttribute('aria-hidden', 'true')
    track.append(band)
    const limit = document.createElement('span')
    limit.className = 'magnitude-visibility-limit'
    limit.style.left = band.style.left
    limit.setAttribute('aria-hidden', 'true')
    track.append(limit)
  }
  for (const { point, range: [bright, faint] } of ranges) {
    const band = document.createElement('span')
    band.className = 'magnitude-variability-range'
    band.style.left = `${axis.position(faint)}%`
    band.style.width = `${axis.position(bright) - axis.position(faint)}%`
    band.style.setProperty('--magnitude-marker-color', starDisplayColor(point.object!, colorMode).getStyle())
    band.setAttribute('aria-hidden', 'true')
    track.append(band)
  }
  const labels: { label: HTMLElement; tick: HTMLElement; position: number }[] = []
  for (const point of [...points].sort((a, b) => b.value - a.value)) {
    const tick = document.createElement('span')
    tick.className = `mass-scale-tick magnitude-marker${point.selected ? ' magnitude-selected' : ''}`
    tick.dataset.objectId = point.id
    if (point.origin) tick.dataset.origin = 'true'
    tick.setAttribute('aria-hidden', 'true')
    const position = axis.position(point.value)
    tick.style.left = `${position}%`
    // A catalog-independent Sirius reference retains an A-star color.
    const object = point.object ?? (point.id === 'sirius-a' ? { ...sun, temperature_k: 9940, spectral_type: 'A1V' } : null)
    tick.style.setProperty('--magnitude-marker-color', object ? starDisplayColor(object, colorMode).getStyle() : 'var(--ink)')
    const label = document.createElement('span')
    const name = document.createElement('span')
    name.textContent = `${point.name}${point.origin ? ' · origin' : ''}`
    label.append(name)
    if (!point.selected) {
      const value = document.createElement('small')
      value.textContent = magnitudeNumber(point.value)
      label.append(document.createTextNode(' '))
      label.append(value)
    }
    tick.append(label)
    track.append(tick)
    labels.push({ label, tick, position })
  }
  // Labels sit next to their ticks; a thin connector preserves the association in a second row.
  const width = track.getBoundingClientRect().width
  scale.style.setProperty('--magnitude-label-max', `${width}px`)
  const occupied: [number, number][][] = []
  for (const { label, tick, position } of labels) {
    const labelWidth = Math.min(width, label.getBoundingClientRect().width)
    const anchor = position / 100 * width
    const left = Math.max(0, Math.min(width - labelWidth, anchor - labelWidth / 2))
    label.style.transform = `translateX(${left - anchor}px)`
    let lane = 0
    while (occupied[lane]?.some(([start, end]) => left < end + 10 && left + labelWidth + 10 > start)) lane++
    const intervals = occupied[lane] ??= []
    intervals.push([left, left + labelWidth])
    tick.style.setProperty('--magnitude-label-lane', String(lane))
  }
  scale.style.setProperty('--magnitude-label-lanes', String(Math.max(1, occupied.length)))
  scale.setAttribute('aria-label', `${kind === 'absolute' ? 'Absolute V magnitude at 10 parsecs' : 'Apparent V magnitude from Earth'}. ${kind === 'apparent' ? 'Nighttime scale: ' : ''}fainter ${magnitudeNumber(axis.faint)} to brighter ${magnitudeNumber(axis.bright)}. ${points.map((point) => `${point.name}${point.selected ? ', selected' : ''}${point.origin ? ', origin' : ''}: ${magnitudeNumber(point.value)}`).join('; ')}.${ranges.map(({ point, range: [bright, faint] }) => ` ${point.name} varies from ${magnitudeNumber(bright)} to ${magnitudeNumber(faint)}.`).join('')}${kind === 'apparent' ? ` ${visibility.name} brightness band: approximately +${visibility.limit} or brighter, fading between +${visibility.fadeStart} and +${visibility.limit}. ${visibility.detail}` : ''}`)
}

function renderComparisonValues(card: HTMLElement, kind: MagnitudeKind, star: Star, other: Star | undefined, colorMode: StarColorMode): void {
  const grid = card.querySelector<HTMLElement>(`#magnitude-${kind}-comparison`)!
  grid.hidden = !other
  grid.replaceChildren()
  card.querySelector<HTMLElement>(`#magnitude-${kind}-value`)!.hidden = Boolean(other)
  card.querySelector<HTMLElement>(`#magnitude-${kind}-icon`)!.hidden = Boolean(other)
  if (!other) return

  for (const object of [star, other]) {
    const tile = document.createElement('div')
    tile.className = 'planet-fact-tile magnitude-comparison-tile'
    tile.dataset.objectId = object.id
    tile.setAttribute('role', 'group')
    tile.setAttribute('aria-label', `${object.name} · ${kind} V magnitude`)
    const heading = document.createElement('span')
    heading.className = 'magnitude-factor-name'
    renderComparisonName(heading, object, colorMode)
    const quantity = document.createElement('div')
    quantity.className = 'magnitude-tile-quantity'
    const value = document.createElement('strong')
    value.textContent = magnitudeNumber(object[kind === 'absolute' ? 'absolute_mag' : 'apparent_mag'])
    quantity.append(createElement(kind === 'absolute' ? Sun : Eye, { width: 20, height: 20, 'stroke-width': 1.7, 'aria-hidden': 'true' }), value)
    tile.append(heading, quantity)
    grid.append(tile)
  }
}

function renderVariability(card: HTMLElement, star: Star, other: Star | undefined): void {
  const variable = [star, ...other ? [other] : []].filter((object) => object.stellar_observations?.variability)
  const container = card.querySelector<HTMLElement>('#magnitude-variability')!
  container.hidden = variable.length === 0
  container.replaceChildren(...variable.map((object) => {
    const { range, detail } = variabilitySummary(object.stellar_observations!.variability!)
    const line = document.createElement('p')
    line.className = 'magnitude-visible-comparison'
    const value = document.createElement('strong')
    value.textContent = range
    line.append(...other ? [`${object.name}: `] : [], value, detail)
    return line
  }))
}

export function renderMagnitudeCard(card: HTMLElement, star: Star, mapOrigin: Star, sun: Star, colorMode: StarColorMode, sirius?: Star, other?: Star): void {
  const comparing = other !== undefined
  const origin = other ?? mapOrigin
  card.classList.toggle('has-comparison', comparing)
  const visibility = MAGNITUDE_VISIBILITY_GUIDES.find((guide) => guide.id === card.dataset.visibilityGuide) ?? DEFAULT_VISIBILITY_GUIDE
  for (const button of card.querySelectorAll<HTMLButtonElement>('[data-visibility]')) {
    button.setAttribute('aria-pressed', String(button.dataset.visibility === visibility.id))
  }
  const comparison = card.querySelector<HTMLElement>('#magnitude-visible-comparison')!
  const reference = comparing ? origin : sun
  const ratio = magnitudeBrightnessRatio(star.absolute_mag, reference.absolute_mag)
  comparison.hidden = ratio === null || star.id === reference.id
  if (!comparison.hidden) {
    const amount = ratio! >= 1 ? ratio! : 1 / ratio!
    const value = amount.toLocaleString('en-US', { maximumSignificantDigits: 3, notation: amount >= 1e6 ? 'compact' : 'standard' })
    card.querySelector<HTMLElement>('#magnitude-visible-ratio')!.textContent = ratio! >= 1 ? `${value}×` : `1/${value}`
    card.querySelector<HTMLElement>('#magnitude-visible-reference')!.textContent = `${ratio! >= 1 ? ' ' : ' of '}${comparing ? `${origin.name}’s` : 'the Sun’s'} visible brightness`
  }
  for (const kind of ['absolute', 'apparent'] as const) {
    const field = kind === 'absolute' ? 'absolute_mag' : 'apparent_mag'
    if (!other) card.querySelector<HTMLElement>(`#magnitude-${kind}-value`)!.textContent = magnitudeNumber(star[field])
    renderComparisonValues(card, kind, star, other, colorMode)
    const notes: string[] = []
    if (!finiteMagnitude(star[field])) {
      notes.push(`Individual ${kind} V magnitude unavailable.`)
      const unresolved = kind === 'apparent' ? star.unresolved_photometry : undefined
      const source = catalogSourceFor(star, field)
      if (unresolved) notes.push(`Preserved system photometry: ${magnitudeNumber(unresolved.magnitude_v)}. ${unresolved.scope}.`)
      else if (source) notes.push(`Preserved catalog value: ${magnitudeNumber(source.record[field])}. ${source.scope}.`)
    }
    if (origin.id !== sun.id && origin.id !== star.id && !finiteMagnitude(origin[field])) notes.push(`${origin.name}: ${kind} V magnitude unavailable.`)
    if (kind === 'apparent') renderVariability(card, star, other)
    const note = card.querySelector<HTMLElement>(`#magnitude-${kind}-note`)!
    note.textContent = notes.join(' ')
    note.hidden = notes.length === 0
    renderScale(card, kind, magnitudePoints(kind, star, mapOrigin, sun, sirius, other), sun, colorMode, visibility)
  }
}
