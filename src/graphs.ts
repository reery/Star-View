import { ChartBar, ChartColumn, ChevronUp, ChevronsDownUp, ChevronsUpDown, Sun, createElement, type IconNode } from 'lucide'
import { LIGHT_YEARS_PER_PARSEC, starDisplayColor, type DistanceUnit, type StarColorMode } from './astronomy'
import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model'
import { MAGNITUDE_VISIBILITY_GUIDES } from './magnitude-properties'
import { luminosityRows, mkPoint, whiteDwarfClassification, whiteDwarfFamilies } from './mk-properties'
import { FILTER_CATEGORIES, filterKeyForObject, type FilterKey } from './object-filter'
import type { StarSystem } from './star-systems'

/** Distances are from the current reference, as in the object list. */
type ObjectTest = (star: Star, distancePc: number) => boolean
interface GraphItem { star: Star; distancePc: number }
interface GraphOptions {
  items: readonly GraphItem[]
  onFilter(test: ObjectTest | null): void
  sun: Star | undefined
  referenceName: string
  systems: ReadonlyMap<string, StarSystem>
  distanceUnit: DistanceUnit
  colorMode: StarColorMode
}
interface GraphContext extends GraphOptions { objects: readonly Star[]; stellar: readonly Star[]; logScale: boolean }
/** A collapsible graph inside a topic; topics can hold several. `scalable` graphs switch between log and linear axes. */
interface GraphSection { id: string; title: string | ((context: GraphContext) => string); icon: IconNode; scalable?: boolean; render(context: GraphContext): Node[] }
interface GraphTopic { id: string; title: string; sections: GraphSection[] }
/** A clickable bar or column that narrows the view to the objects it counts. */
interface Selection { key: string; label: string; test: ObjectTest; range?: readonly [number, number] }
/** A selection without its test, as kept in saved views; open histogram ends are null. */
export interface SavedGraphSelection { section: string; key: string; label: string; range?: readonly [number | null, number | null] }
interface BarRow { label: string; value: number; scale: number; text: string; share?: string; color?: string; select?: Selection }
interface Histogram {
  values: number[]
  /** Range text for one bin, from its lower and upper edge. */
  label(low: number, high: number): string
  ticks(min: number, max: number): number[]
  tick(value: number): string
  /** Values below this edge join the first bin, such as the Sun's apparent magnitude. */
  floor?: number
  color?(center: number): string
  markers?: { value: number; icon: IconNode; label: string }[]
  /** Tests one bin, from `low` (inclusive) to `high` (exclusive); open ends are infinite. */
  select?(low: number, high: number): ObjectTest
  /** Values are log10 of a quantity whose selections save linear ends, so they survive a scale switch. */
  linearRanges?: boolean
}

const typeLabels = new Map<FilterKey, string>(FILTER_CATEGORIES.flatMap((category) => category.subtypes.map(({ key, label }) => [key, label] as const)))
const spectralGroups = ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'L', 'T', 'Y', 'D'] as const
const multiplicityLabels = ['Single', 'Binary', 'Triple', 'Quadruple', '5+ components']
const svg = (icon: IconNode, size = 20) => createElement(icon, { width: size, height: size, 'stroke-width': 1.7, 'aria-hidden': 'true' })
const number = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: 3 }).replace('-', '−')
const isStellar = (star: Star) => STELLAR_OBJECT_TYPES.includes(star.type as never)
const selections = new WeakMap<Element, Selection>()
// Histogram columns rebuild a saved range, whose bins may differ once restored.
const rangeTests = new WeakMap<Element, (low: number, high: number) => ObjectTest>()

function groupBy<K>(objects: readonly Star[], key: (star: Star) => K | null): Map<K, Star[]> {
  const groups = new Map<K, Star[]>()
  for (const object of objects) {
    const value = key(object)
    if (value === null) continue
    const members = groups.get(value)
    if (members) members.push(object)
    else groups.set(value, [object])
  }
  return groups
}

/** The median-temperature member gives a group its typical scene color. */
function typicalMember(members: readonly Star[]): Star {
  const ranked = members.filter((member) => member.temperature_k !== null).sort((a, b) => a.temperature_k! - b.temperature_k!)
  return ranked[ranked.length >> 1] ?? members[0]!
}

/** The Sun counts as a star. */
function objectType(star: Pick<Star, 'id' | 'type'>): FilterKey {
  const key = filterKeyForObject(star)
  return key === 'sun' ? 'star' : key
}

/** Counts objects per filter type, largest first. */
export function objectTypeCensus(objects: readonly Star[]) {
  return [...groupBy(objects, objectType)].map(([type, members]) => ({ type, label: typeLabels.get(type)!, count: members.length, typical: typicalMember(members) }))
    .sort((a, b) => b.count - a.count)
}

/** Harvard class letter; white dwarfs form the D class. Subdwarf and Am (k…h…m…) prefixes are skipped. */
export function spectralGroup(star: Pick<Star, 'type' | 'spectral_type'>): typeof spectralGroups[number] | null {
  if (star.type === 'white_dwarf') return 'D'
  if (!STELLAR_OBJECT_TYPES.includes(star.type as never)) return null
  return (star.spectral_type?.trim().match(/^(?:e?sd|usd|d|k)?([OBAFGKMLTY])/)?.[1] as typeof spectralGroups[number] | undefined) ?? null
}

/** Ranges such as IV–V count with their first class; Iab and plain I join Ib. */
function luminosityGroup(star: Star): string | null {
  if (star.type !== 'star') return null
  const luminosityClass = mkPoint(star)?.luminosityClass.split('–')[0]
  return luminosityClass === 'Iab' || luminosityClass === 'I' ? 'Ib' : luminosityClass ?? null
}

/** A system counts with all its known components, capped at five. */
const multiplicity = (star: Star, systems: ReadonlyMap<string, StarSystem>) => Math.min(systems.get(star.id)?.components.length ?? 1, 5) - 1
const spectralLabel = (group: string) => group === 'D' ? 'D · white dwarfs' : group

/** Rounds up to 1, 2 or 5 × 10ⁿ so a range splits into at most `count` steps. */
function niceStep(range: number, count: number): number {
  const raw = Math.max(range, 1e-9) / count
  const power = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].map((factor) => factor * power).find((step) => step >= raw)!
}

const linearTicks = (min: number, max: number) => {
  const step = niceStep(max - min, 4)
  return Array.from({ length: Math.floor(max / step) - Math.ceil(min / step) + 1 }, (_, index) => (Math.ceil(min / step) + index) * step)
}
/** Decades, with 3× steps when fewer than three decades fit. */
const logTicks = (min: number, max: number) => {
  const decades = Array.from({ length: Math.floor(max) - Math.floor(min) + 1 }, (_, index) => Math.floor(min) + index)
  const ticks = decades.filter((decade) => decade >= min).length < 3 ? decades.flatMap((decade) => [decade, decade + Math.log10(3)]) : decades
  return ticks.filter((tick) => tick >= min - 1e-9 && tick <= max + 1e-9)
}

function missingNote(count: number, text: string): Node[] {
  if (!count) return []
  const note = document.createElement('p')
  note.className = 'filter-hint'
  note.textContent = `${count.toLocaleString('en-US')} ${count === 1 ? 'object' : 'objects'} without ${text}.`
  return [note]
}

/** A bar or column becomes a toggle button when it can narrow the view. */
function selectable<K extends keyof HTMLElementTagNameMap>(tag: K, select: Selection | undefined): HTMLElementTagNameMap[K] | HTMLButtonElement {
  if (!select) return document.createElement(tag)
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.select = select.key
  button.setAttribute('aria-pressed', 'false')
  selections.set(button, select)
  return button
}

function bars(rows: readonly BarRow[]): Node[] {
  return rows.map(({ label, value, scale, text, share, color, select }) => {
    const row = selectable('div', select)
    row.classList.add('graph-bar-row')
    const name = document.createElement('span')
    name.textContent = label
    name.title = label
    const track = document.createElement('span')
    track.className = 'mass-ratio-track'
    track.setAttribute('aria-hidden', 'true')
    const fill = document.createElement('span')
    fill.className = 'planet-ratio-fill'
    fill.style.width = `${scale ? value / scale * 100 : 0}%`
    if (color) fill.style.background = color
    track.append(fill)
    const valueText = document.createElement('span')
    valueText.className = 'graph-bar-value'
    valueText.append(text)
    if (share) valueText.append(' ', Object.assign(document.createElement('small'), { textContent: share }))
    row.append(name, track, valueText)
    return row
  })
}

const percent = (count: number, total: number) => `${(count / total * 100).toLocaleString('en-US', { maximumSignificantDigits: 2 })}%`

/** Counted groups as bars scaled to the largest one. */
function countBars(groups: readonly { label: string; count: number; color?: string; select?: Selection }[], total: number): Node[] {
  const max = Math.max(...groups.map(({ count }) => count))
  return bars(groups.map(({ label, count, color, select }) => ({ label, value: count, scale: max, text: count.toLocaleString('en-US'), share: percent(count, total), color, select })))
}

function histogram({ values, label, ticks, tick, floor = -Infinity, color, markers = [], select, linearRanges }: Histogram): HTMLElement {
  const clamped = values.map((value) => Math.max(value, floor))
  const low = Math.min(...clamped), high = Math.max(...clamped)
  // Aim for about 40 equal bins; a single value still gets one.
  const step = niceStep(high - low, 40)
  const min = Math.floor(low / step) * step
  const bins = Math.max(1, Math.ceil((high - min) / step - 1e-9))
  const max = min + bins * step
  const counts = new Array<number>(bins).fill(0)
  for (const value of clamped) counts[Math.min(bins - 1, Math.floor((value - min) / step + 1e-9))]!++
  const peak = Math.max(...counts)
  const belowFloor = values.some((value) => value < floor)
  const position = (value: number) => `${(value - min) / (max - min) * 100}%`

  const chart = document.createElement('div')
  chart.className = 'graph-histogram'
  const columns = document.createElement('div')
  columns.className = 'graph-columns'
  if (select) rangeTests.set(columns, linearRanges ? (low, high) => select(...[low, high].map((end) => end > 0 ? Math.log10(end) : -Infinity) as [number, number]) : select)
  columns.append(...counts.map((count, index) => {
    const binLow = min + index * step
    const range = label(index === 0 && belowFloor ? -Infinity : binLow, binLow + step)
    // Empty bins have nothing to show, and the outer bins also hold values on their open side.
    const binRange = [index === 0 ? -Infinity : binLow, index === bins - 1 ? Infinity : binLow + step] as const
    const bin = selectable('span', select && count ? { key: binLow.toPrecision(12), label: range, test: select(...binRange), range: linearRanges ? binRange.map((end) => 10 ** end) as [number, number] : binRange } : undefined)
    bin.classList.add('graph-bin')
    bin.dataset.range = range
    bin.dataset.count = countText(count)
    bin.setAttribute('aria-label', `${range} · ${bin.dataset.count}`)
    const fill = document.createElement('i')
    fill.style.height = `${count / peak * 100}%`
    if (color) fill.style.background = color(binLow + step / 2)
    bin.append(fill)
    return bin
  }), ...markers.filter(({ value }) => value >= min && value <= max).map(({ value, icon, label: markerLabel }) => {
    const marker = document.createElement('span')
    marker.className = 'graph-marker'
    marker.style.left = position(value)
    marker.title = markerLabel
    marker.append(svg(icon, 12), document.createElement('i'))
    return marker
  }))
  const axis = document.createElement('div')
  axis.className = 'graph-axis'
  axis.setAttribute('aria-hidden', 'true')
  axis.append(...ticks(min, max).map((value) => {
    const label = document.createElement('span')
    label.textContent = tick(value)
    label.style.left = position(value)
    // Keep the outermost labels inside the card.
    label.style.transform = `translateX(${value <= min ? 0 : value >= max ? -100 : -50}%)`
    return label
  }))
  // One shared tooltip follows the hovered or focused column.
  const tooltip = document.createElement('span')
  tooltip.className = 'tooltip mass-metric-tooltip constellation-tooltip'
  tooltip.setAttribute('aria-hidden', 'true')
  const tooltipRange = document.createElement('strong'), tooltipCount = document.createElement('span')
  tooltip.append(tooltipRange, tooltipCount)
  const showTooltip = (event: Event) => {
    const bin = event.target instanceof Element ? event.target.closest<HTMLElement>('.graph-bin') : null
    if (!bin) return
    tooltipRange.textContent = bin.dataset.range!
    tooltipCount.textContent = bin.dataset.count!
    tooltip.classList.add('is-visible')
    const chartBounds = chart.getBoundingClientRect(), fillBounds = bin.firstElementChild!.getBoundingClientRect()
    const center = fillBounds.left + fillBounds.width / 2 - chartBounds.left
    const left = Math.max(0, Math.min(chartBounds.width - tooltip.offsetWidth, center - tooltip.offsetWidth / 2))
    tooltip.style.left = `${left}px`
    tooltip.style.top = `${fillBounds.top - chartBounds.top - 8}px`
    tooltip.style.setProperty('--constellation-tooltip-arrow', `${Math.max(10, Math.min(tooltip.offsetWidth - 18, center - left - 4))}px`)
  }
  const hideTooltip = () => tooltip.classList.remove('is-visible')
  columns.addEventListener('pointerover', showTooltip)
  columns.addEventListener('pointerleave', hideTooltip)
  columns.addEventListener('focusin', showTooltip)
  columns.addEventListener('focusout', hideTooltip)
  columns.addEventListener('click', hideTooltip)
  chart.append(columns, axis, tooltip)
  return chart
}

const countText = (count: number) => `${count.toLocaleString('en-US')} ${count === 1 ? 'object' : 'objects'}`
const sunMarker = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? [{ value, icon: Sun, label: 'Sun' }] : []
const inRange = (value: number | null | undefined, low: number, high: number) => typeof value === 'number' && Number.isFinite(value) && value >= low && value < high

function objectTypeBars({ objects, colorMode }: GraphContext): Node[] {
  return countBars(objectTypeCensus(objects).map(({ type, label, count, typical }) => ({
    label, count, color: starDisplayColor(typical, colorMode).getStyle(),
    select: { key: type, label, test: (star) => objectType(star) === type },
  })), objects.length)
}

function spectralClassBars({ stellar, colorMode }: GraphContext): Node[] {
  const groups = groupBy(stellar, spectralGroup)
  const classified = [...groups.values()].reduce((sum, members) => sum + members.length, 0)
  return [
    ...countBars(spectralGroups.filter((group) => groups.has(group)).map((group) => ({
      label: spectralLabel(group), count: groups.get(group)!.length,
      color: starDisplayColor(typicalMember(groups.get(group)!), colorMode).getStyle(),
      select: { key: group, label: group, test: (star) => spectralGroup(star) === group },
    })), classified),
    ...missingNote(stellar.length - classified, 'a spectral class'),
  ]
}

function distanceHistogram({ items, distanceUnit, referenceName, logScale }: GraphContext): Node[] {
  const scale = distanceUnit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1
  if (logScale) {
    // The reference object and anything within 1 unit join the first bin.
    const value = (distancePc: number) => distancePc > 0 ? Math.log10(distancePc * scale) : -Infinity
    return [histogram({
      values: items.map(({ distancePc }) => value(distancePc)), floor: 0, linearRanges: true,
      label: (low, high) => `${low === -Infinity ? 'Within' : `${number(10 ** low)} to`} ${number(10 ** high)} ${distanceUnit} ${low === -Infinity ? 'of' : 'from'} ${referenceName}`,
      ticks: logTicks, tick: (tick) => number(10 ** tick),
      select: (low, high) => (_, distancePc) => value(distancePc) >= low && value(distancePc) < high,
    })]
  }
  return [histogram({
    values: items.map(({ distancePc }) => distancePc * scale),
    label: (low, high) => `${number(low)} to ${number(high)} ${distanceUnit} from ${referenceName}`,
    ticks: linearTicks, tick: number,
    select: (low, high) => (_, distancePc) => inRange(distancePc * scale, low, high),
  })]
}

function multiplicityBars({ stellar, systems }: GraphContext): Node[] {
  // A system counts once when any member is shown.
  const counted = new Set<string>()
  const counts = multiplicityLabels.map(() => 0)
  for (const star of stellar) {
    const system = systems.get(star.id)
    if (system && counted.has(system.id)) continue
    if (system) counted.add(system.id)
    counts[multiplicity(star, systems)]!++
  }
  const total = counts.reduce((sum, count) => sum + count, 0)
  return countBars(multiplicityLabels.map((label, index) => ({
    label, count: counts[index]!,
    select: { key: label, label, test: (star: Star) => isStellar(star) && multiplicity(star, systems) === index },
  })).filter(({ count }) => count), total)
}

function planetHostBars({ stellar, colorMode }: GraphContext): Node[] {
  const isHost = (star: Star) => (star.known_planets ?? 0) > 0
  const groups = groupBy(stellar, spectralGroup)
  const row = (key: string, label: string, members: readonly Star[], test: ObjectTest, color?: string): BarRow => {
    const count = members.filter(isHost).length
    return {
      label, value: count, scale: members.length, color, select: count ? { key, label: `${label} hosts`, test } : undefined,
      text: `${count.toLocaleString('en-US')} / ${members.length.toLocaleString('en-US')}`, share: percent(count, members.length),
    }
  }
  return bars([
    row('all', 'All', stellar, (star) => isStellar(star) && isHost(star)),
    ...spectralGroups.filter((group) => groups.has(group)).map((group) => row(group, spectralLabel(group), groups.get(group)!,
      (star) => isHost(star) && spectralGroup(star) === group, starDisplayColor(typicalMember(groups.get(group)!), colorMode).getStyle())),
  ])
}

function propertyHistogram(stellar: readonly Star[], value: (star: Star) => number | null | undefined, missing: string, options: Omit<Histogram, 'values' | 'select'>): Node[] {
  const values = stellar.map(value).filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry))
  if (!values.length) return missingNote(stellar.length, missing)
  const select = (low: number, high: number): ObjectTest => (star) => isStellar(star) && inRange(value(star), low, high)
  return [histogram({ ...options, values, select }), ...missingNote(stellar.length - values.length, missing)]
}

const logRange = (unit: string) => (low: number, high: number) => `${number(10 ** low)} to ${number(10 ** high)} ${unit}`
const magnitudeRange = (low: number, high: number) => `${low === -Infinity ? 'Brighter than' : `${number(low)} to`} ${number(high)} mag`
const logValue = (value: number | null | undefined) => value && value > 0 ? Math.log10(value) : null

function massHistogram({ stellar, sun }: GraphContext): Node[] {
  return propertyHistogram(stellar, (star) => logValue(star.mass_solar), 'a mass', {
    label: logRange('M☉'), ticks: logTicks, tick: (value) => number(10 ** value), markers: sunMarker(logValue(sun?.mass_solar)),
  })
}

function temperatureHistogram({ stellar, sun, colorMode }: GraphContext): Node[] {
  return propertyHistogram(stellar, (star) => logValue(star.temperature_k), 'a temperature', {
    label: logRange('K'), ticks: logTicks, tick: (value) => number(10 ** value),
    // Below about 2,000 K the scene switches to brown-dwarf colors.
    color: (center) => {
      const temperature_k = 10 ** center
      return starDisplayColor({ type: temperature_k < 2000 ? 'brown_dwarf' : 'star', temperature_k, spectral_type: null }, colorMode).getStyle()
    },
    markers: sunMarker(logValue(sun?.temperature_k)),
  })
}

// Metallicity is relative to the Sun, which marks 0 dex.
function metallicityHistogram({ stellar }: GraphContext): Node[] {
  return propertyHistogram(stellar, (star) => star.metallicity_dex, 'a metallicity', {
    label: (low, high) => `${number(low)} to ${number(high)} dex`, ticks: linearTicks, tick: number, markers: sunMarker(0),
  })
}

function apparentMagnitudeHistogram({ stellar }: GraphContext): Node[] {
  return propertyHistogram(stellar, (star) => star.apparent_mag, 'an apparent magnitude', {
    label: magnitudeRange, ticks: linearTicks, tick: number, floor: -2,
    markers: MAGNITUDE_VISIBILITY_GUIDES.filter(({ id }) => id !== 'city').map(({ limit, icon, name }) => ({ value: limit, icon, label: `${name} +${limit}` })),
  })
}

function absoluteMagnitudeHistogram({ stellar, sun }: GraphContext): Node[] {
  return propertyHistogram(stellar, (star) => star.absolute_mag, 'an absolute magnitude', {
    label: magnitudeRange, ticks: linearTicks, tick: number, markers: sunMarker(sun?.absolute_mag),
  })
}

function whiteDwarfClassBars({ stellar, colorMode }: GraphContext): Node[] {
  const whiteDwarfs = stellar.filter((star) => star.type === 'white_dwarf')
  if (!whiteDwarfs.length) return []
  const family = (star: Star) => whiteDwarfClassification(star)?.family ?? null
  const groups = groupBy(whiteDwarfs, family)
  const classified = [...groups.values()].reduce((sum, members) => sum + members.length, 0)
  return [
    ...countBars(whiteDwarfFamilies.filter(([type]) => groups.has(type)).map(([type, description]) => ({
      label: `${type} · ${description.toLowerCase()}`, count: groups.get(type)!.length,
      color: starDisplayColor(typicalMember(groups.get(type)!), colorMode).getStyle(),
      select: { key: type, label: type, test: (star: Star) => family(star) === type },
    })), classified),
    ...missingNote(whiteDwarfs.length - classified, 'a white dwarf class'),
  ]
}

function luminosityClassBars({ stellar, colorMode }: GraphContext): Node[] {
  const stars = stellar.filter((star) => star.type === 'star')
  const groups = groupBy(stars, luminosityGroup)
  const classified = [...groups.values()].reduce((sum, members) => sum + members.length, 0)
  return [
    ...countBars(luminosityRows.filter(([luminosityClass]) => groups.has(luminosityClass)).map(([luminosityClass, name]) => ({
      label: `${luminosityClass} · ${name.toLowerCase()}`, count: groups.get(luminosityClass)!.length,
      color: starDisplayColor(typicalMember(groups.get(luminosityClass)!), colorMode).getStyle(),
      select: { key: luminosityClass, label: luminosityClass, test: (star: Star) => luminosityGroup(star) === luminosityClass },
    })), classified),
    ...missingNote(stars.length - classified, 'a luminosity class'),
  ]
}

const topics: GraphTopic[] = [
  { id: 'star-distribution', title: 'Star distribution', sections: [
    { id: 'object-types', title: 'Object types', icon: ChartBar, render: objectTypeBars },
    { id: 'spectral-classes', title: 'Spectral classes', icon: ChartBar, render: spectralClassBars },
    { id: 'distance', title: ({ distanceUnit, referenceName }) => `Distance from ${referenceName} (${distanceUnit})`, icon: ChartColumn, scalable: true, render: distanceHistogram },
    { id: 'multiplicity', title: 'Multiplicity', icon: ChartBar, render: multiplicityBars },
    { id: 'planet-hosts', title: 'Known planet hosts', icon: ChartBar, render: planetHostBars },
  ] },
  { id: 'physical-properties', title: 'Physical properties', sections: [
    { id: 'mass', title: 'Mass (M☉)', icon: ChartColumn, render: massHistogram },
    { id: 'temperature', title: 'Temperature (K)', icon: ChartColumn, render: temperatureHistogram },
    { id: 'metallicity', title: 'Metallicity (dex)', icon: ChartColumn, render: metallicityHistogram },
    { id: 'apparent-magnitude', title: 'Apparent magnitude', icon: ChartColumn, render: apparentMagnitudeHistogram },
    { id: 'absolute-magnitude', title: 'Absolute magnitude', icon: ChartColumn, render: absoluteMagnitudeHistogram },
  ] },
  { id: 'subtypes', title: 'Subtypes', sections: [
    { id: 'white-dwarf-classes', title: 'White dwarf classes', icon: ChartBar, render: whiteDwarfClassBars },
    { id: 'luminosity-classes', title: 'Luminosity classes', icon: ChartBar, render: luminosityClassBars },
  ] },
]

// Collapsed sections persist for the browser session.
const COLLAPSED_STORAGE_KEY = 'star-view-graph-sections-collapsed'

function readCollapsed(): Set<string> {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(COLLAPSED_STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

export function initializeGraphs(signal: AbortSignal, options: () => GraphOptions) {
  const panel = document.getElementById('graphs-panel')!
  const terms = document.getElementById('graphs-terms')!
  const heading = document.getElementById('graphs-title')!
  const sections = document.getElementById('graphs-sections')!
  const toggleAll = document.getElementById('graphs-collapse-all')!
  const filterBar = document.getElementById('graphs-filter')!
  const filterList = document.getElementById('graphs-filter-list')!
  const clear = document.getElementById('graphs-clear')!
  const collapsed = readCollapsed()
  const linearSections = new Set<string>()
  // Selected bars per graph: the same graph combines with "or", different graphs with "and".
  const filters = new Map<string, Map<string, Selection>>()
  let selected = topics[0]!

  const saveCollapsed = () => {
    try { sessionStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsed])) } catch {}
  }
  const syncToggleAll = () => {
    const allCollapsed = selected.sections.every(({ id }) => collapsed.has(id))
    const label = `${allCollapsed ? 'Expand' : 'Collapse'} all graphs`
    toggleAll.setAttribute('aria-expanded', String(!allCollapsed))
    toggleAll.setAttribute('aria-label', label)
    toggleAll.title = label
    toggleAll.replaceChildren(svg(allCollapsed ? ChevronsUpDown : ChevronsDownUp))
  }
  const matches = ({ star, distancePc }: GraphItem, except?: string) => [...filters].every(([id, chosen]) =>
    id === except || [...chosen.values()].some(({ test }) => test(star, distancePc)))
  // Lists each topic's selections, so filters set elsewhere stay visible; a click opens that topic.
  const renderFilterBar = () => {
    filterBar.hidden = !filters.size
    filterList.replaceChildren(...topics.flatMap((topic) => {
      const active = topic.sections.filter(({ id }) => filters.has(id))
      if (!active.length) return []
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.topic = topic.id
      button.title = `Show ${topic.title}`
      const name = document.createElement('span')
      name.textContent = `${topic.title}: `
      button.append(name, ...active.map(({ id, title }, index) => Object.assign(document.createElement('b'), {
        textContent: `${index ? ' · ' : ''}${typeof title === 'string' ? title.replace(/ \(.*\)$/, '') : 'Distance'} ${[...filters.get(id)!.values()].map(({ label }) => label).join(', ')}`,
      })))
      return [button]
    }))
  }
  const applyFilters = () => {
    renderFilterBar()
    options().onFilter(filters.size ? (star, distancePc) => matches({ star, distancePc }) : null)
  }

  terms.replaceChildren(...topics.map((topic) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'glossary-term'
    button.textContent = topic.title
    button.dataset.topic = topic.id
    button.setAttribute('aria-controls', 'graphs-detail')
    return button
  }))

  const render = () => {
    const graphOptions = options()
    for (const button of terms.querySelectorAll<HTMLButtonElement>('button')) {
      button.setAttribute('aria-current', String(button.dataset.topic === selected.id))
    }
    heading.textContent = selected.title
    sections.replaceChildren(...selected.sections.map((section) => {
      // Each graph applies every other graph's selection but not its own, so its alternatives stay visible.
      const items = graphOptions.items.filter((item) => matches(item, section.id))
      const objects = items.map(({ star }) => star)
      const context: GraphContext = { ...graphOptions, items, objects, stellar: objects.filter(isStellar), logScale: !linearSections.has(section.id) }
      const chosen = filters.get(section.id)
      const details = document.createElement('details')
      details.className = 'planet-atmosphere graph-section'
      details.dataset.section = section.id
      details.open = !collapsed.has(section.id)
      const summary = document.createElement('summary')
      summary.className = 'card-subgroup-heading'
      const title = document.createElement('span')
      title.textContent = typeof section.title === 'string' ? section.title : section.title(context)
      const chevron = svg(ChevronUp)
      chevron.classList.add('graph-section-chevron')
      summary.append(svg(section.icon), title)
      if (chosen) {
        const filter = document.createElement('span')
        filter.className = 'graph-section-filter'
        filter.textContent = [...chosen.values()].map(({ label }) => label).join(', ')
        filter.title = filter.textContent
        summary.append(filter)
      }
      if (section.scalable) {
        const scale = document.createElement('span')
        scale.className = 'unit-options graph-scale'
        scale.setAttribute('role', 'group')
        scale.setAttribute('aria-label', 'Axis scale')
        scale.append(...(['Log', 'Linear'] as const).map((name) => {
          const button = document.createElement('button')
          button.type = 'button'
          button.textContent = name
          button.dataset.scale = name
          button.title = `${name === 'Log' ? 'Logarithmic' : 'Linear'} axis`
          button.setAttribute('aria-pressed', String((name === 'Log') === context.logScale))
          return button
        }))
        summary.append(scale)
      }
      summary.append(chevron)
      const body = document.createElement('div')
      body.className = 'graph-body'
      const content = objects.length ? section.render(context) : []
      body.append(...(content.length ? content : [Object.assign(document.createElement('p'), { className: 'filter-hint', textContent: 'No matching objects are shown in the view.' })]))
      for (const button of body.querySelectorAll<HTMLElement>('[data-select]')) button.setAttribute('aria-pressed', String(!!chosen?.has(button.dataset.select!)))
      details.append(summary, body)
      return details
    }))
    syncToggleAll()
  }
  const refresh = () => { if (!panel.hidden) render() }

  const selectTopic = (event: Event) => {
    const id = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button')?.dataset.topic : undefined
    const topic = topics.find((candidate) => candidate.id === id)
    if (!topic || topic === selected) return
    selected = topic
    render()
    sections.scrollTop = 0
  }
  terms.addEventListener('click', selectTopic, { signal })
  filterList.addEventListener('click', selectTopic, { signal })
  // Selecting a bar narrows the 3D view; the resulting refresh re-renders every graph.
  sections.addEventListener('click', (event) => {
    const scale = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-scale]') : null
    if (scale) {
      const id = scale.closest<HTMLElement>('[data-section]')!.dataset.section!
      if (scale.dataset.scale === 'Log') linearSections.delete(id)
      else linearSections.add(id)
      render()
      sections.querySelector<HTMLElement>(`[data-section="${id}"] [data-scale="${scale.dataset.scale}"]`)?.focus()
      return
    }
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-select]') : null
    const select = button && selections.get(button)
    const section = button?.closest<HTMLElement>('[data-section]')?.dataset.section
    if (!select || !section) return
    const chosen = filters.get(section) ?? new Map<string, Selection>()
    if (chosen.has(select.key)) chosen.delete(select.key)
    else chosen.set(select.key, select)
    if (chosen.size) filters.set(section, chosen)
    else filters.delete(section)
    applyFilters()
  }, { signal })
  clear.addEventListener('click', () => {
    filters.clear()
    applyFilters()
  }, { signal })
  const save = (): SavedGraphSelection[] => [...filters].flatMap(([section, chosen]) => [...chosen.values()].map(({ key, label, range }) =>
    ({ section, key, label, ...(range && { range: range.map((end) => Number.isFinite(end) ? end : null) as [number | null, number | null] }) })))
  // Rebuilds saved selections from each graph rendered over every shown object; selections without a matching entry are dropped.
  const restore = (saved: readonly SavedGraphSelection[]) => {
    filters.clear()
    const graphOptions = options()
    const objects = graphOptions.items.map(({ star }) => star)
    const context: GraphContext = { ...graphOptions, objects, stellar: objects.filter(isStellar), logScale: true }
    const rendered = new Map<string, HTMLElement>()
    for (const { section: id, key, label, range } of saved) {
      const section = topics.flatMap((topic) => topic.sections).find((candidate) => candidate.id === id)
      if (!section || !objects.length) continue
      let body = rendered.get(id)
      if (!body) {
        body = document.createElement('div')
        body.append(...section.render(context))
        rendered.set(id, body)
      }
      const columns = range && body.querySelector('.graph-columns')
      const build = columns ? rangeTests.get(columns) : undefined
      const ends = range?.map((end, index) => end ?? (index ? Infinity : -Infinity)) as [number, number] | undefined
      const select = build && ends ? { key, label, test: build(...ends), range: ends }
        : [...body.querySelectorAll('[data-select]')].map((element) => selections.get(element)).find((candidate) => candidate?.key === key)
      if (!select) continue
      if (!filters.has(id)) filters.set(id, new Map())
      filters.get(id)!.set(key, select)
    }
    applyFilters()
  }
  // Collapsed sections stay collapsed across view and color changes.
  sections.addEventListener('toggle', (event) => {
    const details = event.target as HTMLDetailsElement
    if (details.open) collapsed.delete(details.dataset.section!)
    else collapsed.add(details.dataset.section!)
    saveCollapsed()
    syncToggleAll()
  }, { signal, capture: true })
  // Collapsing all applies to every topic, so the choice holds when switching topics.
  toggleAll.addEventListener('click', () => {
    const collapse = !selected.sections.every(({ id }) => collapsed.has(id))
    collapsed.clear()
    if (collapse) for (const { id } of topics.flatMap((topic) => topic.sections)) collapsed.add(id)
    for (const details of sections.querySelectorAll('details')) details.open = !collapse
    saveCollapsed()
    syncToggleAll()
  }, { signal })
  return { open: refresh, refresh, save, restore }
}
