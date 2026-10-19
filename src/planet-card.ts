import { createLoadError } from './load-recovery'
import { isExtrasolarPlanet, isSmallBody, planetApparentMagnitudeRange, planetAtmosphereSpecs, planetPhysicalSpecs, type PlanetDescription, type PlanetSpec } from './planet-properties'
import { smallBodyMedia } from './small-body-media'
import { magnitudeNumber, NAKED_EYE_MAGNITUDE } from './magnitude-card'
import { extrasolarOrbitalSpecs } from './exoplanet-properties'
import index from './data/generated/startup-index.json'
import { disposePlanetGlobe, planetHasGlobe, renderPlanetGlobe, resetPlanetGlobe } from './planet-globe'
import { ArrowDownToLine, ArrowUpRight, Atom, Box, Diameter, Earth, Eye, Orbit, Radius, ScanLine, Sun, Thermometer, Weight, createElement, type IconNode } from 'lucide'

const primarySpecIds = ['mean-diameter', 'mean-radius', 'mass', 'volume', 'mean-density', 'surface-gravity',
  'escape-velocity', 'synodic-rotation-period', 'sidereal-rotation-period', 'surface-temperature', 'temperature']
const infoIds = new Set(index.planetInfoIds)
const sections = new WeakMap<HTMLElement, { planet: PlanetDescription; info: boolean; moons: boolean }>()

export async function renderPlanetSection(card: HTMLElement, section: 'specs' | 'info' | 'moons'): Promise<void> {
  const state = sections.get(card)
  if (!state || section === 'specs' || state[section]) return
  const container = card.querySelector<HTMLElement>(`#planet-${section}`)!
  try {
    if (section === 'moons') {
      const { renderPlanetMoons } = await import('./moon-card')
      if (sections.get(card) !== state || card.hidden || container.hidden || state[section]) return
      renderPlanetMoons(container, state.planet, (spec) => factTile(spec, true))
    } else {
      const { renderPlanetInfo } = await import('./planet-info')
      if (sections.get(card) !== state || card.hidden || container.hidden || state[section]) return
      renderPlanetInfo(container, state.planet.id)
    }
    state[section] = true
  } catch {
    if (sections.get(card) !== state || card.hidden || container.hidden) return
    container.replaceChildren(createLoadError(section === 'info' ? 'planet Info' : 'moons',
      () => { void renderPlanetSection(card, section) }))
  }
}
const specIcons: Readonly<Record<string, IconNode>> = {
  'mean-diameter': Diameter, 'mean-radius': Radius, mass: Weight, volume: Box,
  'mean-density': Atom, 'surface-gravity': ArrowDownToLine, 'escape-velocity': ArrowUpRight,
  'synodic-rotation-period': Orbit, 'surface-temperature': Thermometer, albedo: Sun,
  flattening: Orbit, 'surface-area': ScanLine, temperature: Thermometer,
  'absolute-magnitude': Sun, 'apparent-magnitude': Eye,
  'semi-major-axis': Orbit, 'sidereal-orbit': Orbit, 'phase-cycle': Sun,
}

let hideActiveTooltip: (() => void) | undefined

function attachTooltip(button: HTMLButtonElement, tooltip: HTMLElement): void {
  tooltip.setAttribute('popover', 'manual')
  button.setAttribute('aria-describedby', tooltip.id)
  let hovered = false
  let listeners: AbortController | undefined
  let observer: MutationObserver | undefined
  let resizeObserver: ResizeObserver | undefined
  const hide = () => {
    if (tooltip.matches(':popover-open')) tooltip.hidePopover()
    listeners?.abort()
    observer?.disconnect()
    resizeObserver?.disconnect()
    if (hideActiveTooltip === hide) hideActiveTooltip = undefined
  }
  const position = () => {
    if (!button.isConnected || !button.checkVisibility()) {
      hide()
      return
    }
    const card = button.closest<HTMLElement>('.planet-card')!
    const scroller = button.closest<HTMLElement>('.card-scroll-content')!
    const anchor = button.getBoundingClientRect()
    const scrollBounds = scroller.getBoundingClientRect()
    if (anchor.bottom <= scrollBounds.top || anchor.top >= scrollBounds.bottom) {
      hide()
      return
    }
    const bounds = card.getBoundingClientRect()
    const margin = 8, gap = 8
    const leftEdge = Math.max(margin, bounds.left + margin)
    const rightEdge = Math.min(window.innerWidth - margin, bounds.right - margin)
    const topEdge = Math.max(margin, bounds.top + margin)
    const bottomEdge = Math.min(window.innerHeight - margin, bounds.bottom - margin)
    const maxWidth = rightEdge - leftEdge
    let width = Math.min(button.closest('.moon-properties') ? 300 : 280, maxWidth)
    tooltip.style.maxWidth = `${width}px`
    // A wider tooltip needs fewer lines when its label is near the card's top edge.
    while (tooltip.offsetHeight > anchor.top - gap - topEdge && width < maxWidth) {
      width = Math.min(width + 24, maxWidth)
      tooltip.style.maxWidth = `${width}px`
    }
    const size = tooltip.getBoundingClientRect()
    const alignRight = (anchor.left + anchor.right) / 2 > (bounds.left + bounds.right) / 2
    const left = Math.max(leftEdge, Math.min(alignRight ? anchor.right - size.width : anchor.left, rightEdge - size.width))
    const above = anchor.top - gap - size.height
    const below = above < topEdge && anchor.bottom + gap + size.height <= bottomEdge
    const top = Math.max(topEdge, Math.min(below ? anchor.bottom + gap : above, bottomEdge - size.height))
    tooltip.style.left = `${left}px`
    tooltip.style.top = `${top}px`
    tooltip.dataset.placement = below ? 'below' : 'above'
    tooltip.style.setProperty('--planet-tooltip-arrow', `${Math.max(10, Math.min((anchor.left + anchor.right) / 2 - left - 4, size.width - 18))}px`)
  }
  const show = () => {
    if (tooltip.matches(':popover-open')) return
    hideActiveTooltip?.()
    hideActiveTooltip = hide
    // The top layer escapes both the scroll area's clipping and the sticky headers.
    tooltip.showPopover()
    position()
    if (!tooltip.matches(':popover-open')) return
    listeners = new AbortController()
    const { signal } = listeners
    window.addEventListener('resize', position, { signal })
    document.addEventListener('scroll', position, { capture: true, passive: true, signal })
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hide() }, { signal })
    document.addEventListener('pointerdown', (event) => { if (!button.contains(event.target as Node)) hide() }, { signal })
    const card = button.closest<HTMLElement>('.planet-card')!
    observer = new MutationObserver(() => {
      if (!button.isConnected || !button.checkVisibility()) hide()
    })
    observer.observe(card, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] })
    resizeObserver = new ResizeObserver(position)
    resizeObserver.observe(card)
  }
  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    hovered = true
    show()
  })
  button.addEventListener('pointerleave', () => {
    hovered = false
    if (document.activeElement !== button) hide()
  })
  button.addEventListener('focus', show)
  button.addEventListener('blur', () => { if (!hovered) hide() })
}

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

function specRow(spec: PlanetSpec, showDetailTooltip = true, showComparison = true): HTMLDivElement {
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
    attachTooltip(button, tooltip)
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
  if (showComparison && spec.comparison) {
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
    attachTooltip(help, tooltip)
    label.replaceChildren(help, tooltip)
  }
  row.append(label, value)
  return row
}

function earthComparison(spec: PlanetSpec): HTMLSpanElement | undefined {
  if (!spec.earthRatios?.length) return undefined
  const comparison = document.createElement('span')
  comparison.className = 'planet-ratio-row'
  comparison.setAttribute('role', 'img')
  const earthIcon = createElement(Earth, { width: 14, height: 14, 'stroke-width': 1.7, 'aria-hidden': 'true' })
  const text = document.createElement('span')
  text.className = 'planet-ratio-value'
  const ratios = spec.earthRatios
  text.textContent = spec.comparison ? spec.comparison.replaceAll('×Earth', '×')
    : `${ratios.map((ratio) => ratio.toLocaleString('en-US', { maximumSignificantDigits: 3 })).join(' – ')}×`
  // A shared bounded scale keeps both tiny exospheres and large gas giants in range.
  // Equal values sit at the midpoint; no positive ratio is clipped.
  const position = (ratio: number) => 100 * ratio / (1 + ratio)
  const track = document.createElement('span')
  track.className = 'planet-ratio-track mass-ratio-track'
  track.setAttribute('aria-hidden', 'true')
  if (ratios.length === 1) {
    const fill = document.createElement('span')
    fill.className = 'planet-ratio-fill'
    fill.style.width = `${position(ratios[0]!)}%`
    track.append(fill)
  } else {
    const low = position(Math.min(...ratios)), high = position(Math.max(...ratios))
    track.classList.add('is-range')
    const range = document.createElement('span')
    range.className = 'planet-ratio-range'
    range.style.left = `${low}%`
    range.style.width = `${high - low}%`
    for (const [index, value] of [low, high].entries()) {
      const marker = document.createElement('span')
      marker.className = `planet-ratio-endpoint${index === 1 ? ' is-high' : ''}`
      marker.style.left = `${value}%`
      track.append(marker)
    }
    track.prepend(range)
  }
  const reference = document.createElement('span')
  reference.className = 'planet-ratio-earth'
  track.append(reference)
  comparison.title = `${text.textContent} Earth. Earth equality is the midpoint. Bar position = ratio / (1 + ratio).${spec.pressureUpperLimit ? ' Pressure is an upper limit.' : ''}`
  comparison.setAttribute('aria-label', `${text.textContent} Earth${spec.pressureUpperLimit ? ', upper limit' : ''}`)
  comparison.append(earthIcon, text, track)
  return comparison
}

function apparentMagnitudeComparison(spec: PlanetSpec): HTMLSpanElement | undefined {
  if (spec.apparentMagnitudeV === undefined) return undefined
  const { brightest, faintest } = planetApparentMagnitudeRange()
  // Equal magnitude steps, with increasing brightness toward the right.
  const position = (magnitude: number) => 100 * (faintest.magnitude - magnitude) / (faintest.magnitude - brightest.magnitude)
  const comparison = document.createElement('span')
  comparison.className = 'planet-magnitude-comparison'
  comparison.setAttribute('role', 'img')
  const description = `Brightest apparent V magnitudes from Earth: ${faintest.name} ${magnitudeNumber(faintest.magnitude)} to ${brightest.name} ${magnitudeNumber(brightest.magnitude)}. Selected: ${magnitudeNumber(spec.apparentMagnitudeV)}. Naked-eye limit approximately +6 under dark skies; visibility fades between +4 and +6. These are peak brightness values, not current measurements.`
  comparison.setAttribute('aria-label', description)
  comparison.title = description
  const track = document.createElement('span')
  track.className = 'planet-ratio-track mass-ratio-track planet-magnitude-track'
  const limitPosition = position(NAKED_EYE_MAGNITUDE)
  const band = document.createElement('span')
  band.className = 'magnitude-visible-band'
  band.style.left = `${limitPosition}%`
  band.style.setProperty('--magnitude-visibility-fade-end', `${(position(4) - limitPosition) / (100 - limitPosition) * 100}%`)
  const limit = document.createElement('span')
  limit.className = 'magnitude-eye-limit planet-magnitude-limit'
  limit.style.left = `${limitPosition}%`
  const limitLabel = document.createElement('span')
  limitLabel.textContent = '+6'
  limit.append(limitLabel)
  const selected = document.createElement('span')
  selected.className = 'planet-magnitude-selected'
  selected.style.left = `${position(spec.apparentMagnitudeV)}%`
  track.append(band, limit, selected)
  const labels = document.createElement('span')
  labels.className = 'planet-magnitude-labels'
  for (const planet of [faintest, brightest]) {
    const label = document.createElement('span')
    label.textContent = planet.name
    labels.append(label)
  }
  comparison.append(track, labels)
  for (const child of [track, labels]) child.setAttribute('aria-hidden', 'true')
  return comparison
}

function factTile(spec: PlanetSpec, showDetailTooltip = true): HTMLDivElement {
  const row = specRow(spec, showDetailTooltip, false)
  row.className = 'planet-fact-tile'
  const label = row.querySelector('dt')!
  if (!spec.id.startsWith('moon-') && showDetailTooltip) {
    // Keep the icon positioned against the tile while the label owns its tooltip.
    const copy = document.createElement('span')
    copy.className = 'mass-metric-copy planet-fact-label'
    copy.append(...label.childNodes)
    label.classList.remove('mass-metric-copy')
    label.append(copy)
  }
  const iconId = spec.id.replace(/^moon-[^-]+-/, '')
  const icon = createElement(specIcons[iconId] ?? Orbit, { width: 24, height: 24, 'stroke-width': 1.5, 'aria-hidden': 'true' })
  icon.classList.add('planet-fact-icon')
  row.querySelector('dt')!.prepend(icon)
  const value = row.querySelector('dd')!
  const primaryValue = document.createElement('span')
  primaryValue.className = 'planet-fact-value'
  primaryValue.append(...value.childNodes)
  value.append(primaryValue)
  const comparison = apparentMagnitudeComparison(spec) ?? earthComparison(spec)
  if (comparison) value.append(comparison)
  else if (spec.comparison) {
    const note = document.createElement('span')
    note.className = 'planet-fact-note'
    note.textContent = spec.comparison
    value.append(note)
  }
  return row
}

export function renderPlanetCard(card: HTMLElement, planet: PlanetDescription): void {
  sections.set(card, { planet, info: false, moons: false })
  const extrasolar = isExtrasolarPlanet(planet)
  card.dataset.planetId = planet.id
  card.querySelector<HTMLElement>('#planet-name')!.textContent = planet.name
  card.querySelector<HTMLElement>('#planet-icon')!.style.setProperty('--planet-color', planet.color)
  const globe = card.querySelector<HTMLCanvasElement>('#planet-globe')!
  let photograph = card.querySelector<HTMLImageElement>('#planet-image')
  if (!photograph) {
    photograph = document.createElement('img')
    photograph.id = 'planet-image'
    photograph.decoding = 'async'
    globe.after(photograph)
  }
  const photo = planetHasGlobe(planet.id) ? undefined : smallBodyMedia[planet.id]
  photograph.hidden = !photo
  globe.hidden = Boolean(photo)
  if (photo) {
    photograph.src = photo.image
    photograph.alt = photo.description
    photograph.title = photo.credit
  } else photograph.removeAttribute('src')
  const addEarth = card.querySelector<HTMLButtonElement>('#planet-add-earth')!
  const globeAvailable = !photo && renderPlanetGlobe(globe, planet.id)
  if (photo) resetPlanetGlobe(globe)
  globe.parentElement!.hidden = !photo && !globeAvailable
  globe.parentElement!.dataset.mediaType = photo ? 'photograph' : 'globe'
  addEarth.hidden = extrasolar || !globeAvailable
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
  card.querySelector<HTMLButtonElement>('#planet-moons-toggle')!.disabled = extrasolar || planet.moonCount === 0
  const infoToggle = card.querySelector<HTMLButtonElement>('#planet-info-toggle')!
  infoToggle.hidden = extrasolar
  const info = card.querySelector<HTMLElement>('#planet-info')!
  info.replaceChildren()
  infoToggle.disabled = extrasolar || !infoIds.has(planet.id)
  const physical = card.querySelector<HTMLElement>('#planet-physical-specs')!
  const physicalSpecs = planetPhysicalSpecs(planet)
  const statsToggle = card.querySelector<HTMLButtonElement>('#planet-stats-toggle')!
  statsToggle.hidden = extrasolar
  physical.classList.toggle('planet-facts-grid', !extrasolar)
  const physicalHeading = card.querySelector<HTMLElement>('#planet-physical-heading')!
  physicalHeading.textContent = extrasolar ? 'Physical characteristics' : 'Key facts'
  const primarySpecs = primarySpecIds.flatMap((id) => physicalSpecs.filter((spec) => spec.id === id))
  const secondarySpecs = physicalSpecs.filter((spec) => !primarySpecIds.includes(spec.id))
  const showStats = (secondary: boolean) => {
    physicalHeading.textContent = secondary ? 'More facts' : 'Key facts'
    physical.dataset.statsPage = secondary ? '2' : '1'
    physical.setAttribute('aria-label', secondary ? 'More facts, page 2 of 2' : 'Key facts, page 1 of 2')
    physical.replaceChildren(...(secondary ? secondarySpecs : primarySpecs).map((spec) => factTile(spec)))
    statsToggle.setAttribute('aria-pressed', String(secondary))
    statsToggle.setAttribute('aria-label', secondary ? 'Show key facts' : 'Show more stats')
    statsToggle.title = secondary ? 'Show key facts (page 1 of 2)' : 'Show more stats (page 2 of 2)'
  }
  statsToggle.onclick = () => {
    showStats(statsToggle.getAttribute('aria-pressed') !== 'true')
    card.querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  }
  if (extrasolar) {
    delete physical.dataset.statsPage
    physical.removeAttribute('aria-label')
    physical.replaceChildren(...physicalSpecs.map((spec) => specRow(spec)))
  } else showStats(false)
  const orbit = card.querySelector<HTMLElement>('#planet-orbit-specs')!
  orbit.replaceChildren(...(extrasolar ? extrasolarOrbitalSpecs(planet).map((spec) => specRow(spec)) : []))
  card.querySelector<HTMLElement>('#planet-orbit-section')!.hidden = !extrasolar
  const atmosphere = card.querySelector<HTMLElement>('#planet-atmosphere-specs')!
  const atmosphereSection = card.querySelector<HTMLDetailsElement>('#planet-atmosphere-section')!
  atmosphereSection.hidden = extrasolar || isSmallBody(planet)
  atmosphereSection.open = true
  atmosphere.replaceChildren()
  if (extrasolar || isSmallBody(planet)) return
  atmosphere.replaceChildren(...planetAtmosphereSpecs(planet).map((spec) => {
    const row = specRow(spec, true, false)
    const comparison = earthComparison(spec)
    if (comparison) row.querySelector('dd')!.append(comparison)
    return row
  }))
  const composition = specRow({ id: 'composition', label: 'Composition', value: '', comparison: '',
    detail: `The main gases or atoms in the atmosphere or exosphere. ${planet.notes.atmosphere}` }, true, false)
  composition.className = 'planet-composition-row'
  const value = composition.querySelector('dd')!
  const list = document.createElement('ul')
  list.className = 'planet-composition'
  list.title = planet.notes.atmosphere
  for (const atom of planet.composition) {
    const item = document.createElement('li')
    item.textContent = `${atom.name} (${atom.symbol})${'abundance' in atom ? ` · ${atom.abundance}` : ''}`
    list.append(item)
  }
  value.append(list)
  atmosphere.append(composition)
}
