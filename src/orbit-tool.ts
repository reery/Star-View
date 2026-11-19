import { starDisplayColor, temperatureToColor, type StarColorMode } from './astronomy'
import type { Star } from './catalog-model'
import { choices, drawing, note, number, player, readouts, slider, svgNode, text } from './glossary-widget'
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
const CENTER = { x: 220, y: 100 }
const TRAIL_SAMPLES = 32

/** Kepler's third law in solar units: years, astronomical units and solar masses. */
export const keplerPeriodYears = (axisAu: number, totalMass: number) => Math.sqrt(axisAu ** 3 / totalMass)
export const keplerAxisAu = (periodYears: number, totalMass: number) => Math.cbrt(periodYears ** 2 * totalMass)

/** Relative orbital speed from the vis-viva equation, in km/s. */
export function relativeSpeedKmS(totalMass: number, axisAu: number, distanceAu: number): number {
  return 2 * Math.PI * Math.sqrt(totalMass * (2 / distanceAu - 1 / axisAu)) * KM_S_PER_AU_YEAR
}

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

export function initializeOrbitTool(container: HTMLElement, signal: AbortSignal, host: OrbitToolHost): { open(pair?: BinaryPair): void } {
  const members: [Member, Member] = [{ mass: BASIC.masses[0], star: null }, { mass: BASIC.masses[1], star: null }]
  let axis: number = BASIC.axisAu
  let eccentricity: number = BASIC.eccentricity
  let period = keplerPeriodYears(axis, members[0].mass + members[1].mass)
  let setBy: 'axis' | 'period' = 'axis'
  let phase = 0
  let orbitMs: number = SPEEDS[1][2]
  /** The catalog pair on display, until a value changes. */
  let loaded: BinaryPair | null = null
  let opened: BinaryPair | null = null
  const notable = new Map<string, BinaryPair>()

  const systemRow = Object.assign(document.createElement('div'), { className: 'range-heading orbit-tool-system' })
  const select = Object.assign(document.createElement('select'), { id: 'orbit-tool-system' })
  systemRow.append(Object.assign(document.createElement('label'), { htmlFor: select.id, textContent: 'System' }), select)
  container.append(systemRow)

  const svg = drawing(container, 196, 'Two stars orbiting their common center of mass, seen face-on', 440)
  const orbits = [svgNode('path', { class: 'planet-orbit stellar-orbit' }), svgNode('path', { class: 'planet-orbit stellar-orbit' })]
  const trails = [svgNode('path', { class: 'orbit-tool-trail' }), svgNode('path', { class: 'orbit-tool-trail' })]
  const link = svgNode('line', { class: 'gw-guide' })
  const markerLayer = svgNode('g')
  const scaleLayer = svgNode('g')
  svg.append(...orbits, ...trails, link,
    barycenterMarker(CENTER.x, CENTER.y, 'Center of mass: the point both stars orbit. Star symbols are enlarged.'),
    markerLayer, scaleLayer, text('Center of mass ⊕', 8, 190, 'start', 'planet-diagram-label'))
  const markers: SVGGElement[] = []

  const timeline = Object.assign(document.createElement('div'), { className: 'orbit-tool-timeline' })
  container.append(timeline)
  player(timeline, signal, (elapsedMs) => {
    phase = (phase + elapsedMs / orbitMs) % 1
    time.set(phase)
    renderPositions()
  })
  const time = slider(timeline, { label: 'Time since closest approach', term: 'periastron', min: 0, max: 1, value: 0,
    format: (value) => `${formatDuration(value * period, period)} of ${formatDuration(period)}`, signal, onInput: (value) => { phase = value; renderPositions() } })
  choices(timeline, 'Playback speed', SPEEDS.map(([id, label]) => [id, label] as const), 'normal', signal, (id) => {
    orbitMs = SPEEDS.find(([candidate]) => candidate === id)![2]
  })

  const groups = Object.assign(document.createElement('div'), { className: 'orbit-tool-groups' })
  const group = (title: string) => {
    const section = Object.assign(document.createElement('section'), { className: 'orbit-tool-group' })
    section.append(Object.assign(document.createElement('h3'), { className: 'card-subgroup-heading', textContent: title }))
    groups.append(section)
    return section
  }
  const starsGroup = group('Stars')
  const orbitGroup = group('Orbit')
  container.append(groups)
  const massSliders = members.map((member, index) => slider(starsGroup, {
    label: `Mass of star ${index ? 'B' : 'A'}`, term: 'mass', min: MASS_RANGE[0], max: MASS_RANGE[1], log: true, value: member.mass, unit: 'M☉',
    format: (value) => `${number(value)} solar masses`, signal,
    onInput: (value) => {
      member.mass = value
      member.star = null
      changed()
    },
  }))
  choices(orbitGroup, 'Set the orbit by', [['axis', 'Separation'], ['period', 'Period']], setBy, signal, (value) => {
    setBy = value
    axisSlider.row.hidden = setBy !== 'axis'
    periodSlider.row.hidden = setBy !== 'period'
  })
  const axisSlider = slider(orbitGroup, { label: 'Semi-major axis', term: 'semi-major-axis', min: AXIS_RANGE_AU[0], max: AXIS_RANGE_AU[1], log: true, value: axis, unit: 'AU',
    format: (value) => `${number(value)} astronomical units`, signal, onInput: (value) => { axis = value; changed() } })
  const periodSlider = slider(orbitGroup, { label: 'Orbital period', term: 'orbital-period', min: PERIOD_RANGE_YEARS[0], max: PERIOD_RANGE_YEARS[1], log: true, value: period, unit: 'years',
    format: (value) => formatDuration(value), signal, onInput: (value) => { period = value; changed() } })
  periodSlider.row.hidden = true
  const eccentricitySlider = slider(orbitGroup, { label: 'Eccentricity', term: 'eccentricity', min: 0, max: 0.95, value: eccentricity, unit: '',
    format: (value) => number(value), signal, onInput: (value) => { eccentricity = value; changed() } })

  const [periodValue, axisValue, closest, farthest, center, speedA, speedB] = readouts(container,
    ['One orbit takes', 'Semi-major axis', 'Closest approach', 'Farthest apart', 'Center of mass', 'Speed of A', 'Speed of B'])
  const source = note(container, '')
  note(container, 'Seen face-on, closest approach to the right. Star symbols are enlarged. A star whose mass you change takes the color of a main-sequence star of that mass.')

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
    loaded = pair
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

    const mass = totalMass()
    const speed = (distance: number) => relativeSpeedKmS(mass, axis, distance)
    const [nearest, widest] = [axis * (1 - eccentricity), axis * (1 + eccentricity)]
    const formatSpeed = (share: number) => `${number(speed(widest) * share)}–${number(speed(nearest) * share)} km/s`
    periodValue!(formatDuration(period))
    axisValue!(`${number(axis)} AU`)
    closest!(`${number(nearest)} AU`)
    farthest!(`${number(widest)} AU`)
    center!(`${number(axis * members[1].mass / mass)} AU from A`)
    speedA!(formatSpeed(members[1].mass / mass))
    speedB!(formatSpeed(members[0].mass / mass))
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
    const positions = factorPair.map((factor) => screen(relative(phase), factor))
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

  apply(null)
  renderOptions()
  return {
    open(pair) {
      loadNotable()
      if (!pair) return render()
      opened = pair
      renderOptions()
      apply(pair)
    },
  }
}
