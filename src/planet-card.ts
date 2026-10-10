import { isExtrasolarPlanet, planetAtmosphereSpecs, planetPhysicalSpecs, type PlanetDescription, type PlanetSpec } from './planet-properties'
import { extrasolarOrbitalSpecs } from './exoplanet-properties'
import { renderPlanetInfo } from './planet-info'
import { disposePlanetGlobe, renderPlanetGlobe } from './planet-globe'
import { renderPlanetMoons } from './moon-card'

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

function specRow(spec: PlanetSpec, showDetailTooltip = false): HTMLDivElement {
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
  if (showDetailTooltip) {
    row.removeAttribute('title')
    label.removeAttribute('title')
    label.classList.add('mass-metric-copy')
    const help = document.createElement('button')
    help.type = 'button'
    help.className = 'mass-metric-help'
    help.textContent = spec.label
    const tooltip = document.createElement('span')
    tooltip.id = `planet-${spec.id}-detail-tooltip`
    tooltip.className = 'tooltip mass-metric-tooltip planet-metric-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    tooltip.textContent = spec.detail
    help.setAttribute('aria-describedby', tooltip.id)
    label.replaceChildren(help, tooltip)
  }
  row.append(label, value)
  return row
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
  const previousMoonGlobe = moons.querySelector<HTMLCanvasElement>('canvas')
  if (previousMoonGlobe) disposePlanetGlobe(previousMoonGlobe)
  delete moons.dataset.selectedMoonId
  moons.replaceChildren()
  card.querySelector<HTMLButtonElement>('#planet-moons-toggle')!.disabled = extrasolar || !renderPlanetMoons(moons, planet, (spec) => specRow(spec, true))
  const infoToggle = card.querySelector<HTMLButtonElement>('#planet-info-toggle')!
  infoToggle.hidden = extrasolar
  const info = card.querySelector<HTMLElement>('#planet-info')!
  info.replaceChildren()
  infoToggle.disabled = extrasolar || !renderPlanetInfo(info, planet.id)
  card.querySelector<HTMLElement>('#planet-physical-specs')!.replaceChildren(...planetPhysicalSpecs(planet).map((spec) => specRow(spec)))
  const orbit = card.querySelector<HTMLElement>('#planet-orbit-specs')!
  orbit.replaceChildren(...(extrasolar ? extrasolarOrbitalSpecs(planet).map((spec) => specRow(spec)) : []))
  card.querySelector<HTMLElement>('#planet-orbit-section')!.hidden = !extrasolar
  const atmosphere = card.querySelector<HTMLElement>('#planet-atmosphere-specs')!
  card.querySelector<HTMLElement>('#planet-atmosphere-section')!.hidden = extrasolar
  atmosphere.replaceChildren()
  if (extrasolar) return
  atmosphere.replaceChildren(...planetAtmosphereSpecs(planet).map((spec) => specRow(spec)))
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
