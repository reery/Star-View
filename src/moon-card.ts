import { planetMoonSpecs, planetMoonsForId, type PlanetMoon, type PlanetSpec, type SolarPlanetDescription } from './planet-properties'
import { disposePlanetGlobe, renderPlanetGlobe } from './planet-globe'
import { moonPhotographs } from './moon-photographs'
import { svgNode } from './spectral-chart'

function moonDistance(moon: PlanetMoon): string {
  return `${(moon.semiMajorAxisKm / 1_000).toLocaleString('en-US', { maximumFractionDigits: 2 })} K km`
}

function moonColor(moon: PlanetMoon): string {
  return moon.id === 'io' ? '#d4bb76' : moon.id === 'titan' ? '#d5b487' : '#bfbab2'
}

function moonOrbits(planet: SolarPlanetDescription, moons: readonly PlanetMoon[]): SVGSVGElement {
  const svg = svgNode('svg', { viewBox: '0 0 420 114', class: 'planet-orbit-diagram moon-orbit-diagram', role: 'img',
    'aria-label': `${planet.name} moon orbits: ${moons.map((moon) => `${moon.name} ${moonDistance(moon)}`).join(', ')}. Logarithmic semi-major-axis scale; body sizes, orbit shapes and positions are schematic, not current positions.` })
  const nearest = Math.min(...moons.map((moon) => moon.semiMajorAxisKm))
  const farthest = Math.max(...moons.map((moon) => moon.semiMajorAxisKm))
  const centerX = 26, centerY = 57
  const orbits = svgNode('g')
  const bodies = svgNode('g')
  for (const moon of moons) {
    const fraction = farthest === nearest ? 0.5 : Math.log(moon.semiMajorAxisKm / nearest) / Math.log(farthest / nearest)
    const x = 70 + 330 * fraction
    orbits.append(svgNode('ellipse', { cx: centerX, cy: centerY, rx: x - centerX, ry: 13 + 29 * fraction,
      class: 'planet-orbit', 'data-orbit-id': moon.id }))
    const body = svgNode('g', { class: 'planet-body', 'data-moon-id': moon.id })
    body.append(svgNode('title', {}, `${moon.name} · ${moonDistance(moon)}`),
      svgNode('circle', { cx: x, cy: centerY, r: 7, class: 'planet-highlight' }),
      svgNode('circle', { cx: x, cy: centerY, r: 4, fill: moonColor(moon), class: 'planet-marker' }))
    bodies.append(body)
  }
  const gradient = svgNode('radialGradient', { id: 'moon-host-shading', cx: '30%', cy: '28%', r: '75%' })
  gradient.append(svgNode('stop', { offset: 0, 'stop-color': '#e2dcd5' }),
    svgNode('stop', { offset: 0.45, 'stop-color': planet.color }), svgNode('stop', { offset: 1, 'stop-color': '#242221' }))
  const definitions = svgNode('defs')
  definitions.append(gradient)
  const host = svgNode('g')
  host.append(svgNode('title', {}, planet.name))
  if (planet.id === 'saturn') host.append(svgNode('ellipse', { cx: centerX, cy: centerY, rx: 17, ry: 5,
    fill: 'none', stroke: planet.color, 'stroke-width': 2, transform: `rotate(-25 ${centerX} ${centerY})` }))
  host.append(svgNode('circle', { cx: centerX, cy: centerY, r: 10, fill: 'url(#moon-host-shading)', class: 'planet-marker' }))
  svg.append(definitions, orbits, host, bodies)
  return svg
}

export function renderPlanetMoons(container: HTMLElement, planet: SolarPlanetDescription,
  renderSpec: (spec: PlanetSpec) => HTMLElement): boolean {
  const previousGlobe = container.querySelector<HTMLCanvasElement>('canvas')
  if (previousGlobe) disposePlanetGlobe(previousGlobe)
  container.replaceChildren()
  const moons = [...planetMoonsForId(planet.id)].sort((a, b) => a.semiMajorAxisKm - b.semiMajorAxisKm)
  if (!moons.length) return false
  container.setAttribute('aria-label', `${planet.name} moons`)
  const figure = document.createElement('figure')
  figure.className = 'planet-system-figure moon-system-figure'
  figure.append(moonOrbits(planet, moons))
  const body = document.createElement('div')
  body.className = 'moon-browser'
  const list = document.createElement('dl')
  list.className = 'properties planet-list moon-list'
  list.setAttribute('aria-label', `Moon orbital distances from ${planet.name}`)
  list.title = 'Orbital semi-major axes between body centers, in thousands of kilometers; not current distances.'
  const details = document.createElement('section')
  details.id = 'planet-moon-details'
  details.className = 'moon-details'
  const frame = document.createElement('div')
  frame.className = 'planet-globe-frame moon-globe-frame'
  const globe = document.createElement('canvas')
  globe.id = 'planet-moon-globe'
  globe.tabIndex = 0
  globe.setAttribute('role', 'img')
  const photograph = document.createElement('img')
  photograph.id = 'planet-moon-image'
  photograph.hidden = true
  photograph.decoding = 'async'
  frame.append(globe, photograph)
  const unavailable = document.createElement('p')
  unavailable.className = 'system-empty moon-globe-unavailable'
  unavailable.textContent = '3D view unavailable'
  const properties = document.createElement('dl')
  properties.className = 'properties planet-properties moon-properties'
  details.append(frame, unavailable, properties)
  body.append(list, details)
  container.append(figure, body)

  function selectMoon(moon: PlanetMoon): void {
    container.dataset.selectedMoonId = moon.id
    for (const button of list.querySelectorAll<HTMLButtonElement>('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.moonId === moon.id))
    }
    for (const node of figure.querySelectorAll<SVGElement>('[data-orbit-id], .planet-body')) {
      node.classList.toggle('is-highlighted', (node.dataset.moonId ?? node.dataset.orbitId) === moon.id)
    }
    details.setAttribute('aria-label', `${moon.name} specifications`)
    properties.replaceChildren(...planetMoonSpecs(moon, planet.name).map(renderSpec))
    const photo = moonPhotographs[moon.id]
    globe.hidden = Boolean(photo)
    photograph.hidden = !photo
    if (photo) {
      disposePlanetGlobe(globe)
      photograph.src = photo.image
      photograph.alt = photo.description
      photograph.title = photo.credit
    } else photograph.removeAttribute('src')
    const available = Boolean(photo) || renderPlanetGlobe(globe, moon.id)
    globe.hidden = Boolean(photo) || !available
    frame.dataset.mediaType = photo ? 'photograph' : 'globe'
    frame.hidden = !available
    unavailable.hidden = available
    if (!available) disposePlanetGlobe(globe)
  }
  for (const moon of moons) {
    const row = document.createElement('div')
    row.className = 'planet-row moon-row'
    row.dataset.moonId = moon.id
    const name = document.createElement('dt')
    const swatch = document.createElement('span')
    swatch.className = 'star-swatch'
    swatch.style.backgroundColor = moonColor(moon)
    swatch.setAttribute('aria-hidden', 'true')
    name.append(swatch, moon.name)
    const value = document.createElement('dd')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'object-type-toggle'
    button.dataset.moonId = moon.id
    button.setAttribute('aria-label', `${moon.name}, orbital distance ${moonDistance(moon)} from ${planet.name}`)
    button.setAttribute('aria-controls', details.id)
    button.textContent = moonDistance(moon)
    row.addEventListener('click', () => selectMoon(moon))
    value.append(button)
    row.append(name, value)
    list.append(row)
  }
  selectMoon(moons[0]!)
  return true
}
