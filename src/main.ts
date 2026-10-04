import './style.css'
import { ArrowLeft, ArrowRight, CircleHelp, Clock, Crosshair, Eye, Filter, Focus, Grid2X2, List, Lock, Minus, Orbit, Pause, Play, Plus, RotateCcw, RotateCw, Save, Settings2, Star as StarIcon, Trash2, createElement, type IconNode } from 'lucide'
import { COMPACT_OBJECT_TYPES, describeObject, isCompactObject, isNebulaObject, NEBULA_OBJECT_TYPES, type Star } from './catalog-model'
import { catalogSelection, mergeCatalogStars } from './catalog-runtime'
import { compactOverlayManifest, loadCompactRemnants } from './compact-overlay'
import { loadNebulae, nebulaOverlayManifest } from './nebula-overlay'
import { catalogs, catalogErrors } from './registry'
import { formatDistance, gridSpacingPc, LIGHT_YEARS_PER_PARSEC, starDisplayColor, sunRelativeMetrics, type DistanceUnit, type MotionFrame, type StarColorMode } from './astronomy'
import { EARTH_ORBIT_MODES, earthOrbitDateForMode, earthOrbitModeLabel, isEarthOrbitMode, type EarthOrbitMode } from './earth-orbit'
import { MOTION_YEAR_OPTIONS, SIMULATION_YEAR_LIMIT, createStarViewer, type MotionYears, type StarViewer, type ViewerViewState } from './viewer'
import { isObjectMapVisible } from './viewer-primitives'
import {
  availableFilterKeys, categoryAvailable, DEFAULT_FILTER_CATEGORIES, DEFAULT_FILTER_SUBTYPES, effectiveFilterKeys, FILTER_CATEGORIES,
  filterCategoryForKey, filterSummary, isFilterCategoryId, isFilterKey, type FilterCategoryId, type FilterKey,
} from './object-filter'
import { ObjectList } from './object-list'
import { SelectionHistory } from './selection-history'

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

function measurement(value: number | null, error: number | null, unit: string, maximumFractionDigits = 3): string {
  if (value === null) return 'Not available'
  const formatted = value.toLocaleString('en-US', { maximumFractionDigits })
  const uncertainty = error === null ? '' : ` +/- ${error.toLocaleString('en-US', { maximumFractionDigits })}`
  return `${formatted}${uncertainty} ${unit}`
}

function preciseMeasurement(value: number | null, error: number | null, unit: string): string {
  if (value === null) return 'Not available'
  const significant = (number: number, digits: number) => {
    const absolute = Math.abs(number)
    return absolute > 0 && (absolute < 1e-6 || absolute >= 1e9)
      ? number.toExponential(digits - 1).replace('e+', 'e')
      : number.toLocaleString('en-US', { maximumSignificantDigits: digits })
  }
  const formatted = significant(value, 8)
  const uncertainty = error === null ? '' : ` +/- ${significant(error, 3)}`
  return `${formatted}${uncertainty} ${unit}`
}

function scientificQuantity(value: number | null, unit: string): string {
  if (value === null) return 'Not available'
  return `${value.toExponential(3).replace('e+', 'e')} ${unit}`
}

icon('reset-icon', Focus)
icon('grid-icon', Grid2X2)
icon('views-icon', Save)
icon('save-view-icon', Save)
icon('selection-back-icon', ArrowLeft)
icon('selection-forward-icon', ArrowRight)
icon('set-origin-icon', StarIcon)
icon('observer-view-icon', Eye)
icon('observer-roll-counterclockwise-icon', RotateCcw)
icon('observer-roll-reset-icon', Crosshair)
icon('observer-roll-clockwise-icon', RotateCw)
icon('filter-icon', Filter)
icon('preferences-icon', Settings2)
icon('objects-icon', List)
icon('info-icon', CircleHelp)
icon('info-brand-icon', Orbit)
icon('filter-lock-icon', Lock)
icon('preferences-lock-icon', Lock)
icon('objects-lock-icon', Lock)
icon('motion-icon', Clock)
icon('motion-lock-icon', Lock)
icon('time-play-icon', Play)
icon('time-now-icon', RotateCcw)
icon('time-follow-icon', Crosshair)
icon('time-slower-icon', Minus)
icon('time-faster-icon', Plus)

const events = new AbortController()
let viewer: StarViewer | undefined
let stars: Star[] = []
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
let followSelection = false
let simulationDirection: 1 | -1 = 1
let playbackSecondsPerThousandYears = 1
let playbackFrameRequest: number | null = null
let previousPlaybackTime = 0
let catalogRequest = 0
let sceneBusy = true
const filterCategories = new Set<FilterCategoryId>(DEFAULT_FILTER_CATEGORIES)
const filterSubtypes = new Set<FilterKey>(DEFAULT_FILTER_SUBTYPES)
const availableKeys = availableFilterKeys(compactOverlayManifest.counts, nebulaOverlayManifest.counts)
let visibleKeys = effectiveFilterKeys(filterCategories, filterSubtypes, availableKeys)
let distanceUnit: DistanceUnit = 'ly'
let starColorMode: StarColorMode = 'exaggerated'
const BRIGHT_CATALOG_ID = 'bright-stars'
const WESTERN_CONSTELLATION_CATALOG_ID = 'western-constellation-stars'
const FAMOUS_CLUSTER_CATALOG_ID = 'famous-cluster-stars'
const ADDITIVE_CATALOG_IDS = new Set([BRIGHT_CATALOG_ID, WESTERN_CONSTELLATION_CATALOG_ID, FAMOUS_CLUSTER_CATALOG_ID])
const SAVED_VIEWS_STORAGE_KEY = 'star-view-saved-views'

interface SavedViewSettings {
  catalogId: string
  showAlwaysBright: boolean
  showWesternConstellationStars: boolean
  showFamousClusterStars: boolean
  filterCategories: FilterCategoryId[]
  filterSubtypes: FilterKey[]
  magnitudeLimit: number
  objectDistanceLimitLy: number
  earthOrbitMode: EarthOrbitMode
  milkyWayVisible: boolean
  motionArrowsVisible: boolean
  motionYears: MotionYears
  motionFrame: MotionFrame
  distanceUnit: DistanceUnit
  starColorMode: StarColorMode
  labelLimit: number
  powerSavingMode: boolean
  gridVisible: boolean
  simulationYears: number
  simulationPlaying: boolean
  simulationDirection: 1 | -1
  playbackSecondsPerThousandYears: number
  followSelection: boolean
  selectedId: string | null
  observerId: string
  referenceId: string
  observerView: boolean
  observerViewAnchorId: string | null
  objectSearch: string
  viewState: ViewerViewState
}

interface SavedView {
  version: 1
  id: string
  name: string
  originName: string
  savedAt: string
  settings: SavedViewSettings
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteTuple3(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
}

function isSavedView(value: unknown): value is SavedView {
  if (!isRecord(value) || value.version !== 1 || typeof value.id !== 'string' || typeof value.name !== 'string' || !value.name.trim()
    || typeof value.originName !== 'string' || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) || !isRecord(value.settings)) return false
  const settings = value.settings
  const viewState = settings.viewState
  return typeof settings.catalogId === 'string'
    && typeof settings.showAlwaysBright === 'boolean'
    && typeof settings.showWesternConstellationStars === 'boolean'
    && typeof settings.showFamousClusterStars === 'boolean'
    && Array.isArray(settings.filterCategories) && settings.filterCategories.every(isFilterCategoryId)
    && Array.isArray(settings.filterSubtypes) && settings.filterSubtypes.every(isFilterKey)
    && typeof settings.magnitudeLimit === 'number' && settings.magnitudeLimit >= 0 && settings.magnitudeLimit <= 25
    && typeof settings.objectDistanceLimitLy === 'number' && OBJECT_DISTANCE_STEPS_LY.includes(settings.objectDistanceLimitLy as typeof OBJECT_DISTANCE_STEPS_LY[number])
    && typeof settings.earthOrbitMode === 'string' && isEarthOrbitMode(settings.earthOrbitMode)
    && typeof settings.milkyWayVisible === 'boolean'
    && typeof settings.motionArrowsVisible === 'boolean'
    && typeof settings.motionYears === 'number' && MOTION_YEAR_OPTIONS.includes(settings.motionYears as MotionYears)
    && (settings.motionFrame === 'galactic' || settings.motionFrame === 'solar')
    && (settings.distanceUnit === 'ly' || settings.distanceUnit === 'pc')
    && (settings.starColorMode === 'real' || settings.starColorMode === 'exaggerated')
    && typeof settings.labelLimit === 'number' && settings.labelLimit >= 0 && settings.labelLimit <= 140 && settings.labelLimit % 20 === 0
    && typeof settings.powerSavingMode === 'boolean'
    && typeof settings.gridVisible === 'boolean'
    && typeof settings.simulationYears === 'number' && Math.abs(settings.simulationYears) <= SIMULATION_YEAR_LIMIT
    && typeof settings.simulationPlaying === 'boolean'
    && (settings.simulationDirection === 1 || settings.simulationDirection === -1)
    && typeof settings.playbackSecondsPerThousandYears === 'number' && settings.playbackSecondsPerThousandYears >= 0.5 && settings.playbackSecondsPerThousandYears <= 15
    && typeof settings.followSelection === 'boolean'
    && (settings.selectedId === null || typeof settings.selectedId === 'string')
    && typeof settings.observerId === 'string'
    && typeof settings.referenceId === 'string'
    && typeof settings.observerView === 'boolean'
    && (settings.observerViewAnchorId === null || typeof settings.observerViewAnchorId === 'string')
    && typeof settings.objectSearch === 'string'
    && isRecord(viewState) && isFiniteTuple3(viewState.position) && isFiniteTuple3(viewState.target)
    && typeof viewState.home === 'boolean' && typeof viewState.observerRollRadians === 'number' && Number.isFinite(viewState.observerRollRadians)
}

function readSavedViews(): SavedView[] {
  try {
    const stored = localStorage.getItem(SAVED_VIEWS_STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter(isSavedView).sort((first, second) => Date.parse(second.savedAt) - Date.parse(first.savedAt)) : []
  } catch {
    return []
  }
}

// Nearest-N catalogs form an ordered size progression; landmark catalogs are independent additive toggles.
const sliderCatalogs = catalogs.filter((catalog) => !ADDITIVE_CATALOG_IDS.has(catalog.manifest.id))
  .sort((first, second) => first.manifest.objectCount - second.manifest.objectCount)
const OBJECT_DISTANCE_STEPS_LY = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 150, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 10000] as const
let savedViews = readSavedViews()
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
const viewButtons = ['reset-view', 'toggle-grid', 'views-toggle'].map((id) => element<HTMLButtonElement>(id))
const timelineButtons = ['time-play', 'time-now', 'time-follow'].map((id) => element<HTMLButtonElement>(id))
const timeSlider = element<HTMLInputElement>('time-slider')
const selectionHistory = new SelectionHistory(selectedId)
const panelNames = ['views', 'motion', 'filter', 'preferences', 'objects', 'info'] as const
const lockablePanelNames = ['motion', 'filter', 'preferences', 'objects'] as const
const lockedPanels = new Set<typeof lockablePanelNames[number]>()

function selectedStarAvailable(id: string): boolean {
  return stars.some((star) => star.id === id)
}

function updateSelectionHistoryControls(): void {
  element<HTMLButtonElement>('selection-back').disabled = sceneBusy || !selectionHistory.canGoBack(selectedStarAvailable)
  element<HTMLButtonElement>('selection-forward').disabled = sceneBusy || !selectionHistory.canGoForward(selectedStarAvailable)
}

function updateReferenceControl(): void {
  element<HTMLButtonElement>('set-origin').disabled = sceneBusy || selectedId === null || selectedId === referenceId
}

function updateObserverControl(): void {
  const button = element<HTMLButtonElement>('observer-view')
  const observer = observerViewAnchorId === null ? undefined : stars.find((star) => star.id === observerViewAnchorId)
  button.disabled = sceneBusy || (!observerView && selectedId === null)
  button.setAttribute('aria-pressed', String(observerView))
  button.setAttribute('aria-label', observerView ? 'Exit observer view' : 'Enter observer view')
  text('observer-view-tooltip', observerView ? 'Exit observer view' : 'Observer view')
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
  for (const id of ['reset-view']) {
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
  syncVisibilityObserverLayout()
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
  text('star-name', star.name)
  renderSelectedDistance(displayedDistancePc)
  element('selected-swatch').style.background = color
  text('distance-value', formatDistance(metrics.distancePc, distanceUnit).split(' ')[0]!)
  text('distance-unit', ` ${distanceUnit}`)
  text('object-type', describeObject(star))
  text('constellation', star.id === 'sun' ? 'Not applicable' : star.constellation ?? 'Not available')
  const compact = star.compact
  const compactObject = isCompactObject(star)
  const nebula = star.nebula
  const nebulaObject = isNebulaObject(star)
  for (const row of document.querySelectorAll<HTMLElement>('.stellar-property')) row.hidden = compactObject || nebulaObject
  for (const row of document.querySelectorAll<HTMLElement>('.compact-property')) row.hidden = !compactObject
  for (const row of document.querySelectorAll<HTMLElement>('.nebula-property')) row.hidden = !nebulaObject
  element('mass-row').hidden = nebulaObject
  for (const row of document.querySelectorAll<HTMLElement>('.pulsar-property')) row.hidden = star.type !== 'pulsar'
  for (const row of document.querySelectorAll<HTMLElement>('.rotation-property')) row.hidden = star.type === 'black_hole' || !compactObject
  for (const row of document.querySelectorAll<HTMLElement>('.orbit-property')) row.hidden = !compact || (compact.orbital_period_days === null && compact.companion === null)
  text('spectral-type', star.spectral_type ?? 'Not available')
  text('temperature', quantity(star.temperature_k, 'K', 0))
  const luminosity = star.luminosity_solar
  text('luminosity', luminosity !== null && luminosity < 1 ? `${luminosity.toLocaleString('en-US', { maximumSignificantDigits: 3 })} solar` : quantity(luminosity, 'solar'))
  text('mass', compact ? preciseMeasurement(star.mass_solar, compact.mass_error_solar, 'solar') : quantity(star.mass_solar, 'solar'))
  text('radius', quantity(star.radius_solar, 'solar'))
  text('metallicity', quantity(star.metallicity_dex, 'dex'))
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
    text('compact-companion', compact.companion ?? 'Not available')
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
    text('nebula-designations', nebula.designations.join(', '))
    text('nebula-angular-size', `${nebula.angular_size_arcmin[0]}′ × ${nebula.angular_size_arcmin[1]}′`)
    text('nebula-extent', `${extent(2 * major)} × ${extent(2 * minor)} × ${extent(deepPc)} ${distanceUnit}`)
    text('nebula-illumination', nebula.illuminating_stars)
    text('nebula-distance-source', nebula.distance_source)
    const source = element<HTMLAnchorElement>('nebula-source')
    source.textContent = nebula.source_label
    source.href = nebula.source_url
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
  text('motion-data', fullVelocity ? 'Full space motion' : raw ? 'Transverse only; radial velocity unavailable' : 'Not available')
  const sky = raw ?? compact ?? nebula ?? null
  text('right-ascension', sky ? `${sky.ra_deg.toLocaleString('en-US', { maximumFractionDigits: 9 })} deg` : 'Not available')
  text('declination', sky ? `${sky.dec_deg.toLocaleString('en-US', { maximumFractionDigits: 9 })} deg` : 'Not available')
  text('astrometry-epoch', raw ? `J${raw.epoch.toFixed(1)}` : 'Not available')
  text('parallax', raw ? measurement(raw.parallax_mas, raw.parallax_error_mas, 'mas', 6) : 'Not available')
  text('proper-motion-ra', raw ? measurement(raw.pm_ra_cosdec_masyr, raw.pm_ra_error_masyr, 'mas/yr', 6) : 'Not available')
  text('proper-motion-dec', raw ? measurement(raw.pm_dec_masyr, raw.pm_dec_error_masyr, 'mas/yr', 6) : 'Not available')
  text('radial-velocity', raw ? measurement(raw.radial_velocity_kms, raw.radial_velocity_error_kms, 'km/s', 6) : 'Not available')
  text('astrometry-source', raw?.astrometry_ref || compact?.position_source || nebula?.position_source || 'Not available')
  text('absolute-mag', quantity(star.absolute_mag))
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

function selectStar(id: string | null, recordHistory = true): void {
  if (id !== null && !stars.some((star) => star.id === id)) return
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
  if (!observerView) {
    const anchorId = selectedId
    if (anchorId === null) return
    observerViewAnchorId = anchorId
    observerId = anchorId
    observerView = viewer.setObserverView(true, anchorId)
    if (!observerView) observerViewAnchorId = null
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
  text('grid-spacing', `${formatDistance(gridSpacingPc(objectDistanceLimitLy), distanceUnit, distanceUnit === 'pc' ? 1 : 2)} grid`)
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
    const [brightCatalog, westernConstellationCatalog, famousClusterCatalog] = await Promise.all([
      loadAdditiveCatalog(showAlwaysBright, BRIGHT_CATALOG_ID),
      loadAdditiveCatalog(showWesternConstellationStars, WESTERN_CONSTELLATION_CATALOG_ID),
      loadAdditiveCatalog(showFamousClusterStars, FAMOUS_CLUSTER_CATALOG_ID),
    ])
    const compactObjects = COMPACT_OBJECT_TYPES.some((type) => visibleKeys.has(type)) ? await loadCompactRemnants() : []
    const nebulae = NEBULA_OBJECT_TYPES.some((type) => visibleKeys.has(type)) ? await loadNebulae() : []
    const withBrightStars = mergeCatalogStars(selectedCatalog, brightCatalog)
    const withConstellationStars = mergeCatalogStars(withBrightStars, westernConstellationCatalog)
    nextStars = [...mergeCatalogStars(withConstellationStars, famousClusterCatalog), ...compactObjects, ...nebulae]
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
  const overlayChanged = [COMPACT_OBJECT_TYPES, NEBULA_OBJECT_TYPES].some((types) =>
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

const objectList = new ObjectList(element('star-list'), selectStar, (shown, total) => text('catalog-count', `${shown}/${total}`))
objectList.setColorMode(starColorMode)

function savedViewDate(isoDate: string): string {
  const date = new Date(isoDate)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function setSavedViewsStatus(message: string): void {
  const status = element('saved-views-status')
  status.textContent = message
  status.title = message
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

function renderSavedViews(): void {
  const list = element<HTMLTableSectionElement>('saved-views-list')
  list.replaceChildren(...savedViews.map((savedView) => {
    const row = document.createElement('tr')
    row.dataset.savedViewId = savedView.id
    row.tabIndex = 0
    row.setAttribute('aria-label', `Load saved view ${savedView.name}`)
    row.title = `Load ${savedView.name}`
    const name = document.createElement('td')
    name.textContent = savedView.name
    name.title = savedView.name
    const origin = document.createElement('td')
    origin.textContent = savedView.originName
    origin.title = savedView.originName
    const date = document.createElement('td')
    const time = document.createElement('time')
    time.dateTime = savedView.savedAt
    time.textContent = savedViewDate(savedView.savedAt)
    date.append(time)
    const action = document.createElement('td')
    const remove = document.createElement('button')
    remove.className = 'saved-view-delete'
    remove.type = 'button'
    remove.dataset.deleteSavedView = savedView.id
    remove.setAttribute('aria-label', `Delete saved view ${savedView.name}`)
    remove.title = 'Delete saved view'
    remove.append(createElement(Trash2, { width: 17, height: 17, 'stroke-width': 1.8, 'aria-hidden': 'true' }))
    action.append(remove)
    row.append(name, origin, date, action)
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
    distanceUnit,
    starColorMode,
    labelLimit,
    powerSavingMode,
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
  element<HTMLInputElement>(`unit-${distanceUnit}`).checked = true
  element<HTMLInputElement>(`star-colors-${starColorMode}`).checked = true
  labelLimitInput.value = String(labelLimit)
  labelLimitInput.setAttribute('aria-valuetext', labelLimit === 0 ? 'Off' : `${labelLimit} labels`)
  text('label-limit-value', labelLimit === 0 ? 'Off' : String(labelLimit))
  element<HTMLInputElement>('power-saving-mode').checked = powerSavingMode
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
  distanceUnit = settings.distanceUnit
  starColorMode = settings.starColorMode
  labelLimit = settings.labelLimit
  powerSavingMode = settings.powerSavingMode
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
    localStorage.setItem('star-view-distance-unit', distanceUnit)
    localStorage.setItem('star-view-color-mode', starColorMode)
    localStorage.setItem('star-view-label-limit', String(labelLimit))
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
  renderDistances()
  viewer?.setDistanceUnit(distanceUnit)
}, { signal: events.signal })
element('star-colors').addEventListener('change', () => {
  starColorMode = element<HTMLInputElement>('star-colors-exaggerated').checked ? 'exaggerated' : 'real'
  try { localStorage.setItem('star-view-color-mode', starColorMode) } catch {}
  objectList.setColorMode(starColorMode)
  renderSelection()
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
  text('grid-spacing', `${formatDistance(gridSpacingPc(objectDistanceLimitLy), distanceUnit, distanceUnit === 'pc' ? 1 : 2)} grid`)
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
  syncVisibilityObserverLayout()
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
element('saved-views-list').addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const deleteButton = target.closest<HTMLButtonElement>('[data-delete-saved-view]')
  if (deleteButton) {
    deleteSavedView(deleteButton.dataset.deleteSavedView!)
    return
  }
  const row = target.closest<HTMLTableRowElement>('tr[data-saved-view-id]')
  const savedView = savedViews.find((candidate) => candidate.id === row?.dataset.savedViewId)
  if (savedView) void loadSavedView(savedView)
}, { signal: events.signal })
element('saved-views-list').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const target = event.target
  if (!(target instanceof HTMLTableRowElement)) return
  const savedView = savedViews.find((candidate) => candidate.id === target.dataset.savedViewId)
  if (!savedView) return
  event.preventDefault()
  void loadSavedView(savedView)
}, { signal: events.signal })
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  const open = panelNames.find((name) => name !== 'motion' && panelIsOpen(name))
    ?? (panelIsOpen('motion') ? 'motion' : undefined)
  if (!open) return
  togglePanel(open)
  element(`${open}-toggle`).focus()
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
}, { signal: events.signal })
element('selection-back').addEventListener('click', () => navigateSelectionHistory('back'), { signal: events.signal })
element('selection-forward').addEventListener('click', () => navigateSelectionHistory('forward'), { signal: events.signal })
element('set-origin').addEventListener('click', setSelectedAsOrigin, { signal: events.signal })
element('observer-view').addEventListener('click', toggleObserverView, { signal: events.signal })
element('observer-object').addEventListener('click', () => {
  if (observerViewAnchorId !== null) selectStar(observerViewAnchorId)
}, { signal: events.signal })
element('observer-roll-counterclockwise').addEventListener('click', () => rollObserverView('counterclockwise'), { signal: events.signal })
element('observer-roll-reset').addEventListener('click', () => rollObserverView('center'), { signal: events.signal })
element('observer-roll-clockwise').addEventListener('click', () => rollObserverView('clockwise'), { signal: events.signal })

import.meta.hot?.dispose(() => {
  events.abort()
  if (playbackFrameRequest !== null) cancelAnimationFrame(playbackFrameRequest)
  viewer?.dispose()
})
