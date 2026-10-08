import { isExtrasolarPlanet, planetAtmosphereSpecs, planetMoonsForId, planetPhysicalSpecs, scientificPlanetValue, type PlanetDescription, type PlanetSpec, type SolarPlanetDescription } from './planet-properties'
import { extrasolarOrbitalSpecs } from './exoplanet-properties'
import { renderPlanetInfo } from './planet-info'
import { renderPlanetGlobe } from './planet-globe'

function specTooltipLines(spec: PlanetSpec): string[] | undefined {
  if (spec.temperatureK) {
    const digits = spec.temperatureK.length > 1 ? 0 : 1
    const format = (temperature: number) => temperature.toLocaleString('en-US', { maximumFractionDigits: digits })
    const celsius = spec.temperatureK.map((kelvin) => kelvin - 273.15)
    const fahrenheit = celsius.map((temperature) => temperature * 9 / 5 + 32)
    return [`${celsius.map(format).join(' / ')} °C`, `${fahrenheit.map(format).join(' / ')} °F`]
  }
  if (spec.pressurePa !== undefined) {
    const prefix = spec.pressureUpperLimit ? '≲ ' : ''
    const format = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: spec.pressureSignificantDigits ?? 3 })
    const bar = spec.pressurePa / 100_000
    const psi = spec.pressurePa / 6_894.757293168
    return [`${prefix}${format(bar)} bar`, `${prefix}${format(psi)} psi`]
  }
  return undefined
}

function specRow(spec: PlanetSpec): HTMLDivElement {
  const row = document.createElement('div')
  row.dataset.planetSpec = spec.id
  const label = document.createElement('dt')
  label.textContent = spec.label
  const value = document.createElement('dd')
  const lines = specTooltipLines(spec)
  if (lines) {
    value.classList.add('mass-metric-copy')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'mass-metric-help'
    button.textContent = spec.value
    button.setAttribute('aria-label', `${spec.label}: ${spec.value}. ${spec.detail}`)
    const tooltip = document.createElement('span')
    tooltip.id = `planet-${spec.id}-tooltip`
    tooltip.className = 'tooltip mass-metric-tooltip planet-metric-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    for (const line of lines) {
      const span = document.createElement('span')
      span.textContent = line
      tooltip.append(span)
    }
    button.setAttribute('aria-describedby', tooltip.id)
    value.append(button, tooltip)
    label.title = spec.detail
  } else {
    if (spec.sourceUrl) {
      const link = document.createElement('a')
      link.href = spec.sourceUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = spec.value
      value.append(link)
    } else value.append(spec.value)
    row.title = spec.detail
  }
  if (spec.comparison) {
    const comparison = document.createElement('span')
    comparison.className = 'planet-earth-comparison'
    comparison.textContent = ` (${spec.comparison})`
    value.append(comparison)
  }
  row.append(label, value)
  return row
}

function renderPlanetMoons(container: HTMLElement, planet: SolarPlanetDescription): boolean {
  const moons = planetMoonsForId(planet.id)
  container.replaceChildren()
  for (const moon of moons) {
    const section = document.createElement('section')
    const heading = document.createElement('h3')
    heading.id = `planet-moon-${moon.id}-heading`
    heading.className = 'card-subgroup-heading'
    const link = document.createElement('a')
    link.href = moon.source
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.title = `NASA ${moon.sourceLabel}`
    link.textContent = moon.name
    heading.append(link)
    section.setAttribute('aria-labelledby', heading.id)
    const properties = document.createElement('dl')
    properties.className = 'properties planet-properties'
    const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 4 })
    const specs: [string, string, string, string?][] = [
      ['mean-radius', 'Mean radius', `${format(moon.meanRadiusKm)} km`, moon.meanRadiusDetail],
      ['mass', 'Mass', `${scientificPlanetValue(moon.massKg)} kg`],
      ['surface-gravity', 'Surface gravity', `${format(moon.surfaceGravityMs2)} m/s²`, moon.surfaceGravityDetail],
      ['semi-major-axis', 'Orbital semi-major axis', `${format(moon.semiMajorAxisKm)} km`, moon.semiMajorAxisDetail ?? `Orbital size measured between the centers of ${planet.name} and ${moon.name}, not a current distance.`],
      ['sidereal-orbit', 'Sidereal orbital period', `${format(moon.siderealOrbitDays)} d${moon.id === 'triton' ? ' · retrograde' : ''}`, moon.siderealOrbitDetail ?? 'One orbit relative to the distant stars.'],
      ['phase-cycle', 'Phase cycle', `${format(moon.phaseCycleDays)} d`, moon.phaseCycleDetail ?? 'Synodic month: one new Moon to the next.'],
    ]
    properties.append(...specs.map(([id, label, value, detail]) => specRow({
      id: `moon-${moon.id}-${id}`, label, value, comparison: '',
      detail: `${detail ? `${detail} ` : ''}NASA ${moon.sourceLabel}.`,
    })))
    section.append(heading, properties)
    container.append(section)
  }
  return moons.length > 0
}

export function renderPlanetCard(card: HTMLElement, planet: PlanetDescription): void {
  const extrasolar = isExtrasolarPlanet(planet)
  card.dataset.planetId = planet.id
  card.querySelector<HTMLElement>('#planet-name')!.textContent = planet.name
  card.querySelector<HTMLElement>('#planet-icon')!.style.setProperty('--planet-color', planet.color)
  const globe = card.querySelector<HTMLCanvasElement>('#planet-globe')!
  const addEarth = card.querySelector<HTMLButtonElement>('#planet-add-earth')!
  const globeAvailable = renderPlanetGlobe(globe, planet.id)
  globe.parentElement!.hidden = !globeAvailable
  addEarth.hidden = extrasolar
  addEarth.disabled = planet.id === 'earth' || !globeAvailable
  addEarth.title = planet.id === 'earth' ? 'Earth is already selected' : 'Add Earth for size comparison'
  addEarth.setAttribute('aria-label', 'Add Earth')
  addEarth.setAttribute('aria-pressed', 'false')
  addEarth.onclick = () => {
    const comparing = addEarth.getAttribute('aria-pressed') !== 'true'
    renderPlanetGlobe(globe, planet.id, comparing)
    addEarth.setAttribute('aria-label', comparing ? 'Remove Earth' : 'Add Earth')
    addEarth.title = comparing ? 'Remove Earth from size comparison' : 'Add Earth for size comparison'
    addEarth.setAttribute('aria-pressed', String(comparing))
  }
  card.querySelector<HTMLElement>('#planet-moons-toggle')!.hidden = extrasolar || planet.moonCount === 0
  const moons = card.querySelector<HTMLElement>('#planet-moons')!
  moons.replaceChildren()
  card.querySelector<HTMLButtonElement>('#planet-moons-toggle')!.disabled = extrasolar || !renderPlanetMoons(moons, planet)
  const infoToggle = card.querySelector<HTMLButtonElement>('#planet-info-toggle')!
  infoToggle.hidden = extrasolar
  const info = card.querySelector<HTMLElement>('#planet-info')!
  info.replaceChildren()
  infoToggle.disabled = extrasolar || !renderPlanetInfo(info, planet.id)
  card.querySelector<HTMLElement>('#planet-physical-specs')!.replaceChildren(...planetPhysicalSpecs(planet).map(specRow))
  const orbit = card.querySelector<HTMLElement>('#planet-orbit-specs')!
  orbit.replaceChildren(...(extrasolar ? extrasolarOrbitalSpecs(planet).map(specRow) : []))
  card.querySelector<HTMLElement>('#planet-orbit-section')!.hidden = !extrasolar
  const atmosphere = card.querySelector<HTMLElement>('#planet-atmosphere-specs')!
  card.querySelector<HTMLElement>('#planet-atmosphere-section')!.hidden = extrasolar
  atmosphere.replaceChildren()
  if (extrasolar) return
  atmosphere.replaceChildren(...planetAtmosphereSpecs(planet).map(specRow))
  const composition = document.createElement('div')
  composition.className = 'planet-composition-row'
  composition.dataset.planetSpec = 'composition'
  const label = document.createElement('dt')
  label.textContent = 'Composition'
  const value = document.createElement('dd')
  const list = document.createElement('ul')
  list.className = 'planet-composition'
  list.title = planet.notes.atmosphere
  for (const atom of planet.composition) {
    const item = document.createElement('li')
    item.textContent = `${atom.name} (${atom.symbol})${'abundance' in atom ? ` · ${atom.abundance}` : ''}`
    list.append(item)
  }
  value.append(list)
  composition.append(label, value)
  atmosphere.append(composition)
}
