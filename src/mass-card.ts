import { ArrowDownToLine, Atom, CircleDashed, Flame, Hourglass, Weight } from 'lucide'
import type { StarColorMode } from './astronomy'
import { isCompactObject, type Star } from './catalog-model'
import { renderFact, type Fact } from './comparison-tiles'
import { MISSING_VALUE } from './format'
import { typicalMassClass, type TypicalMassClass } from './mass-comparison'
import { JUPITER_MASS_SOLAR, massFuel, massProperties } from './mass-properties'
import { renderPlotMarkers, type PlotPoint } from './plot-markers'

const number = (value: number, digits = 3) => value.toLocaleString('en-US', { maximumSignificantDigits: digits })
const superscript = (value: string) => value.replace(/[-\d]/g, (digit) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(digit)]!)
const scientific = (value: number) => {
  const [mantissa, exponent] = value.toExponential(2).split('e')
  return `${number(Number(mantissa))} × 10${superscript(String(Number(exponent)))}`
}
const factor = (value: number) => value !== 0 && (value < 0.001 || value >= 1e12) ? scientific(value)
  : value >= 1000 ? value.toLocaleString('en-US', { notation: 'compact', maximumSignificantDigits: 3 }).replace('K', 'k') : number(value)
const duration = (gyr: number): [string, string] => gyr >= 1000 ? [number(gyr / 1000, 2), 'trillion years']
  : gyr >= 1 ? [number(gyr, 2), 'billion years'] : [number(gyr * 1000, 2), 'million years']
const teaspoon = (grams: number) => grams >= 1e6 ? `${factor(grams / 1e6)}\u00a0t` : grams >= 1000 ? `${number(grams / 1000)}\u00a0kg` : `${number(grams)}\u00a0g`

function massFact(star: Star, typical: TypicalMassClass | null, comparing: boolean): Fact {
  const { mass, kilograms } = massProperties(star)
  const uncertainty = star.compact?.mass_error_solar
  const substellar = mass !== null && (mass < 0.08 || star.type === 'brown_dwarf' || star.type === 'sub_brown_dwarf')
  // A one-object sample only compares the object with itself.
  const range = mass !== null && typical?.metrics.mass.range && typical.metrics.mass.range[0] < typical.metrics.mass.range[1] ? typical.metrics.mass.range : null
  // The bar spans the class range; it extends, with a little room, only toward an outlying mass.
  const placement = range && (() => {
    const pad = (range[1] / range[0]) ** 0.1
    const low = mass! < range[0] ? mass! / pad : range[0], high = mass! > range[1] ? mass! * pad : range[1]
    const position = (value: number) => Math.log(value / low) / Math.log(high / low) * 100
    return { rangeLowPosition: position(range[0]), rangeHighPosition: position(range[1]), position: position(mass!) }
  })()
  const error = uncertainty !== null && uncertainty !== undefined && Number.isFinite(uncertainty) && uncertainty >= 0 ? [`± ${number(uncertainty)} M☉`] : []
  return {
    title: 'Mass', icon: Weight, value: mass === null ? MISSING_VALUE : number(mass), unit: mass === null ? '' : 'M☉',
    bar: placement ? {
      from: placement.rangeLowPosition, to: placement.rangeHighPosition, marker: placement.position,
      caption: `Typical ${typical!.label.replace(/^[A-Z](?=[a-z])/, (letter) => letter.toLowerCase())}`, ends: [number(range![0]), `${number(range![1])}\u00a0M☉`],
    } : undefined,
    notes: mass === null ? ['Catalog mass unavailable.'] : [
      ...error,
      // Paired cells are too narrow for a conversion; a range bar leaves room for one line.
      ...(comparing || (range && error.length) ? [] : [substellar ? `${number(mass / JUPITER_MASS_SOLAR)} Jupiter masses` : `${scientific(kilograms!)} kg`]),
    ],
  }
}

function gravityFact(star: Star): Fact {
  const { mass, radius, gravity, escapeKms, horizonKm } = massProperties(star)
  if (horizonKm !== null) return { title: 'Event horizon', icon: CircleDashed, value: number(horizonKm), unit: 'km radius', notes: [`${number(horizonKm * 2)}\u00a0km across`] }
  const fact = { title: 'Surface gravity', icon: ArrowDownToLine }
  if (gravity === null) return { ...fact, value: MISSING_VALUE, unit: '', notes: [star.type === 'black_hole' ? 'Catalog mass needed.'
    : isCompactObject(star) ? 'Needs a radius and a relativistic model.' : mass === null ? 'Catalog mass needed.' : radius === null ? 'Catalog radius needed.' : ''] }
  return { ...fact, value: factor(gravity / 9.80665), unit: '× Earth', notes: [`${factor(gravity)}\u00a0m/s²`, `Escape ${factor(escapeKms!)}\u00a0km/s`] }
}

function fuelFact(star: Star): Fact {
  const fuel = massFuel(star)
  if (fuel.kind === 'lifetime') {
    const [value, unit] = duration(fuel.gyr)
    const age = star.age_gyr !== null && Number.isFinite(star.age_gyr) && star.age_gyr > 0 ? star.age_gyr : null
    return {
      title: 'Fuel lifetime', icon: Hourglass, value: `${fuel.lowerBound ? '>' : '~'}${value}`, unit,
      bar: age === null ? undefined : { from: 0, to: Math.min(100, age / fuel.gyr * 100) },
      notes: age === null ? [] : [age > fuel.gyr ? `Age ${number(age, 2)} Gyr exceeds this estimate` : `Age ${number(age, 2)} Gyr · ${number(age / fuel.gyr * 100, 2)}% used`],
    }
  }
  if (fuel.kind === 'burn-rate') return { title: 'Burn rate', icon: Flame, value: factor(fuel.ratio), unit: '× Sun’s rate', notes: [fuel.reason] }
  if (fuel.kind === 'density') return {
    title: 'Mean density', icon: Atom, value: fuel.density === null ? MISSING_VALUE : factor(fuel.density), unit: fuel.density === null ? '' : 'g/cm³',
    notes: [...(fuel.density === null ? [] : [`Teaspoon ≈ ${teaspoon(fuel.density * 5)}`]), fuel.reason],
  }
  if (fuel.kind === 'no-fusion') return { title: 'Fusion', icon: Flame, value: fuel.label, unit: '', notes: [fuel.reason] }
  return { title: 'Fuel lifetime', icon: Hourglass, value: MISSING_VALUE, unit: '', notes: [fuel.reason] }
}

// A fading zone starts its shading at `fade[0]` and reaches full strength at `fade[1]`.
type Zone = { from: number; to: number; label: string; key: string; fade?: readonly [number, number] }
// Broad single-star outcomes by initial mass: https://science.nasa.gov/universe/stars/types/
const STELLAR_SPECTRUM = {
  heading: 'Fate by birth mass', low: 0.01, high: 100,
  zones: [
    { from: 0, to: 0.08, label: 'Brown dwarf', key: 'substellar' },
    { from: 0.08, to: 8, label: '→ White dwarf', key: 'white-dwarf' },
    { from: 8, to: Infinity, label: '→ Supernova', key: 'collapse', fade: [6, 10] },
  ] as Zone[],
  limits: [[0.08, 'Hydrogen-burning limit: lighter objects never ignite hydrogen'], [8, 'Core-collapse boundary (initial mass); 6–10 M☉ is a transition']] as const,
}
const REMNANT_SPECTRUM = {
  heading: 'Remnant mass limits', low: 0.1, high: 100,
  zones: [
    { from: 0, to: 1.4, label: 'White dwarf', key: 'white-dwarf' },
    { from: 1.4, to: 2.3, label: 'Neutron star', key: 'neutron-star' },
    { from: 2.3, to: Infinity, label: 'Black hole', key: 'collapse' },
  ] as Zone[],
  limits: [[1.4, 'Chandrasekhar limit: the heaviest a white dwarf can be'], [2.3, 'Approximate neutron-star maximum (about 2.2–2.5 M☉)']] as const,
}

export function renderMassCardContent(card: HTMLElement, star: Star, origin: Star, sun: Star, colorMode: StarColorMode, other?: Star): void {
  const get = (id: string) => card.querySelector<HTMLElement>(`#${id}`)!
  const set = (id: string, content: string) => { get(id).textContent = content }
  const comparing = other !== undefined
  const shown = comparing ? [star, other] : [star]
  card.classList.toggle('has-comparison', comparing)
  const typical = shown.map((object) => typicalMassClass(object))
  const facts = shown.map((object, index) => [massFact(object, typical[index] ?? null, comparing), gravityFact(object), fuelFact(object)])
  get('mass-facts').replaceChildren(...facts[0]!.map((_, row) => renderFact(facts.map((entry) => entry[row]!), shown, colorMode, row === 0)))

  const isRemnant = (object: Star) => object.type === 'white_dwarf' || isCompactObject(object)
  const remnant = isRemnant(star)
  const spectrum = remnant ? REMNANT_SPECTRUM : STELLAR_SPECTRUM
  set('mass-spectrum-heading', spectrum.heading)
  // Comparison mode plots the pair; otherwise the selected object, the origin and the Sun.
  // Each axis shows only its own kind: remnant masses are not birth masses.
  const plotted = [...new Map((comparing ? [star, other, sun] : [star, origin, sun]).map((object) => [object.id, object])).values()]
    .filter((object) => isRemnant(object) === remnant)
    .flatMap((object) => { const { mass } = massProperties(object); return mass === null ? [] : [{ object, mass }] })
  // Keep the familiar range; extend by whole decades only for outlying plotted masses.
  const masses = plotted.map(({ mass }) => mass)
  const low = Math.min(spectrum.low, ...masses.map((mass) => 10 ** Math.floor(Math.log10(mass))))
  const high = Math.max(spectrum.high, ...masses.map((mass) => 10 ** Math.ceil(Math.log10(mass))))
  const position = (value: number) => Math.max(0, Math.min(100, (Math.log10(value) - Math.log10(low)) / (Math.log10(high) - Math.log10(low)) * 100))
  const bar = get('mass-spectrum')
  const zoneBounds = ({ from, to }: Zone) => [from <= low ? 0 : position(from), to >= high ? 100 : position(to)] as const
  get('mass-zones').replaceChildren(...spectrum.zones.map((entry) => {
    const zone = document.createElement('span')
    zone.className = `mass-zone mass-zone-${entry.key}`
    const [start, end] = zoneBounds(entry.fade ? { ...entry, from: entry.fade[0] } : entry)
    zone.style.left = `${start}%`
    zone.style.width = `${end - start}%`
    if (entry.fade) zone.style.setProperty('--mass-zone-fade', `${(position(entry.fade[1]) - start) / (end - start) * 100}%`)
    return zone
  }), ...spectrum.limits.map(([value]) => {
    const limit = document.createElement('span')
    limit.className = 'mass-typical-limit'
    limit.style.left = `${position(value)}%`
    return limit
  }))
  // Start each zone name at its lower boundary, then push crowded names apart within the axis width.
  const zoneLabels = get('mass-zone-labels')
  zoneLabels.replaceChildren(...spectrum.zones.map((zone) => {
    const text = document.createElement('span')
    text.textContent = zone.label
    return text
  }))
  const labelWidth = zoneLabels.getBoundingClientRect().width
  const placed = spectrum.zones.map((zone, index) => {
    const [start] = zoneBounds(zone)
    const width = (zoneLabels.children[index] as HTMLElement).getBoundingClientRect().width
    return { width, left: Math.max(0, Math.min(labelWidth - width, start / 100 * labelWidth + (start > 0 ? 4 : 0))) }
  })
  for (let index = 1; index < placed.length; index++) placed[index]!.left = Math.max(placed[index]!.left, placed[index - 1]!.left + placed[index - 1]!.width + 8)
  for (let index = placed.length - 1; index >= 0; index--) {
    const limit = index === placed.length - 1 ? labelWidth : placed[index + 1]!.left - 8
    placed[index]!.left = Math.max(0, Math.min(placed[index]!.left, limit - placed[index]!.width))
  }
  placed.forEach(({ left }, index) => { (zoneLabels.children[index] as HTMLElement).style.left = `${left}px` })
  set('mass-spectrum-low', `${number(low)} M☉`)
  set('mass-spectrum-high', `${number(high)} M☉`)
  const axis = get('mass-spectrum-axis')
  axis.querySelectorAll('.mass-scale-help').forEach((label) => label.remove())
  const axisBounds = axis.getBoundingClientRect()
  let previousRight = axis.firstElementChild!.getBoundingClientRect().right
  for (const [value, description] of spectrum.limits) {
    const label = document.createElement('span')
    label.className = 'mass-metric-copy mass-scale-help'
    label.style.left = `${position(value)}%`
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'mass-metric-help'
    button.textContent = number(value)
    const tooltip = document.createElement('span')
    tooltip.id = `mass-limit-${String(value).replace('.', '-')}-tooltip`
    tooltip.className = 'tooltip mass-metric-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    tooltip.textContent = `${number(value)} M☉ · ${description}`
    button.setAttribute('aria-describedby', tooltip.id)
    label.append(button, tooltip)
    axis.append(label)
    // Nudge a crowded limit label right, rather than overlapping its neighbor.
    const bounds = label.getBoundingClientRect()
    const shift = Math.max(0, previousRight + 6 - bounds.left)
    if (shift) label.style.setProperty('--mass-limit-shift', `${shift}px`)
    previousRight = bounds.right + shift
    // Keep the popup inside the card while its triangle points at the limit label.
    const width = Math.min(220, axisBounds.width)
    const center = (bounds.left + bounds.right) / 2 + shift
    const left = Math.max(axisBounds.left, Math.min(center - 15, axisBounds.right - width))
    label.style.setProperty('--mass-tooltip-width', `${width}px`)
    label.style.setProperty('--mass-tooltip-offset', `${left - bounds.left - shift}px`)
    // The arrow is offset from the padding edge, inside the tooltip's 1px border.
    label.style.setProperty('--mass-tooltip-arrow', `${Math.max(10, Math.min(center - left - 5, width - 18))}px`)
  }

  const selectedClass = typical[0]
  set('mass-class-method', selectedClass?.note ?? '')
  get('mass-class-method').hidden = !selectedClass
  const source = get('mass-class-source') as HTMLAnchorElement
  source.hidden = !selectedClass?.source
  if (selectedClass?.source) {
    source.href = selectedClass.source
    source.textContent = `${selectedClass.sourceLabel} ↗`
  }

  const points: PlotPoint[] = plotted.map(({ object, mass }) => ({
    name: object.name, object, position: position(mass), value: `${number(mass)} M☉`,
    role: object.id === star.id ? 'selected' : object.id === sun.id ? 'sun' : 'reference',
  }))
  renderPlotMarkers(bar, points, colorMode, true)
  bar.setAttribute('aria-label', `${spectrum.heading}. Logarithmic axis from ${number(low)} to ${number(high)} solar masses. `
    + `${spectrum.zones.map(({ from, to, label }) => `${label}: ${from <= 0 ? `below ${number(to)}` : to === Infinity ? `above ${number(from)}` : `${number(from)} to ${number(to)}`} solar masses`).join('; ')}. `
    + `${points.map((point) => `${point.name}: ${point.value}`).join('. ')}.`)

}
