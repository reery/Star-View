import './style.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import { Focus, Grid2X2, Orbit, ZoomIn, ZoomOut, createElement, type IconNode } from 'lucide'
import { describeObject, OBJECT_TYPES, objectTypeLabel, type ObjectType, type Star } from './catalog'
import { catalogSelection, loadCatalog } from './catalogs'
import { catalogs, catalogErrors } from './registry'
import { formatDistance, sunRelativeMetrics, temperatureToColor, type DistanceUnit } from './astronomy'
import { createStarViewer, type StarViewer } from './viewer'

function element<ElementType extends HTMLElement = HTMLElement>(id: string): ElementType {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing interface element: ${id}`)
  return found as ElementType
}

function text(id: string, value: string): void {
  element(id).textContent = value
}

function icon(id: string, shape: IconNode): void {
  element(id).replaceChildren(createElement(shape, { width: 20, height: 20, 'stroke-width': 1.7, 'aria-hidden': 'true' }))
}

function quantity(value: number | null, unit = '', maximumFractionDigits = 3): string {
  if (value === null) return 'Not available'
  return `${value.toLocaleString('en-US', { maximumFractionDigits })}${unit ? ` ${unit}` : ''}`
}

icon('brand-icon', Orbit)
icon('reset-icon', Focus)
icon('grid-icon', Grid2X2)
icon('zoom-in-icon', ZoomIn)
icon('zoom-out-icon', ZoomOut)

const events = new AbortController()
let viewer: StarViewer | undefined
let stars: Star[] = []
let activeCatalogId = ''
let selectedId: string | null = 'sirius-a'
let observerId = 'sirius-a'
let magnitudeLimit = 7
let objectDistanceLimitLy = 100
let gridVisible = true
let powerSavingMode = true
const selectedTypes = new Set<ObjectType>(OBJECT_TYPES)
let distanceUnit: DistanceUnit = 'ly'
try {
  if (localStorage.getItem('star-view-distance-unit') === 'pc') distanceUnit = 'pc'
} catch {}
const viewButtons = ['reset-view', 'toggle-grid', 'zoom-in', 'zoom-out'].map((id) => element<HTMLButtonElement>(id))

function sceneStatus(message: string | null): void {
  const status = element('scene-status')
  status.textContent = message
  status.hidden = message === null
  viewButtons.forEach((button) => { button.disabled = message !== null })
}

function renderSelection(): void {
  const sun = stars.find((star) => star.id === 'sun')!
  const star = stars.find((candidate) => candidate.id === selectedId)
  text('visibility-base', stars.find((candidate) => candidate.id === observerId)?.name ?? 'Sun')
  element('star-details').hidden = !star
  element('selection-empty').hidden = Boolean(star)
  for (const button of element('star-list').querySelectorAll<HTMLButtonElement>('button')) {
    const selected = button.dataset.star === selectedId
    button.classList.toggle('is-selected', selected)
    button.setAttribute('aria-pressed', String(selected))
  }
  if (!star) {
    delete element('inspector').dataset.selectedStar
    element('inspector').style.removeProperty('--selected-star-color')
    text('selection-announcement', 'No object selected.')
    return
  }
  const metrics = sunRelativeMetrics(star, sun)
  element('inspector').dataset.selectedStar = star.id
  element('inspector').style.setProperty('--selected-star-color', temperatureToColor(star.temperature_k).getStyle())
  text('star-name', star.name)
  text('star-id', star.id)
  element('selected-swatch').style.background = temperatureToColor(star.temperature_k).getStyle()
  text('distance-value', formatDistance(metrics.distancePc, distanceUnit).split(' ')[0]!)
  text('distance-unit', ` ${distanceUnit}`)
  text('object-type', describeObject(star))
  text('constellation', star.id === 'sun' ? 'Not applicable' : star.constellation ?? 'Not available')
  text('spectral-type', star.spectral_type ?? 'Not available')
  text('temperature', quantity(star.temperature_k, 'K', 0))
  text('mass', quantity(star.mass_solar, 'solar'))
  text('luminosity', quantity(star.luminosity_solar, 'solar'))
  element('luminosity-row').hidden = star.luminosity_solar === null
  text('coordinate-x', formatDistance(star.x_pc, distanceUnit, 3))
  text('coordinate-y', formatDistance(star.y_pc, distanceUnit, 3))
  text('coordinate-z', formatDistance(star.z_pc, distanceUnit, 3))
  text('plane-distance', formatDistance(metrics.planeDistancePc, distanceUnit, 3))
  text('epoch', `J${star.epoch.toFixed(1)}`)
  text('velocity-x', quantity(star.vx_kms, 'km/s'))
  text('velocity-y', quantity(star.vy_kms, 'km/s'))
  text('velocity-z', quantity(star.vz_kms, 'km/s'))
  text('absolute-mag', quantity(star.absolute_mag))
  text('star-notes', star.notes || 'No source notes available.')
  text('selection-announcement', `${star.name}, ${formatDistance(metrics.distancePc, distanceUnit)} from the Sun.`)
}

function selectStar(id: string | null): void {
  if (id !== null && !stars.some((star) => star.id === id)) return
  selectedId = id
  if (id !== null) observerId = id
  renderSelection()
  viewer?.select(id)
  viewer?.setVisibility(observerId, magnitudeLimit)
}

function renderDistances(): void {
  const sun = stars.find((star) => star.id === 'sun')!
  element<HTMLInputElement>(`unit-${distanceUnit}`).checked = true
  text('grid-spacing', `${formatDistance(0.5, distanceUnit, distanceUnit === 'pc' ? 1 : 2)} grid`)
  for (const button of element('star-list').querySelectorAll<HTMLButtonElement>('button')) {
    const star = stars.find((candidate) => candidate.id === button.dataset.star)!
    button.querySelector('.catalog-distance')!.textContent = formatDistance(sunRelativeMetrics(star, sun).distancePc, distanceUnit)
  }
  renderSelection()
}

function switchCatalog(id: string): void {
  if (id === activeCatalogId) return
  const definition = catalogs.find((catalog) => catalog.manifest.id === id)
  if (!definition) return
  const nextStars = loadCatalog(definition)
  const retained = catalogSelection(nextStars, selectedId, observerId)
  viewer?.dispose()
  viewer = undefined
  stars = nextStars
  activeCatalogId = id
  selectedId = retained.selectedId
  observerId = retained.observerId
  const list = element('star-list')
  list.replaceChildren()
  text('catalog-count', stars.length.toString().padStart(2, '0'))
  text('scene-epoch', `J${definition.manifest.epoch.toFixed(1)}`)
  element<HTMLSelectElement>('catalog-select').value = id
  element('catalog-select').title = `${definition.manifest.description} ${definition.manifest.snapshot}`
  for (const star of stars) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'catalog-entry'
    button.dataset.star = star.id
    button.setAttribute('aria-label', `Select ${star.name}`)
    const swatch = document.createElement('span')
    swatch.className = 'star-swatch'
    swatch.style.background = temperatureToColor(star.temperature_k).getStyle()
    swatch.setAttribute('aria-hidden', 'true')
    const name = document.createElement('span')
    name.className = 'catalog-name'
    name.textContent = star.name
    const distance = document.createElement('span')
    distance.className = 'catalog-distance'
    button.append(swatch, name, distance)
    list.append(button)
  }
  renderDistances()
  try {
    viewer = createStarViewer(element('scene'), stars, { onSelect: selectStar, onStatus: sceneStatus })
    viewer.setDistanceUnit(distanceUnit)
    viewer.select(selectedId, false)
    viewer.setVisibility(observerId, magnitudeLimit)
    viewer.setObjectDistanceLimit(objectDistanceLimitLy)
    viewer.setObjectTypeFilter([...selectedTypes])
    viewer.setPowerSavingMode(powerSavingMode)
    viewer.setGridVisible(gridVisible)
    sceneStatus(null)
  } catch {
    sceneStatus('3D graphics are unavailable on this device. The object catalog and details are still available.')
  }
}

function catalogError(error: unknown): void {
  text('catalog-error', error instanceof Error ? error.message : String(error))
  element('catalog-error').hidden = false
}

const typeOptions = element('object-type-options')
function renderObjectTypeSummary(): void {
  text('object-type-filter-summary', selectedTypes.size === OBJECT_TYPES.length ? 'All' : `${selectedTypes.size} of ${OBJECT_TYPES.length}`)
}

for (const type of OBJECT_TYPES) {
  const label = document.createElement('label')
  label.className = 'object-type-option'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.name = 'object-type'
  input.dataset.objectType = type
  input.checked = true
  const name = document.createElement('span')
  name.textContent = objectTypeLabel(type)
  label.append(input, name)
  typeOptions.append(label)
}
renderObjectTypeSummary()

for (const { manifest } of catalogs) {
  element<HTMLSelectElement>('catalog-select').add(new Option(manifest.label, manifest.id))
}
try {
  switchCatalog('nearest-neighbors')
  if (catalogErrors.length) catalogError(catalogErrors.join('\n'))
} catch (error) {
  catalogError(error)
  sceneStatus('The nearby-object catalog could not be loaded.')
}

element('star-list').addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-star]')
  if (button) selectStar(button.dataset.star!)
}, { signal: events.signal })
element('catalog-select').addEventListener('change', () => {
  try {
    switchCatalog(element<HTMLSelectElement>('catalog-select').value)
  } catch (error) {
    catalogError(error)
    element<HTMLSelectElement>('catalog-select').value = activeCatalogId
  }
}, { signal: events.signal })
element('distance-units').addEventListener('change', () => {
  distanceUnit = element<HTMLInputElement>('unit-ly').checked ? 'ly' : 'pc'
  try { localStorage.setItem('star-view-distance-unit', distanceUnit) } catch {}
  renderDistances()
  viewer?.setDistanceUnit(distanceUnit)
}, { signal: events.signal })
element('magnitude-limit').addEventListener('input', () => {
  const input = element<HTMLInputElement>('magnitude-limit')
  if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) return
  magnitudeLimit = input.valueAsNumber
  text('magnitude-limit-value', String(magnitudeLimit))
  viewer?.setVisibility(observerId, magnitudeLimit)
}, { signal: events.signal })
element('magnitude-limit').addEventListener('change', () => {
  element<HTMLInputElement>('magnitude-limit').value = String(magnitudeLimit)
}, { signal: events.signal })
element('object-distance-limit').addEventListener('input', () => {
  const input = element<HTMLInputElement>('object-distance-limit')
  if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) return
  objectDistanceLimitLy = input.valueAsNumber
  text('object-distance-limit-value', `${objectDistanceLimitLy} ly`)
  viewer?.setObjectDistanceLimit(objectDistanceLimitLy)
}, { signal: events.signal })
element('power-saving-mode').addEventListener('change', () => {
  powerSavingMode = element<HTMLInputElement>('power-saving-mode').checked
  viewer?.setPowerSavingMode(powerSavingMode)
}, { signal: events.signal })
element('object-type-filter').addEventListener('change', (event) => {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const type = input.dataset.objectType as ObjectType | undefined
  if (!type || !OBJECT_TYPES.includes(type)) return
  if (input.checked) selectedTypes.add(type)
  else selectedTypes.delete(type)
  renderObjectTypeSummary()
  viewer?.setObjectTypeFilter([...selectedTypes])
}, { signal: events.signal })
element('reset-view').addEventListener('click', () => viewer?.reset(), { signal: events.signal })
element('toggle-grid').addEventListener('click', () => {
  if (!viewer) return
  const button = element('toggle-grid')
  gridVisible = !gridVisible
  viewer.setGridVisible(gridVisible)
  button.setAttribute('aria-pressed', String(gridVisible))
  text('grid-tooltip', gridVisible ? 'Hide grid' : 'Show grid')
  element('grid-legend').hidden = !gridVisible
  element('plane-key').hidden = !gridVisible
}, { signal: events.signal })
element('zoom-in').addEventListener('click', () => viewer?.zoom('in'), { signal: events.signal })
element('zoom-out').addEventListener('click', () => viewer?.zoom('out'), { signal: events.signal })

import.meta.hot?.dispose(() => {
  events.abort()
  viewer?.dispose()
})
