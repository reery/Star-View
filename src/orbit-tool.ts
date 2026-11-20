import { Orbit, Sparkles, Telescope, Timer, createElement, type IconNode } from 'lucide'
import { starDisplayColor, temperatureToColor, type StarColorMode } from './astronomy'
import type { Star } from './catalog-model'
import { drawing, note, number, player, readouts, slider, svgNode, text } from './glossary-widget'
import type { StarSystem } from './star-systems'
import { barycenterMarker, orbitScaleBar, stellarMarker } from './stellar-system-card'
import { binaryForOrbit, eccentricAnomaly, loadStellarOrbits, orbitalPlanePoint, stellarOrbitsForSystem, type BinaryPair } from './stellar-orbits'

/** Notable pairs with well-measured orbits; their values come from the catalog's orbit and star records. */
export const NOTABLE_ORBITS = [
  ['alpha-centauri', 'alpha-centauri-0'],
  ['sirius', 'sirius-0'],
  ['procyon', 'procyon-0'],
  ['capella', 'capella-0'],
  ['kruger-60', 'kruger-60-0'],
  ['luyten-726-8', 'luyten-726-8-0'],
] as const

const BASIC = { masses: [1, 0.5], axisAu: 10, eccentricity: 0.3 } as const
const MASS_RANGE = [0.05, 60] as const
const AXIS_RANGE_AU = [0.01, 2000] as const
const PERIOD_RANGE_YEARS = [0.001, 100_000] as const
/** One astronomical unit per Julian year, in km/s. */
const KM_S_PER_AU_YEAR = 149_597_870.7 / (365.25 * 86_400)
const SPEEDS = [['slow', 'Slow', 20_000], ['normal', 'Normal', 8000], ['fast', 'Fast', 3000]] as const
const NORMAL_SPEED = 1
const CENTER = { x: 220, y: 118 }
const TRAIL_SAMPLES = 32

const ICON_SIZE = { width: 20, height: 20, 'stroke-width': 1.7, 'aria-hidden': 'true' } as const
/** Three columns rising left to right, one more filled per faster speed. */
const speedIcon = (speed: number): IconNode => [4, 10, 16].map((x, index) =>
  ['rect', { x, y: 15 - 5 * index, width: 4, height: 5 + 5 * index, rx: 1, fill: index <= speed ? 'currentColor' : 'none' }])
/** Two stars held apart by a line: the orbit set by its separation. */
const SeparationIcon: IconNode = [['circle', { cx: 5, cy: 12, r: 3 }], ['circle', { cx: 19, cy: 12, r: 3 }], ['path', { d: 'M8 12h8' }]]
const SET_BY = { axis: ['separation', SeparationIcon], period: ['period', Timer] } as const

/** Kepler's third law in solar units: years, astronomical units and solar masses. */
export const keplerPeriodYears = (axisAu: number, totalMass: number) => Math.sqrt(axisAu ** 3 / totalMass)
export const keplerAxisAu = (periodYears: number, totalMass: number) => Math.cbrt(periodYears ** 2 * totalMass)

/** Relative orbital speed from the vis-viva equation, in km/s. */
export function relativeSpeedKmS(totalMass: number, axisAu: number, distanceAu: number): number {
  return 2 * Math.PI * Math.sqrt(totalMass * (2 / distanceAu - 1 / axisAu)) * KM_S_PER_AU_YEAR
}

/** Decimal places that give the smallest value of a changing quantity two significant digits; larger values keep them. */
export const fixedDigits = (smallest: number) => Math.max(0, 1 - Math.floor(Math.log10(smallest)))
const fixed = (value: number, digits: number) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** Hours, days or years, picked by `scale`, so a time within an orbit shares the period's unit. */
export function formatDuration(years: number, scale = years): string {
  if (scale < 1 / 365.25) return `${number(years * 365.25 * 24)} hours`
  if (scale < 1) return `${number(years * 365.25)} days`
  return `${number(years)} years`
}

export interface OrbitToolHost {
  /** A reviewed system on the map. */
  systemById(id: string): StarSystem | undefined
  /** The same system from a catalog that holds every notable pair, for pairs the map lacks. */
  catalogSystemById(id: string): Promise<StarSystem | undefined>
  colorMode(): StarColorMode
}

interface Member {
  mass: number
  /** The catalog star while its mass is unchanged; its color and name follow the record. */
  star: Star | null
}

export function initializeOrbitTool(container: HTMLElement, signal: AbortSignal, host: OrbitToolHost): { open(pair?: BinaryPair): void; reset(): void } {
  const members: [Member, Member] = [{ mass: BASIC.masses[0], star: null }, { mass: BASIC.masses[1], star: null }]
  let axis: number = BASIC.axisAu
  let eccentricity: number = BASIC.eccentricity
  let period = keplerPeriodYears(axis, members[0].mass + members[1].mass)
  let setBy: 'axis' | 'period' = 'axis'
  let phase = 0
  let speed = NORMAL_SPEED
  /** The catalog pair on display, until a value changes. */
  let loaded: BinaryPair | null = null
  /** The pair last chosen or opened, which a reset returns to; null for the basic setup. */
  let chosen: BinaryPair | null = null
  let opened: BinaryPair | null = null
  const notable = new Map<string, BinaryPair>()

  /** A row naming a part of the tool by an icon and a title, as the detail cards' fact tiles do. */
  const heading = (host: HTMLElement, icon: IconNode, title: HTMLElement) => {
    const row = Object.assign(document.createElement('div'), { className: 'orbit-tool-tile-heading' })
    title.classList.add('luminosity-factor-title')
    const symbol = createElement(icon, ICON_SIZE)
    symbol.classList.add('luminosity-factor-icon')
    row.append(symbol, title)
    host.append(row)
    return row
  }
  const tiles = () => container.appendChild(Object.assign(document.createElement('div'), { className: 'planet-facts-grid orbit-tool-tiles' }))
  const tile = (host: HTMLElement, className: string) => host.appendChild(Object.assign(document.createElement('section'), { className: `planet-fact-tile ${className}` }))

  // The system and its orbit's size side by side.
  const summary = tile(tiles(), 'orbit-tool-summary')
  const system = summary.appendChild(Object.assign(document.createElement('div'), { className: 'orbit-tool-system' }))
  const select = Object.assign(document.createElement('select'), { id: 'orbit-tool-system' })
  heading(system, Telescope, Object.assign(document.createElement('label'), { htmlFor: select.id, textContent: 'System' }))
  system.append(select)
  const [periodValue, axisValue, closest, farthest] = readouts(summary, ['Orbit', 'Semi-major axis', 'Closest approach', 'Farthest apart'])

  const svg = drawing(container, 214, 'Two stars orbiting their common center of mass, seen face-on', 440)
  const orbits = [svgNode('path', { class: 'planet-orbit stellar-orbit' }), svgNode('path', { class: 'planet-orbit stellar-orbit' })]
  const trails = [svgNode('path', { class: 'orbit-tool-trail' }), svgNode('path', { class: 'orbit-tool-trail' })]
  const link = svgNode('line', { class: 'gw-guide' })
  const markerLayer = svgNode('g')
  const scaleLayer = svgNode('g')
  const apart = text('', 8, 14, 'start', 'planet-diagram-label orbit-tool-live')
  const speeds = [text('', 432, 14, 'end', 'planet-diagram-label orbit-tool-live'), text('', 432, 32, 'end', 'planet-diagram-label orbit-tool-live')]
  svg.append(...orbits, ...trails, link,
    barycenterMarker(CENTER.x, CENTER.y, 'Center of mass: the point both stars orbit. Star symbols are enlarged.'),
    markerLayer, scaleLayer, apart, ...speeds, text('Center of mass ⊕', 8, 208, 'start', 'planet-diagram-label'))
  const markers: SVGGElement[] = []

  const timeline = Object.assign(document.createElement('div'), { className: 'orbit-tool-timeline' })
  container.append(timeline)
  const pause = player(timeline, signal, (elapsedMs) => {
    phase = (phase + elapsedMs / SPEEDS[speed]![2]) % 1
    time.set(phase)
    renderPositions()
  }, 'orbit')
  const time = slider(timeline, { label: 'Time since closest approach', term: 'periastron', min: 0, max: 1, value: 0,
    format: (value) => `${formatDuration(value * period, period)} of ${formatDuration(period)}`, signal, onInput: (value) => { phase = value; renderPositions() } })
  const speedButton = Object.assign(document.createElement('button'), { type: 'button', className: 'panel-lock orbit-tool-speed' })
  timeline.append(speedButton)
  speedButton.addEventListener('click', () => setSpeed((speed + 1) % SPEEDS.length), { signal })

  const groups = tiles()
  const starsGroup = tile(groups, 'orbit-tool-group')
  heading(starsGroup, Sparkles, Object.assign(document.createElement('h3'), { textContent: 'Stars' }))
  const orbitGroup = tile(groups, 'orbit-tool-group')
  const setByButton = Object.assign(document.createElement('button'), { type: 'button', className: 'panel-lock orbit-tool-set-by' })
  heading(orbitGroup, Orbit, Object.assign(document.createElement('h3'), { textContent: 'Orbit' })).append(setByButton)
  setByButton.addEventListener('click', () => setSetBy(setBy === 'axis' ? 'period' : 'axis'), { signal })
  const massSliders = members.map((member, index) => slider(starsGroup, {
    label: `Mass of star ${index ? 'B' : 'A'}`, term: 'mass', min: MASS_RANGE[0], max: MASS_RANGE[1], log: true, value: member.mass, unit: 'M☉',
    format: (value) => `${number(value)} solar masses`, signal,
    onInput: (value) => {
      member.mass = value
      member.star = null
      changed()
    },
  }))
  const axisSlider = slider(orbitGroup, { label: 'Semi-major axis', term: 'semi-major-axis', min: AXIS_RANGE_AU[0], max: AXIS_RANGE_AU[1], log: true, value: axis, unit: 'AU',
    format: (value) => `${number(value)} astronomical units`, signal, onInput: (value) => { axis = value; changed() } })
  const periodSlider = slider(orbitGroup, { label: 'Orbital period', term: 'orbital-period', min: PERIOD_RANGE_YEARS[0], max: PERIOD_RANGE_YEARS[1], log: true, value: period, unit: 'years',
    format: (value) => formatDuration(value), signal, onInput: (value) => { period = value; changed() } })
  const eccentricitySlider = slider(orbitGroup, { label: 'Eccentricity', term: 'eccentricity', min: 0, max: 0.95, value: eccentricity, unit: '',
    format: (value) => number(value), signal, onInput: (value) => { eccentricity = value; changed() } })

  const source = note(container, '')
  note(container, 'Seen face-on, closest approach to the right. Star symbols are enlarged. A star whose mass you change takes the color of a main-sequence star of that mass.')

  function setSpeed(next: number): void {
    speed = next
    const [id, label] = SPEEDS[speed]!
    speedButton.dataset.speed = id
    speedButton.replaceChildren(createElement(speedIcon(speed), ICON_SIZE))
    speedButton.title = `${label} playback`
    speedButton.setAttribute('aria-label', `Playback speed: ${label.toLowerCase()}. Change speed`)
  }

  /** The slider the orbit is set by shows; the button shows that choice's icon. */
  function setSetBy(next: typeof setBy): void {
    setBy = next
    axisSlider.row.hidden = setBy !== 'axis'
    periodSlider.row.hidden = setBy !== 'period'
    const [name, icon] = SET_BY[setBy]
    setByButton.replaceChildren(createElement(icon, ICON_SIZE))
    setByButton.title = `Orbit set by ${name}`
    setByButton.setAttribute('aria-label', `Orbit set by ${name}. Set it by ${SET_BY[setBy === 'axis' ? 'period' : 'axis'][0]} instead`)
  }

  function totalMass(): number {
    return members[0].mass + members[1].mass
  }

  /** A value changed: the period or the axis follows from Kepler's third law, and the pair is no longer the catalog's. */
  function changed(): void {
    if (setBy === 'axis') {
      period = keplerPeriodYears(axis, totalMass())
      periodSlider.set(Math.min(PERIOD_RANGE_YEARS[1], Math.max(PERIOD_RANGE_YEARS[0], period)))
    } else {
      axis = keplerAxisAu(period, totalMass())
      axisSlider.set(Math.min(AXIS_RANGE_AU[1], Math.max(AXIS_RANGE_AU[0], axis)))
    }
    loaded = null
    select.value = ''
    render()
  }

  function apply(pair: BinaryPair | null): void {
    loaded = chosen = pair
    members.forEach((member, index) => {
      member.star = pair?.stars[index] ?? null
      member.mass = member.star?.mass_solar ?? BASIC.masses[index]!
      massSliders[index]!.set(member.mass)
    })
    // The catalog's measured period and axis both show as published, even where Kepler's law with the catalog masses differs slightly.
    axis = pair?.orbit.semiMajorAxisAu ?? BASIC.axisAu
    eccentricity = pair?.orbit.eccentricity ?? BASIC.eccentricity
    period = pair?.orbit.periodYears ?? keplerPeriodYears(axis, totalMass())
    axisSlider.set(axis)
    periodSlider.set(period)
    eccentricitySlider.set(eccentricity)
    phase = 0
    time.set(0)
    select.value = pair?.orbit.id ?? 'basic'
    render()
  }

  function memberColor(member: Member): string {
    // Main-sequence stars run roughly as T ∝ M^0.5 around the Sun's mass; only an illustration.
    return member.star ? starDisplayColor(member.star, host.colorMode()).getStyle()
      : temperatureToColor(Math.min(40_000, 5772 * Math.sqrt(member.mass)), host.colorMode()).getStyle()
  }

  let pixelsPerAu = 1
  /** The live labels keep their decimals through an orbit, so they don't flicker between precisions. */
  let distanceDigits = 0
  let speedDigits = 0
  /** Unit-axis position of the relative orbit at a fraction of the period since periastron. */
  const relative = (fraction: number) => orbitalPlanePoint({ eccentricity }, eccentricAnomaly(2 * Math.PI * (fraction - Math.floor(fraction)), eccentricity))
  const factors = () => [-members[1].mass / totalMass(), members[0].mass / totalMass()] as const
  const screen = (point: { x: number; y: number }, factor: number) =>
    ({ x: CENTER.x + point.x * factor * axis * pixelsPerAu, y: CENTER.y + point.y * factor * axis * pixelsPerAu })

  function render(): void {
    const [a, b] = factors()
    // The view keeps the center of mass fixed and zooms in steps, so a growing orbit visibly grows before the view rescales.
    // The lighter star's orbit is the larger one; it reaches farthest at apastron.
    const reach = Math.max(-a, b) * axis
    const auPerPixel = Math.max(reach * (1 + eccentricity) / 200, reach * Math.sqrt(1 - eccentricity ** 2) / 68)
    const step = 10 ** Math.floor(Math.log10(auPerPixel))
    pixelsPerAu = 1 / ([1, 1.5, 2, 3, 5, 7.5, 10].find((multiple) => multiple * step >= auPerPixel)! * step)
    const samples = Array.from({ length: 129 }, (_, index) => orbitalPlanePoint({ eccentricity }, index / 128 * 2 * Math.PI))
    ;[a, b].forEach((factor, index) => {
      orbits[index]!.setAttribute('d', samples.map((point, i) => {
        const { x, y } = screen(point, factor)
        return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`
      }).join(' ') + ' Z')
    })
    scaleLayer.replaceChildren(orbitScaleBar(pixelsPerAu, 'Distance scale in the orbital plane, in astronomical units.', 432, 190))
    markers.splice(0, markers.length, ...members.map((member, index) => {
      const label = index ? 'B' : 'A'
      return stellarMarker(memberColor(member), member.star?.name ?? `Star ${label}`, label, 0, 0)
    }))
    markerLayer.replaceChildren(...markers)
    members.forEach((member, index) => trails[index]!.setAttribute('stroke', memberColor(member)))

    periodValue!(formatDuration(period))
    axisValue!(`${number(axis)} AU`)
    closest!(`${number(axis * (1 - eccentricity))} AU`)
    farthest!(`${number(axis * (1 + eccentricity))} AU`)
    distanceDigits = fixedDigits(axis * (1 - eccentricity))
    // The heavier star moves slowest, most of all when the pair is farthest apart.
    speedDigits = fixedDigits(relativeSpeedKmS(totalMass(), axis, axis * (1 + eccentricity)) * Math.min(...members.map(({ mass }) => mass)) / totalMass())
    time.set(phase)
    renderSource()
    renderPositions()
  }

  function renderSource(): void {
    source.hidden = !loaded
    if (!loaded) return
    const { orbit } = loaded
    const reference = Object.assign(document.createElement('a'), { href: orbit.sourceUrl, target: '_blank', rel: 'noopener noreferrer', textContent: orbit.reference })
    reference.title = orbit.catalog
    source.replaceChildren(`${loaded.name}: orbit from `, reference, ', masses from the catalog.')
  }

  function renderPositions(): void {
    const factorPair = factors()
    const point = relative(phase)
    const positions = factorPair.map((factor) => screen(point, factor))
    positions.forEach(({ x, y }, index) => {
      markers[index]?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
      // The trail covers the last fifth of an orbit, ending at the star.
      trails[index]!.setAttribute('d', Array.from({ length: TRAIL_SAMPLES + 1 }, (_, i) => {
        const point = screen(relative(phase - 0.2 * (1 - i / TRAIL_SAMPLES)), factorPair[index]!)
        return `${i ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`
      }).join(' '))
    })
    link.setAttribute('x1', positions[0]!.x.toFixed(2))
    link.setAttribute('y1', positions[0]!.y.toFixed(2))
    link.setAttribute('x2', positions[1]!.x.toFixed(2))
    link.setAttribute('y2', positions[1]!.y.toFixed(2))
    // Vis-viva gives the relative speed at this distance; each star moves its mass share of it around the center of mass.
    const distance = axis * Math.hypot(point.x, point.y)
    const relativeSpeed = relativeSpeedKmS(totalMass(), axis, distance)
    apart.textContent = `${fixed(distance, distanceDigits)} AU apart`
    speeds.forEach((label, index) => { label.textContent = `${index ? 'B' : 'A'}  ${fixed(relativeSpeed * members[1 - index]!.mass / totalMass(), speedDigits)} km/s` })
  }

  function renderOptions(): void {
    const option = (value: string, label: string, hidden = false) => Object.assign(document.createElement('option'), { value, textContent: label, hidden, disabled: hidden })
    const real = Object.assign(document.createElement('optgroup'), { label: 'Real systems' })
    const pairs = [...notable.values()]
    if (opened && !notable.has(opened.orbit.id)) pairs.unshift(opened)
    real.append(...pairs.map((pair) => option(pair.orbit.id, pair.name)))
    select.replaceChildren(option('', 'Custom', true), option('basic', 'Basic setup'), real)
    select.value = loaded?.orbit.id ?? (select.value || '')
  }

  select.addEventListener('change', () => {
    if (select.value === 'basic') apply(null)
    else {
      const pair = notable.get(select.value) ?? (opened?.orbit.id === select.value ? opened : null)
      if (pair) apply(pair)
    }
  }, { signal })

  // Notable pairs load once, from the map's records where it has both stars.
  let notableLoad: Promise<void> | undefined
  function loadNotable(): void {
    notableLoad ??= Promise.all(NOTABLE_ORBITS.map(async ([systemId, orbitId]) => {
      for (const lookup of [async (id: string) => host.systemById(id), host.catalogSystemById]) {
        const system = await lookup(systemId)
        if (!system) continue
        await loadStellarOrbits(system.id)
        const orbit = stellarOrbitsForSystem(system).find(({ id }) => id === orbitId)
        const pair = orbit && binaryForOrbit(system, orbit)
        if (pair) return pair
      }
      return null
    })).then((pairs) => {
      for (const pair of pairs) if (pair) notable.set(pair.orbit.id, pair)
      renderOptions()
    }, () => { notableLoad = undefined })
  }

  setSpeed(NORMAL_SPEED)
  setSetBy('axis')
  apply(null)
  renderOptions()
  return {
    /** Back to the chosen pair, or the basic setup, at closest approach, paused, at normal speed. */
    reset() {
      pause()
      setSpeed(NORMAL_SPEED)
      setSetBy('axis')
      apply(chosen)
    },
    open(pair) {
      loadNotable()
      if (!pair) return render()
      opened = pair
      renderOptions()
      apply(pair)
    },
  }
}
