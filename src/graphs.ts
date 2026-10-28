import { ChartBar, ChartColumn, ChartPie, ChartScatter, ChevronUp, CircleX, ChevronsDownUp, ChevronsUpDown, Gauge, Layers, RotateCcw, Sun, createElement, type IconNode } from 'lucide'
import { LIGHT_YEARS_PER_PARSEC, starDisplayColor, type DistanceUnit, type StarColorMode } from './astronomy'
import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model'
import { MAGNITUDE_VISIBILITY_GUIDES } from './magnitude-properties'
import { luminosityRows, mkPoint, whiteDwarfClassification, whiteDwarfFamilies } from './mk-properties'
import { FILTER_CATEGORIES, filterKeyForObject, type FilterKey } from './object-filter'
import { svgNode } from './spectral-chart'
import type { StarSystem } from './star-systems'

/** Distances are from the current reference, as in the object list. */
type ObjectTest = (star: Star, distancePc: number) => boolean
interface GraphItem { star: Star; distancePc: number }
interface GraphOptions {
  items: readonly GraphItem[]
  onFilter(test: ObjectTest | null): void
  sun: Star | undefined
  reference: Star | undefined
  referenceName: string
  systems: ReadonlyMap<string, StarSystem>
  distanceUnit: DistanceUnit
  colorMode: StarColorMode
}
interface GraphView { items: readonly GraphItem[]; objects: readonly Star[]; stellar: readonly Star[] }
/**
 * `full` is the view before any graph selection, present when other graphs narrow this one; it shows behind the narrowed counts.
 * `chosen` is this graph's own selection. `bins` shifts the histogram bin width by that many steps; positive values give more, narrower bins.
 */
interface GraphContext extends GraphOptions, GraphView { full: GraphView | null; chosen: readonly Selection[]; logScale: boolean; bins: number }
/**
 * A collapsible graph inside a topic; topics can hold several. `scalable` graphs switch between log and linear axes, `binned` graphs change their bin count.
 * `boxed` graphs select drawn boxes, which their heading clears. `short` names the graph in the filter bar when its title changes or carries units.
 */
interface GraphSection { id: string; title: string | ((context: GraphContext) => string); short?: string; icon: IconNode; scalable?: boolean; binned?: boolean; boxed?: boolean; render(context: GraphContext): Node[] }
interface GraphTopic { id: string; title: string; icon: IconNode; sections: GraphSection[] }
/** A clickable bar, column or box that narrows the view to the objects it counts; ranges hold low and high ends, per axis. */
interface Selection { key: string; label: string; test: ObjectTest; range?: readonly number[] }
/** A selection without its test, as kept in saved views; open histogram ends are null. */
export interface SavedGraphSelection { section: string; key: string; label: string; range?: readonly (number | null)[] }
/** `full` is the full view's share of the track, with `title` describing it. */
interface BarRow { label: string; value: number; scale: number; text: string; share?: string; color?: string; select?: Selection; full?: number; title?: string }
interface Histogram {
  values: number[]
  /** The full view's values, when other graphs narrow this one; they also set the bins. */
  full?: number[]
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
  bins: number
}

const typeLabels = new Map<FilterKey, string>(FILTER_CATEGORIES.flatMap((category) => category.subtypes.map(({ key, label }) => [key, label] as const)))
const spectralGroups = ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'L', 'T', 'Y', 'D'] as const
const multiplicityLabels = ['Single', 'Binary', 'Triple', 'Quadruple', '5+ components']
const svg = (icon: IconNode, size = 20) => createElement(icon, { width: size, height: size, 'stroke-width': 1.7, 'aria-hidden': 'true' })
const number = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: 3 }).replace('-', '−')
const isStellar = (star: Star) => STELLAR_OBJECT_TYPES.includes(star.type as never)
const selections = new WeakMap<Element, Selection>()
// Histogram columns and scatter plots rebuild a saved range, whose bins may differ once restored.
const rangeTests = new WeakMap<Element, (...ends: number[]) => ObjectTest>()
// Scatter plots turn a dragged box, in fractions of the plot from its top left, into a selection.
const brushes = new WeakMap<Element, (x0: number, y0: number, x1: number, y1: number) => Selection>()

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
const typicalColor = (members: readonly Star[], colorMode: StarColorMode) => starDisplayColor(typicalMember(members), colorMode).getStyle()
// Below about 2,000 K the scene switches to brown-dwarf colors.
const temperatureColor = (temperature_k: number, colorMode: StarColorMode) =>
  starDisplayColor({ type: temperature_k < 2000 ? 'brown_dwarf' : 'star', temperature_k, spectral_type: null }, colorMode).getStyle()

/** Groups the view, and the full view when other graphs narrow it; rows and colors follow the full view, so they stay put. */
function groupBoth<K>(context: GraphContext, list: (view: GraphView) => readonly Star[], key: (star: Star) => K | null) {
  const size = (groups: Map<K, Star[]>) => [...groups.values()].reduce((sum, members) => sum + members.length, 0)
  const groups = groupBy(list(context), key)
  const full = context.full ? groupBy(list(context.full), key) : groups
  const total = size(groups)
  return {
    groups, full, total, fullTotal: context.full ? size(full) : undefined, missing: list(context).length - total,
    tally: (group: K) => ({ count: groups.get(group)?.length ?? 0, full: full.get(group)!.length, color: typicalColor(full.get(group)!, context.colorMode) }),
  }
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

const stepFactors = [1, 1.5, 2, 3, 5, 7.5]
/** Moves a 1, 2 or 5 × 10ⁿ step by `count` places along 1, 1.5, 2, 3, 5 and 7.5 × 10ⁿ; positive counts make it smaller. */
function shiftStep(step: number, count: number): number {
  const power = Math.floor(Math.log10(step) + 1e-9)
  const place = 6 * power + stepFactors.indexOf(Math.round(step / 10 ** power)) - count
  return stepFactors[place - 6 * Math.floor(place / 6)]! * 10 ** Math.floor(place / 6)
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

const superscript = (value: number) => String(value).replace(/[-\d]/g, (char) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(char)]!)
/** Labels log ticks; an axis reaching beyond 0.01 to 10⁴ switches to powers of ten throughout, so its labels stay narrow. */
const logTickLabels = (ticks: readonly number[]) => ticks.some((tick) => tick < -2 || tick >= 5)
  ? ticks.map((tick) => {
    const decade = Math.floor(tick + 1e-9), factor = Math.round(10 ** (tick - decade))
    return `${factor > 1 ? `${factor}×` : ''}10${superscript(decade)}`
  })
  : ticks.map((tick) => number(10 ** tick))

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
  return rows.map(({ label, value, scale, text, share, color, select, full, title }) => {
    const row = selectable('div', select)
    row.classList.add('graph-bar-row')
    if (title) row.title = title
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
    if (full !== undefined) {
      const fullFill = document.createElement('span')
      fullFill.className = 'graph-bar-full'
      fullFill.style.width = `${full * 100}%`
      track.append(fullFill)
    }
    track.append(fill)
    const valueText = document.createElement('span')
    valueText.className = 'graph-bar-value'
    valueText.append(text)
    if (share) valueText.append(' ', Object.assign(document.createElement('small'), { textContent: share }))
    row.append(name, track, valueText)
    return row
  })
}

const percent = (count: number, total: number) => `${(total ? count / total * 100 : 0).toLocaleString('en-US', { maximumSignificantDigits: 2 })}%`
const share = (count: number, total: number) => total ? count / total : 0
const fullTitle = (text: string, count: number, total: number) => `Full view: ${text} · ${percent(count, total)}`

/**
 * Counted groups as bars scaled to the largest share. A `fullTotal` marks a view narrowed by other graphs,
 * whose full-view shares show behind, so a group's rise or fall reads at any selection size.
 */
function countBars(groups: readonly { label: string; count: number; full?: number; color?: string; select?: Selection }[], total: number, fullTotal?: number): Node[] {
  const scale = Math.max(...groups.map(({ count, full = 0 }) => Math.max(share(count, total), fullTotal ? share(full, fullTotal) : 0)))
  return bars(groups.map(({ label, count, full = 0, color, select }) => ({
    label, value: share(count, total), scale, text: count.toLocaleString('en-US'), share: percent(count, total), color, select: count ? select : undefined,
    ...(fullTotal !== undefined && { full: scale ? share(full, fullTotal) / scale : 0, title: fullTitle(full.toLocaleString('en-US'), full, fullTotal) }),
  })))
}

function histogram({ values, full, label, ticks, tick, floor = -Infinity, color, markers = [], select, linearRanges, bins: binShift }: Histogram): HTMLElement {
  // Bins span the full view, so they stay put while other graphs narrow this one.
  const clamped = (full ?? values).map((value) => Math.max(value, floor))
  const low = Math.min(...clamped), high = Math.max(...clamped)
  // Aim for about 40 equal bins by default; a single value still gets one.
  const step = shiftStep(niceStep(high - low, 40), binShift)
  const min = Math.floor(low / step) * step
  const bins = Math.max(1, Math.ceil((high - min) / step - 1e-9))
  const max = min + bins * step
  const binCounts = (list: readonly number[]) => {
    const counts = new Array<number>(bins).fill(0)
    for (const value of list) counts[Math.min(bins - 1, Math.floor((Math.max(value, floor) - min) / step + 1e-9))]!++
    return counts
  }
  const counts = binCounts(values), fullCounts = full && binCounts(full)
  // Heights are shares of each population, so a narrowed view compares with the full one at any size.
  const peak = Math.max(...counts.map((count) => share(count, values.length)), ...(fullCounts ?? []).map((count) => share(count, full!.length)))
  const belowFloor = (full ?? values).some((value) => value < floor)
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
    bin.dataset.count = fullCounts ? `${count.toLocaleString('en-US')} of ${countText(fullCounts[index]!)}` : countText(count)
    bin.setAttribute('aria-label', `${range} · ${bin.dataset.count}`)
    if (fullCounts) {
      const fullFill = document.createElement('b')
      fullFill.style.height = `${share(fullCounts[index]!, full!.length) / peak * 100}%`
      bin.append(fullFill)
    }
    const fill = document.createElement('i')
    fill.style.height = `${share(count, values.length) / peak * 100}%`
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
    // The tooltip sits above the taller of the column and its full-view shadow.
    const chartBounds = chart.getBoundingClientRect(), fillBounds = [...bin.children].map((fill) => fill.getBoundingClientRect())
    const center = fillBounds[0]!.left + fillBounds[0]!.width / 2 - chartBounds.left
    const left = Math.max(0, Math.min(chartBounds.width - tooltip.offsetWidth, center - tooltip.offsetWidth / 2))
    tooltip.style.left = `${left}px`
    tooltip.style.top = `${Math.min(...fillBounds.map(({ top }) => top)) - chartBounds.top - 8}px`
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
const finite = (values: readonly (number | null | undefined)[]) => values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
const hint = (text: string) => Object.assign(document.createElement('p'), { className: 'filter-hint', textContent: text })

function objectTypeBars({ objects, full, colorMode }: GraphContext): Node[] {
  const counts = full && groupBy(objects, objectType)
  return countBars(objectTypeCensus(full?.objects ?? objects).map(({ type, label, count, typical }) => ({
    label, count: counts ? counts.get(type)?.length ?? 0 : count, full: count, color: starDisplayColor(typical, colorMode).getStyle(),
    select: { key: type, label, test: (star) => objectType(star) === type },
  })), objects.length, full?.objects.length)
}

function spectralClassBars(context: GraphContext): Node[] {
  const { full, total, fullTotal, missing, tally } = groupBoth(context, ({ stellar }) => stellar, spectralGroup)
  return [
    ...countBars(spectralGroups.filter((group) => full.has(group)).map((group) => ({
      label: spectralLabel(group), ...tally(group),
      select: { key: group, label: group, test: (star) => spectralGroup(star) === group },
    })), total, fullTotal),
    ...missingNote(missing, 'a spectral class'),
  ]
}

function distanceHistogram({ items, full, distanceUnit, referenceName, logScale, bins }: GraphContext): Node[] {
  const scale = distanceUnit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1
  if (logScale) {
    // The reference object and anything within 1 unit join the first bin.
    const value = (distancePc: number) => distancePc > 0 ? Math.log10(distancePc * scale) : -Infinity
    return [histogram({
      values: items.map(({ distancePc }) => value(distancePc)), full: full?.items.map(({ distancePc }) => value(distancePc)), floor: 0, linearRanges: true, bins,
      label: (low, high) => `${low === -Infinity ? 'Within' : `${number(10 ** low)} to`} ${number(10 ** high)} ${distanceUnit} ${low === -Infinity ? 'of' : 'from'} ${referenceName}`,
      ticks: logTicks, tick: (tick) => number(10 ** tick),
      select: (low, high) => (_, distancePc) => value(distancePc) >= low && value(distancePc) < high,
    })]
  }
  return [histogram({
    values: items.map(({ distancePc }) => distancePc * scale), full: full?.items.map(({ distancePc }) => distancePc * scale), bins,
    label: (low, high) => `${number(low)} to ${number(high)} ${distanceUnit} from ${referenceName}`,
    ticks: linearTicks, tick: number,
    select: (low, high) => (_, distancePc) => inRange(distancePc * scale, low, high),
  })]
}

/** Line-of-sight velocity in km/s away from the reference, negative while approaching; both need a full space motion. */
export function radialVelocity(star: Star, reference: Star): number | null {
  const dx = star.x_pc - reference.x_pc, dy = star.y_pc - reference.y_pc, dz = star.z_pc - reference.z_pc
  const distance = Math.hypot(dx, dy, dz)
  if (!distance || [star.vx_kms, star.vy_kms, star.vz_kms, reference.vx_kms, reference.vy_kms, reference.vz_kms].includes(null)) return null
  return (dx * (star.vx_kms! - reference.vx_kms!) + dy * (star.vy_kms! - reference.vy_kms!) + dz * (star.vz_kms! - reference.vz_kms!)) / distance
}

const motionLabels = ['Approaching', 'Receding'] as const
// A selection keeps the reference it was made from, so moving the origin does not change what it holds.
function motionBars(context: GraphContext): Node[] {
  const { stellar, reference } = context
  if (!reference) return []
  const moving = (star: Star) => star.vx_kms !== null && star.vy_kms !== null && star.vz_kms !== null
  if (!moving(reference)) return [hint(`${reference.name} has no full space motion.`)]
  const motion = (star: Star) => {
    const velocity = radialVelocity(star, reference)
    return velocity === null ? null : motionLabels[velocity < 0 ? 0 : 1]
  }
  const { full, total, fullTotal, tally } = groupBoth(context, ({ stellar }) => stellar, motion)
  return [
    ...countBars(motionLabels.filter((label) => full.has(label)).map((label) => {
      const { count, full } = tally(label)
      return { label, count, full, select: { key: `${label} ${reference.id}`, label: `${label} ${reference.name}`, test: (star: Star) => isStellar(star) && motion(star) === label } }
    }), total, fullTotal),
    ...missingNote(stellar.filter((star) => !moving(star)).length, 'a full space motion'),
  ]
}

function multiplicityBars({ stellar, full, systems }: GraphContext): Node[] {
  // A system counts once when any member is shown.
  const tally = (list: readonly Star[]) => {
    const counted = new Set<string>()
    const counts = multiplicityLabels.map(() => 0)
    for (const star of list) {
      const system = systems.get(star.id)
      if (system && counted.has(system.id)) continue
      if (system) counted.add(system.id)
      counts[multiplicity(star, systems)]!++
    }
    return counts
  }
  const sum = (counts: readonly number[]) => counts.reduce((total, count) => total + count, 0)
  const counts = tally(stellar), fullCounts = full ? tally(full.stellar) : counts
  return countBars(multiplicityLabels.map((label, index) => ({
    label, count: counts[index]!, full: fullCounts[index]!,
    select: { key: label, label, test: (star: Star) => isStellar(star) && multiplicity(star, systems) === index },
  })).filter(({ full }) => full), sum(counts), full ? sum(fullCounts) : undefined)
}

function planetHostBars(context: GraphContext): Node[] {
  const { stellar, full, colorMode } = context
  const isHost = (star: Star) => (star.known_planets ?? 0) > 0
  const { groups, full: fullGroups } = groupBoth(context, ({ stellar }) => stellar, spectralGroup)
  const hosts = (count: number, members: number) => `${count.toLocaleString('en-US')} / ${members.toLocaleString('en-US')}`
  const row = (key: string, label: string, members: readonly Star[] = [], fullMembers: readonly Star[], test: ObjectTest, color?: string): BarRow => {
    const count = members.filter(isHost).length
    const fullCount = full ? fullMembers.filter(isHost).length : 0
    return {
      label, value: count, scale: members.length, color, select: count ? { key, label: `${label} hosts`, test } : undefined,
      text: hosts(count, members.length), share: percent(count, members.length),
      ...(full && { full: share(fullCount, fullMembers.length), title: fullTitle(hosts(fullCount, fullMembers.length), fullCount, fullMembers.length) }),
    }
  }
  return bars([
    row('all', 'All', stellar, full?.stellar ?? stellar, (star) => isStellar(star) && isHost(star)),
    ...spectralGroups.filter((group) => fullGroups.has(group)).map((group) => row(group, spectralLabel(group), groups.get(group), fullGroups.get(group)!,
      (star) => isHost(star) && spectralGroup(star) === group, typicalColor(fullGroups.get(group)!, colorMode))),
  ])
}

const hrPoint = (star: Star) => {
  const temperature = logValue(star.temperature_k), luminosity = logValue(star.luminosity_solar)
  return temperature === null || luminosity === null ? null : [temperature, luminosity] as const
}
const hrTest = (t0: number, t1: number, l0: number, l1: number): ObjectTest => (star) =>
  isStellar(star) && inRange(star.temperature_k, t0, t1) && inRange(star.luminosity_solar, l0, l1)
const hrSelection = (t0: number, t1: number, l0: number, l1: number): Selection => ({
  key: [t0, t1, l0, l1].map((end) => end.toPrecision(4)).join(' '), label: `${number(t0)} to ${number(t1)} K, ${number(l0)} to ${number(l1)} L☉`,
  test: hrTest(t0, t1, l0, l1), range: [t0, t1, l0, l1],
})

/** Temperature against luminosity, hot stars left and bright ones on top; dragging a box selects the stars inside it. */
function hrScatter({ items, stellar, full, chosen, sun, colorMode }: GraphContext): Node[] {
  const plotted = (list: readonly GraphItem[]) => list.flatMap((item) => {
    const point = isStellar(item.star) ? hrPoint(item.star) : null
    return point ? [{ ...item, point }] : []
  })
  const shown = plotted(items), all = full ? plotted(full.items) : shown
  if (!all.length) return missingNote(stellar.length, 'a temperature and luminosity')
  // The axes span the full view, so they stay put while other graphs narrow this one.
  const extent = (axis: 0 | 1) => {
    const values = all.map(({ point }) => point[axis])
    const low = Math.min(...values), high = Math.max(...values), pad = Math.max(high - low, 0.5) * 0.04
    return [low - pad, high + pad] as const
  }
  const [cool, hot] = extent(0), [faint, bright] = extent(1)
  const x = (temperature: number) => (hot - temperature) / (hot - cool), y = (luminosity: number) => (bright - luminosity) / (bright - faint)
  const position = (fraction: number) => `${Math.max(0, Math.min(1, fraction)) * 100}%`

  // One path per temperature color keeps thousands of dots cheap to draw; 1,000 units span the plot.
  const layer = (className: string, list: typeof all, colored: boolean) => {
    const paths = new Map<number, string>()
    for (const { point: [temperature, luminosity] } of list) {
      const key = colored ? Math.round(temperature * 50) : 0
      paths.set(key, `${paths.get(key) ?? ''}M${(x(temperature) * 1000).toFixed(1)} ${(y(luminosity) * 1000).toFixed(1)}h0`)
    }
    const group = svgNode('g', { class: className })
    group.append(...[...paths].map(([key, d]) => svgNode('path', colored ? { d, stroke: temperatureColor(10 ** (key / 50), colorMode) } : { d })))
    return group
  }
  // Dots outside this graph's own boxes recede, like unselected bars.
  const inside: typeof all = [], outside: typeof all = []
  for (const entry of shown) (!chosen.length || chosen.some(({ test }) => test(entry.star, entry.distancePc)) ? inside : outside).push(entry)
  const chart = svgNode('svg', { viewBox: '0 0 1000 1000', preserveAspectRatio: 'none', role: 'img', 'aria-label': `${countText(shown.length)} by temperature and luminosity` })
  if (full) chart.append(layer('graph-dots-full', all, false))
  chart.append(layer('graph-dots-muted', outside, true), layer('graph-dots', inside, true))

  const plot = document.createElement('div')
  plot.className = 'graph-plot'
  plot.title = 'Drag to select a region'
  rangeTests.set(plot, hrTest)
  const temperatureAt = (fraction: number) => 10 ** (hot - fraction * (hot - cool)), luminosityAt = (fraction: number) => 10 ** (bright - fraction * (bright - faint))
  brushes.set(plot, (x0, y0, x1, y1) => hrSelection(temperatureAt(Math.max(x0, x1)), temperatureAt(Math.min(x0, x1)), luminosityAt(Math.max(y0, y1)), luminosityAt(Math.min(y0, y1))))
  plot.append(chart)
  const sunPoint = sun && hrPoint(sun)
  if (sunPoint) {
    const marker = document.createElement('span')
    marker.className = 'graph-plot-marker'
    marker.title = 'Sun'
    Object.assign(marker.style, { left: position(x(sunPoint[0])), top: position(y(sunPoint[1])) })
    marker.append(svg(Sun, 12))
    plot.append(marker)
  }
  // Each box removes from its upper left corner and resizes from its lower right one.
  plot.append(...chosen.flatMap((selection) => {
    if (selection.range?.length !== 4) return []
    const [t0, t1, l0, l1] = selection.range.map(Math.log10) as [number, number, number, number]
    const box = Object.assign(document.createElement('span'), { className: 'graph-brush', title: selection.label })
    box.dataset.key = selection.key
    Object.assign(box.style, { left: position(x(t1)), right: position(1 - x(t0)), top: position(y(l1)), bottom: position(1 - y(l0)) })
    const remove = Object.assign(document.createElement('button'), { type: 'button', className: 'graph-brush-remove', title: `Remove ${selection.label}` })
    remove.setAttribute('aria-label', `Remove ${selection.label}`)
    remove.append(svg(CircleX, 16))
    box.append(remove, Object.assign(document.createElement('span'), { className: 'graph-brush-resize', title: 'Drag to resize' }))
    return [box]
  }))

  // Luminosity can span ten decades or more; about six labels stay legible.
  const axis = (className: string, ticks: number[], place: (label: HTMLElement, tick: number) => void) => {
    const element = document.createElement('div')
    element.className = className
    element.setAttribute('aria-hidden', 'true')
    const shown = ticks.filter((_, index) => index % Math.ceil(ticks.length / 6) === 0), labels = logTickLabels(shown)
    element.append(...shown.map((tick, index) => {
      const label = Object.assign(document.createElement('span'), { textContent: labels[index]! })
      place(label, tick)
      return label
    }))
    // The labels sit outside the flow; a hidden copy of the longest sets the axis width.
    element.append(Object.assign(document.createElement('span'), { className: 'graph-axis-sizer', textContent: labels.reduce((longest, label) => label.length > longest.length ? label : longest, '') }))
    return element
  }
  const title = (text: string) => Object.assign(document.createElement('span'), { className: 'graph-axis-title', textContent: text })
  const scatter = document.createElement('div')
  scatter.className = 'graph-scatter'
  scatter.append(
    title('Luminosity (L☉)'),
    axis('graph-axis graph-axis-y', logTicks(faint, bright), (label, tick) => { label.style.top = position(y(tick)) }),
    plot,
    // Keep the outermost labels inside the card.
    axis('graph-axis', logTicks(cool, hot), (label, tick) => {
      label.style.left = position(x(tick))
      label.style.transform = `translateX(${x(tick) < 0.05 ? 0 : x(tick) > 0.95 ? -100 : -50}%)`
    }),
    title('Temperature (K)'),
  )
  const missing = missingNote(stellar.length - shown.length, 'a temperature and luminosity')
  if (!sunPoint) return [scatter, ...missing]
  // The Sun's key leads the line with the missing count.
  const key = Object.assign(document.createElement('p'), { className: 'filter-hint graph-legend' })
  key.append(svg(Sun, 12), ['Sun', ...missing.map(({ textContent }) => textContent)].join(' · '))
  return [scatter, key]
}

function propertyHistogram({ stellar, full, bins }: GraphContext, value: (star: Star) => number | null | undefined, missing: string, options: Omit<Histogram, 'values' | 'full' | 'select' | 'bins'>): Node[] {
  const values = finite(stellar.map(value)), fullValues = full ? finite(full.stellar.map(value)) : undefined
  if (!(fullValues ?? values).length) return missingNote(stellar.length, missing)
  const select = (low: number, high: number): ObjectTest => (star) => isStellar(star) && inRange(value(star), low, high)
  return [histogram({ ...options, values, full: fullValues, select, bins }), ...missingNote(stellar.length - values.length, missing)]
}

const logRange = (unit: string) => (low: number, high: number) => `${number(10 ** low)} to ${number(10 ** high)} ${unit}`
const magnitudeRange = (low: number, high: number) => `${low === -Infinity ? 'Brighter than' : `${number(low)} to`} ${number(high)} mag`
const logValue = (value: number | null | undefined) => value && value > 0 ? Math.log10(value) : null

/** A solar-unit property on a log axis, with the Sun marked. */
const solarHistogram = (field: 'mass_solar' | 'radius_solar' | 'luminosity_solar', unit: string, missing: string) => (context: GraphContext): Node[] =>
  propertyHistogram(context, (star) => logValue(star[field]), missing, {
    label: logRange(unit), ticks: logTicks, tick: (value) => number(10 ** value), markers: sunMarker(logValue(context.sun?.[field])),
  })

function temperatureHistogram(context: GraphContext): Node[] {
  const { sun, colorMode } = context
  return propertyHistogram(context, (star) => logValue(star.temperature_k), 'a temperature', {
    label: logRange('K'), ticks: logTicks, tick: (value) => number(10 ** value),
    color: (center) => temperatureColor(10 ** center, colorMode),
    markers: sunMarker(logValue(sun?.temperature_k)),
  })
}

// Metallicity is relative to the Sun, which marks 0 dex.
function metallicityHistogram(context: GraphContext): Node[] {
  return propertyHistogram(context, (star) => star.metallicity_dex, 'a metallicity', {
    label: (low, high) => `${number(low)} to ${number(high)} dex`, ticks: linearTicks, tick: number, markers: sunMarker(0),
  })
}

function apparentMagnitudeHistogram(context: GraphContext): Node[] {
  return propertyHistogram(context, (star) => star.apparent_mag, 'an apparent magnitude', {
    label: magnitudeRange, ticks: linearTicks, tick: number, floor: -2,
    markers: MAGNITUDE_VISIBILITY_GUIDES.filter(({ id }) => id !== 'city').map(({ limit, icon, name }) => ({ value: limit, icon, label: `${name} +${limit}` })),
  })
}

function absoluteMagnitudeHistogram(context: GraphContext): Node[] {
  return propertyHistogram(context, (star) => star.absolute_mag, 'an absolute magnitude', {
    label: magnitudeRange, ticks: linearTicks, tick: number, markers: sunMarker(context.sun?.absolute_mag),
  })
}

function whiteDwarfClassBars(context: GraphContext): Node[] {
  const whiteDwarfs = ({ stellar }: GraphView) => stellar.filter((star) => star.type === 'white_dwarf')
  const family = (star: Star) => whiteDwarfClassification(star)?.family ?? null
  const { full, total, fullTotal, missing, tally } = groupBoth(context, whiteDwarfs, family)
  return [
    ...countBars(whiteDwarfFamilies.filter(([type]) => full.has(type)).map(([type, description]) => ({
      label: `${type} · ${description.toLowerCase()}`, ...tally(type),
      select: { key: type, label: type, test: (star: Star) => family(star) === type },
    })), total, fullTotal),
    ...missingNote(missing, 'a white dwarf class'),
  ]
}

function luminosityClassBars(context: GraphContext): Node[] {
  const { full, total, fullTotal, missing, tally } = groupBoth(context, ({ stellar }) => stellar.filter((star) => star.type === 'star'), luminosityGroup)
  return [
    ...countBars(luminosityRows.filter(([luminosityClass]) => full.has(luminosityClass)).map(([luminosityClass, name]) => ({
      label: `${luminosityClass} · ${name.toLowerCase()}`, ...tally(luminosityClass),
      select: { key: luminosityClass, label: luminosityClass, test: (star: Star) => luminosityGroup(star) === luminosityClass },
    })), total, fullTotal),
    ...missingNote(missing, 'a luminosity class'),
  ]
}

const topics: GraphTopic[] = [
  { id: 'star-distribution', title: 'Star distribution', icon: ChartPie, sections: [
    { id: 'object-types', title: 'Object types', icon: ChartBar, render: objectTypeBars },
    { id: 'spectral-classes', title: 'Spectral classes', icon: ChartBar, render: spectralClassBars },
    { id: 'distance', title: ({ distanceUnit, referenceName }) => `Distance from ${referenceName} (${distanceUnit})`, short: 'Distance', icon: ChartColumn, scalable: true, binned: true, render: distanceHistogram },
    { id: 'motion', title: ({ referenceName }) => `Motion relative to ${referenceName}`, short: 'Motion', icon: ChartBar, render: motionBars },
    { id: 'multiplicity', title: 'Multiplicity', icon: ChartBar, render: multiplicityBars },
    { id: 'planet-hosts', title: 'Known planet hosts', icon: ChartBar, render: planetHostBars },
  ] },
  { id: 'physical-properties', title: 'Physical properties', icon: Gauge, sections: [
    { id: 'hr-diagram', title: 'HR diagram', icon: ChartScatter, boxed: true, render: hrScatter },
    { id: 'mass', title: 'Mass (M☉)', icon: ChartColumn, binned: true, render: solarHistogram('mass_solar', 'M☉', 'a mass') },
    { id: 'radius', title: 'Radius (R☉)', icon: ChartColumn, binned: true, render: solarHistogram('radius_solar', 'R☉', 'a radius') },
    { id: 'luminosity', title: 'Luminosity (L☉)', icon: ChartColumn, binned: true, render: solarHistogram('luminosity_solar', 'L☉', 'a luminosity') },
    { id: 'temperature', title: 'Temperature (K)', icon: ChartColumn, binned: true, render: temperatureHistogram },
    { id: 'metallicity', title: 'Metallicity (dex)', icon: ChartColumn, binned: true, render: metallicityHistogram },
    { id: 'apparent-magnitude', title: 'Apparent magnitude', icon: ChartColumn, binned: true, render: apparentMagnitudeHistogram },
    { id: 'absolute-magnitude', title: 'Absolute magnitude', icon: ChartColumn, binned: true, render: absoluteMagnitudeHistogram },
  ] },
  { id: 'subtypes', title: 'Subtypes', icon: Layers, sections: [
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
  const expand = document.getElementById('graphs-filter-expand')!
  const collapsed = readCollapsed()
  const linearSections = new Set<string>()
  // Bin shifts per histogram, from fewest to most bins; absent means the default.
  const binShifts = new Map<string, number>()
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
  const setExpanded = (expanded: boolean) => {
    filterBar.toggleAttribute('data-expanded', expanded)
    expand.setAttribute('aria-expanded', String(expanded))
  }
  // Lists each topic's selections, so filters set elsewhere stay visible; a click opens that topic. The list folds up again once cleared.
  const renderFilterBar = () => {
    filterBar.hidden = !filters.size
    if (!filters.size) setExpanded(false)
    filterList.replaceChildren(...topics.flatMap((topic) => {
      const active = topic.sections.filter(({ id }) => filters.has(id))
      if (!active.length) return []
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.topic = topic.id
      const name = document.createElement('span')
      name.textContent = `${topic.title}: `
      button.append(name, ...active.map(({ id, title, short }, index) => Object.assign(document.createElement('b'), {
        textContent: `${index ? ' · ' : ''}${short ?? (typeof title === 'string' ? title.replace(/ \(.*\)$/, '') : '')} ${[...filters.get(id)!.values()].map(({ label }) => label).join(', ')}`,
      })))
      // Long selections end in an ellipsis; the title holds them in full.
      button.title = `Show ${button.textContent}`
      return [button]
    }))
  }
  const applyFilters = () => {
    renderFilterBar()
    options().onFilter(filters.size ? (star, distancePc) => matches({ star, distancePc }) : null)
  }
  // A moved or resized box replaces the selection it `replaces`.
  const toggleSelection = (section: string, select: Selection, replaces?: string) => {
    const chosen = filters.get(section) ?? new Map<string, Selection>()
    if (replaces !== undefined) chosen.delete(replaces)
    if (replaces === undefined && chosen.has(select.key)) chosen.delete(select.key)
    else chosen.set(select.key, select)
    if (chosen.size) filters.set(section, chosen)
    else filters.delete(section)
    applyFilters()
  }

  terms.replaceChildren(...topics.map((topic) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'glossary-term'
    button.append(
      Object.assign(document.createElement('span'), { className: 'glossary-term-icon', title: topic.title }),
      Object.assign(document.createElement('span'), { className: 'glossary-term-label', textContent: topic.title }),
    )
    button.firstElementChild!.append(svg(topic.icon, 16))
    button.dataset.topic = topic.id
    button.setAttribute('aria-controls', 'graphs-detail')
    return button
  }))

  const view = (items: readonly GraphItem[]): GraphView => {
    const objects = items.map(({ star }) => star)
    return { items, objects, stellar: objects.filter(isStellar) }
  }
  // Each graph applies every other graph's selection but not its own, so its alternatives stay visible; the full view shows behind when they narrow it.
  const contextFor = (section: GraphSection, graphOptions: GraphOptions, full: GraphView): GraphContext => {
    const items = graphOptions.items.filter((item) => matches(item, section.id))
    const narrowed = items.length < full.items.length
    return {
      ...graphOptions, ...(narrowed ? view(items) : full), full: narrowed ? full : null, chosen: [...filters.get(section.id)?.values() ?? []],
      logScale: !linearSections.has(section.id), bins: binShifts.get(section.id) ?? 0,
    }
  }
  const renderBody = (body: HTMLElement, section: GraphSection, context: GraphContext) => {
    const chosen = filters.get(section.id)
    const content = context.objects.length ? section.render(context) : []
    body.replaceChildren(...(content.length ? content : [Object.assign(document.createElement('p'), { className: 'filter-hint', textContent: 'No matching objects are shown in the view.' })]))
    for (const button of body.querySelectorAll<HTMLElement>('[data-select]')) button.setAttribute('aria-pressed', String(!!chosen?.has(button.dataset.select!)))
    const slider = body.parentElement?.querySelector<HTMLInputElement>('.graph-bins > input')
    if (slider) slider.setAttribute('aria-valuetext', `${body.querySelectorAll('.graph-bin').length} bars`)
  }
  const render = () => {
    const graphOptions = options()
    const full = view(graphOptions.items)
    for (const button of terms.querySelectorAll<HTMLButtonElement>('button')) {
      button.setAttribute('aria-current', String(button.dataset.topic === selected.id))
    }
    heading.textContent = selected.title
    // Redrawing after a selection keeps the graph in view.
    const scroll = sections.scrollTop
    sections.replaceChildren(...selected.sections.map((section) => {
      const context = contextFor(section, graphOptions, full)
      const chosen = filters.get(section.id)
      const details = document.createElement('details')
      details.className = 'planet-atmosphere graph-section'
      details.dataset.section = section.id
      details.open = !collapsed.has(section.id)
      const summary = document.createElement('summary')
      summary.className = 'card-subgroup-heading'
      const title = document.createElement('span')
      title.className = 'graph-section-title'
      title.textContent = title.title = typeof section.title === 'string' ? section.title : section.title(context)
      const chevron = svg(ChevronUp)
      chevron.classList.add('graph-section-chevron')
      // The selection follows the title, or wraps below it when space runs out.
      const label = document.createElement('span')
      label.className = 'graph-section-label'
      label.append(title)
      if (chosen) {
        const filter = document.createElement('span')
        filter.className = 'graph-section-filter'
        filter.textContent = [...chosen.values()].map(({ label }) => label).join(', ')
        filter.title = filter.textContent
        label.append(filter)
      }
      summary.append(svg(section.icon), label)
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
      // Fewer bars to the left, more to the right; the default sits in the middle.
      if (section.binned) {
        const bins = document.createElement('span')
        bins.className = 'graph-bins'
        const slider = Object.assign(document.createElement('input'), { type: 'range', min: '-4', max: '4', step: '1', value: String(context.bins), title: 'Fewer or more bars' })
        slider.setAttribute('aria-label', 'Number of bars')
        const reset = Object.assign(document.createElement('button'), { type: 'button', className: 'panel-lock', title: 'Reset bars', disabled: !context.bins })
        reset.setAttribute('aria-label', 'Reset number of bars')
        reset.append(svg(RotateCcw, 16))
        bins.append(slider, reset)
        summary.append(bins)
      }
      if (section.boxed) {
        const clearBoxes = Object.assign(document.createElement('span'), { className: 'graph-reset' })
        const reset = Object.assign(document.createElement('button'), { type: 'button', className: 'panel-lock', title: 'Clear boxes', disabled: !chosen })
        reset.setAttribute('aria-label', 'Clear drawn boxes')
        reset.append(svg(RotateCcw, 16))
        clearBoxes.append(reset)
        summary.append(clearBoxes)
      }
      summary.append(chevron)
      const body = document.createElement('div')
      body.className = 'graph-body'
      details.append(summary, body)
      renderBody(body, section, context)
      return details
    }))
    sections.scrollTop = scroll
    syncToggleAll()
  }
  // The bar slider holds off the full redraw, which would replace it mid-drag.
  let holdRedraw = false
  const refresh = () => { if (!panel.hidden && !holdRedraw) render() }
  // New bars reset the graph's selection; only graph bodies redraw, so a slider drag continues.
  const setBins = (slider: HTMLInputElement, value: number) => {
    const details = slider.closest<HTMLElement>('[data-section]')!
    const id = details.dataset.section!
    slider.value = String(value)
    if (value) binShifts.set(id, value)
    else binShifts.delete(id)
    slider.parentElement!.querySelector('button')!.disabled = !value
    // Without this graph's selection, every other graph counts more objects.
    const cleared = filters.delete(id)
    if (cleared) {
      details.querySelector('.graph-section-filter')?.remove()
      holdRedraw = true
      applyFilters()
      holdRedraw = false
    }
    const graphOptions = options()
    const full = view(graphOptions.items)
    for (const section of selected.sections) {
      if (!cleared && section.id !== id) continue
      renderBody(sections.querySelector<HTMLElement>(`[data-section="${section.id}"] > .graph-body`)!, section, contextFor(section, graphOptions, full))
    }
  }

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
      const linear = scale.dataset.scale === 'Linear'
      if (linear !== linearSections.has(id)) {
        if (linear) linearSections.add(id)
        else linearSections.delete(id)
        // New bars reset the graph's selection; applying that redraws every graph.
        if (filters.delete(id)) applyFilters()
        else render()
      }
      sections.querySelector<HTMLElement>(`[data-section="${id}"] [data-scale="${scale.dataset.scale}"]`)?.focus()
      return
    }
    // Bar controls sit in the section heading but do not toggle it.
    const bins = event.target instanceof Element ? event.target.closest('.graph-bins') : null
    if (bins) {
      event.preventDefault()
      const slider = bins.querySelector('input')!
      if (event.target instanceof Element && event.target.closest('button')) {
        setBins(slider, 0)
        slider.focus()
      }
      return
    }
    const clearBoxes = event.target instanceof Element ? event.target.closest('.graph-reset') : null
    if (clearBoxes) {
      event.preventDefault()
      if (event.target instanceof Element && event.target.closest('button') && filters.delete(clearBoxes.closest<HTMLElement>('[data-section]')!.dataset.section!)) applyFilters()
      return
    }
    const remove = event.target instanceof Element ? event.target.closest<HTMLElement>('.graph-brush-remove') : null
    if (remove) {
      const section = remove.closest<HTMLElement>('[data-section]')!.dataset.section!
      toggleSelection(section, filters.get(section)!.get(remove.parentElement!.dataset.key!)!)
      return
    }
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-select]') : null
    const select = button && selections.get(button)
    const section = button?.closest<HTMLElement>('[data-section]')?.dataset.section
    if (select && section) toggleSelection(section, select)
  }, { signal })
  // Dragging across a scatter plot adds the box to its selection. Dragging a box moves it and dragging its corner handle resizes it
  // from the opposite corner, both within the plot. Capture starts only once the pointer moves, so a plain click still reaches a box's remove button.
  sections.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target : null
    const plot = target?.closest<HTMLElement>('.graph-plot')
    const brush = plot && brushes.get(plot)
    if (!brush || !event.isPrimary || event.button || target!.closest('.graph-brush-remove')) return
    const bounds = plot.getBoundingClientRect()
    const clamp = (value: number) => Math.max(0, Math.min(1, value))
    const at = ({ clientX, clientY }: { clientX: number; clientY: number }) => [clamp((clientX - bounds.left) / bounds.width), clamp((clientY - bounds.top) / bounds.height)] as const
    const existing = target!.closest<HTMLElement>('.graph-brush'), resizing = !!target!.closest('.graph-brush-resize')
    const frame = existing?.getBoundingClientRect()
    const [startX, startY] = at(event)
    const [left, top] = frame ? at({ clientX: frame.left, clientY: frame.top }) : [startX, startY]
    const [right, bottom] = frame ? at({ clientX: frame.right, clientY: frame.bottom }) : [startX, startY]
    let ends: readonly [number, number, number, number] | null = null
    const box = existing ?? Object.assign(document.createElement('span'), { className: 'graph-brush' })
    const move = (moveEvent: PointerEvent) => {
      const [x, y] = at(moveEvent)
      const dx = Math.max(-left, Math.min(1 - right, x - startX)), dy = Math.max(-top, Math.min(1 - bottom, y - startY))
      const next = existing && !resizing ? [left + dx, top + dy, right + dx, bottom + dy] as const : [left, top, x, y] as const
      // A box needs some height and width, and a move some distance; smaller moves stay a click.
      if (!ends && (existing && !resizing ? Math.hypot(dx * bounds.width, dy * bounds.height) < 3
        : Math.abs(next[2] - next[0]) * bounds.width < 6 || Math.abs(next[3] - next[1]) * bounds.height < 6)) return
      if (!ends) {
        plot.setPointerCapture(event.pointerId)
        if (!existing) plot.append(box)
      }
      ends = next
      const [x0, y0, x1, y1] = next
      Object.assign(box.style, { left: `${Math.min(x0, x1) * 100}%`, top: `${Math.min(y0, y1) * 100}%`, right: `${(1 - Math.max(x0, x1)) * 100}%`, bottom: `${(1 - Math.max(y0, y1)) * 100}%` })
    }
    const finish = (finishEvent: PointerEvent) => {
      plot.removeEventListener('pointermove', move)
      plot.removeEventListener('pointerup', finish)
      plot.removeEventListener('pointercancel', finish)
      if (!existing) box.remove()
      if (ends && finishEvent.type === 'pointerup') toggleSelection(plot.closest<HTMLElement>('[data-section]')!.dataset.section!, brush(...ends), existing?.dataset.key)
      // A cancelled move or resize puts the box back.
      else if (ends && existing) render()
    }
    plot.addEventListener('pointermove', move)
    plot.addEventListener('pointerup', finish)
    plot.addEventListener('pointercancel', finish)
  }, { signal })
  sections.addEventListener('input', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.closest('.graph-bins')) setBins(event.target, Number(event.target.value))
  }, { signal })
  expand.addEventListener('click', () => setExpanded(!filterBar.hasAttribute('data-expanded')), { signal })
  clear.addEventListener('click', () => {
    filters.clear()
    applyFilters()
  }, { signal })
  const save = (): SavedGraphSelection[] => [...filters].flatMap(([section, chosen]) => [...chosen.values()].map(({ key, label, range }) =>
    ({ section, key, label, ...(range && { range: range.map((end) => Number.isFinite(end) ? end : null) }) })))
  // Rebuilds saved selections from each graph rendered over every shown object; selections without a matching entry are dropped.
  const restore = (saved: readonly SavedGraphSelection[]) => {
    filters.clear()
    const graphOptions = options()
    const context: GraphContext = { ...graphOptions, ...view(graphOptions.items), full: null, chosen: [], logScale: true, bins: 0 }
    const { objects } = context
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
      const columns = range && body.querySelector('.graph-columns, .graph-plot')
      const build = columns ? rangeTests.get(columns) : undefined
      const ends = range?.map((end, index) => end ?? (index % 2 ? Infinity : -Infinity))
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
