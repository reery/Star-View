import { formatOrbitalDistance, type PlanetarySystem } from './planetary-systems'
import { svgNode as svgElement } from './spectral-chart'
import type { StarColorMode } from './astronomy'
import type { StarSystem } from './star-systems'
import { renderStellarSystem } from './stellar-system-card'
import { Leaf, createElement } from 'lucide'
import type { Star } from './catalog-model'
import { habitableZoneForStar, type HabitableZone } from './habitable-zone'

const renderedSystems = new WeakMap<HTMLElement, string>()
const habitableZoneVisibility = new WeakMap<HTMLElement, { hostStarId: string; visible: boolean }>()

function orbitalDiagram(system: PlanetarySystem, stellarCount: number, zone: HabitableZone | null = null): SVGSVGElement {
  const positioned = system.planets.filter((planet) => planet.semiMajorAxisAu !== null && planet.semiMajorAxisAu > 0 && !planet.distanceLimit)
  const svg = svgElement('svg', { viewBox: '0 0 260 94', class: 'planet-orbit-diagram', role: 'img',
    'aria-label': `${system.name}: ${system.planets.map((planet) => `${planet.name} ${formatOrbitalDistance(planet)}`).join(', ')}. Logarithmic orbital distance scale; body sizes and orbits are schematic, not current positions.` })
  const distances = positioned.map((planet) => planet.semiMajorAxisAu!)
  // Include both zone edges in the same distance scale, even when all known
  // planets lie closer to the host or beyond the zone.
  if (zone) distances.push(zone.innerAu, zone.outerAu)
  const nearest = Math.min(...distances)
  const farthest = Math.max(...distances)
  const sunX = 22
  const centerY = 42
  const orbits = svgElement('g', {})
  const bodies = svgElement('g', {})
  const fractionForDistance = (distance: number) => farthest === nearest ? 0.5 : Math.log(distance / nearest) / Math.log(farthest / nearest)
  const habitableZone = svgElement('g', { class: 'planet-habitable-zone' })
  if (zone) {
    const ellipse = (distance: number) => {
      const fraction = fractionForDistance(distance)
      const rx = 30 + 188 * fraction
      const ry = 10 + 20 * fraction
      return `M ${sunX + rx} ${centerY} a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 a ${rx} ${ry} 0 1 0 ${2 * rx} 0 Z`
    }
    habitableZone.append(svgElement('title', {}, `Conservative habitable zone · ${zone.innerAu.toPrecision(3)}–${zone.outerAu.toPrecision(3)} AU`),
      svgElement('path', { d: `${ellipse(zone.outerAu)} ${ellipse(zone.innerAu)}`, 'fill-rule': 'evenodd',
        'data-inner-au': zone.innerAu, 'data-outer-au': zone.outerAu }))
    svg.setAttribute('aria-label', `${svg.getAttribute('aria-label')} Conservative habitable zone: ${zone.innerAu.toPrecision(3)}–${zone.outerAu.toPrecision(3)} AU, host star only.`)
  }
  // Logarithmic spacing separates the inner planets in a narrow panel. The host
  // is a symbolic origin: its zero distance cannot occupy a logarithmic axis.
  positioned.forEach((planet) => {
    const fraction = fractionForDistance(planet.semiMajorAxisAu!)
    const x = 52 + 188 * fraction
    const orbit = svgElement('ellipse', { cx: sunX, cy: centerY, rx: x - sunX, ry: 10 + 20 * fraction,
      class: 'planet-orbit', 'data-orbit-id': planet.id })
    orbits.append(orbit)
    const body = svgElement('g', { class: 'planet-body', 'data-planet-id': planet.id })
    const title = svgElement('title', {}, `${planet.name} · ${formatOrbitalDistance(planet)}`)
    // Symbol sizes preserve legibility rather than representing physical radii.
    const radius = ['jupiter', 'saturn'].includes(planet.id) ? 4.5 : ['uranus', 'neptune'].includes(planet.id) ? 3.5 : 2.5
    const marker = svgElement('circle', { cx: x, cy: centerY, r: radius, fill: planet.color, class: 'planet-marker' })
    const halo = svgElement('circle', { cx: x, cy: centerY, r: radius + 3, class: 'planet-highlight' })
    body.append(title, halo)
    if (planet.id === 'saturn') body.append(svgElement('ellipse', { cx: x, cy: centerY, rx: 8, ry: 2.5,
      fill: 'none', stroke: planet.color, 'stroke-width': 1, transform: `rotate(-25 ${x} ${centerY})` }))
    body.append(marker)
    bodies.append(body)
  })
  const glow = svgElement('radialGradient', { id: 'system-star-glow' })
  glow.append(svgElement('stop', { offset: 0, 'stop-color': 'var(--selected-star-color)', 'stop-opacity': 0.6 }),
    svgElement('stop', { offset: 1, 'stop-color': 'var(--selected-star-color)', 'stop-opacity': 0 }))
  const definitions = svgElement('defs', {})
  definitions.append(glow)
  const star = svgElement('g', {})
  star.append(svgElement('circle', { cx: sunX, cy: centerY, r: 20, fill: 'url(#system-star-glow)' }),
    svgElement('circle', { cx: sunX, cy: centerY, r: 6, fill: 'var(--selected-star-color)' }),
    svgElement('circle', { cx: sunX, cy: centerY, r: 3, fill: '#fff8ed' }))
  const sunLabel = svgElement('text', { x: 8, y: 86, 'text-anchor': 'start', class: 'planet-diagram-label' }, system.name)
  svg.append(definitions, habitableZone, orbits, star, bodies)
  if (stellarCount > 1) svg.append(sunLabel)
  return svg
}

export function highlightSystemPlanet(container: HTMLElement, selectedId: string | null, openId: string | null = null): void {
  for (const row of container.querySelectorAll<HTMLElement>('.planet-row')) {
    const button = row.querySelector<HTMLButtonElement>('button')!
    button.setAttribute('aria-pressed', String(row.dataset.planetId === selectedId))
    if (button.hasAttribute('aria-controls')) button.setAttribute('aria-expanded', String(row.dataset.planetId === openId))
  }
  for (const node of container.querySelectorAll<SVGElement>('[data-orbit-id], .planet-body')) {
    node.classList.toggle('is-highlighted', (node.dataset.planetId ?? node.dataset.orbitId) === selectedId)
  }
}

export function renderSystemCard(container: HTMLElement, planets: PlanetarySystem | undefined, system: StarSystem | undefined,
  selectedStar: Star, colorMode: StarColorMode, onPlanetSelect: (planetId: string) => void): void {
  const selectedId = selectedStar.id
  const stellarCount = system?.components.length ?? 1
  const key = `${planets?.hostStarId ?? ''}:${system?.components.map(({ star }) => star.id).join('|') ?? ''}:${selectedId}:${colorMode}:${selectedStar.luminosity_solar}:${selectedStar.temperature_k}`
  if (renderedSystems.get(container) === key) return
  const content: HTMLElement[] = []
  if (planets?.planets.length) {
    const section = document.createElement('section')
    const heading = document.createElement('h3')
    heading.className = 'card-subgroup-heading stellar-system-heading'
    heading.id = 'system-planets-heading'
    heading.textContent = `${planets.planets.length} known ${planets.planets.length === 1 ? 'planet' : 'planets'}`
    section.setAttribute('aria-labelledby', heading.id)
    const figure = document.createElement('figure')
    figure.id = 'planet-system-figure'
    figure.className = 'planet-system-figure'
    figure.hidden = !planets.planets.some((planet) => planet.semiMajorAxisAu !== null && planet.semiMajorAxisAu > 0 && !planet.distanceLimit)
    const zone = selectedId === planets.hostStarId ? habitableZoneForStar(selectedStar) : null
    const state = habitableZoneVisibility.get(container)
    let zoneVisible = Boolean(zone && state?.hostStarId === planets.hostStarId && state.visible)
    const zoneToggle = document.createElement('button')
    zoneToggle.id = 'habitable-zone-toggle'
    zoneToggle.type = 'button'
    zoneToggle.className = 'panel-lock stellar-header-control stellar-orbit-view-toggle habitable-zone-toggle'
    zoneToggle.disabled = !zone || figure.hidden
    zoneToggle.setAttribute('aria-label', 'Habitable zone')
    zoneToggle.setAttribute('aria-controls', figure.id)
    zoneToggle.append(createElement(Leaf, { width: 18, height: 18, 'stroke-width': 1.7, 'aria-hidden': 'true' }))
    function updateDiagram(): void {
      zoneToggle.setAttribute('aria-pressed', String(zoneVisible))
      zoneToggle.title = zoneToggle.disabled
        ? 'Habitable zone unavailable · Requires orbital distances, host luminosity and temperature within 2600–7200 K'
        : `${zoneVisible ? 'Hide' : 'Show'} habitable zone · ${zone!.innerAu.toPrecision(3)}–${zone!.outerAu.toPrecision(3)} AU · Kopparapu (2014), conservative, 1 Earth mass, host star only`
      figure.replaceChildren(orbitalDiagram(planets!, stellarCount, zoneVisible ? zone : null))
      const selectedPlanet = container.querySelector<HTMLElement>('.planet-row:has(button[aria-pressed="true"])')?.dataset.planetId ?? null
      const openPlanet = container.querySelector<HTMLElement>('.planet-row:has(button[aria-expanded="true"])')?.dataset.planetId ?? null
      highlightSystemPlanet(container, selectedPlanet, openPlanet)
    }
    zoneToggle.addEventListener('click', () => {
      zoneVisible = !zoneVisible
      habitableZoneVisibility.set(container, { hostStarId: planets.hostStarId, visible: zoneVisible })
      updateDiagram()
    })
    updateDiagram()
    heading.append(zoneToggle)
    const list = document.createElement('dl')
    list.className = 'properties planet-list'
    list.setAttribute('aria-label', `Planet orbital distances from ${planets.name}`)
    list.title = planets.source.note
    for (const planet of planets.planets) {
      const row = document.createElement('div')
      row.className = 'planet-row'
      row.dataset.planetId = planet.id
      const name = document.createElement('dt')
      const swatch = document.createElement('span')
      swatch.className = 'star-swatch'
      swatch.style.backgroundColor = planet.color
      swatch.setAttribute('aria-hidden', 'true')
      name.append(swatch, planet.name)
      const value = document.createElement('dd')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'object-type-toggle'
      button.setAttribute('aria-label', `${planet.name}, orbital distance ${formatOrbitalDistance(planet)} from ${planets.name}`)
      button.setAttribute('aria-pressed', 'false')
      button.setAttribute('aria-controls', 'planet-card')
      button.setAttribute('aria-expanded', 'false')
      button.textContent = formatOrbitalDistance(planet)
      row.addEventListener('click', () => onPlanetSelect(planet.id))
      value.append(button)
      row.append(name, value)
      list.append(row)
    }
    section.append(heading, figure, list)
    content.push(section)
  }
  if (system) content.push(renderStellarSystem(system, selectedId, colorMode))
  container.replaceChildren(...content)
  if (!planets?.planets.length) habitableZoneVisibility.delete(container)
  else if (habitableZoneVisibility.get(container)?.hostStarId !== planets.hostStarId) {
    habitableZoneVisibility.set(container, { hostStarId: planets.hostStarId, visible: false })
  }
  renderedSystems.set(container, key)
}
