import './style.css'
import { ArrowLeft, ArrowRight, BookOpen, ChevronsLeftRight, ChevronsRightLeft, CircleHelp, Clock, Crosshair, Earth, Eye, Filter, Focus, Grid2X2, List, Lock, Minus, Moon, Orbit, Pause, Play, Plus, RotateCcw, RotateCw, Save, Search, Settings2, X, createElement, type IconNode } from 'lucide'
import { ObserverOriginIcon, OriginIcon } from './origin-icon'
import { BUBBLE_OBJECT_TYPES, COMPACT_OBJECT_TYPES, describeObject, isBubbleObject, isCompactObject, isMolecularCloudObject, isNebulaObject, MOLECULAR_CLOUD_OBJECT_TYPES, NEBULA_OBJECT_TYPES, type Star } from './catalog-model'
import { catalogSelection, mergeCatalogStars } from './catalog-runtime'
import { objectDesignations } from './designations'
import { compactOverlayManifest, loadCompactRemnants } from './compact-overlay'
import { loadNebulae, nebulaOverlayManifest } from './nebula-overlay'
import { loadMolecularClouds, molecularCloudOverlayManifest } from './molecular-cloud-overlay'
import { bubbleOverlayManifest, loadBubbles } from './bubble-overlay'
import { catalogs, catalogErrors } from './registry'
import { formatDistance, LIGHT_YEARS_PER_PARSEC, starDisplayColor, sunRelativeMetrics, type DistanceUnit, type GridScale, type MotionFrame, type StarColorMode } from './astronomy'
import { EARTH_ORBIT_MODES, earthOrbitDateForMode, earthOrbitModeLabel, isEarthOrbitMode, type EarthOrbitMode } from './earth-orbit'
import { MOTION_YEAR_OPTIONS, SIMULATION_YEAR_LIMIT, createStarViewer, type MotionYears, type StarViewer, type ViewerViewState } from './viewer'
import { isObjectMapVisible } from './viewer-primitives'
import { renderSelectedStarPreview } from './selected-star-preview'
import { disposeDistanceComparison, renderDistanceComparison } from './distance-comparison'
import type { MassReference } from './mass-comparison'
import { renderRadiusBars } from './radius-card'
import { hrCardAvailable, hrMagnitude, renderHrDiagram, type HrMagnitudeMode } from './hr-diagram'
import { renderMkDiagram } from './mk-diagram'
import { spectralReference } from './spectral-chart'
import { massCardAvailable } from './mass-properties'
import { radiusComparison, radiusStats, radiusSummary, renderRadiusComparison, type RadiusReference } from './radius-comparison'
import { indexStarSystems, primarySystemStarId, type StarSystem } from './star-systems'
import { loadStellarOrbits } from './stellar-orbits'
import { loadPlanetarySystems, planetarySystemForStar } from './planetary-systems'
import { highlightSystemPlanet, renderSystemCard } from './system-card'
import {
  availableFilterKeys, categoryAvailable, DEFAULT_FILTER_CATEGORIES, DEFAULT_FILTER_SUBTYPES, effectiveFilterKeys, FILTER_CATEGORIES,
  filterCategoryForKey, filterSummary, isFilterCategoryId, isFilterKey, type FilterCategoryId, type FilterKey,
} from './object-filter'
import { ObjectList } from './object-list'
import { SelectionHistory } from './selection-history'
import { objectTypeIntroduction } from './object-type-info'
import { initializeGlossary } from './glossary'
import { MISSING_VALUE, measurement, preciseMeasurement, quantity, scientificQuantity } from './format'
import { OBJECT_DISTANCE_STEPS_LY, readSavedViews, SAVED_VIEWS_STORAGE_KEY, type SavedView, type SavedViewSettings } from './saved-views'

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

icon('reset-icon', Focus)
icon('grid-icon', Grid2X2)
icon('views-icon', Save)
icon('save-view-icon', Save)
icon('selection-back-icon', ArrowLeft)
icon('selection-forward-icon', ArrowRight)
icon('set-origin-icon', OriginIcon)
icon('go-to-origin-icon', Crosshair)
icon('observer-view-icon', Eye)
icon('observer-view-origin-icon', ObserverOriginIcon)
icon('observer-roll-counterclockwise-icon', RotateCcw)
icon('observer-roll-reset-icon', Crosshair)
icon('observer-roll-clockwise-icon', RotateCw)
icon('filter-icon', Filter)
icon('preferences-icon', Settings2)
icon('objects-icon', List)
icon('glossary-icon', BookOpen)
icon('glossary-search-icon', Search)
icon('glossary-lock-icon', Lock)
icon('info-icon', CircleHelp)
icon('info-brand-icon', Orbit)
icon('filter-lock-icon', Lock)
icon('preferences-lock-icon', Lock)
icon('objects-lock-icon', Lock)
icon('objects-expand-icon', ChevronsLeftRight)
icon('motion-icon', Clock)
icon('motion-lock-icon', Lock)
icon('object-type-close-icon', X)
icon('metallicity-close-icon', X)
icon('radius-close-icon', X)
icon('spectral-close-icon', X)
icon('mass-close-icon', X)
icon('distance-close-icon', X)
icon('distance-lock-icon', Lock)
icon('planet-lock-icon', Lock)
icon('planet-specs-icon', List)
icon('planet-info-icon', BookOpen)
icon('planet-moons-icon', Moon)
icon('planet-earth-icon', Earth)
icon('planet-earth-plus-icon', Plus)
icon('planet-earth-minus-icon', Minus)
icon('time-play-icon', Play)
icon('time-now-icon', RotateCcw)
icon('time-follow-icon', Crosshair)
icon('time-slower-icon', Minus)
icon('time-faster-icon', Plus)
icon('object-specs-icon', List)
icon('object-info-icon', BookOpen)
icon('object-system-icon', Orbit)

const events = new AbortController()
initializeGlossary(events.signal)
let viewer: StarViewer | undefined
let stars: Star[] = []
let starSystems: ReadonlyMap<string, StarSystem> = new Map()
let activeCatalogId = ''
let selectedId: string | null = 'sirius-a'
let observerId = 'sirius-a'
let referenceId = 'sun'
let magnitudeLimit = 7
let objectDistanceLimitLy = 100
let showAlwaysBright = false
let showWesternConstellationStars = false
let showFamousClusterStars = false
let gridVisible = true
let observerView = false
let observerViewAnchorId: string | null = null
let powerSavingMode = false
let labelLimit = 40
let motionArrowsVisible = true
let earthOrbitMode: EarthOrbitMode = 'now'
let milkyWayVisible = true
let motionFrame: MotionFrame = 'galactic'
let motionYears: MotionYears = 1_000
let simulationYears = 0
let simulationPlaying = false
let selectedDistancePc: number | null = null
let viewerDistancePc: number | null = null
let currentGridScale: GridScale = { spacing: 1, spacingPc: 1 / LIGHT_YEARS_PER_PARSEC, halfSizePc: 10 / LIGHT_YEARS_PER_PARSEC }
let followSelection = false
let simulationDirection: 1 | -1 = 1
let playbackSecondsPerThousandYears = 1
let playbackFrameRequest: number | null = null
let previousPlaybackTime = 0
let catalogRequest = 0
let sceneBusy = true
const filterCategories = new Set<FilterCategoryId>(DEFAULT_FILTER_CATEGORIES)
const filterSubtypes = new Set<FilterKey>(DEFAULT_FILTER_SUBTYPES)
const availableKeys = availableFilterKeys(compactOverlayManifest.counts, nebulaOverlayManifest.counts, molecularCloudOverlayManifest.counts, bubbleOverlayManifest.counts)
let visibleKeys = effectiveFilterKeys(filterCategories, filterSubtypes, availableKeys)
let distanceUnit: DistanceUnit = 'ly'
let starColorMode: StarColorMode = 'exaggerated'
const BRIGHT_CATALOG_ID = 'bright-stars'
const WESTERN_CONSTELLATION_CATALOG_ID = 'western-constellation-stars'
const FAMOUS_CLUSTER_CATALOG_ID = 'famous-cluster-stars'
const ADDITIVE_CATALOG_IDS = new Set([BRIGHT_CATALOG_ID, WESTERN_CONSTELLATION_CATALOG_ID, FAMOUS_CLUSTER_CATALOG_ID])

// Nearest-N catalogs form an ordered size progression; landmark catalogs are independent additive toggles.
const sliderCatalogs = catalogs.filter((catalog) => !ADDITIVE_CATALOG_IDS.has(catalog.manifest.id))
  .sort((first, second) => first.manifest.objectCount - second.manifest.objectCount)
let savedViews = readSavedViews()
let savedViewMenuRow: HTMLTableRowElement | null = null
try {
  if (localStorage.getItem('star-view-distance-unit') === 'pc') distanceUnit = 'pc'
  if (localStorage.getItem('star-view-color-mode') === 'real') starColorMode = 'real'
  const storedEarthOrbitMode = localStorage.getItem('star-view-earth-orbit-mode')
  if (isEarthOrbitMode(storedEarthOrbitMode)) earthOrbitMode = storedEarthOrbitMode
  else if (localStorage.getItem('star-view-earth-orbit-visible') === 'false') earthOrbitMode = 'off'
  if (localStorage.getItem('star-view-milky-way-visible') === 'false') milkyWayVisible = false
  const storedLabelLimit = localStorage.getItem('star-view-label-limit')
  const parsedLabelLimit = Number(storedLabelLimit)
  if (storedLabelLimit !== null && parsedLabelLimit >= 0 && parsedLabelLimit <= 140 && parsedLabelLimit % 20 === 0) labelLimit = parsedLabelLimit
} catch {}
element<HTMLInputElement>(`star-colors-${starColorMode}`).checked = true
const earthOrbitModeInput = element<HTMLInputElement>('earth-orbit-mode')
earthOrbitModeInput.value = String(EARTH_ORBIT_MODES.indexOf(earthOrbitMode))
earthOrbitModeInput.setAttribute('aria-valuetext', earthOrbitModeLabel(earthOrbitMode))
text('earth-orbit-mode-value', earthOrbitModeLabel(earthOrbitMode))
element<HTMLInputElement>('milky-way-visible').checked = milkyWayVisible
const labelLimitInput = element<HTMLInputElement>('label-limit')
labelLimitInput.value = String(labelLimit)
labelLimitInput.setAttribute('aria-valuetext', labelLimit === 0 ? 'Off' : `${labelLimit} labels`)
text('label-limit-value', labelLimit === 0 ? 'Off' : String(labelLimit))
const cameraViews = ['top', 'side', 'front'] as const
const cameraViewButtonIds = ['reset-view', ...cameraViews.map((view) => `${view}-view`)]
const viewButtons = [...cameraViewButtonIds, 'toggle-grid', 'views-toggle'].map((id) => element<HTMLButtonElement>(id))
const timelineButtons = ['time-play', 'time-now', 'time-follow'].map((id) => element<HTMLButtonElement>(id))
const timeSlider = element<HTMLInputElement>('time-slider')
// Evenly spaced timeline ticks; set via CSSOM because the CSP forbids inline style attributes.
const timeMarkers = document.querySelectorAll<HTMLElement>('.time-markers i')
timeMarkers.forEach((marker, index) => marker.style.setProperty('--marker-position', `${index / (timeMarkers.length - 1) * 100}%`))
const selectionHistory = new SelectionHistory(selectedId)
const panelNames = ['views', 'motion', 'filter', 'objects', 'glossary', 'preferences', 'info'] as const
const lockablePanelNames = ['motion', 'filter', 'objects', 'glossary', 'preferences'] as const
const lockedPanels = new Set<typeof lockablePanelNames[number]>()

function selectedStarAvailable(id: string): boolean {
  return stars.some((star) => star.id === id)
}

function updateSelectionHistoryControls(): void {
  for (const direction of ['back', 'forward'] as const) {
    const id = direction === 'back' ? selectionHistory.peekBack(selectedStarAvailable) : selectionHistory.peekForward(selectedStarAvailable)
    const star = stars.find((star) => star.id === id)
    const prefix = `selection-${direction}`
    const label = direction === 'back' ? 'Previous selection' : 'Next selection'
    const button = element<HTMLButtonElement>(prefix)
    button.disabled = sceneBusy || !star
    button.setAttribute('aria-label', star ? `${label}: ${star.name}` : label)
    element(`${prefix}-object`).hidden = !star
    text(`${prefix}-name`, star?.name ?? '')
    element(`${prefix}-swatch`).style.background = star ? starDisplayColor(star, starColorMode).getStyle() : ''
  }
}

function updateReferenceControl(): void {
  const setOrigin = element<HTMLButtonElement>('set-origin')
  const selected = stars.find((star) => star.id === selectedId)
  setOrigin.disabled = sceneBusy || selectedId === null || selectedId === referenceId
  setOrigin.setAttribute('aria-label', `Set ${selected?.name ?? 'selected object'} as origin`)
  text('set-origin-name', selected?.name ?? 'selected object')
  element('set-origin-swatch').hidden = !selected
  element('set-origin-swatch').style.background = selected ? starDisplayColor(selected, starColorMode).getStyle() : ''
  const goToOrigin = element<HTMLButtonElement>('go-to-origin')
  const origin = stars.find((star) => star.id === referenceId)
  goToOrigin.disabled = sceneBusy || !origin
  goToOrigin.setAttribute('aria-label', origin ? `Go to ${origin.name}` : 'Go to set origin')
  text('go-to-origin-name', origin?.name ?? 'set origin')
  element('go-to-origin-swatch').hidden = !origin
  element('go-to-origin-swatch').style.background = origin ? starDisplayColor(origin, starColorMode).getStyle() : ''
  // Keep the expansion reachable by keyboard when the selected object is already the origin.
  element('origin-controls').tabIndex = setOrigin.disabled && !goToOrigin.disabled ? 0 : -1
}

function updateObserverControl(): void {
  const button = element<HTMLButtonElement>('observer-view')
  const selected = stars.find((star) => star.id === selectedId)
  const origin = stars.find((star) => star.id === referenceId)
  const observer = observerViewAnchorId === null ? undefined : stars.find((star) => star.id === observerViewAnchorId)
  button.disabled = sceneBusy || (!observerView && !selected)
  button.setAttribute('aria-pressed', String(observerView))
  button.setAttribute('aria-label', observerView ? 'Exit observer view' : selected ? `Observe from ${selected.name}` : 'Enter observer view')
  text('observer-view-tooltip', observerView ? 'Exit observer view' : 'Observe from')
  element('observer-view-target').hidden = observerView || !selected
  text('observer-view-target-name', selected?.name ?? '')
  element('observer-view-target-swatch').style.background = selected ? starDisplayColor(selected, starColorMode).getStyle() : ''
  const originButton = element<HTMLButtonElement>('observer-view-origin')
  const observingOrigin = observerView && observerViewAnchorId === referenceId
  originButton.disabled = sceneBusy || !origin
  originButton.setAttribute('aria-pressed', String(observingOrigin))
  originButton.setAttribute('aria-label', origin ? `Observe from origin ${origin.name}` : 'Observe from origin')
  text('observer-view-origin-name', origin?.name ?? 'set origin')
  element('observer-view-origin-swatch').hidden = !origin
  element('observer-view-origin-swatch').style.background = origin ? starDisplayColor(origin, starColorMode).getStyle() : ''
  element('observer-view-controls').tabIndex = button.disabled && !originButton.disabled ? 0 : -1
  element('observer-direction-card').hidden = !observerView
  const observerObject = element<HTMLButtonElement>('observer-object')
  observerObject.hidden = !observer
  observerObject.disabled = sceneBusy || !observer
  if (observer) {
    const color = starDisplayColor(observer, starColorMode).getStyle()
    text('observer-object-name', observer.name)
    observerObject.setAttribute('aria-label', `Select observing object ${observer.name}`)
    element('observer-object-swatch').style.background = color
    element('observer-direction-card').style.setProperty('--observer-star-color', color)
  }
  for (const id of ['observer-roll-counterclockwise', 'observer-roll-reset', 'observer-roll-clockwise']) {
    element<HTMLButtonElement>(id).disabled = sceneBusy || !observerView
  }
  for (const id of cameraViewButtonIds) {
    element<HTMLButtonElement>(id).disabled = sceneBusy || observerView
  }
}

function cardsHaveClearance(first: HTMLElement, second: HTMLElement, gap = 10): boolean {
  const firstBounds = first.getBoundingClientRect()
  const secondBounds = second.getBoundingClientRect()
  return firstBounds.right + gap <= secondBounds.left
    || secondBounds.right + gap <= firstBounds.left
    || firstBounds.bottom + gap <= secondBounds.top
    || secondBounds.bottom + gap <= firstBounds.top
}

function panelIsOpen(name: typeof panelNames[number]): boolean {
  return element<HTMLButtonElement>(`${name}-toggle`).getAttribute('aria-expanded') === 'true'
}

function setPanelOpen(name: typeof panelNames[number], open: boolean): void {
  if (name === 'views' && !open) closeSavedViewContextMenu()
  if (name === 'objects' && !open) objectList.closeColumnFilter()
  element<HTMLButtonElement>(`${name}-toggle`).setAttribute('aria-expanded', String(open))
  element(`${name}-panel`).hidden = !open
}

function syncPanelLayout(): void {
  const dock = element('control-dock')
  const motionOpen = panelIsOpen('motion')
  const dockPanel = panelNames.find((name) => name !== 'views' && name !== 'motion' && panelIsOpen(name))
  if (dockPanel) dock.dataset.open = dockPanel
  else if (motionOpen) dock.dataset.open = 'motion'
  else delete dock.dataset.open
  if (motionOpen) dock.dataset.motionOpen = ''
  else delete dock.dataset.motionOpen
  syncSelectedObjectLayout()
  syncObjectTypeLayout()
  syncVisibilityObserverLayout()
}

function closeObjectTypeCard(restoreFocus = false): void {
  const card = element('object-type-card')
  if (card.hidden) return
  card.hidden = true
  element('object-type-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('object-type-toggle').focus()
}

function closeMetallicityCard(restoreFocus = false): void {
  const card = element('metallicity-card')
  if (card.hidden) return
  card.hidden = true
  element('metallicity-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('metallicity-toggle').focus()
}

function closeRadiusCard(restoreFocus = false): void {
  const card = element('radius-card')
  if (card.hidden) return
  card.hidden = true
  element('radius-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('radius-toggle').focus()
}

function closeMassCard(restoreFocus = false): void {
  const card = element('mass-card')
  if (card.hidden) return
  card.hidden = true
  element('mass-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('mass-toggle').focus()
}

function closeSpectralCard(restoreFocus = false): void {
  const card = element('spectral-card')
  if (card.hidden) return
  card.hidden = true
  element('spectral-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('spectral-toggle').focus()
}

let spectralMagnitudeMode: HrMagnitudeMode | null = null
let spectralDiagram: 'hr' | 'mk' = 'hr'

function renderSpectralCard(star: Star): void {
  const sun = stars.find((candidate) => candidate.id === 'sun')!
  const origin = stars.find((candidate) => candidate.id === referenceId) ?? sun
  const reference = spectralReference(origin, sun)
  for (const diagram of ['hr', 'mk'] as const) {
    element(`spectral-${diagram}`).setAttribute('aria-pressed', String(spectralDiagram === diagram))
    element(`spectral-${diagram}-content`).hidden = spectralDiagram !== diagram
  }
  if (spectralDiagram === 'hr') {
    const mode = spectralMagnitudeMode ?? (hrMagnitude(star, 'visual') === null && hrMagnitude(star, 'bolometric') !== null ? 'bolometric' : 'visual')
    renderHrDiagram(element('spectral-card'), star, reference, mode)
  } else renderMkDiagram(element('spectral-card'), star, reference)
  syncObjectTypeLayout()
}

function toggleSpectralCard(): void {
  if (!element('spectral-card').hidden) {
    closeSpectralCard(true)
    return
  }
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (!star || !hrCardAvailable(star)) return
  closePlanetCard()
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeMassCard()
  closeDistanceCard()
  element('spectral-card').hidden = false
  element('spectral-toggle').setAttribute('aria-expanded', 'true')
  renderSpectralCard(star)
  element('spectral-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  element('spectral-close').focus({ preventScroll: true })
}

let activePlanetId: string | null = null
let planetCardLocked = false
const planetSections = ['specs', 'info', 'moons'] as const

// Planet details, imagery and the globe renderer load only when a planet is opened.
type PlanetModules = {
  renderPlanetCard: typeof import('./planet-card').renderPlanetCard
  planetDescriptionForId: typeof import('./planet-properties').planetDescriptionForId
  disposePlanetGlobe: typeof import('./planet-globe').disposePlanetGlobe
}
let planetModules: PlanetModules | undefined
async function loadPlanetModules(): Promise<PlanetModules> {
  if (planetModules) return planetModules
  const [card, properties, globe] = await Promise.all([import('./planet-card'), import('./planet-properties'), import('./planet-globe')])
  return planetModules = {
    renderPlanetCard: card.renderPlanetCard,
    planetDescriptionForId: properties.planetDescriptionForId,
    disposePlanetGlobe: globe.disposePlanetGlobe,
  }
}

function showPlanetSection(section: typeof planetSections[number]): void {
  for (const candidate of planetSections) {
    element(`planet-${candidate}`).hidden = candidate !== section
    element(`planet-${candidate}-toggle`).setAttribute('aria-expanded', String(candidate === section))
  }
  element('planet-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  syncObjectTypeLayout()
}

function closePlanetCard(restoreFocus = false): void {
  const card = element('planet-card')
  if (card.hidden) return
  card.hidden = true
  const system = element('object-system')
  const selectedRow = system.querySelector<HTMLElement>('.planet-row:has([aria-pressed="true"])')
  const selectedPlanet = selectedRow?.dataset.planetId ?? null
  highlightSystemPlanet(system, selectedPlanet === activePlanetId ? null : selectedPlanet)
  if (restoreFocus) {
    const button = system.querySelector<HTMLButtonElement>(`.planet-row[data-planet-id="${activePlanetId}"] button`)
    if (button && !system.hidden) button.focus({ preventScroll: true })
    else if (!element('selected-object-card').hidden) element('object-system-toggle').focus({ preventScroll: true })
  }
}

async function selectSystemPlanet(planetId: string): Promise<void> {
  const system = element('object-system')
  const { planetDescriptionForId, renderPlanetCard } = await loadPlanetModules()
  const description = planetDescriptionForId(planetId)
  const selected = system.querySelector<HTMLButtonElement>(`.planet-row[data-planet-id="${planetId}"] button`)?.getAttribute('aria-pressed') === 'true'
  if (!description) {
    if (!planetCardLocked) closePlanetCard()
    highlightSystemPlanet(system, selected ? null : planetId, element('planet-card').hidden ? null : activePlanetId)
    return
  }
  if (!element('planet-card').hidden && activePlanetId === planetId) {
    closePlanetCard(true)
    return
  }
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeMassCard()
  closeDistanceCard()
  activePlanetId = planetId
  closeSpectralCard()
  renderPlanetCard(element('planet-card'), description)
  element('planet-card').hidden = false
  highlightSystemPlanet(system, planetId, planetId)
  showPlanetSection('specs')
  element('planet-specs-toggle').focus({ preventScroll: true })
}

let massReference: MassReference = 'class'
let massCardModule: typeof import('./mass-card') | undefined

function renderMassCard(star: Star): void {
  if (!massCardModule) return
  const origin = stars.find((candidate) => candidate.id === referenceId) ?? stars.find((candidate) => candidate.id === 'sun')!
  const referenceMode = origin.id === 'sun' && massReference === 'origin' ? 'sun' : massReference
  text('mass-reference-origin', `vs ${origin.name}`)
  element('mass-reference-origin').hidden = origin.id === 'sun'
  element('mass-reference-origin').title = `Compare mass properties with ${origin.name}`
  element('mass-reference-origin').setAttribute('aria-label', `Compare mass properties with ${origin.name}`)
  for (const mode of ['class', 'origin', 'sun'] as const) {
    element(`mass-reference-${mode}`).setAttribute('aria-pressed', String(referenceMode === mode))
  }
  massCardModule.renderMassCardContent(element('mass-card'), star, origin, referenceMode)
  syncObjectTypeLayout()
}

async function toggleMassCard(): Promise<void> {
  if (!element('mass-card').hidden) {
    closeMassCard(true)
    return
  }
  massCardModule ??= await import('./mass-card')
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (!star || !massCardAvailable(star)) return
  closePlanetCard()
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeDistanceCard()
  closeSpectralCard()
  element('mass-card').hidden = false
  element('mass-toggle').setAttribute('aria-expanded', 'true')
  renderMassCard(star)
  element('mass-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  element('mass-close').focus({ preventScroll: true })
}

let distanceReference: 'origin' | 'sun' = 'origin'
let distanceCardLocked = false
let lastDistanceCardRender = -Infinity

function closeDistanceCard(restoreFocus = false): void {
  const card = element('distance-card')
  if (card.hidden) return
  card.hidden = true
  element('distance-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('distance-toggle').focus()
}

function renderDistanceCard(star: Star): void {
  const sun = stars.find((candidate) => candidate.id === 'sun')!
  const origin = stars.find((candidate) => candidate.id === referenceId) ?? sun
  const referenceMode = origin.id === 'sun' ? 'sun' : distanceReference
  const originLabel = `from ${origin.name}`
  text('distance-reference-origin', originLabel)
  element('distance-reference-origin').hidden = origin.id === 'sun'
  element('distance-reference-origin').title = originLabel
  element('distance-reference-origin').setAttribute('aria-label', originLabel)
  for (const mode of ['origin', 'sun'] as const) {
    element(`distance-reference-${mode}`).setAttribute('aria-pressed', String(referenceMode === mode))
  }
  const reference = referenceMode === 'sun' ? sun : origin
  renderDistanceComparison(element<HTMLCanvasElement>('distance-comparison'), star, reference, starColorMode, distanceUnit, simulationYears, motionFrame)
  lastDistanceCardRender = performance.now()
  syncObjectTypeLayout()
}

function refreshDistanceCard(): void {
  if (element('distance-card').hidden) return
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (star) renderDistanceCard(star)
}

function toggleDistanceCard(): void {
  if (!element('distance-card').hidden) {
    closeDistanceCard(true)
    return
  }
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (!star) return
  closePlanetCard()
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeMassCard()
  closeSpectralCard()
  element('distance-card').hidden = false
  element('distance-toggle').setAttribute('aria-expanded', 'true')
  renderDistanceCard(star)
  element('distance-close').focus({ preventScroll: true })
}

let radiusReference: RadiusReference = 'auto'

function renderRadiusCard(star: Star): void {
  const origin = stars.find((candidate) => candidate.id === referenceId) ?? stars.find((candidate) => candidate.id === 'sun')!
  const comparison = radiusComparison(star, origin, radiusReference)
  text('radius-selected-name', comparison.selected.name)
  text('radius-selected-column', comparison.selected.name)
  text('radius-reference-column', comparison.reference.name)
  for (const mode of ['origin', 'jupiter', 'earth'] as const) {
    element(`radius-reference-${mode}`).setAttribute('aria-pressed', String(mode === comparison.referenceMode))
  }
  text('radius-reference-origin', origin.name)
  element('radius-reference-origin').title = `Compare radius with ${origin.name}`
  element('radius-reference-origin').setAttribute('aria-label', `Compare radius with ${origin.name}`)
  element('radius-benchmark-note').hidden = radiusReference !== 'auto' || !comparison.jupiterBenchmark
  text('radius-benchmark-note', 'Comparing with Jupiter because the selected radius is at most 2 R♃.')
  const radiusMissing = comparison.selected.radiusKm === null || comparison.reference.radiusKm === null
  text('radius-comparison-summary', radiusMissing ? radiusSummary(comparison) : '')
  element('radius-comparison-summary').hidden = !radiusMissing
  renderRadiusBars(element('radius-card'), star, comparison)
  text('radius-scale-note', renderRadiusComparison(element<HTMLCanvasElement>('radius-comparison'), comparison))
  element('radius-stats').replaceChildren(...radiusStats(comparison).map(({ label, values }) => {
    const row = document.createElement('tr')
    const heading = document.createElement('th')
    heading.scope = 'row'
    heading.textContent = label
    row.append(heading)
    for (const { value } of values) {
      const cell = document.createElement('td')
      cell.append(value)
      row.append(cell)
    }
    return row
  }))
  syncObjectTypeLayout()
}

function toggleRadiusCard(): void {
  if (!element('radius-card').hidden) {
    closeRadiusCard(true)
    return
  }
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (!star || element('radius-toggle').closest<HTMLElement>('.stellar-property')!.hidden) return
  closePlanetCard()
  closeObjectTypeCard()
  closeMetallicityCard()
  closeDistanceCard()
  closeMassCard()
  closeSpectralCard()
  element('radius-card').hidden = false
  element('radius-toggle').setAttribute('aria-expanded', 'true')
  renderRadiusCard(star)
  element('radius-close').focus({ preventScroll: true })
}

function renderMetallicityCard(star: Star): void {
  const value = star.metallicity_dex
  const iron = star.metallicity_kind === '[Fe/H]'
  const ratioName = iron ? 'iron-to-hydrogen' : 'metal-to-hydrogen'
  text('metallicity-heading', `Metallicity ${star.metallicity_kind ?? ''}`.trim())
  const limit = 2
  const outsideScale = value !== null && Math.abs(value) > limit
  const position = value === null ? 50 : Math.max(0, Math.min(100, (value + limit) / (2 * limit) * 100))
  const scale = element('metallicity-scale')
  scale.style.setProperty('--metallicity-position', `${position}%`)
  scale.style.setProperty('--metallicity-label-offset', position < 35 ? '0%' : position > 65 ? '-100%' : '-50%')
  const formatPercent = (percent: number): string => `${percent.toLocaleString('en-US', {
    notation: percent > 1000 ? 'compact' : 'standard',
    ...(percent > 1000 ? { maximumSignificantDigits: 3 } : { maximumFractionDigits: percent < 1 ? 2 : 0 }),
    useGrouping: false,
  }).replace('K', 'k')}%`
  const solarPercent = value === null ? null : 10 ** value * 100
  const percentageLabel = solarPercent === null ? '' : `${formatPercent(solarPercent)} of Sun`
  scale.setAttribute('aria-label', `${star.name}: ${quantity(value, 'dex')}${value === null ? '' : `, ${percentageLabel}`}. Scale −2 to +2 dex: 1%, 10%, 100%, 10 times and 100 times the Sun’s ${ratioName} ratio.${outsideScale ? ' Value is outside the scale; marker shown at the nearest edge.' : ''}`)
  const ticks = [
    { dex: -2, ratio: '1%' }, { dex: -1, ratio: '10%' }, { dex: 0, ratio: '100%' },
    { dex: 1, ratio: '10x' }, { dex: 2, ratio: '100x' },
  ].map(({ dex, ratio }) => {
    const tick = document.createElement('span')
    tick.className = 'metallicity-tick'
    if (dex === 0) tick.classList.add('metallicity-tick-sun')
    tick.style.left = `${(dex + limit) / (2 * limit) * 100}%`
    const dexLabel = document.createElement('span')
    dexLabel.className = 'metallicity-tick-dex'
    dexLabel.textContent = `${dex < 0 ? '−' : dex > 0 ? '+' : ''}${Math.abs(dex)}`
    const ratioLabel = document.createElement('span')
    ratioLabel.className = 'metallicity-tick-ratio'
    ratioLabel.textContent = ratio
    tick.append(dexLabel, ratioLabel)
    return tick
  })
  element('metallicity-ticks').replaceChildren(...ticks)
  element('metallicity-marker').hidden = value === null
  element('metallicity-fill').hidden = value === null
  text('metallicity-marker-value', value === null ? '' : `${value > 0 ? '+' : ''}${quantity(value, 'dex', 2)} (${percentageLabel})`)
  let description = `No metallicity measurement is available for ${star.name}. [Fe/H] measures iron relative to hydrogen; [M/H] describes overall metallicity. They are distinct quantities.`
  if (value !== null) {
    description = iron
      ? '[Fe/H] measures iron relative to hydrogen; it does not measure the total abundance of all metals.'
      : '[M/H] measures overall metals relative to hydrogen; it is not an iron-specific [Fe/H] measurement.'
    description += ` ${metallicityContext(star)}`
    if (outsideScale) description += ' Its value is beyond the displayed −2 to +2 dex range; the marker sits at the nearest edge.'
  }
  text('metallicity-description', description)
  syncObjectTypeLayout()
}

function metallicityContext(star: Star): string {
  const value = star.metallicity_dex
  if (value === null) return ''
  // Population trends, not individual age estimates: https://arxiv.org/abs/1401.4437
  if (value <= -1) return 'This metal-poor composition is often found in older stellar populations formed from less enriched gas.'
  if (value < -0.3) return 'This subsolar composition can reflect formation from less enriched gas.'
  if (value < 0) {
    if (star.type === 'star' && star.age_gyr !== null && star.age_gyr < 1 && star.mass_solar !== null && star.mass_solar > 1) {
      return 'This young star is more massive than the Sun and has a slightly subsolar composition.'
    }
    return 'This slightly subsolar composition lies within the range found among Milky Way disk stars.'
  }
  if (value === 0) return `Each increase of 1 dex represents ten times the ${star.metallicity_kind === '[Fe/H]' ? 'iron' : 'metal'}-to-hydrogen ratio.`
  return 'This metal-rich composition can reflect formation from gas enriched by earlier generations of stars.'
}

function toggleMetallicityCard(): void {
  if (!element('metallicity-card').hidden) {
    closeMetallicityCard(true)
    return
  }
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (!star || element('metallicity-toggle').closest<HTMLElement>('.stellar-property')!.hidden) return
  closePlanetCard()
  closeObjectTypeCard()
  closeRadiusCard()
  closeMassCard()
  closeDistanceCard()
  closeSpectralCard()
  element('metallicity-card').hidden = false
  element('metallicity-toggle').setAttribute('aria-expanded', 'true')
  renderMetallicityCard(star)
  element('metallicity-close').focus({ preventScroll: true })
}

function renderObjectTypeCard(star: Star): void {
  const introduction = objectTypeIntroduction(star)
  text('object-type-heading', introduction.title)
  text('object-type-description', introduction.description)
  text('object-type-caption', introduction.caption)
  const image = element<HTMLImageElement>('object-type-image')
  image.src = introduction.image
  image.alt = introduction.caption
  image.style.objectPosition = introduction.imagePosition ?? '50% 50%'
  element('object-type-card').dataset.objectType = star.type
  element<HTMLAnchorElement>('object-type-source').href = introduction.source
  const imageSource = element<HTMLAnchorElement>('object-type-image-source')
  if (introduction.imageSource) imageSource.href = introduction.imageSource
  else imageSource.removeAttribute('href')
  imageSource.textContent = introduction.imageCredit
  syncObjectTypeLayout()
}

function toggleObjectTypeCard(): void {
  if (!element('object-type-card').hidden) {
    closeObjectTypeCard(true)
    return
  }
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (!star) return
  closePlanetCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeMassCard()
  closeDistanceCard()
  closeSpectralCard()
  element('object-type-card').hidden = false
  element('object-type-toggle').setAttribute('aria-expanded', 'true')
  renderObjectTypeCard(star)
  element('object-type-close').focus({ preventScroll: true })
}

function syncObjectTypeLayout(): void {
  const motion = element('motion-panel')
  const cards = ['object-type-card', 'metallicity-card', 'radius-card', 'spectral-card', 'mass-card', 'distance-card', 'planet-card'].map((id) => element(id))
  for (const card of cards) card.style.removeProperty('max-height')
  if (motion.hidden) return
  // Read every rectangle before writing, so playback refreshes cause one layout.
  const motionBounds = motion.getBoundingClientRect()
  const limits = cards.map((card) => {
    if (card.hidden) return null
    const bounds = card.getBoundingClientRect()
    return bounds.left < motionBounds.right && bounds.right > motionBounds.left
      ? `${Math.max(120, Math.floor(motionBounds.top - bounds.top - 10))}px` : null
  })
  cards.forEach((card, index) => {
    const limit = limits[index]
    if (limit) card.style.maxHeight = limit
  })
}

function syncSelectedObjectLayout(): void {
  const selectedCard = element('selected-object-card')
  selectedCard.style.removeProperty('max-height')
  const motionPanel = element('motion-panel')
  if (motionPanel.hidden || selectedCard.hidden) return
  const availableHeight = Math.floor(motionPanel.getBoundingClientRect().top - selectedCard.getBoundingClientRect().top - 10)
  selectedCard.style.maxHeight = `${Math.max(68, availableHeight)}px`
}

function syncVisibilityObserverLayout(): void {
  const caption = document.querySelector<HTMLElement>('.visibility-observer')!
  caption.classList.remove('is-avoiding-motion')
  const motionPanel = element('motion-panel')
  if (motionPanel.hidden) return
  const panelBounds = motionPanel.getBoundingClientRect()
  document.querySelector<HTMLElement>('.scene-wrap')!.style.setProperty('--motion-panel-clearance', `${Math.ceil(window.innerHeight - panelBounds.top + 12)}px`)
  const captionBounds = caption.getBoundingClientRect()
  const overlapsAtBottom = panelBounds.left < captionBounds.right && panelBounds.right > captionBounds.left &&
    panelBounds.top < captionBounds.bottom && panelBounds.bottom > captionBounds.top
  caption.classList.toggle('is-avoiding-motion', overlapsAtBottom)
}

function togglePanel(name: typeof panelNames[number]): void {
  const opening = !panelIsOpen(name)
  if (!opening) {
    setPanelOpen(name, false)
    syncPanelLayout()
    return
  }
  for (const candidate of panelNames) {
    if (candidate === name) continue
    if (candidate === 'motion' && name !== 'motion' && lockedPanels.has('motion')) continue
    setPanelOpen(candidate, false)
  }
  setPanelOpen(name, true)
  syncPanelLayout()
  const selectedCard = element('selected-object-card')
  const objectDetails = element<HTMLDetailsElement>('object-card-details')
  if (name !== 'motion' && !selectedCard.hidden && objectDetails.open && !cardsHaveClearance(selectedCard, element(`${name}-panel`))) objectDetails.open = false
}

function dismissOpenPanel(): void {
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeSpectralCard()
  closeMassCard()
  if (!distanceCardLocked) closeDistanceCard()
  if (!planetCardLocked) closePlanetCard()
  let changed = false
  for (const name of panelNames) {
    if (!panelIsOpen(name)) continue
    const lockable = lockablePanelNames.find((candidate) => candidate === name)
    if (lockable && lockedPanels.has(lockable)) continue
    setPanelOpen(name, false)
    changed = true
  }
  if (changed) syncPanelLayout()
}

function togglePanelLock(name: typeof lockablePanelNames[number]): void {
  const button = element<HTMLButtonElement>(`${name}-lock`)
  const locked = !lockedPanels.has(name)
  if (locked) lockedPanels.add(name)
  else lockedPanels.delete(name)
  button.setAttribute('aria-pressed', String(locked))
}

function sceneStatus(message: string | null): void {
  const status = element('scene-status')
  status.textContent = message
  status.hidden = message === null
  sceneBusy = message !== null
  if (sceneBusy) setSimulationPlaying(false)
  viewButtons.forEach((button) => { button.disabled = sceneBusy })
  timelineButtons.forEach((button) => { button.disabled = sceneBusy })
  timeSlider.disabled = sceneBusy
  renderPlaybackSpeed()
  renderFollowState()
  updateSelectionHistoryControls()
  updateReferenceControl()
  updateObserverControl()
}

function formattedSimulationTime(years: number): { short: string; accessible: string } {
  if (Math.abs(years) < 0.05) return { short: 'Now', accessible: 'Now' }
  const absolute = Math.abs(years)
  const value = absolute.toLocaleString('en-US', { maximumFractionDigits: absolute < 100 ? 1 : 0 })
  const direction = years < 0 ? 'past' : 'future'
  return { short: `${years < 0 ? '\u2212' : '+'}${value} yr`, accessible: `${value} years in the ${direction}` }
}

function renderSimulationTime(): void {
  const formatted = formattedSimulationTime(simulationYears)
  timeSlider.value = String(simulationYears)
  const position = (simulationYears + SIMULATION_YEAR_LIMIT) / (2 * SIMULATION_YEAR_LIMIT) * 100
  timeSlider.style.setProperty('--time-fill-start', `${Math.min(50, position)}%`)
  timeSlider.style.setProperty('--time-fill-end', `${Math.max(50, position)}%`)
  timeSlider.setAttribute('aria-valuetext', formatted.accessible)
  text('time-value', formatted.short)
}

function renderPlaybackState(): void {
  const play = element<HTMLButtonElement>('time-play')
  play.setAttribute('aria-pressed', String(simulationPlaying))
  play.setAttribute('aria-label', simulationPlaying ? 'Pause stellar motion' : 'Play stellar motion')
  icon('time-play-icon', simulationPlaying ? Pause : Play)
}

function renderPlaybackSpeed(): void {
  text('time-speed-value', `1k years / ${playbackSecondsPerThousandYears}s`)
  element<HTMLButtonElement>('time-slower').disabled = sceneBusy || playbackSecondsPerThousandYears >= 15
  element<HTMLButtonElement>('time-faster').disabled = sceneBusy || playbackSecondsPerThousandYears <= 0.5
}

function renderFollowState(): void {
  const follow = element<HTMLButtonElement>('time-follow')
  follow.setAttribute('aria-pressed', String(followSelection))
  follow.disabled = sceneBusy || selectedId === null || observerView
}

function setSimulationYears(years: number): void {
  const clamped = Math.max(-SIMULATION_YEAR_LIMIT, Math.min(SIMULATION_YEAR_LIMIT, years))
  simulationYears = Math.abs(clamped) < 1e-9 ? 0 : clamped
  renderSimulationTime()
  viewer?.setSimulationYears(simulationYears)
  if (!simulationPlaying || performance.now() - lastDistanceCardRender >= 100) refreshDistanceCard()
}

function playbackFrame(time: number): void {
  playbackFrameRequest = null
  if (!simulationPlaying) return
  if (previousPlaybackTime > 0) {
    const elapsed = Math.min(100, Math.max(0, time - previousPlaybackTime))
    let next = simulationYears + simulationDirection * elapsed / playbackSecondsPerThousandYears
    if (next >= SIMULATION_YEAR_LIMIT) {
      next = SIMULATION_YEAR_LIMIT - (next - SIMULATION_YEAR_LIMIT)
      simulationDirection = -1
    } else if (next <= -SIMULATION_YEAR_LIMIT) {
      next = -SIMULATION_YEAR_LIMIT + (-SIMULATION_YEAR_LIMIT - next)
      simulationDirection = 1
    }
    setSimulationYears(next)
  }
  previousPlaybackTime = time
  playbackFrameRequest = requestAnimationFrame(playbackFrame)
}

function setSimulationPlaying(playing: boolean): void {
  if (playing === simulationPlaying) return
  simulationPlaying = playing
  previousPlaybackTime = 0
  viewer?.setSimulationPlaying(playing)
  if (playbackFrameRequest !== null) cancelAnimationFrame(playbackFrameRequest)
  playbackFrameRequest = playing ? requestAnimationFrame(playbackFrame) : null
  renderPlaybackState()
  if (!playing) refreshDistanceCard()
}

renderSimulationTime()
renderPlaybackState()
renderPlaybackSpeed()
renderFollowState()

function renderSelectedDistance(distancePc: number): void {
  text('star-distance', formatDistance(distancePc, distanceUnit))
}

function renderViewerDistance(distancePc: number): void {
  viewerDistancePc = distancePc
  const distance = formatDistance(distancePc, distanceUnit)
  const output = element('viewer-distance')
  if (output.textContent === distance) return
  output.textContent = distance
}

function renderGridScale(scale: GridScale): void {
  currentGridScale = scale
  text('grid-spacing', `${scale.spacing.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${distanceUnit} grid`)
}

const objectSections = ['specs', 'info', 'system'] as const
let activeObjectSection: typeof objectSections[number] = 'specs'

function syncObjectInfoAvailability(): void {
  const toggle = element<HTMLButtonElement>('object-info-toggle')
  const available = element('object-info').childElementCount > 0
  toggle.disabled = !available
  toggle.title = available ? 'Info' : 'Info · No data yet'
  toggle.setAttribute('aria-label', toggle.title)
  if (!available && activeObjectSection === 'info') {
    activeObjectSection = 'specs'
    syncObjectSections()
  }
}

function syncObjectSections(): void {
  const details = element<HTMLDetailsElement>('object-card-details')
  for (const section of objectSections) {
    const active = section === activeObjectSection
    element(`object-${section}`).hidden = !active
    element(`object-${section}-toggle`).setAttribute('aria-expanded', String(details.open && active))
  }
  element('known-planets').setAttribute('aria-expanded', String(details.open && activeObjectSection === 'system'))
  syncSelectedObjectLayout()
}

for (const section of objectSections) {
  element(`object-${section}-toggle`).addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    const details = element<HTMLDetailsElement>('object-card-details')
    const opening = !details.open || activeObjectSection !== section
    activeObjectSection = section
    details.open = opening
    if (section !== 'system' && !planetCardLocked) closePlanetCard()
    if (section !== 'specs') {
      closeObjectTypeCard()
      closeMetallicityCard()
      closeRadiusCard()
      closeSpectralCard()
      closeMassCard()
      closeDistanceCard()
    }
    syncObjectSections()
  }, { signal: events.signal })
}
element('object-card-details').addEventListener('toggle', syncObjectSections, { signal: events.signal })
element('known-planets-row').addEventListener('click', () => {
  if (element<HTMLButtonElement>('known-planets').disabled) return
  activeObjectSection = 'system'
  element<HTMLDetailsElement>('object-card-details').open = true
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeSpectralCard()
  closeMassCard()
  closeDistanceCard()
  syncObjectSections()
  element('object-system-toggle').focus({ preventScroll: true })
}, { signal: events.signal })
syncObjectSections()

function renderSystemComponents(system: StarSystem | undefined, selectedComponentId: string): void {
  const group = element('star-components')
  group.hidden = !system
  const preview = element<HTMLCanvasElement>('selected-swatch')
  preview.title = system ? `${system.components.length} cataloged components · illustrative arrangement` : ''
  if (!system) {
    group.replaceChildren()
    delete group.dataset.system
    return
  }
  group.setAttribute('aria-label', `${system.name} components`)
  const key = system.components.map(({ label, star }) => `${label}:${star.id}`).join('|')
  // Retain the buttons while switching components so keyboard focus stays put.
  if (group.dataset.system !== key) {
    group.dataset.system = key
    group.replaceChildren(...system.components.map(({ label, star }) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'star-component'
      button.dataset.componentId = star.id
      const preview = document.createElement('canvas')
      preview.className = 'star-component-icon'
      preview.setAttribute('aria-hidden', 'true')
      button.append(preview, label)
      button.title = star.name
      button.setAttribute('aria-label', `Show ${system.name} ${label}${star.id === 'proxima-centauri' ? ' (Proxima Centauri)' : ''}`)
      return button
    }))
  }
  for (const button of group.querySelectorAll<HTMLButtonElement>('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.componentId === selectedComponentId))
    const component = system.components.find(({ star }) => star.id === button.dataset.componentId)!
    renderSelectedStarPreview(button.querySelector<HTMLCanvasElement>('canvas')!, component.star, starColorMode)
  }
}

element('star-components').addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-component-id]')
  if (!button?.dataset.componentId) return
  // Component buttons live below the distance inside the expandable header.
  event.preventDefault()
  event.stopPropagation()
  selectStar(button.dataset.componentId, true, true)
}, { signal: events.signal })

function renderSelection(): void {
  const sun = stars.find((star) => star.id === 'sun')!
  const reference = stars.find((star) => star.id === referenceId) ?? sun
  const star = stars.find((candidate) => candidate.id === selectedId)
  text('reference-base', reference.name)
  text('visibility-base', stars.find((candidate) => candidate.id === observerId)?.name ?? 'Sun')
  element('selected-object-card').hidden = !star
  element('star-details').hidden = !star
  syncSelectedObjectLayout()
  syncVisibilityObserverLayout()
  objectList.setSelected(selectedId)
  updateReferenceControl()
  updateObserverControl()
  if (!star) {
    if (!planetCardLocked) closePlanetCard()
    closeObjectTypeCard()
    closeMetallicityCard()
    closeRadiusCard()
    closeMassCard()
    closeDistanceCard()
    closeSpectralCard()
    delete element('inspector').dataset.selectedStar
    element('inspector').style.removeProperty('--selected-star-color')
    text('selection-announcement', 'No object selected.')
    return
  }
  const metrics = sunRelativeMetrics(star, sun)
  const displayedDistancePc = selectedDistancePc ?? sunRelativeMetrics(star, reference).distancePc
  const color = starDisplayColor(star, starColorMode).getStyle()
  element('inspector').dataset.selectedStar = star.id
  element('inspector').style.setProperty('--selected-star-color', color)
  const system = starSystems.get(star.id)
  const planets = planetarySystemForStar(star.id)
  text('star-name', system?.name ?? star.name)
  renderSelectedDistance(displayedDistancePc)
  renderSystemComponents(system, star.id)
  const knownPlanetCount = planets?.planets.length ?? star.known_planets ?? 0
  renderSelectedStarPreview(element<HTMLCanvasElement>('selected-swatch'), star, starColorMode, system?.components.map((component) => component.star), knownPlanetCount > 0)
  renderSystemCard(element('object-system'), planets, system, star.id, starColorMode, selectSystemPlanet)
  const openPlanet = activePlanetId ? planetModules?.planetDescriptionForId(activePlanetId) : undefined
  if (!planetCardLocked && openPlanet?.hostStarId !== star.id) closePlanetCard()
  if (!element('planet-card').hidden && openPlanet?.hostStarId === star.id) highlightSystemPlanet(element('object-system'), activePlanetId, activePlanetId)
  const systemToggle = element<HTMLButtonElement>('object-system-toggle')
  const systemAvailable = Boolean(planets?.planets.length || system)
  systemToggle.disabled = !systemAvailable
  systemToggle.title = systemAvailable ? 'System' : 'System · No data yet'
  systemToggle.setAttribute('aria-label', systemAvailable
    ? `System${system ? `, ${system.components.length} stars` : ''}${planets ? `, ${planets.planets.length} known planets` : ''}` : systemToggle.title)
  element<HTMLButtonElement>('known-planets').disabled = !planets?.planets.length
  if (!systemAvailable && activeObjectSection === 'system') {
    activeObjectSection = 'specs'
    syncObjectSections()
  }
  syncObjectInfoAvailability()
  if (knownPlanetCount > 0) element<HTMLCanvasElement>('selected-swatch').title = `${knownPlanetCount} known planets · illustrative orbit`
  text('distance-value', formatDistance(metrics.distancePc, distanceUnit).split(' ')[0]!)
  text('distance-unit', ` ${distanceUnit}`)
  element('distance-toggle').setAttribute('aria-label', `Visualize distance and direction of ${star.name}`)
  refreshDistanceCard()
  text('object-type', describeObject(star))
  element('object-type-toggle').setAttribute('aria-label', `Learn about ${describeObject(star).toLowerCase()}`)
  if (!element('object-type-card').hidden) renderObjectTypeCard(star)
  element('constellation-row').hidden = star.id === 'sun'
  text('constellation', star.constellation ?? MISSING_VALUE)
  text('known-planets', String(knownPlanetCount))
  element('known-planets').title = 'Show confirmed planets in this system from the adopted NASA Exoplanet Archive snapshot.'
  element('known-planets').setAttribute('aria-label', `Show system with ${knownPlanetCount} known planets`)
  text('object-subtypes', star.subtypes?.length ? star.subtypes.join(' · ') : MISSING_VALUE)
  const compact = star.compact
  const compactObject = isCompactObject(star)
  const nebula = star.nebula
  const nebulaObject = isNebulaObject(star)
  const molecularCloud = star.molecular_cloud
  const molecularCloudObject = isMolecularCloudObject(star)
  const bubble = star.bubble
  const bubbleObject = isBubbleObject(star)
  element('known-planets-row').hidden = knownPlanetCount === 0 || nebulaObject || molecularCloudObject || bubbleObject
  element('object-subtypes-row').hidden = (nebulaObject || molecularCloudObject || bubbleObject) && !star.subtypes?.length
  for (const row of document.querySelectorAll<HTMLElement>('.stellar-property')) row.hidden = compactObject || nebulaObject || molecularCloudObject || bubbleObject
  for (const row of document.querySelectorAll<HTMLElement>('.compact-property')) row.hidden = !compactObject
  for (const row of document.querySelectorAll<HTMLElement>('.nebula-property')) row.hidden = !nebulaObject
  for (const row of document.querySelectorAll<HTMLElement>('.molecular-cloud-property')) row.hidden = !molecularCloudObject
  for (const row of document.querySelectorAll<HTMLElement>('.bubble-property')) row.hidden = !bubbleObject
  element('mass-row').hidden = nebulaObject || bubbleObject
  for (const row of document.querySelectorAll<HTMLElement>('.pulsar-property')) row.hidden = star.type !== 'pulsar'
  for (const row of document.querySelectorAll<HTMLElement>('.rotation-property')) row.hidden = star.type === 'black_hole' || !compactObject
  for (const row of document.querySelectorAll<HTMLElement>('.orbit-property')) row.hidden = !compact || (compact.orbital_period_days === null && compact.companion === null)
  text('spectral-type', star.spectral_type ?? MISSING_VALUE)
  element('spectral-toggle').setAttribute('aria-label', `Explore spectral type of ${star.name}`)
  if (!hrCardAvailable(star)) closeSpectralCard()
  else if (!element('spectral-card').hidden) renderSpectralCard(star)
  text('temperature', quantity(star.temperature_k, 'K', 0))
  const luminosity = star.luminosity_solar
  text('luminosity', luminosity !== null && luminosity < 1 ? `${luminosity.toLocaleString('en-US', { maximumSignificantDigits: 3 })} L☉` : quantity(luminosity, 'L☉'))
  text('mass', compact ? preciseMeasurement(star.mass_solar, compact.mass_error_solar, 'M☉') : quantity(star.mass_solar, 'M☉'))
  element<HTMLButtonElement>('mass-toggle').disabled = !massCardAvailable(star)
  element('mass-toggle').setAttribute('aria-label', `Explore mass of ${star.name}`)
  element('mass-row').classList.toggle('mass-row', massCardAvailable(star))
  if (!massCardAvailable(star)) closeMassCard()
  else if (!element('mass-card').hidden) renderMassCard(star)
  text('radius', quantity(star.radius_solar, 'R☉'))
  element('radius-toggle').setAttribute('aria-label', `Compare radius of ${star.name} with origin`)
  if (compactObject || nebulaObject || molecularCloudObject || bubbleObject) closeRadiusCard()
  else if (!element('radius-card').hidden) renderRadiusCard(star)
  text('metallicity', quantity(star.metallicity_dex, 'dex'))
  text('metallicity-label', `Metallicity ${star.metallicity_kind ?? ''}`.trim())
  element('metallicity-toggle').setAttribute('aria-label', `Explain metallicity of ${star.name}`)
  if (compactObject || nebulaObject || molecularCloudObject || bubbleObject) closeMetallicityCard()
  else if (!element('metallicity-card').hidden) renderMetallicityCard(star)
  text('age', quantity(star.age_gyr, 'Gyr'))
  if (compact) {
    text('compact-status', compact.confidence === 'confirmed' ? 'Confirmed' : 'Candidate')
    const rotation = preciseMeasurement(compact.rotation_period_s, compact.rotation_period_error_s, 's')
    text('rotation-period', compact.rotation_period_s === null ? rotation : `${rotation} (${(1 / compact.rotation_period_s).toLocaleString('en-US', { maximumSignificantDigits: 6 })} Hz)`)
    text('radio-luminosity', quantity(compact.radio_luminosity_1400_mjy_kpc2, 'mJy kpc²'))
    text('characteristic-age', quantity(compact.characteristic_age_yr, 'yr', 0))
    text('surface-field', scientificQuantity(compact.surface_magnetic_field_gauss, 'G'))
    text('spin-down-power', scientificQuantity(compact.spin_down_power_erg_s, 'erg/s'))
    text('orbital-period', preciseMeasurement(compact.orbital_period_days, compact.orbital_period_error_days, 'days'))
    text('compact-companion', compact.companion ?? MISSING_VALUE)
    text('detection-method', compact.detection_method)
    const source = element<HTMLAnchorElement>('compact-source')
    source.textContent = compact.source_label
    source.href = compact.source_url
  }
  if (nebula) {
    const [depth, major, minor] = nebula.shape.semi_axes_pc
    const offsets = nebula.shape.layer_offsets_pc
    const deepPc = 2 * depth + (offsets.length ? Math.max(...offsets) - Math.min(...offsets) : 0)
    const extent = (pc: number) => (pc * (distanceUnit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1)).toLocaleString('en-US', { maximumFractionDigits: 1 })
    text('nebula-angular-size', `${nebula.angular_size_arcmin[0]}′ × ${nebula.angular_size_arcmin[1]}′`)
    text('nebula-extent', `${extent(2 * major)} × ${extent(2 * minor)} × ${extent(deepPc)} ${distanceUnit}`)
    text('nebula-illumination', nebula.illuminating_stars)
    text('nebula-distance-source', nebula.distance_source)
    const source = element<HTMLAnchorElement>('nebula-source')
    source.textContent = nebula.source_label
    source.href = nebula.source_url
  }
  if (molecularCloud) {
    const conversion = distanceUnit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1
    const format = (value: number, maximumFractionDigits = 1) => (value * conversion).toLocaleString('en-US', { maximumFractionDigits })
    text('molecular-cloud-complex', molecularCloud.complex_name ?? 'Unassociated catalog feature')
    text('molecular-cloud-radius', `${format(molecularCloud.equivalent_radius_pc)} ${distanceUnit}`)
    text('molecular-cloud-density', `${molecularCloud.mean_density_cm3.toLocaleString('en-US')} H nuclei/cm³`)
    text('molecular-cloud-peak-density', `${molecularCloud.peak_density_cm3.toLocaleString('en-US')} H nuclei/cm³`)
    text('molecular-cloud-volume', `${(molecularCloud.volume_pc3 * conversion ** 3).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${distanceUnit}³`)
    text('molecular-cloud-resolution', `${molecularCloud.source_voxel_count.toLocaleString('en-US')} one-pc voxels`)
    const source = element<HTMLAnchorElement>('molecular-cloud-source')
    source.textContent = molecularCloud.source_label
    source.href = molecularCloud.source_url
  }
  if (bubble) {
    const conversion = distanceUnit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1
    const extent = (pc: number) => (pc * conversion).toLocaleString('en-US', { maximumFractionDigits: 0 })
    const [minimum, maximum] = bubble.surface_distance_range_pc
    text('bubble-average-radius', `${extent(bubble.average_radius_pc)} ${distanceUnit}`)
    text('bubble-surface-range', `${extent(minimum)}–${extent(maximum)}${bubble.surface_distance_max_open ? '+' : ''} ${distanceUnit}`)
    text('bubble-shell-thickness', `${extent(bubble.shell_thickness_pc)} ${distanceUnit}`)
    const source = element<HTMLAnchorElement>('bubble-source')
    source.textContent = bubble.source_label
    source.href = bubble.source_url
  }
  text('coordinate-x', formatDistance(star.x_pc, distanceUnit, 3))
  text('coordinate-y', formatDistance(star.y_pc, distanceUnit, 3))
  text('coordinate-z', formatDistance(star.z_pc, distanceUnit, 3))
  text('plane-distance', formatDistance(metrics.planeDistancePc, distanceUnit, 3))
  text('epoch', `J${star.epoch.toFixed(1)}`)
  text('velocity-x', quantity(star.vx_kms, 'km/s'))
  text('velocity-y', quantity(star.vy_kms, 'km/s'))
  text('velocity-z', quantity(star.vz_kms, 'km/s'))
  const raw = star.raw_astrometry
  const fullVelocity = [star.vx_kms, star.vy_kms, star.vz_kms].every((value) => value !== null) || (raw !== null && raw.radial_velocity_kms !== null)
  text('motion-data', fullVelocity ? 'Full space motion' : raw ? 'Transverse only; radial velocity unavailable' : MISSING_VALUE)
  const sky = raw ?? compact ?? nebula ?? null
  text('right-ascension', sky ? `${sky.ra_deg.toLocaleString('en-US', { maximumFractionDigits: 9 })} deg` : MISSING_VALUE)
  text('declination', sky ? `${sky.dec_deg.toLocaleString('en-US', { maximumFractionDigits: 9 })} deg` : MISSING_VALUE)
  text('astrometry-epoch', raw ? `J${raw.epoch.toFixed(1)}` : MISSING_VALUE)
  text('parallax', raw ? measurement(raw.parallax_mas, raw.parallax_error_mas, 'mas', 6) : MISSING_VALUE)
  text('proper-motion-ra', raw ? measurement(raw.pm_ra_cosdec_masyr, raw.pm_ra_error_masyr, 'mas/yr', 6) : MISSING_VALUE)
  text('proper-motion-dec', raw ? measurement(raw.pm_dec_masyr, raw.pm_dec_error_masyr, 'mas/yr', 6) : MISSING_VALUE)
  text('radial-velocity', raw ? measurement(raw.radial_velocity_kms, raw.radial_velocity_error_kms, 'km/s', 6) : MISSING_VALUE)
  text('astrometry-source', raw?.astrometry_ref || compact?.position_source || nebula?.position_source || molecularCloud?.position_source || bubble?.position_source || MISSING_VALUE)
  text('absolute-mag', quantity(star.absolute_mag))
  text('apparent-mag', quantity(star.apparent_mag ?? null))
  const designations = objectDesignations(star)
  element('designations-row').hidden = designations.length === 0
  element('object-designations').replaceChildren(...designations.map((name) => {
    const item = document.createElement('li')
    item.textContent = name
    return item
  }))
  text('star-notes', star.notes || 'No source notes available.')
  const referenceName = reference.id === 'sun' ? 'the Sun' : reference.name
  text('selection-announcement', `${star.name}, ${formatDistance(displayedDistancePc, distanceUnit)} from ${referenceName}.`)
}

function updateObjectListFilter(): void {
  const reference = stars.find((star) => star.id === referenceId) ?? stars.find((star) => star.id === 'sun')
  if (!reference) return
  objectList.setFilter((star) => {
    const distanceLy = sunRelativeMetrics(star, reference).distanceLy
    return isObjectMapVisible(star, visibleKeys, selectedId, observerId, distanceLy, objectDistanceLimitLy)
  })
}

function selectStar(id: string | null, recordHistory = true, explicitComponent = false): void {
  if (id !== null && !stars.some((star) => star.id === id)) return
  const system = id === null ? undefined : starSystems.get(id)
  // Entering a system starts at its primary; component controls and history
  // deliberately retain individual identities.
  if (system && recordHistory && !explicitComponent) id = primarySystemStarId(system)
  if (id !== null && recordHistory) selectionHistory.record(id)
  selectedDistancePc = null
  selectedId = id
  if (id !== null && !observerView) observerId = id
  updateObjectListFilter()
  renderSelection()
  viewer?.select(id)
  renderFollowState()
  updateSelectionHistoryControls()
}

function navigateSelectionHistory(direction: 'back' | 'forward'): void {
  const id = selectionHistory[direction](selectedStarAvailable)
  if (id !== null) selectStar(id, false)
}

function setSelectedAsOrigin(): void {
  if (selectedId === null || selectedId === referenceId) return
  referenceId = selectedId
  selectedDistancePc = null
  objectList.setReference(referenceId)
  updateObjectListFilter()
  viewer?.setReference(referenceId)
  renderSelection()
}

function toggleObserverView(): void {
  if (!viewer || (!observerView && selectedId === null)) return
  setObserverViewAnchor(observerView ? null : selectedId)
}

function setObserverViewAnchor(anchorId: string | null): void {
  if (!viewer || sceneBusy) return
  if (anchorId !== null) {
    if (!stars.some((star) => star.id === anchorId)) return
    observerView = viewer.setObserverView(true, anchorId)
    observerViewAnchorId = observerView ? anchorId : null
    if (observerView) observerId = anchorId
  } else {
    observerView = viewer.setObserverView(false)
    observerViewAnchorId = null
    if (selectedId !== null) observerId = selectedId
    viewer.setVisibility(observerId, magnitudeLimit)
  }
  updateObjectListFilter()
  renderSelection()
  renderFollowState()
  updateObserverControl()
}

function rollObserverView(direction: 'counterclockwise' | 'center' | 'clockwise'): void {
  viewer?.rollObserverView(direction)
}

function renderDistances(): void {
  element<HTMLInputElement>(`unit-${distanceUnit}`).checked = true
  renderGridScale(currentGridScale)
  objectList.setDistanceUnit(distanceUnit)
  if (viewerDistancePc !== null) renderViewerDistance(viewerDistancePc)
  renderSelection()
}

async function switchCatalog(id: string, refresh = false): Promise<void> {
  if (id === activeCatalogId && !refresh) return
  const definition = catalogs.find((catalog) => catalog.manifest.id === id)
  if (!definition) return
  const request = ++catalogRequest
  sceneStatus(`Loading ${definition.manifest.label}...`)
  let nextStars: Star[]
  try {
    const selectedCatalog = await definition.load()
    const loadAdditiveCatalog = (enabled: boolean, catalogId: string) => enabled && id !== catalogId
      ? catalogs.find((catalog) => catalog.manifest.id === catalogId)!.load()
      : Promise.resolve([])
    const loadOverlay = (types: readonly FilterKey[], load: () => Promise<Star[]>) =>
      types.some((type) => visibleKeys.has(type)) ? load() : Promise.resolve([])
    const [brightCatalog, westernConstellationCatalog, famousClusterCatalog, compactObjects, nebulae, molecularClouds, bubbles] = await Promise.all([
      loadAdditiveCatalog(showAlwaysBright, BRIGHT_CATALOG_ID),
      loadAdditiveCatalog(showWesternConstellationStars, WESTERN_CONSTELLATION_CATALOG_ID),
      loadAdditiveCatalog(showFamousClusterStars, FAMOUS_CLUSTER_CATALOG_ID),
      loadOverlay(COMPACT_OBJECT_TYPES, loadCompactRemnants),
      loadOverlay(NEBULA_OBJECT_TYPES, loadNebulae),
      loadOverlay(MOLECULAR_CLOUD_OBJECT_TYPES, loadMolecularClouds),
      loadOverlay(BUBBLE_OBJECT_TYPES, loadBubbles),
      loadPlanetarySystems(),
      loadStellarOrbits(),
    ])
    const withBrightStars = mergeCatalogStars(selectedCatalog, brightCatalog)
    const withConstellationStars = mergeCatalogStars(withBrightStars, westernConstellationCatalog)
    nextStars = [...mergeCatalogStars(withConstellationStars, famousClusterCatalog), ...compactObjects, ...nebulae, ...molecularClouds, ...bubbles]
  } catch (error) {
    if (request !== catalogRequest) return
    catalogError(error)
    renderCatalogRange(activeCatalogId)
    sceneStatus(viewer ? null : 'The nearby-object catalog could not be loaded.')
    return
  }
  if (request !== catalogRequest) return
  const retainedView: ViewerViewState | undefined = viewer?.getViewState()
  const retained = catalogSelection(nextStars, selectedId, observerId)
  viewer?.dispose()
  viewer = undefined
  stars = nextStars
  starSystems = indexStarSystems(stars)
  activeCatalogId = id
  selectedDistancePc = null
  selectedId = retained.selectedId
  observerId = retained.observerId
  const retainedObserverView = observerView
  if (observerViewAnchorId && !nextStars.some((star) => star.id === observerViewAnchorId)) {
    observerView = false
    observerViewAnchorId = null
  }
  referenceId = nextStars.some((star) => star.id === referenceId) ? referenceId : 'sun'
  text('scene-epoch', `J${definition.manifest.epoch.toFixed(1)}`)
  renderCatalogRange(id)
  element('catalog-range').title = `${definition.manifest.description} ${definition.manifest.snapshot}`
  element<HTMLInputElement>('object-search').value = ''
  objectList.setStars(stars, distanceUnit, selectedId, referenceId)
  updateObjectListFilter()
  renderDistances()
  try {
    viewer = createStarViewer(element('scene'), stars, {
      onInteraction: dismissOpenPanel,
      onSelect: selectStar,
      onSelectedDistance(distancePc) {
        selectedDistancePc = distancePc
        if (distancePc !== null && selectedId !== null) renderSelectedDistance(distancePc)
      },
      onViewerDistance: renderViewerDistance,
      onGridScale: renderGridScale,
      onStatus: sceneStatus,
      colorMode: starColorMode,
      earthOrbitDate: earthOrbitDateForMode(earthOrbitMode),
      milkyWayVisible,
    })
  } catch (error) {
    console.error('Could not create the 3D viewer.', error)
    sceneStatus('3D graphics are unavailable on this device. The object catalog and details are still available.')
    return
  }
  viewer.setDistanceUnit(distanceUnit)
  viewer.setReference(referenceId)
  viewer.select(selectedId, false)
  viewer.setVisibility(observerId, magnitudeLimit)
  viewer.setObjectDistanceLimit(objectDistanceLimitLy)
  viewer.setObjectFilter([...visibleKeys])
  viewer.setLabelLimit(labelLimit)
  viewer.setMotionArrowsVisible(motionArrowsVisible)
  viewer.setMotionFrame(motionFrame)
  viewer.setMotionYears(motionYears)
  viewer.setFollowSelection(followSelection)
  viewer.setSimulationYears(simulationYears)
  viewer.setSimulationPlaying(simulationPlaying)
  viewer.setPowerSavingMode(powerSavingMode)
  viewer.setGridVisible(gridVisible)
  // A home view refits to the new visible set; manual views keep their camera.
  if (retainedView && !retainedView.home && (!retainedObserverView || observerView)) {
    viewer.setViewState({ ...retainedView, home: false })
  }
  observerView = viewer.setObserverView(observerView, observerViewAnchorId ?? undefined, retainedView?.observerRollRadians)
  if (!observerView) observerViewAnchorId = null
  sceneStatus(null)
}

function catalogError(error: unknown): void {
  text('catalog-error', error instanceof Error ? error.message : String(error))
  element('catalog-error').hidden = false
}

const categoryOptions = element('object-categories')
const typeOptions = element('object-type-options')

function noDataHint(id: string, input: HTMLInputElement): HTMLSpanElement {
  const hint = document.createElement('span')
  hint.className = 'filter-hint'
  hint.id = id
  hint.textContent = 'No data yet'
  input.setAttribute('aria-describedby', id)
  return hint
}

for (const category of FILTER_CATEGORIES) {
  const available = categoryAvailable(category.id, availableKeys)
  const toggle = document.createElement('label')
  toggle.className = 'filter-toggle category-toggle'
  toggle.classList.toggle('is-unavailable', !available)
  const input = document.createElement('input')
  input.id = `category-${category.id}`
  input.type = 'checkbox'
  input.setAttribute('role', 'switch')
  input.setAttribute('aria-label', category.label)
  input.dataset.category = category.id
  input.disabled = !available
  toggle.htmlFor = input.id
  const toggleText = document.createElement('span')
  toggleText.className = 'toggle-text'
  const toggleName = document.createElement('span')
  toggleName.textContent = category.label
  toggleText.append(toggleName)
  if (!available) toggleText.append(noDataHint(`${input.id}-hint`, input))
  const control = document.createElement('span')
  control.className = 'switch-control'
  const track = document.createElement('span')
  track.className = 'switch-track'
  track.setAttribute('aria-hidden', 'true')
  control.append(input, track)
  toggle.append(toggleText, control)
  categoryOptions.append(toggle)

  const group = document.createElement('div')
  group.className = 'type-group'
  group.setAttribute('role', 'group')
  const heading = document.createElement('span')
  heading.className = 'type-group-heading'
  heading.id = `type-group-${category.id}`
  heading.textContent = category.label
  group.setAttribute('aria-labelledby', heading.id)
  group.append(heading)
  for (const subtype of category.subtypes) {
    const option = document.createElement('label')
    option.className = 'object-type-option'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.name = 'object-type'
    checkbox.dataset.filterKey = subtype.key
    checkbox.setAttribute('aria-label', subtype.label)
    const name = document.createElement('span')
    name.textContent = subtype.label
    option.append(checkbox, name)
    if (!availableKeys.has(subtype.key)) {
      option.classList.add('is-unavailable')
      option.append(noDataHint(`type-${subtype.key}-hint`, checkbox))
    }
    group.append(option)
  }
  typeOptions.append(group)
}

function renderObjectFilter(): void {
  for (const input of categoryOptions.querySelectorAll<HTMLInputElement>('input[data-category]')) {
    input.checked = !input.disabled && filterCategories.has(input.dataset.category as FilterCategoryId)
  }
  for (const input of typeOptions.querySelectorAll<HTMLInputElement>('input[data-filter-key]')) {
    const key = input.dataset.filterKey as FilterKey
    input.checked = availableKeys.has(key) && filterSubtypes.has(key)
    input.disabled = !availableKeys.has(key) || !filterCategories.has(filterCategoryForKey(key))
  }
  text('object-type-filter-summary', filterSummary(visibleKeys, availableKeys))
}

function applyObjectFilter(): void {
  const previous = visibleKeys
  visibleKeys = effectiveFilterKeys(filterCategories, filterSubtypes, availableKeys)
  renderObjectFilter()
  const overlayChanged = [COMPACT_OBJECT_TYPES, NEBULA_OBJECT_TYPES, MOLECULAR_CLOUD_OBJECT_TYPES, BUBBLE_OBJECT_TYPES].some((types) =>
    types.some((type) => previous.has(type)) !== types.some((type) => visibleKeys.has(type)))
  if (overlayChanged) {
    void switchCatalog(activeCatalogId, true)
    return
  }
  updateObjectListFilter()
  viewer?.setObjectFilter([...visibleKeys])
}

renderObjectFilter()

const catalogRange = element<HTMLInputElement>('catalog-range')
catalogRange.max = String(Math.max(0, sliderCatalogs.length - 1))
element('catalog-range-bounds').replaceChildren(...[sliderCatalogs[0], sliderCatalogs.at(-1)].map((catalog) => {
  const bound = document.createElement('span')
  bound.textContent = `${catalog?.manifest.objectCount ?? 0} objects`
  return bound
}))

function previewCatalogRange(index: number): void {
  const manifest = sliderCatalogs[index]?.manifest
  if (!manifest) return
  text('catalog-range-value', manifest.label)
  catalogRange.setAttribute('aria-valuetext', manifest.label)
}

function renderCatalogRange(id: string): void {
  const index = sliderCatalogs.findIndex((catalog) => catalog.manifest.id === id)
  if (index < 0) return
  catalogRange.value = String(index)
  previewCatalogRange(index)
}

const objectList = new ObjectList(element('star-list'), selectStar, (shown, total) => text('catalog-count', `${shown}/${total}`), element('object-database'))
objectList.setColorMode(starColorMode)

function setSavedViewsStatus(message: string): void {
  const status = element('saved-views-status')
  status.textContent = message
  const input = element<HTMLInputElement>('save-view-name')
  input.placeholder = message || 'Name this view'
  input.title = message
  input.toggleAttribute('data-status', Boolean(message))
}

function writeSavedViews(next: SavedView[]): boolean {
  try {
    localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(next))
    savedViews = next
    return true
  } catch {
    setSavedViewsStatus('Could not write saved views to browser storage')
    return false
  }
}

function closeSavedViewContextMenu(restoreFocus = false): void {
  const menu = element('saved-view-context-menu')
  menu.hidden = true
  element('saved-view-context-backdrop').hidden = true
  element('app').inert = false
  element('views-panel').removeAttribute('data-context-menu-open')
  delete menu.dataset.savedViewId
  savedViewMenuRow?.setAttribute('aria-expanded', 'false')
  if (restoreFocus && savedViewMenuRow?.isConnected) savedViewMenuRow.focus()
  savedViewMenuRow = null
}

function openSavedViewContextMenu(row: HTMLTableRowElement, x: number, y: number): void {
  const savedView = savedViews.find((candidate) => candidate.id === row.dataset.savedViewId)
  if (!savedView) return
  closeSavedViewContextMenu()
  const menu = element('saved-view-context-menu')
  const remove = element<HTMLButtonElement>('saved-view-context-delete')
  remove.textContent = `Delete ${savedView.name}`
  menu.dataset.savedViewId = savedView.id
  savedViewMenuRow = row
  row.setAttribute('aria-expanded', 'true')
  menu.style.left = '0px'
  menu.style.top = '0px'
  menu.hidden = false
  element('saved-view-context-backdrop').hidden = false
  element('app').inert = true
  element('views-panel').setAttribute('data-context-menu-open', '')
  const bounds = menu.getBoundingClientRect()
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8))}px`
  remove.focus({ preventScroll: true })
}

function renderSavedViews(): void {
  closeSavedViewContextMenu()
  const list = element<HTMLTableSectionElement>('saved-views-list')
  list.replaceChildren(...savedViews.map((savedView) => {
    const row = document.createElement('tr')
    row.dataset.savedViewId = savedView.id
    row.tabIndex = 0
    row.setAttribute('aria-label', `Load saved view ${savedView.name}`)
    row.setAttribute('aria-haspopup', 'menu')
    row.setAttribute('aria-controls', 'saved-view-context-menu')
    row.setAttribute('aria-expanded', 'false')
    row.title = `Load ${savedView.name}`
    const name = document.createElement('td')
    name.textContent = savedView.name
    name.title = savedView.name
    const origin = document.createElement('td')
    origin.textContent = savedView.originName
    origin.title = savedView.originName
    row.append(name, origin)
    return row
  }))
  element('saved-views-empty').hidden = savedViews.length > 0
  element('saved-views-table-wrap').hidden = savedViews.length === 0
}

function currentSavedViewSettings(): SavedViewSettings | null {
  if (!viewer || sceneBusy) return null
  return {
    catalogId: activeCatalogId,
    showAlwaysBright,
    showWesternConstellationStars,
    showFamousClusterStars,
    filterCategories: [...filterCategories],
    filterSubtypes: [...filterSubtypes],
    magnitudeLimit,
    objectDistanceLimitLy,
    earthOrbitMode,
    milkyWayVisible,
    motionArrowsVisible,
    motionYears,
    motionFrame,
    gridVisible,
    simulationYears,
    simulationPlaying,
    simulationDirection,
    playbackSecondsPerThousandYears,
    followSelection,
    selectedId,
    observerId,
    referenceId,
    observerView,
    observerViewAnchorId,
    objectSearch: element<HTMLInputElement>('object-search').value,
    viewState: viewer.getViewState(),
  }
}

function saveCurrentView(): void {
  const input = element<HTMLInputElement>('save-view-name')
  const name = input.value.trim()
  if (!name) {
    setSavedViewsStatus('Enter a name for this view')
    input.focus()
    return
  }
  const settings = currentSavedViewSettings()
  if (!settings) {
    setSavedViewsStatus('Wait for the scene to finish loading before saving')
    return
  }
  const savedAt = new Date().toISOString()
  const savedView: SavedView = {
    version: 1,
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    name,
    originName: stars.find((star) => star.id === referenceId)?.name ?? referenceId,
    savedAt,
    settings,
  }
  const next = [savedView, ...savedViews].sort((first, second) => Date.parse(second.savedAt) - Date.parse(first.savedAt))
  if (!writeSavedViews(next)) return
  input.value = ''
  setSavedViewsStatus(`Saved “${name}”`)
  renderSavedViews()
}

function syncSavedSettingsInputs(): void {
  renderCatalogRange(activeCatalogId)
  element<HTMLInputElement>('show-always-bright').checked = showAlwaysBright
  element<HTMLInputElement>('show-western-constellation-stars').checked = showWesternConstellationStars
  element<HTMLInputElement>('show-famous-cluster-stars').checked = showFamousClusterStars
  const distanceIndex = OBJECT_DISTANCE_STEPS_LY.indexOf(objectDistanceLimitLy as typeof OBJECT_DISTANCE_STEPS_LY[number])
  const distanceInput = element<HTMLInputElement>('object-distance-limit')
  distanceInput.value = String(Math.max(0, distanceIndex))
  distanceInput.setAttribute('aria-valuetext', `${objectDistanceLimitLy} light-years`)
  text('object-distance-limit-value', `${objectDistanceLimitLy} ly`)
  const magnitudeInput = element<HTMLInputElement>('magnitude-limit')
  magnitudeInput.value = String(magnitudeLimit)
  text('magnitude-limit-value', String(magnitudeLimit))
  earthOrbitModeInput.value = String(EARTH_ORBIT_MODES.indexOf(earthOrbitMode))
  earthOrbitModeInput.setAttribute('aria-valuetext', earthOrbitModeLabel(earthOrbitMode))
  text('earth-orbit-mode-value', earthOrbitModeLabel(earthOrbitMode))
  element<HTMLInputElement>('milky-way-visible').checked = milkyWayVisible
  element<HTMLInputElement>('motion-arrows-visible').checked = motionArrowsVisible
  element<HTMLSelectElement>('motion-years').value = String(motionYears)
  element<HTMLInputElement>(`motion-frame-${motionFrame}`).checked = true
  const gridButton = element<HTMLButtonElement>('toggle-grid')
  gridButton.setAttribute('aria-pressed', String(gridVisible))
  text('grid-tooltip', gridVisible ? 'Hide grid' : 'Show grid')
  element('grid-legend').hidden = !gridVisible
  renderObjectFilter()
  renderSimulationTime()
  renderPlaybackState()
  renderPlaybackSpeed()
  renderFollowState()
}

async function loadSavedView(savedView: SavedView): Promise<void> {
  const settings = savedView.settings
  if (!catalogs.some((catalog) => catalog.manifest.id === settings.catalogId)) {
    setSavedViewsStatus(`The catalog for “${savedView.name}” is no longer available`)
    return
  }
  setSavedViewsStatus(`Loading “${savedView.name}”`)
  setSimulationPlaying(false)
  if (observerView) viewer?.setObserverView(false)
  observerView = false
  observerViewAnchorId = null
  showAlwaysBright = settings.showAlwaysBright
  showWesternConstellationStars = settings.showWesternConstellationStars
  showFamousClusterStars = settings.showFamousClusterStars
  filterCategories.clear()
  settings.filterCategories.forEach((category) => filterCategories.add(category))
  filterSubtypes.clear()
  settings.filterSubtypes.forEach((subtype) => filterSubtypes.add(subtype))
  visibleKeys = effectiveFilterKeys(filterCategories, filterSubtypes, availableKeys)
  magnitudeLimit = settings.magnitudeLimit
  objectDistanceLimitLy = settings.objectDistanceLimitLy
  earthOrbitMode = settings.earthOrbitMode
  milkyWayVisible = settings.milkyWayVisible
  motionArrowsVisible = settings.motionArrowsVisible
  motionYears = settings.motionYears
  motionFrame = settings.motionFrame
  gridVisible = settings.gridVisible
  simulationYears = settings.simulationYears
  simulationDirection = settings.simulationDirection
  playbackSecondsPerThousandYears = settings.playbackSecondsPerThousandYears
  followSelection = settings.followSelection
  selectedId = settings.selectedId
  observerId = settings.observerId
  referenceId = settings.referenceId
  objectList.setColorMode(starColorMode)
  syncSavedSettingsInputs()
  await switchCatalog(settings.catalogId, true)
  if (!viewer || activeCatalogId !== settings.catalogId) {
    setSavedViewsStatus(`Could not load “${savedView.name}”`)
    return
  }
  element<HTMLInputElement>('object-search').value = settings.objectSearch
  objectList.setQuery(settings.objectSearch)
  viewer.setViewState(settings.viewState)
  const savedObserverAnchorId = settings.observerViewAnchorId
  const anchorAvailable = savedObserverAnchorId !== null && stars.some((star) => star.id === savedObserverAnchorId)
  if (settings.observerView && anchorAvailable) {
    observerViewAnchorId = savedObserverAnchorId
    observerId = savedObserverAnchorId
    viewer.setVisibility(observerId, magnitudeLimit)
    observerView = viewer.setObserverView(true, savedObserverAnchorId, settings.viewState.observerRollRadians)
    if (!observerView) observerViewAnchorId = null
  }
  if (selectedId !== null) selectionHistory.record(selectedId)
  updateObjectListFilter()
  objectList.setReference(referenceId)
  renderDistances()
  renderSelection()
  syncSavedSettingsInputs()
  updateSelectionHistoryControls()
  updateReferenceControl()
  updateObserverControl()
  try {
    localStorage.setItem('star-view-earth-orbit-mode', earthOrbitMode)
    localStorage.setItem('star-view-milky-way-visible', String(milkyWayVisible))
  } catch {}
  setSimulationPlaying(settings.simulationPlaying)
  setPanelOpen('views', false)
  syncPanelLayout()
  setSavedViewsStatus(`Loaded “${savedView.name}”`)
}

function deleteSavedView(id: string): void {
  const savedView = savedViews.find((candidate) => candidate.id === id)
  if (!savedView) return
  const next = savedViews.filter((candidate) => candidate.id !== id)
  if (!writeSavedViews(next)) return
  setSavedViewsStatus(`Deleted “${savedView.name}”`)
  renderSavedViews()
}

renderSavedViews()
renderCatalogRange('nearest-neighbors')
void switchCatalog('nearest-neighbors')
if (catalogErrors.length) catalogError(catalogErrors.join('\n'))

element('object-search').addEventListener('input', () => objectList.setQuery(element<HTMLInputElement>('object-search').value), { signal: events.signal })
element('objects-expand').addEventListener('click', () => {
  const panel = element('objects-panel')
  const expanded = !panel.classList.contains('is-expanded')
  const search = panel.querySelector<HTMLElement>('.object-search')!
  if (expanded) {
    panel.style.setProperty('--objects-height', `${panel.getBoundingClientRect().height}px`)
    panel.querySelector('.objects-heading')!.insertBefore(search, element('objects-expand'))
  } else {
    panel.insertBefore(search, element('star-list'))
    panel.style.removeProperty('--objects-height')
  }
  panel.classList.toggle('is-expanded', expanded)
  element('control-dock').toggleAttribute('data-objects-expanded', expanded)
  const button = element('objects-expand')
  const label = expanded ? 'Collapse objects list' : 'Expand objects list'
  button.setAttribute('aria-expanded', String(expanded))
  button.setAttribute('aria-label', label)
  button.title = label
  icon('objects-expand-icon', expanded ? ChevronsRightLeft : ChevronsLeftRight)
  objectList.setExpanded(expanded)
  syncPanelLayout()
}, { signal: events.signal })
catalogRange.addEventListener('input', () => previewCatalogRange(catalogRange.valueAsNumber), { signal: events.signal })
catalogRange.addEventListener('change', () => {
  const catalog = sliderCatalogs[catalogRange.valueAsNumber]
  if (catalog) void switchCatalog(catalog.manifest.id)
}, { signal: events.signal })
element('show-always-bright').addEventListener('change', () => {
  showAlwaysBright = element<HTMLInputElement>('show-always-bright').checked
  void switchCatalog(activeCatalogId, true)
}, { signal: events.signal })
element('show-western-constellation-stars').addEventListener('change', () => {
  showWesternConstellationStars = element<HTMLInputElement>('show-western-constellation-stars').checked
  void switchCatalog(activeCatalogId, true)
}, { signal: events.signal })
element('show-famous-cluster-stars').addEventListener('change', () => {
  showFamousClusterStars = element<HTMLInputElement>('show-famous-cluster-stars').checked
  void switchCatalog(activeCatalogId, true)
}, { signal: events.signal })
element('distance-units').addEventListener('change', () => {
  distanceUnit = element<HTMLInputElement>('unit-ly').checked ? 'ly' : 'pc'
  try { localStorage.setItem('star-view-distance-unit', distanceUnit) } catch {}
  viewer?.setDistanceUnit(distanceUnit)
  renderDistances()
}, { signal: events.signal })
element('star-colors').addEventListener('change', () => {
  starColorMode = element<HTMLInputElement>('star-colors-exaggerated').checked ? 'exaggerated' : 'real'
  try { localStorage.setItem('star-view-color-mode', starColorMode) } catch {}
  objectList.setColorMode(starColorMode)
  renderSelection()
  updateSelectionHistoryControls()
  viewer?.setStarColorMode(starColorMode)
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
  objectDistanceLimitLy = OBJECT_DISTANCE_STEPS_LY[input.valueAsNumber] ?? objectDistanceLimitLy
  input.setAttribute('aria-valuetext', `${objectDistanceLimitLy} light-years`)
  text('object-distance-limit-value', `${objectDistanceLimitLy} ly`)
  updateObjectListFilter()
  viewer?.setObjectDistanceLimit(objectDistanceLimitLy)
}, { signal: events.signal })
element('power-saving-mode').addEventListener('change', () => {
  powerSavingMode = element<HTMLInputElement>('power-saving-mode').checked
  viewer?.setPowerSavingMode(powerSavingMode)
}, { signal: events.signal })
element('label-limit').addEventListener('input', () => {
  const input = element<HTMLInputElement>('label-limit')
  if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) return
  labelLimit = input.valueAsNumber
  input.setAttribute('aria-valuetext', labelLimit === 0 ? 'Off' : `${labelLimit} labels`)
  text('label-limit-value', labelLimit === 0 ? 'Off' : String(labelLimit))
  try { localStorage.setItem('star-view-label-limit', String(labelLimit)) } catch {}
  viewer?.setLabelLimit(labelLimit)
}, { signal: events.signal })
element('motion-arrows-visible').addEventListener('change', () => {
  motionArrowsVisible = element<HTMLInputElement>('motion-arrows-visible').checked
  viewer?.setMotionArrowsVisible(motionArrowsVisible)
}, { signal: events.signal })
element('earth-orbit-mode').addEventListener('input', () => {
  const input = element<HTMLInputElement>('earth-orbit-mode')
  const mode = EARTH_ORBIT_MODES[input.valueAsNumber]
  if (!mode) return
  earthOrbitMode = mode
  const label = earthOrbitModeLabel(mode)
  input.setAttribute('aria-valuetext', label)
  text('earth-orbit-mode-value', label)
  try { localStorage.setItem('star-view-earth-orbit-mode', mode) } catch {}
  viewer?.setEarthOrbitDate(earthOrbitDateForMode(mode))
}, { signal: events.signal })
element('milky-way-visible').addEventListener('change', () => {
  milkyWayVisible = element<HTMLInputElement>('milky-way-visible').checked
  try { localStorage.setItem('star-view-milky-way-visible', String(milkyWayVisible)) } catch {}
  viewer?.setMilkyWayVisible(milkyWayVisible)
}, { signal: events.signal })
element('motion-years').addEventListener('change', () => {
  const years = Number(element<HTMLSelectElement>('motion-years').value) as MotionYears
  if (!MOTION_YEAR_OPTIONS.includes(years)) return
  motionYears = years
  viewer?.setMotionYears(years)
}, { signal: events.signal })
element('motion-frame').addEventListener('change', () => {
  motionFrame = element<HTMLInputElement>('motion-frame-solar').checked ? 'solar' : 'galactic'
  viewer?.setMotionFrame(motionFrame)
  refreshDistanceCard()
}, { signal: events.signal })
element('time-play').addEventListener('click', () => {
  if (!simulationPlaying) {
    if (simulationYears >= SIMULATION_YEAR_LIMIT) simulationDirection = -1
    else if (simulationYears <= -SIMULATION_YEAR_LIMIT) simulationDirection = 1
  }
  setSimulationPlaying(!simulationPlaying)
}, { signal: events.signal })
element('time-now').addEventListener('click', () => {
  setSimulationPlaying(false)
  simulationDirection = 1
  setSimulationYears(0)
}, { signal: events.signal })
element('time-follow').addEventListener('click', () => {
  followSelection = !followSelection
  viewer?.setFollowSelection(followSelection)
  renderFollowState()
}, { signal: events.signal })
timeSlider.addEventListener('input', () => {
  if (!timeSlider.validity.valid || !Number.isFinite(timeSlider.valueAsNumber)) return
  setSimulationPlaying(false)
  setSimulationYears(timeSlider.valueAsNumber)
}, { signal: events.signal })
element('time-slower').addEventListener('click', () => {
  playbackSecondsPerThousandYears = playbackSecondsPerThousandYears < 1
    ? 1
    : Math.min(15, playbackSecondsPerThousandYears + 1)
  renderPlaybackSpeed()
}, { signal: events.signal })
element('time-faster').addEventListener('click', () => {
  playbackSecondsPerThousandYears = playbackSecondsPerThousandYears <= 1
    ? 0.5
    : Math.max(1, playbackSecondsPerThousandYears - 1)
  renderPlaybackSpeed()
}, { signal: events.signal })
window.addEventListener('resize', () => {
  syncSelectedObjectLayout()
  syncObjectTypeLayout()
  syncVisibilityObserverLayout()
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (star && !element('radius-card').hidden) renderRadiusCard(star)
  if (star && !element('mass-card').hidden) renderMassCard(star)
  refreshDistanceCard()
}, { signal: events.signal })
categoryOptions.addEventListener('change', (event) => {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const category = input.dataset.category
  if (!isFilterCategoryId(category)) return
  if (input.checked) filterCategories.add(category)
  else filterCategories.delete(category)
  applyObjectFilter()
}, { signal: events.signal })
element('object-type-filter').addEventListener('change', (event) => {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const key = input.dataset.filterKey
  if (!isFilterKey(key)) return
  if (input.checked) filterSubtypes.add(key)
  else filterSubtypes.delete(key)
  applyObjectFilter()
}, { signal: events.signal })
for (const name of panelNames) {
  element(`${name}-toggle`).addEventListener('click', () => togglePanel(name), { signal: events.signal })
}
for (const name of lockablePanelNames) {
  element(`${name}-lock`).addEventListener('click', () => togglePanelLock(name), { signal: events.signal })
}
element<HTMLFormElement>('save-view-form').addEventListener('submit', (event) => {
  event.preventDefault()
  saveCurrentView()
}, { signal: events.signal })
element('save-view-name').addEventListener('input', () => setSavedViewsStatus(''), { signal: events.signal })
element('saved-views-list').addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const row = target.closest<HTMLTableRowElement>('tr[data-saved-view-id]')
  const savedView = savedViews.find((candidate) => candidate.id === row?.dataset.savedViewId)
  if (savedView) void loadSavedView(savedView)
}, { signal: events.signal })
element('saved-views-list').addEventListener('contextmenu', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const row = target.closest<HTMLTableRowElement>('tr[data-saved-view-id]')
  if (!row) return
  event.preventDefault()
  const bounds = row.getBoundingClientRect()
  openSavedViewContextMenu(row, event.clientX || bounds.left + 12, event.clientY || bounds.bottom)
}, { signal: events.signal })
element('saved-views-list').addEventListener('keydown', (event) => {
  const target = event.target
  if (!(target instanceof HTMLTableRowElement)) return
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    event.preventDefault()
    const bounds = target.getBoundingClientRect()
    openSavedViewContextMenu(target, bounds.left + 12, bounds.bottom)
    return
  }
  if (event.key !== 'Enter' && event.key !== ' ') return
  const savedView = savedViews.find((candidate) => candidate.id === target.dataset.savedViewId)
  if (!savedView) return
  event.preventDefault()
  void loadSavedView(savedView)
}, { signal: events.signal })
element('saved-view-context-delete').addEventListener('click', () => {
  const id = element('saved-view-context-menu').dataset.savedViewId
  if (!id) return
  const index = savedViews.findIndex((savedView) => savedView.id === id)
  closeSavedViewContextMenu(true)
  deleteSavedView(id)
  const rows = element('saved-views-list').querySelectorAll<HTMLTableRowElement>('tr')
  const focusTarget = rows[Math.min(index, rows.length - 1)] ?? element('save-view-name')
  focusTarget.focus({ preventScroll: true })
}, { signal: events.signal })
element('saved-view-context-backdrop').addEventListener('click', () => {
  closeSavedViewContextMenu(true)
}, { signal: events.signal })
element('saved-view-context-backdrop').addEventListener('contextmenu', (event) => {
  event.preventDefault()
  closeSavedViewContextMenu(true)
}, { signal: events.signal })
element('saved-view-context-menu').addEventListener('keydown', (event) => {
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) event.preventDefault()
}, { signal: events.signal })
window.addEventListener('resize', () => closeSavedViewContextMenu(), { signal: events.signal })
document.addEventListener('keydown', (event) => {
  if (!element('saved-view-context-menu').hidden) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      closeSavedViewContextMenu(true)
      event.preventDefault()
      return
    }
  }
  if (event.key !== 'Escape') return
  if (!element('planet-card').hidden) {
    closePlanetCard(true)
    return
  }
  if (!element('mass-card').hidden) {
    closeMassCard(true)
    return
  }
  if (!element('distance-card').hidden) {
    closeDistanceCard(true)
    return
  }
  if (!element('radius-card').hidden) {
    closeRadiusCard(true)
    return
  }
  if (!element('spectral-card').hidden) {
    closeSpectralCard(true)
    return
  }
  if (!element('metallicity-card').hidden) {
    closeMetallicityCard(true)
    return
  }
  if (!element('object-type-card').hidden) {
    closeObjectTypeCard(true)
    return
  }
  const open = panelNames.find((name) => name !== 'motion' && panelIsOpen(name))
    ?? (panelIsOpen('motion') ? 'motion' : undefined)
  if (!open) return
  togglePanel(open)
  element(`${open}-toggle`).focus()
}, { signal: events.signal })
document.querySelector('.object-type-row')!.addEventListener('click', toggleObjectTypeCard, { signal: events.signal })
element('object-type-close').addEventListener('click', () => closeObjectTypeCard(true), { signal: events.signal })
document.querySelector('.metallicity-row')!.addEventListener('click', toggleMetallicityCard, { signal: events.signal })
element('metallicity-close').addEventListener('click', () => closeMetallicityCard(true), { signal: events.signal })
document.querySelector('.distance-row')!.addEventListener('click', toggleDistanceCard, { signal: events.signal })
element('distance-close').addEventListener('click', () => closeDistanceCard(true), { signal: events.signal })
element('distance-lock').addEventListener('click', () => {
  distanceCardLocked = !distanceCardLocked
  element('distance-lock').setAttribute('aria-pressed', String(distanceCardLocked))
}, { signal: events.signal })
element('planet-lock').addEventListener('click', () => {
  planetCardLocked = !planetCardLocked
  element('planet-lock').setAttribute('aria-pressed', String(planetCardLocked))
}, { signal: events.signal })
for (const section of planetSections) {
  element(`planet-${section}-toggle`).addEventListener('click', () => showPlanetSection(section), { signal: events.signal })
}
for (const mode of ['origin', 'sun'] as const) {
  element(`distance-reference-${mode}`).addEventListener('click', () => {
    distanceReference = mode
    refreshDistanceCard()
  }, { signal: events.signal })
}
element('mass-row').addEventListener('click', toggleMassCard, { signal: events.signal })
element('mass-close').addEventListener('click', () => closeMassCard(true), { signal: events.signal })
for (const mode of ['class', 'origin', 'sun'] as const) {
  element(`mass-reference-${mode}`).addEventListener('click', () => {
    massReference = mode
    const star = stars.find((candidate) => candidate.id === selectedId)
    if (star && !element('mass-card').hidden) renderMassCard(star)
  }, { signal: events.signal })
}
document.querySelector('.radius-row')!.addEventListener('click', toggleRadiusCard, { signal: events.signal })
element('radius-close').addEventListener('click', () => closeRadiusCard(true), { signal: events.signal })
document.querySelector('.spectral-row')!.addEventListener('click', toggleSpectralCard, { signal: events.signal })
element('spectral-close').addEventListener('click', () => closeSpectralCard(true), { signal: events.signal })
for (const diagram of ['hr', 'mk'] as const) {
  element(`spectral-${diagram}`).addEventListener('click', () => {
    spectralDiagram = diagram
    const star = stars.find((candidate) => candidate.id === selectedId)
    if (star && !element('spectral-card').hidden) renderSpectralCard(star)
    element('spectral-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  }, { signal: events.signal })
}
for (const mode of ['visual', 'bolometric'] as const) {
  element(`spectral-${mode}`).addEventListener('click', () => {
    spectralMagnitudeMode = mode
    const star = stars.find((candidate) => candidate.id === selectedId)
    if (star && !element('spectral-card').hidden) renderSpectralCard(star)
  }, { signal: events.signal })
}
for (const mode of ['origin', 'jupiter', 'earth'] as const) {
  element(`radius-reference-${mode}`).addEventListener('click', () => {
    radiusReference = mode
    const star = stars.find((candidate) => candidate.id === selectedId)
    if (star && !element('radius-card').hidden) renderRadiusCard(star)
  }, { signal: events.signal })
}
element('reset-view').addEventListener('click', () => {
  dismissOpenPanel()
  viewer?.reset()
}, { signal: events.signal })
for (const view of cameraViews) {
  element(`${view}-view`).addEventListener('click', () => {
    dismissOpenPanel()
    viewer?.setCameraView(view)
  }, { signal: events.signal })
}
element('toggle-grid').addEventListener('click', () => {
  if (!viewer) return
  const button = element('toggle-grid')
  gridVisible = !gridVisible
  viewer.setGridVisible(gridVisible)
  button.setAttribute('aria-pressed', String(gridVisible))
  text('grid-tooltip', gridVisible ? 'Hide grid' : 'Show grid')
  element('grid-legend').hidden = !gridVisible
}, { signal: events.signal })
element('selection-back').addEventListener('click', () => navigateSelectionHistory('back'), { signal: events.signal })
element('selection-forward').addEventListener('click', () => navigateSelectionHistory('forward'), { signal: events.signal })
element('set-origin').addEventListener('click', setSelectedAsOrigin, { signal: events.signal })
element('go-to-origin').addEventListener('click', () => {
  dismissOpenPanel()
  if (observerView) toggleObserverView()
  selectStar(referenceId)
}, { signal: events.signal })
element('observer-view').addEventListener('click', toggleObserverView, { signal: events.signal })
element('observer-view-origin').addEventListener('click', () => setObserverViewAnchor(referenceId), { signal: events.signal })
element('observer-object').addEventListener('click', () => {
  if (observerViewAnchorId !== null) selectStar(observerViewAnchorId)
}, { signal: events.signal })
element('observer-roll-counterclockwise').addEventListener('click', () => rollObserverView('counterclockwise'), { signal: events.signal })
element('observer-roll-reset').addEventListener('click', () => rollObserverView('center'), { signal: events.signal })
element('observer-roll-clockwise').addEventListener('click', () => rollObserverView('clockwise'), { signal: events.signal })

const observerDirectionLayout = new ResizeObserver(() => {
  const card = element('observer-direction-card')
  const objectsPanel = element('objects-panel')
  if (card.hidden || objectsPanel.hidden) return
  const inspector = element('inspector')
  const height = `${card.offsetHeight}px`
  if (inspector.style.getPropertyValue('--observer-direction-height') !== height) {
    inspector.style.setProperty('--observer-direction-height', height)
  }
  const clearance = `${Math.ceil(inspector.getBoundingClientRect().bottom - objectsPanel.getBoundingClientRect().top + 10)}px`
  if (inspector.style.getPropertyValue('--objects-panel-clearance') !== clearance) {
    inspector.style.setProperty('--objects-panel-clearance', clearance)
  }
})
for (const id of ['inspector', 'objects-panel', 'observer-direction-card']) observerDirectionLayout.observe(element(id))

import.meta.hot?.dispose(() => {
  events.abort()
  observerDirectionLayout.disconnect()
  if (playbackFrameRequest !== null) cancelAnimationFrame(playbackFrameRequest)
  viewer?.dispose()
  disposeDistanceComparison()
  planetModules?.disposePlanetGlobe()
})
