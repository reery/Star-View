import { starDisplayColor, type StarColorMode } from './astronomy'
import { Orbit, createElement } from 'lucide'
import { svgNode as svg } from './spectral-chart'
import { starComponentIdentity, type StarSystem, type StarSystemComponent } from './star-systems'
import { orbitalPlanePoint, orbitBarycenterVisible, orbitHasGeometry, orbitMassFraction, projectedOrbitPoint, stellarOrbitsForSystem, type StellarOrbit } from './stellar-orbits'

let topView = false

function componentId(component: StarSystemComponent): string {
  return starComponentIdentity(component.star.id)?.canonicalStarId ?? component.star.id
}

function starMarker(component: StarSystemComponent, x: number, y: number, colorMode: StarColorMode, labelSide: 'left' | 'right' | 'below' = 'below'): SVGGElement {
  const group = svg('g', { 'data-stellar-component': component.star.id })
  const color = starDisplayColor(component.star, colorMode).getStyle()
  group.append(svg('title', {}, component.star.name),
    svg('circle', { cx: x, cy: y, r: 13, fill: color, opacity: 0.06 }),
    svg('circle', { cx: x, cy: y, r: 8, fill: color, opacity: 0.12 }),
    svg('circle', { cx: x, cy: y, r: 4, fill: color, class: 'planet-marker' }),
    svg('circle', { cx: x, cy: y, r: 1.7, fill: '#fff8ed' }),
    svg('text', { x: x + (labelSide === 'left' ? -12 : labelSide === 'right' ? 12 : 0), y: y + (labelSide === 'below' ? 23 : 4),
      'text-anchor': labelSide === 'left' ? 'end' : labelSide === 'right' ? 'start' : 'middle', class: 'planet-diagram-label' }, component.label))
  return group
}

function stellarDiagram(system: StarSystem, orbit: StellarOrbit | undefined, colorMode: StarColorMode): SVGSVGElement {
  const diagram = svg('svg', { viewBox: '0 0 260 160', class: 'planet-orbit-diagram stellar-orbit-diagram', role: 'img' })
  const geometry = orbit && orbitHasGeometry(orbit)
  diagram.dataset.orbitView = geometry ? topView ? 'top' : 'sky' : 'unavailable'
  const description = geometry
    ? `${system.name} ${orbit.primary}–${orbit.secondary}. ${topView ? 'Top view of the orbital plane; periastron to the right.' : 'Sky-projected orbit; north up, east left.'} Stellar sizes and orbital phase are illustrative. Each pair has its own scale.`
    : `${system.name}: ${system.components.map((c) => c.label).join(', ')}. Illustrative component arrangement; a complete relative orbit is unavailable.`
  diagram.setAttribute('aria-label', description)
  diagram.append(svg('title', {}, description))
  if (!geometry) {
    const columns = Math.min(4, system.components.length)
    system.components.forEach((component, index) => {
      const row = Math.floor(index / columns)
      const count = Math.min(columns, system.components.length - row * columns)
      diagram.append(starMarker(component, 260 * ((index % columns) + 0.5) / count, system.components.length > 4 ? 43 + row * 65 : 68, colorMode))
    })
    return diagram
  }
  const fraction = orbitMassFraction(system, orbit)
  const barycentric = fraction !== null
  if (!barycentric) diagram.querySelector('title')!.textContent += ' Mass ratio unavailable; the companion is drawn relative to the primary.'
  const point = topView ? orbitalPlanePoint : projectedOrbitPoint
  const samples = Array.from({ length: 129 }, (_, index) => point(orbit, index / 128 * Math.PI * 2))
  const factors = barycentric ? [-fraction, 1 - fraction] : [0, 1]
  const points = factors.flatMap((factor) => samples.map((p) => ({ x: p.x * factor, y: p.y * factor })))
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x))
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y))
  const scale = Math.min(208 / Math.max(maxX - minX, 0.01), 96 / Math.max(maxY - minY, 0.01))
  const transform = (p: { x: number; y: number }, factor: number) => ({ x: 130 + (p.x * factor - (minX + maxX) / 2) * scale, y: 67 + (p.y * factor - (minY + maxY) / 2) * scale })
  factors.forEach((factor, index) => {
    if (factor === 0) return
    const path = samples.map((p, i) => {
      const screen = transform(p, factor)
      return `${i ? 'L' : 'M'}${screen.x.toFixed(2)},${screen.y.toFixed(2)}`
    }).join(' ') + ' Z'
    diagram.append(svg('path', { d: path, class: 'planet-orbit stellar-orbit', 'data-stellar-orbit': index ? orbit.secondary : orbit.primary }))
  })
  if (barycentric && orbitBarycenterVisible(system, orbit)) {
    const center = transform({ x: 0, y: 0 }, 1)
    const marker = svg('g', { class: 'stellar-barycenter', 'data-barycenter': orbit.id })
    marker.append(svg('title', {}, 'Center of mass: the point both members orbit, calculated from their catalog masses. Stellar symbols are enlarged.'),
      svg('circle', { cx: center.x, cy: center.y, r: 3.5, fill: '#000', stroke: 'var(--muted)', 'stroke-width': 1 }),
      svg('path', { d: `M${center.x - 6},${center.y}h12 M${center.x},${center.y - 6}v12`, stroke: 'var(--muted)', 'stroke-width': 0.7 }),
      svg('text', { x: 16, y: 149, 'text-anchor': 'start', class: 'planet-diagram-label' }, 'Center of mass ⊕'))
    diagram.append(marker)
  }
  // Fixed anomaly communicates the measured geometry without claiming today's phase.
  const phase = point(orbit, 1.15)
  ;[orbit.primaryIds, orbit.secondaryIds].forEach((ids, index) => {
    const location = transform(phase, factors[index]!)
    ids.forEach((id, memberIndex) => {
      const component = system.components.find((c) => componentId(c) === id)!
      const center = transform({ x: 0, y: 0 }, 1)
      diagram.append(starMarker(component, location.x + (memberIndex - (ids.length - 1) / 2) * 18, location.y, colorMode,
        ids.length > 1 ? 'below' : location.x < center.x ? 'left' : 'right'))
    })
  })
  // A 1/2/5 scale bar follows the pair's physical axis and current projection.
  const targetAu = 50 * orbit.semiMajorAxisAu! / scale
  const magnitude = 10 ** Math.floor(Math.log10(targetAu))
  const fractionOfMagnitude = targetAu / magnitude
  const distanceAu = (fractionOfMagnitude >= 5 ? 5 : fractionOfMagnitude >= 2 ? 2 : 1) * magnitude
  const barWidth = distanceAu / orbit.semiMajorAxisAu! * scale
  const right = 244, left = right - barWidth
  const scaleBar = svg('g', { 'data-orbit-scale-au': distanceAu })
  scaleBar.append(svg('title', {}, `Distance scale in ${topView ? 'the orbital plane' : 'the projected sky plane'}, in astronomical units.`),
    svg('path', { d: `M${left},129v6 M${left},132H${right} M${right},129v6`, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1 }),
    svg('text', { x: right, y: 149, 'text-anchor': 'end', class: 'planet-diagram-label' },
      `${distanceAu.toLocaleString('en-US', { maximumSignificantDigits: 3 })} AU`))
  diagram.append(scaleBar)
  return diagram
}

const terms = [
  ['primary', 'Primary', 'The reference star, or inner pair’s center of mass, used for this relative orbit.'],
  ['period', 'Period', 'Time for the two members to complete one orbit relative to each other.'],
  ['axis', 'Semi-major axis', 'Half the long diameter of the true relative orbit, in astronomical units. One AU is the mean Earth–Sun distance.'],
  ['eccentricity', 'Eccentricity', 'Orbit shape: 0 is circular; values closer to 1 are more elongated.'],
  ['inclination', 'Inclination', 'Tilt to the plane of the sky: 0° is face-on, 90° is edge-on.'],
  ['node', 'Longitude of the node', 'Position angle of the line where the orbital plane crosses the sky plane, measured from north toward east. Visual-only orbits can have a 180° ambiguity.'],
  ['epoch', 'Periastron epoch', 'The published time when the two members pass closest together. The time convention is shown with the value.'],
  ['argument', 'Argument of periastron', 'Angle in the orbital plane from the ascending node to closest approach. The source may quote this for the primary or the secondary.'],
] as const

function orbitDetails(orbit: StellarOrbit | undefined): HTMLElement {
  const list = document.createElement('dl')
  list.className = 'properties stellar-orbit-properties'
  const format = (value: number | null | undefined, unit = '') => value === null || value === undefined ? 'Not available'
    : `${value.toLocaleString('en-US', { maximumSignificantDigits: 6 })}${unit}`
  const epochNumber = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 6, useGrouping: false })
  const epoch = !orbit || orbit.periastronEpoch === null ? 'Not available'
    : orbit.epochKind === 'Besselian year' ? `B${epochNumber(orbit.periastronEpoch)}`
    : orbit.epochKind === 'Julian year' ? `J${epochNumber(orbit.periastronEpoch)}`
    : orbit.epochKind === 'JD − 2400000' ? `JD ${epochNumber(orbit.periastronEpoch + 2400000)}`
    : orbit.epochKind === 'MJD' ? `MJD ${epochNumber(orbit.periastronEpoch)}` : epochNumber(orbit.periastronEpoch)
  const values = [orbit?.primary ?? 'Not available', orbit ? format(orbit.periodYears < 1 ? orbit.periodYears * 365.25 : orbit.periodYears, orbit.periodYears < 1 ? ' d' : ' yr') : 'Not available',
    format(orbit?.semiMajorAxisAu, ' AU'), format(orbit?.eccentricity), format(orbit?.inclinationDeg, '°'), format(orbit?.nodeDeg, '°'),
    epoch,
    format(orbit?.argumentDeg, '°')]
  for (const [index, [id, label, detail]] of terms.entries()) {
    const row = document.createElement('div')
    row.dataset.orbitSpec = id
    const term = document.createElement('dt')
    term.className = 'mass-metric-copy'
    const help = document.createElement('button')
    help.type = 'button'
    help.className = 'mass-metric-help'
    help.textContent = label
    const tooltip = document.createElement('span')
    tooltip.id = `stellar-orbit-${id}-tooltip`
    tooltip.className = 'tooltip mass-metric-tooltip stellar-orbit-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    tooltip.textContent = detail
    if (id === 'axis' && orbit?.axisDerivation) tooltip.textContent += ' Converted from the published angular axis using the catalog parallax.'
    if (id === 'argument' && orbit?.argumentComponent) tooltip.textContent += orbit.grade === 9 ? ' This solution describes the system’s center of light (photocenter).' : ` This source uses component ${orbit.argumentComponent}.`
    if (id === 'epoch' && orbit?.epochKind) tooltip.textContent += ` Source convention: ${orbit.epochKind}; B and J denote Besselian and Julian years, JD denotes Julian date.`
    help.setAttribute('aria-describedby', tooltip.id)
    term.append(help, tooltip)
    const value = document.createElement('dd')
    value.textContent = values[index]!
    row.append(term, value)
    list.append(row)
  }
  if (orbit) {
    const source = document.createElement('div')
    const label = document.createElement('dt')
    label.textContent = 'Source'
    const value = document.createElement('dd')
    const link = document.createElement('a')
    link.href = orbit.sourceUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = orbit.reference
    link.title = `${orbit.catalog}${orbit.grade === 9 ? ' · photocenter solution' : orbit.grade === 8 ? ' · interferometric solution' : orbit.grade ? ` · orbit grade ${orbit.grade}/5 (1 definitive, 5 indeterminate)` : ''}`
    value.append(link)
    source.append(label, value)
    list.append(source)
  }
  return list
}

export function renderStellarSystem(system: StarSystem, selectedId: string, colorMode: StarColorMode): HTMLElement {
  const section = document.createElement('section')
  section.className = 'stellar-system-section'
  const heading = document.createElement('h3')
  heading.className = 'card-subgroup-heading stellar-system-heading'
  heading.textContent = `${system.components.length} stars system`
  const viewToggle = document.createElement('button')
  viewToggle.id = 'stellar-orbit-view-toggle'
  viewToggle.type = 'button'
  viewToggle.className = 'panel-lock stellar-header-control stellar-orbit-view-toggle'
  viewToggle.setAttribute('aria-label', 'Top view of stellar orbit')
  viewToggle.setAttribute('aria-controls', 'stellar-system-figure')
  viewToggle.append(createElement(Orbit, { width: 18, height: 18, 'stroke-width': 1.7, 'aria-hidden': 'true' }))
  heading.append(viewToggle)
  const figure = document.createElement('figure')
  figure.id = 'stellar-system-figure'
  figure.className = 'planet-system-figure'
  const detailsHeader = document.createElement('div')
  detailsHeader.className = 'card-subgroup-heading stellar-orbit-heading'
  const headingDetails = document.createElement('h3')
  headingDetails.textContent = 'Orbit details'
  const controls = document.createElement('div')
  controls.className = 'stellar-orbit-controls'
  controls.setAttribute('aria-label', 'Orbital pairs')
  const details = document.createElement('div')
  const orbits = stellarOrbitsForSystem(system)
  let activeOrbit: StellarOrbit | undefined
  function updateDiagram(): void {
    const available = Boolean(activeOrbit && orbitHasGeometry(activeOrbit))
    viewToggle.disabled = !available
    viewToggle.setAttribute('aria-pressed', String(available && topView))
    viewToggle.title = available ? topView ? 'Show sky projection' : 'View orbit from above' : 'Top view unavailable for this pair'
    figure.replaceChildren(stellarDiagram(system, activeOrbit, colorMode))
  }
  viewToggle.addEventListener('click', () => {
    topView = !topView
    updateDiagram()
  })
  function show(orbit: StellarOrbit | undefined): void {
    activeOrbit = orbit
    updateDiagram()
    details.replaceChildren(orbitDetails(orbit))
    for (const button of controls.querySelectorAll<HTMLButtonElement>('button')) button.setAttribute('aria-pressed', String(button.dataset.orbitId === orbit?.id))
    const notice = document.createElement('p')
    notice.className = 'system-empty'
    if (!orbit) notice.textContent = 'Orbital elements are not available in the adopted sources.'
    else if (orbit.grade === 9) notice.textContent = 'Photocenter solution; the relative stellar axis is unavailable.'
    else if (!orbitHasGeometry(orbit)) notice.textContent = 'A complete relative orbit is not available for this pair.'
    else if (orbit.grade === 4 || orbit.grade === 5) notice.textContent = orbit.grade === 5 ? 'Orbit is poorly constrained (grade 5).' : 'Orbit is preliminary (grade 4).'
    if (notice.textContent) details.append(notice)
  }
  for (const orbit of orbits) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'panel-lock stellar-header-control stellar-orbit-pair'
    button.dataset.orbitId = orbit.id
    button.textContent = `${orbit.primary}–${orbit.secondary}`
    button.setAttribute('aria-label', `Show ${orbit.primary}–${orbit.secondary} orbit`)
    button.addEventListener('click', () => show(orbit))
    controls.append(button)
  }
  // An orbit within the selected branch takes precedence over its wider parent.
  const canonicalId = starComponentIdentity(selectedId)?.canonicalStarId ?? selectedId
  const selectedOrbit = orbits.filter((o) => [...o.primaryIds, ...o.secondaryIds].includes(canonicalId))
    .sort((a, b) => a.periodYears - b.periodYears)[0] ?? orbits[0]
  show(selectedOrbit)
  detailsHeader.append(headingDetails)
  if (orbits.length) detailsHeader.append(controls)
  section.append(heading, figure, detailsHeader, details)
  return section
}
