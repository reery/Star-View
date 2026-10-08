import { formatOrbitalDistance, type PlanetarySystem } from './planetary-systems'
import { planetDescriptionForId } from './planet-properties'

const svgNamespace = 'http://www.w3.org/2000/svg'
const renderedSystems = new WeakMap<HTMLElement, string>()

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(svgNamespace, tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value))
  return node
}

function orbitalDiagram(system: PlanetarySystem): SVGSVGElement {
  const svg = svgElement('svg', { viewBox: '0 0 260 94', class: 'planet-orbit-diagram', role: 'img',
    'aria-label': `${system.name}: ${system.planets.map((planet) => `${planet.name} ${formatOrbitalDistance(planet)}`).join(', ')}. Logarithmic orbital distance scale; body sizes and orbits are schematic, not current positions.` })
  const nearest = system.planets[0]!.semiMajorAxisAu
  const farthest = system.planets[system.planets.length - 1]!.semiMajorAxisAu
  const sunX = 22
  const centerY = 42
  const orbits = svgElement('g', {})
  const bodies = svgElement('g', {})
  // Logarithmic spacing separates the inner planets in a narrow panel. The Sun
  // is a symbolic origin: its zero distance cannot occupy a logarithmic axis.
  system.planets.forEach((planet) => {
    const fraction = farthest === nearest ? 0 : Math.log(planet.semiMajorAxisAu / nearest) / Math.log(farthest / nearest)
    const x = 52 + 188 * fraction
    const orbit = svgElement('ellipse', { cx: sunX, cy: centerY, rx: x - sunX, ry: 10 + 20 * fraction,
      class: 'planet-orbit', 'data-orbit-id': planet.id })
    orbits.append(orbit)
    const body = svgElement('g', { class: 'planet-body', 'data-planet-id': planet.id })
    const title = svgElement('title', {})
    title.textContent = `${planet.name} · ${formatOrbitalDistance(planet)}`
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
  const sunLabel = svgElement('text', { x: sunX, y: 86, 'text-anchor': 'middle', class: 'planet-diagram-label' })
  sunLabel.textContent = 'Sun'
  svg.append(definitions, orbits, star, bodies, sunLabel)
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

export function renderSystemCard(container: HTMLElement, planets: PlanetarySystem | undefined, stellarCount: number, onPlanetSelect: (planetId: string) => void): void {
  const key = `${planets?.hostStarId ?? ''}:${stellarCount}`
  if (renderedSystems.get(container) === key) return
  const content: HTMLElement[] = []
  if (planets) {
    const section = document.createElement('section')
    const heading = document.createElement('h3')
    heading.className = 'card-subgroup-heading'
    heading.id = 'system-planets-heading'
    heading.textContent = `${planets.planets.length} known Planets`
    section.setAttribute('aria-labelledby', heading.id)
    const figure = document.createElement('figure')
    figure.className = 'planet-system-figure'
    figure.append(orbitalDiagram(planets))
    const list = document.createElement('dl')
    list.className = 'properties planet-list'
    list.setAttribute('aria-label', 'Planet orbital distances from Sun')
    list.title = 'Orbital semi-major axes, not instantaneous distances from the Sun.'
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
      button.setAttribute('aria-label', `${planet.name}, orbital distance ${formatOrbitalDistance(planet)} from Sun`)
      button.setAttribute('aria-pressed', 'false')
      if (planetDescriptionForId(planet.id)) {
        button.setAttribute('aria-controls', 'planet-card')
        button.setAttribute('aria-expanded', 'false')
      }
      button.textContent = formatOrbitalDistance(planet)
      row.addEventListener('click', () => onPlanetSelect(planet.id))
      value.append(button)
      row.append(name, value)
      list.append(row)
    }
    section.append(heading, figure, list)
    content.push(section)
  }
  if (stellarCount > 1) {
    const heading = document.createElement('h3')
    heading.className = 'card-subgroup-heading system-stars-heading'
    heading.textContent = `${stellarCount} stars system`
    content.push(heading)
  }
  if (!planets) {
    const empty = document.createElement('p')
    empty.className = 'system-empty'
    empty.textContent = 'Planet data not added for this system yet.'
    content.push(empty)
  }
  container.replaceChildren(...content)
  renderedSystems.set(container, key)
}
