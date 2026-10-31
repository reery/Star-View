import { SaveCheck } from 'lucide'
import { clearLoadRecovery, createLoadError, loadWithRecovery } from './load-recovery'
import { streamWhenLoaded } from './content-stream'
import { ArrowLeft, ArrowLeftRight, ArrowRight, Atom, BookOpen, Box, Cake, ChartColumn, ChartScatter, ChevronUp, FunnelX, ChevronsDownUp, ChevronsLeftRight, ChevronsRightLeft, ChevronsUpDown, CircleDashed, CircleHelp, Clock, Cloud, Compass, Crosshair, Earth, Ellipsis, Eye, Filter, Focus, Galaxy, Globe, Grid2X2, List, Lock, Minus, Moon, Orbit, Paintbrush, PanelLeftClose, PanelLeftOpen, Pause, Play, Plus, Radius, RotateCcw, RotateCw, Save, Shrink, Search, Settings2, Sparkle, Sun, Telescope, Thermometer, Trophy, Weight, X, ArrowDown, ArrowUp, ChevronDown, LogIn, LogOut, Rocket, Trash2, createElement, type IconNode } from 'lucide'
import { ObserverOriginIcon, OriginIcon } from './origin-icon'
import { ConstellationIcon } from './constellation-icon'
import { createSpaceship, createSpaceshipGizmo, SPACESHIP_KEYS, SPACESHIP_LABELS, SPACESHIP_SPEEDS_LY_PER_S, type Spaceship, type SpaceshipKey, type SpaceshipLabels, type SpaceshipTelemetry } from './spaceship'
import { FIRST_BIRTH_YEAR, NEIGHBORHOOD_RADIUS_LY, NeighborhoodIcon, neighborhoodBounds } from './neighborhood'
import { BUBBLE_OBJECT_TYPES, COMPACT_OBJECT_TYPES, describeObject, isBubbleObject, isCompactObject, isMolecularCloudObject, isNebulaObject, MOLECULAR_CLOUD_OBJECT_TYPES, NEBULA_OBJECT_TYPES, type Star } from './catalog-model'
import { catalogSelection, mergeCatalogStars } from './catalog-runtime'
import { catalogMeasurement, catalogSourceFor } from './catalog-source'
import { completeLoadedCompanions as completeCatalogCompanions } from './constellation-companions'
import { objectDesignations } from './designations'
import { completeCompanionRecords } from './companion-records'
import { compactOverlayManifest, loadCompactRemnants } from './compact-overlay'
import { loadNebulae, nebulaOverlayManifest } from './nebula-overlay'
import { loadMolecularClouds, molecularCloudOverlayManifest } from './molecular-cloud-overlay'
import { bubbleOverlayManifest, loadBubbles } from './bubble-overlay'
import { catalogs, catalogErrors } from './registry'
import legacyStarIds from './data/legacy-star-ids.json'
import { apparentVisualMagnitude, displayMotionForStar, formatDistance, galacticToWorld, LIGHT_YEARS_PER_PARSEC, starDisplayColor, sunRelativeMetrics, type DistanceUnit, type GridScale, type MotionFrame, type StarColorMode } from './astronomy'
import { EARTH_ORBIT_MODES, earthOrbitDateForMode, earthOrbitModeLabel, isEarthOrbitMode, type EarthOrbitMode } from './earth-orbit'
import { MOTION_YEAR_OPTIONS, SIMULATION_YEAR_LIMIT, createStarViewer, type MotionYears, type StarViewer, type ViewerViewState } from './viewer'
import { isObjectMapVisible, mapVisibilityTier, motionTravelDistancePc } from './viewer-primitives'
import { renderSelectedStarPreview } from './selected-star-preview'
import { COMPARISON_DETAIL_TOGGLES, initializeStarComparison } from './star-comparison'
import { radialVelocitySource, specValues, type SpecValue } from './spec-values'
import { starInfoAvailable } from './star-info-availability'
import type { HrMagnitudeMode } from './hr-diagram'
import { hrCardAvailable, spectralReference } from './spectral-properties'
import { positionCardHeaderTooltips } from './card-header-tooltips'
import { EARTH_MASS_SOLAR, JUPITER_MASS_SOLAR, massCardAvailable } from './mass-properties'
import { luminosityCardAvailable } from './luminosity-properties'
import { MAGNITUDE_VISIBILITY_GUIDES, magnitudeCardAvailable } from './magnitude-properties'
import { temperatureCardAvailable } from './temperature-properties'
import { constellationCardAvailable, loadConstellationChart, type ConstellationChart } from './constellations'
import type { RadiusReference } from './radius-comparison'
import { indexStarSystems, type StarSystem } from './star-systems'
import { loadStellarOrbits } from './stellar-orbits'
import { loadPlanetarySystem, planetCountForStar, planetarySystemForStar, planetHostId } from './planetary-systems'
import { loadStarDetails, starDetailsLoaded } from './selected-star-details'
import {
  availableFilterKeys, categoryAvailable, DEFAULT_FILTER_CATEGORIES, DEFAULT_FILTER_SUBTYPES, effectiveFilterKeys, FILTER_CATEGORIES,
  filterCategoryForKey, filterSummary, isFilterCategoryId, isFilterKey, type FilterCategoryId, type FilterKey,
} from './object-filter'
import { ObjectList, type ObjectListFilter } from './object-list'
import { SelectionHistory } from './selection-history'
import { appendConstellationContent } from './constellation-card-content'
import { initializeToolbarTouch } from './toolbar-touch'
import { initializeTouchTooltips } from './touch-tooltips'
import { attachPopoverTooltip } from './popover-tooltips'
import { objectSubtypeDescription } from './object-subtype-info'
import { MISSING_VALUE, preciseMeasurement, quantity, scientificQuantity } from './format'
import { OBJECT_DISTANCE_STEPS_LY, readSavedViews, SAVED_VIEWS_STORAGE_KEY, type SavedView, type SavedViewSettings } from './saved-views'
import type { SkyGridMode } from './sky-grid'
import { browserDataSize, deleteBrowserData } from './browser-data'
import { readSavedFilter, SAVED_FILTER_STORAGE_KEY, type SavedFilter } from './saved-filter'
import { DEFAULT_PAINT_CONTROLS, DEFAULT_PAINT_LEVEL, isPaintSettingId, PAINT_CHANNELS, PAINT_HISTOGRAM_BINS, PAINT_LEVEL_RANGE, PAINT_SETTINGS, paintLegend, starPainter, type PaintChannel, type PaintControls, type PaintSettingId } from './star-paint'

function element<ElementType extends HTMLElement = HTMLElement>(id: string): ElementType {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing interface element: ${id}`)
  return found as ElementType
}

function loadCardFeature<T>(id: string, label: string, load: () => Promise<T>, isCurrent?: () => boolean) {
  const card = element(`${id}-card`)
  const target = card.querySelector<HTMLElement>(':scope > .card-scroll-content') ?? card
  // A card that is just opening shows its frame at once and streams its content in once loaded, without a loading message.
  const opening = target.getAnimations().some((animation) => animation.pending)
  const loading = loadWithRecovery(target, load, {
    label,
    silent: opening,
    isCurrent: () => !events.signal.aborted && (isCurrent?.() ?? true),
    retry: () => {
      element(`${id}-close`).click()
      element(`${id}-toggle`).click()
    },
    focusTarget: element(`${id}-close`),
    onChange: syncObjectTypeLayout,
  })
  return opening ? streamWhenLoaded(target, loading) : loading
}

function text(id: string, value: string): void {
  const target = element(id)
  target.textContent = value
  target.classList.toggle('missing-value', value === MISSING_VALUE)
}

// Values with selection-specific markup stay in renderSelection; Specs owns the rest.
const SPECS_OWNED_BY_SELECTION = new Set(['distance-toggle', 'known-planets', 'object-subtypes-empty'])

function showSpec(id: string, value: SpecValue): void {
  const target = element(id)
  target.textContent = value.text
  if (value.title) target.title = value.title
  else target.removeAttribute('title')
  target.classList.toggle('unresolved-measurement', Boolean(value.unresolved))
  target.classList.toggle('missing-value', value.text === MISSING_VALUE)
  if (value.label !== undefined) target.closest('.properties > div')!.querySelector('dt')!.textContent = value.label
}

function sourceCardTooltip(metric: 'luminosity' | 'radius' | 'temperature', star: Star, propertiesHidden: boolean): void {
  const visible = catalogSourceFor(star, metric === 'temperature' ? 'temperature_k' : `${metric}_solar`) !== undefined && !propertiesHidden
  const row = element(`${metric}-row`)
  element(`${metric}-source-tooltip`).removeAttribute('data-model-range')
  element(`${metric}-source-tooltip`).hidden = !visible
  text(`${metric}-source-tooltip`, visible
    ? `Unresolved system value. ${star.name}’s individual ${metric} is unavailable, so the card is disabled.` : '')
  row.tabIndex = visible ? 0 : -1
  if (visible) {
    row.setAttribute('aria-describedby', `${metric}-source-tooltip`)
    element(metric).removeAttribute('title')
  } else row.removeAttribute('aria-describedby')
}

function icon(id: string, shape: IconNode): void {
  element(id).replaceChildren(createElement(shape, { width: 20, height: 20, 'stroke-width': 1.7, 'aria-hidden': 'true' }))
}

appendConstellationContent(element('constellation-card'))

icon('discover-icon', Compass)
icon('constellations-icon', ConstellationIcon)
icon('neighborhood-icon', NeighborhoodIcon)
icon('neighborhood-active-icon', NeighborhoodIcon)
icon('neighborhood-clear-icon', FunnelX)
icon('neighborhood-birth-icon', Cake)
icon('neighborhood-lock-icon', Lock)
icon('neighborhood-close-icon', X)
icon('spaceship-icon', Rocket)
icon('spaceship-active-icon', Rocket)
icon('spaceship-clear-icon', Trash2)
icon('spaceship-help-icon', CircleHelp)
icon('spaceship-close-icon', X)
icon('spaceship-travelled-reset-icon', RotateCcw)
icon('spaceship-throttle-up-icon', ChevronUp)
icon('spaceship-throttle-down-icon', ChevronDown)
for (const [key, shape] of [['q', RotateCcw], ['w', ArrowUp], ['e', RotateCw], ['a', ArrowLeft], ['s', ArrowDown], ['d', ArrowRight]] as const) icon(`spaceship-key-${key}-icon`, shape)
const updateSpaceshipGizmo = createSpaceshipGizmo(element('spaceship-gizmo'))
icon('top-lists-icon', Trophy)
icon('top-lists-lock-icon', Lock)
icon('top-lists-close-icon', X)
icon('graphs-icon', ChartColumn)
icon('spectral-catalog-icon', ChartScatter)
icon('spectral-kiel-catalog-icon', ChartScatter)
icon('graphs-width-icon', ChevronsRightLeft)
icon('graphs-clear-icon', FunnelX)
icon('graph-filter-active-icon', ChartColumn)
icon('paint-active-icon', Paintbrush)
icon('motion-active-icon', Clock)
icon('graphs-lock-icon', Lock)
icon('graphs-close-icon', X)
icon('paint-icon', Paintbrush)
icon('paint-shrink-icon', Shrink)
icon('paint-reset-icon', RotateCcw)
icon('paint-lock-icon', Lock)
icon('paint-close-icon', X)
icon('constellations-search-icon', Search)
icon('constellations-maximize-icon', ChevronsUpDown)
icon('constellations-lock-icon', Lock)
icon('constellations-close-icon', X)
icon('discover-constellation-magnify-icon', Search)
icon('discover-constellation-grid-icon', Globe)
icon('discover-constellation-info-icon', BookOpen)
icon('reset-icon', Focus)
icon('grid-icon', Grid2X2)
icon('equatorial-grid-icon', Globe)
icon('galactic-grid-icon', Galaxy)
icon('views-icon', Save)
icon('save-view-icon', Save)
icon('selection-back-icon', ArrowLeft)
icon('selection-forward-icon', ArrowRight)
icon('set-origin-icon', OriginIcon)
icon('set-sun-origin-icon', Sun)
icon('go-to-origin-icon', Crosshair)
icon('observer-view-icon', Eye)
icon('observer-view-origin-icon', ObserverOriginIcon)
icon('observer-telescope-icon', Telescope)
icon('observer-roll-counterclockwise-icon', RotateCcw)
icon('observer-roll-reset-icon', Crosshair)
icon('observer-roll-clockwise-icon', RotateCw)
icon('filter-icon', Filter)
icon('preferences-icon', Settings2)
icon('objects-icon', List)
icon('glossary-icon', BookOpen)
icon('glossary-search-icon', Search)
icon('glossary-lock-icon', Lock)
icon('glossary-close-icon', X)
icon('info-icon', CircleHelp)
icon('info-brand-icon', Orbit)
icon('filter-lock-icon', Lock)
icon('filter-reset-icon', RotateCcw)
icon('filter-save-icon', Save)
icon('preferences-lock-icon', Lock)
icon('objects-lock-icon', Lock)
icon('objects-close-icon', X)
icon('objects-expand-icon', ChevronsLeftRight)
icon('objects-shrink-icon', ChevronsDownUp)
icon('objects-maximize-icon', ChevronsUpDown)
icon('motion-icon', Clock)
icon('motion-lock-icon', Lock)
icon('motion-close-icon', X)
const detailCardClosers = {
  'object-type': closeObjectTypeCard,
  metallicity: closeMetallicityCard,
  radius: closeRadiusCard,
  spectral: closeSpectralCard,
  pulsar: closePulsarCard,
  mass: closeMassCard,
  luminosity: closeLuminosityCard,
  temperature: closeTemperatureCard,
  magnitude: closeMagnitudeCard,
  constellation: closeConstellationCard,
  distance: closeDistanceCard,
  planet: closePlanetCard,
}
type DetailCardName = keyof typeof detailCardClosers
const detailCardNames = Object.keys(detailCardClosers) as DetailCardName[]
const lockedDetailCards = new Set<DetailCardName>()
for (const name of detailCardNames) {
  icon(`${name}-close-icon`, X)
  icon(`${name}-lock-icon`, Lock)
}
icon('magnitude-absolute-icon', Sun)
icon('magnitude-apparent-icon', Eye)
icon('constellation-magnify-icon', Search)
icon('constellation-grid-icon', Globe)
icon('constellation-info-icon', BookOpen)
icon('planet-specs-icon', List)
icon('planet-info-icon', BookOpen)
icon('planet-moons-icon', Moon)
icon('planet-earth-icon', Earth)
icon('planet-earth-plus-icon', Plus)
icon('planet-earth-minus-icon', Minus)
icon('planet-stats-icon', Ellipsis)
icon('planet-atmosphere-icon', Cloud)
icon('planet-atmosphere-chevron', ChevronUp)
icon('time-play-icon', Play)
icon('time-now-icon', RotateCcw)
icon('distance-time-reset-icon', RotateCcw)
icon('time-follow-icon', Crosshair)
icon('time-slower-icon', Minus)
icon('time-faster-icon', Plus)
icon('object-specs-icon', List)
icon('object-info-icon', BookOpen)
icon('object-system-icon', Orbit)
icon('object-compare-icon', ArrowLeftRight)
icon('visibility-lock-icon', Lock)

const events = new AbortController()
initializeTouchTooltips(events.signal)
initializeToolbarTouch(document.querySelector<HTMLElement>('.scene-toolbar')!, events.signal)
for (const help of document.querySelectorAll<HTMLButtonElement>('.compact-property .mass-metric-help')) attachPopoverTooltip(help, help.nextElementSibling as HTMLElement)
// The Spaceship card sits at the bottom of the screen, so its help rises above it.
attachPopoverTooltip(element<HTMLButtonElement>('spaceship-help'), element('spaceship-help-tooltip'), 'above')
let constellationBrowser: ReturnType<typeof import('./constellation-browser').initializeConstellationBrowser> | undefined
let topLists: ReturnType<typeof import('./top-lists').initializeTopLists> | undefined
let graphs: ReturnType<typeof import('./graphs').initializeGraphs> | undefined
let graphFilter: ObjectListFilter | null = null
/** The Neighborhood keeps its center while active, so selecting a neighbor does not move it. */
let neighborhoodCenter: Star | null = null
/** Session-only: the ship survives catalog changes but is never saved in a view. */
let spaceship: Spaceship | null = null
let spaceshipSpeedLevel = 1
let spaceshipLabels: SpaceshipLabels = 'selected'
/** Whether the map rates brightness from the ship rather than the selected object. */
let spaceshipVisibility = false
const spaceshipKeys = new Set<SpaceshipKey>()
/** Touch throttle from -1 (backward) to 1 (forward); it overrides W and S while held. */
let spaceshipThrottle = 0
let spaceshipTelemetry: SpaceshipTelemetry | null = null
let spaceshipStatsTime = -Infinity
let neighborhoodRadiusLy: number = NEIGHBORHOOD_RADIUS_LY.initial
let neighborhoodBirthYear: number | null = null
let neighborhoodFilter: ObjectListFilter | null = null
/** Yearly displacement in parsecs per object and motion frame, for Neighborhood membership at the simulated time. */
const neighborhoodMotions = { galactic: new WeakMap<Star, ReturnType<typeof galacticToWorld> | null>(), solar: new WeakMap<Star, ReturnType<typeof galacticToWorld> | null>() }
/** Farthest object of the chosen catalog from the Sun, so the Neighborhood can say where its coverage ends. */
let catalogReachLy = Infinity
let glossaryInitialized = false
const paintSettings = new Map<PaintSettingId, number>()
/** Visible objects the paint is fitted to; null while nothing is painted. */
let paintStars: Star[] | null = null
/** Paint settings on their fixed linear scale instead of ranking the visible objects. */
const linearPaintSettings = new Set<PaintSettingId>()
/** Slider controls of the paint settings, at their defaults when absent. */
const paintControls = new Map<PaintSettingId, PaintControls>()
/** Channels each paint setting claims when enabled, both when absent. */
const paintChannels = new Map<PaintSettingId, readonly PaintChannel[]>()
const paintChannelsOf = (id: PaintSettingId) => paintChannels.get(id) ?? PAINT_CHANNELS
let paintZoomShrink = false
let viewer: StarViewer | undefined
let stars: Star[] = []
let starIndex = new Map<string, Star>()
const starById = (id: string | null | undefined): Star | undefined => id ? starIndex.get(id) : undefined
// Chart selections are explicit additions, independent of the overlay switches.
// Each system stays loaded only while it is selected, compared, anchored or the origin.
const constellationSelectedSystems = new Map<string, Star[]>()
let constellationSelectionRequest = 0
let starSystems: ReadonlyMap<string, StarSystem> = new Map()
let activeCatalogId = ''
let selectedId: string | null = 'sirius-a'
let observerId = 'sirius-a'
// A locked visibility base ignores selection changes; unlocking returns to the last selected object.
let visibilityLockId: string | null = null
let lastSelectedId = observerId
let referenceId = 'sun'
let magnitudeLimit = 7
let hideFainterObjects = false
let objectDistanceLimitLy = 100
let showWesternConstellationStars = false
let showNotableDistantStars = false
let gridVisible = true
let skyGridMode: SkyGridMode = 'off'
let observerView = false
let observerViewAnchorId: string | null = null
let powerSavingMode = false
// Touch-first devices start with fewer labels; a stored preference overrides this below.
const touchFirstInput = window.matchMedia('(hover: none) and (pointer: coarse)')
const wideLayout = window.matchMedia('(min-width: 721px)')
let labelLimit = touchFirstInput.matches ? 20 : 40
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
const WESTERN_CONSTELLATION_CATALOG_ID = 'western-constellation-stars'
const NOTABLE_DISTANT_CATALOG_ID = 'notable-distant-stars'
// Retired catalog IDs (bright-stars) restore saved selections on their surviving records.
const legacyStarId = (id: string) => (legacyStarIds.ids as Record<string, string>)[id] ?? id

// Nearest-N catalogs form an ordered size progression; the landmark catalogs are additive toggles.
const ADDITIVE_CATALOG_IDS: readonly string[] = [WESTERN_CONSTELLATION_CATALOG_ID, NOTABLE_DISTANT_CATALOG_ID]
const sliderCatalogs = catalogs.filter((catalog) => !ADDITIVE_CATALOG_IDS.includes(catalog.manifest.id))
  .sort((first, second) => first.manifest.objectCount - second.manifest.objectCount)
const savedFilter = readSavedFilter(sliderCatalogs.map((catalog) => catalog.manifest.id))
const initialCatalogId = savedFilter?.catalogId ?? 'nearest-neighbors'
if (savedFilter) {
  // The retired bright-star switch now maps to the constellation catalog that contains its stars.
  showWesternConstellationStars = savedFilter.showWesternConstellationStars || savedFilter.showAlwaysBright
  showNotableDistantStars = savedFilter.showNotableDistantStars ?? false
  filterCategories.clear()
  savedFilter.filterCategories.forEach((category) => filterCategories.add(category))
  filterSubtypes.clear()
  savedFilter.filterSubtypes.forEach((subtype) => filterSubtypes.add(subtype))
  magnitudeLimit = savedFilter.magnitudeLimit
  hideFainterObjects = savedFilter.hideFainterObjects ?? false
  objectDistanceLimitLy = savedFilter.objectDistanceLimitLy
  visibleKeys = effectiveFilterKeys(filterCategories, filterSubtypes, availableKeys)
}
let savedViews = readSavedViews()
let savedViewMenuRow: HTMLTableRowElement | null = null
let sceneMenuTargetId: string | null = null
/** The pointer that opened the scene menu while still pressed; releasing it over an item chooses that item. */
let sceneMenuPointerId: number | null = null
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
const viewButtons = [...cameraViewButtonIds, 'toggle-grid', 'toggle-equatorial-grid', 'toggle-galactic-grid', 'views-toggle'].map((id) => element<HTMLButtonElement>(id))
const timelineButtons = ['time-play', 'time-now', 'time-follow'].map((id) => element<HTMLButtonElement>(id))
const timeSlider = element<HTMLInputElement>('time-slider')
// The distance card has its own timeline, which moves only its two views.
const distanceTimeSlider = element<HTMLInputElement>('distance-time-slider')
// Evenly spaced timeline ticks; set via CSSOM because the CSP forbids inline style attributes.
document.querySelectorAll('.time-markers').forEach((markers) => {
  const ticks = markers.querySelectorAll<HTMLElement>('i')
  ticks.forEach((marker, index) => marker.style.setProperty('--marker-position', `${index / (ticks.length - 1) * 100}%`))
})
const selectionHistory = new SelectionHistory(selectedId)
// The Spaceship card floats at the bottom center: it opens beside other cards and only its own controls close it.
const panelNames = ['views', 'motion', 'filter', 'objects', 'glossary', 'constellations', 'top-lists', 'graphs', 'paint', 'neighborhood', 'preferences', 'info', 'spaceship'] as const
const lockablePanelNames = ['motion', 'filter', 'objects', 'glossary', 'constellations', 'top-lists', 'graphs', 'paint', 'neighborhood', 'preferences'] as const
// Discover panels open from the flyout, so focus returns to its toggle.
const panelToggleId = (name: typeof panelNames[number]) => name === 'constellations' || name === 'top-lists' || name === 'graphs' || name === 'paint' || name === 'neighborhood' || name === 'motion' || name === 'spaceship' ? 'discover-toggle' : `${name}-toggle`
const lockedPanels = new Set<typeof lockablePanelNames[number]>()
// On desktop, these cards move the 3D view center left while locked, so the scene stays visible beside them.
const viewCenteringPanels: readonly typeof lockablePanelNames[number][] = ['paint', 'graphs']

function selectedStarAvailable(id: string): boolean {
  return starIndex.has(id)
}

function updateSelectionHistoryControls(): void {
  for (const direction of ['back', 'forward'] as const) {
    const id = direction === 'back' ? selectionHistory.peekBack(selectedStarAvailable) : selectionHistory.peekForward(selectedStarAvailable)
    const star = starById(id)
    const prefix = `selection-${direction}`
    const label = direction === 'back' ? 'Previous selection' : 'Next selection'
    const button = element<HTMLButtonElement>(prefix)
    button.disabled = sceneBusy || !star
    button.setAttribute('aria-label', star ? `${label}: ${star.name}` : label)
    element(`${prefix}-object`).hidden = !star
    text(`${prefix}-name`, star?.name ?? '')
    element(`${prefix}-swatch`).style.background = star ? starDisplayColor(star, starColorMode).getStyle() : ''
  }
  // Keep forward navigation reachable when history is already at its first entry.
  element('selection-controls').tabIndex = element<HTMLButtonElement>('selection-back').disabled && !element<HTMLButtonElement>('selection-forward').disabled ? 0 : -1
}

function updateReferenceControl(): void {
  const sun = starById('sun')
  element<HTMLButtonElement>('set-sun-origin').disabled = sceneBusy || !sun || referenceId === 'sun'
  element('set-sun-origin-swatch').style.background = sun ? starDisplayColor(sun, starColorMode).getStyle() : ''
  const setOrigin = element<HTMLButtonElement>('set-origin')
  const selected = starById(selectedId)
  setOrigin.disabled = sceneBusy || selectedId === null || selectedId === referenceId
  setOrigin.setAttribute('aria-label', `Set ${selected?.name ?? 'selected object'} as origin`)
  text('set-origin-name', selected?.name ?? 'selected object')
  element('set-origin-swatch').hidden = !selected
  element('set-origin-swatch').style.background = selected ? starDisplayColor(selected, starColorMode).getStyle() : ''
  const goToOrigin = element<HTMLButtonElement>('go-to-origin')
  const origin = starById(referenceId)
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
  const selected = starById(selectedId)
  const origin = starById(referenceId)
  const observer = starById(observerViewAnchorId)
  // Piloting a ship and observing from an object both own the camera.
  const piloting = spaceship?.piloting === true
  button.disabled = sceneBusy || piloting || (!observerView && !selected)
  button.setAttribute('aria-pressed', String(observerView))
  button.setAttribute('aria-label', observerView ? 'Exit observer view' : selected ? `Observe from ${selected.name}` : 'Enter observer view')
  text('observer-view-tooltip', observerView ? 'Exit observer view' : 'Observe from')
  element('observer-view-target').hidden = observerView || !selected
  text('observer-view-target-name', selected?.name ?? '')
  element('observer-view-target-swatch').style.background = selected ? starDisplayColor(selected, starColorMode).getStyle() : ''
  const originButton = element<HTMLButtonElement>('observer-view-origin')
  const observingOrigin = observerView && observerViewAnchorId === referenceId
  originButton.disabled = sceneBusy || piloting || !origin || selectedId === referenceId
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
  element('observer-telescope').setAttribute('aria-pressed', String(observerView && Boolean(viewer?.getViewState().observerTelescope)))
  for (const id of ['observer-telescope', 'observer-roll-counterclockwise', 'observer-roll-reset', 'observer-roll-clockwise']) {
    element<HTMLButtonElement>(id).disabled = sceneBusy || !observerView
  }
  for (const id of cameraViewButtonIds) {
    element<HTMLButtonElement>(id).disabled = sceneBusy || observerView || piloting
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
  if (name === 'filter' && !open) setFilterSaveIndicator(false)
  if (name === 'views' && !open) closeSavedViewContextMenu()
  if (name === 'objects' && !open) objectList.closeColumnFilter()
  element<HTMLButtonElement>(`${name}-toggle`).setAttribute('aria-expanded', String(open))
  element(`${name}-panel`).hidden = !open
  if (name === 'preferences' && open) updateBrowserDataSize()
  if (name === 'glossary' && open && !glossaryInitialized) void loadGlossaryPanel()
  if (name === 'constellations') {
    if (!open) constellationBrowser?.close()
    else if (constellationBrowser) constellationBrowser.open()
    else void loadConstellationsPanel()
  }
  if (name === 'top-lists' && open) {
    if (topLists) topLists.open()
    else void loadTopListsPanel()
  }
  if (name === 'graphs' && open) {
    if (graphs) graphs.open()
    else void loadGraphsPanel()
  }
  if (name === 'neighborhood' && open) {
    // Opening starts a neighborhood around the selection; an active one keeps its center.
    if (neighborhoodCenter) renderNeighborhood()
    else setNeighborhoodCenter(defaultNeighborhoodCenter())
  }
  if (name === 'spaceship') {
    // Opening turns the camera into a ship; an existing one keeps its place.
    if (open && !spaceship) launchSpaceship()
    else renderSpaceship()
  }
}

async function loadGlossaryPanel(): Promise<void> {
  const result = await loadWithRecovery(element('glossary-panel').querySelector<HTMLElement>('.glossary-body')!,
    () => import('./glossary'), {
      label: 'Glossary', retry: () => { void loadGlossaryPanel() },
      isCurrent: () => !events.signal.aborted && panelIsOpen('glossary'),
      focusTarget: element('glossary-close'), onChange: syncPanelLayout,
    })
  if (!result || glossaryInitialized) return
  result.value.initializeGlossary(events.signal)
  glossaryInitialized = true
}

async function loadConstellationsPanel(): Promise<void> {
  const body = element('constellations-panel').querySelector<HTMLElement>('.glossary-body')!
  // The panel frame shows at once; its content streams in once loaded, without a loading message.
  const result = await streamWhenLoaded(body, loadWithRecovery(body, () => import('./constellation-browser'), {
    label: 'Constellations', silent: true, retry: () => { void loadConstellationsPanel() },
    isCurrent: () => !events.signal.aborted && panelIsOpen('constellations'),
    focusTarget: element('constellations-close'), onChange: syncPanelLayout,
  }))
  if (!result || constellationBrowser) return
  constellationBrowser = result.value.initializeConstellationBrowser(events.signal,
    () => ({ objects: stars, colorMode: starColorMode, distanceUnit, onSelect: (object) => { void selectConstellationStar(object) } }),
    starById(selectedId)?.constellation ?? undefined)
  constellationBrowser.open()
}

async function loadTopListsPanel(): Promise<void> {
  const result = await loadWithRecovery(element('top-lists-panel').querySelector<HTMLElement>('.glossary-body')!,
    () => import('./top-lists'), {
      label: 'Top lists', retry: () => { void loadTopListsPanel() },
      isCurrent: () => !events.signal.aborted && panelIsOpen('top-lists'),
      focusTarget: element('top-lists-close'), onChange: syncPanelLayout,
    })
  if (!result || topLists) return
  topLists = result.value.initializeTopLists(events.signal, () => ({ distanceUnit, onSelect: (object) => { void selectTopListObject(object) } }))
  topLists.open()
}

async function loadGraphsPanel(): Promise<void> {
  const body = element('graphs-panel').querySelector<HTMLElement>('.glossary-body')!
  // The panel frame shows at once; its content streams in once loaded, without a loading message.
  const result = await streamWhenLoaded(body, loadWithRecovery(body, () => import('./graphs'), {
    label: 'Graphs', silent: true, retry: () => { void loadGraphsPanel() },
    isCurrent: () => !events.signal.aborted && panelIsOpen('graphs'),
    focusTarget: element('graphs-close'), onChange: syncPanelLayout,
  }))
  if (!result) return
  initializeGraphs(result.value).open()
}

function initializeGraphs(module: typeof import('./graphs')): NonNullable<typeof graphs> {
  return graphs ??= module.initializeGraphs(events.signal,
    () => ({ items: objectList.mapItems(baseObjectListFilter()), onFilter: setGraphFilter, sun: starById('sun'), reference: starById(referenceId), referenceName: starById(referenceId)?.name ?? 'Sun', systems: starSystems, distanceUnit, colorMode: starColorMode }))
}

/** Prefer the loaded record of a merged identity; otherwise add the listed catalog record. */
async function selectTopListObject(object: import('./top-lists').TopListObject): Promise<void> {
  const loaded = starById(object.id) ?? (object.designation === null ? undefined : stars.find((star) => objectDesignations(star).includes(object.designation!)))
  if (loaded) return selectConstellationStar(loaded)
  const payload = object.catalog === compactOverlayManifest.id ? await loadCompactRemnants()
    : await catalogs.find((catalog) => catalog.manifest.id === object.catalog)!.load()
  const record = payload.find((star) => star.id === object.id)
  if (record) await selectConstellationStar(record, new Map(payload.map((star) => [star.id, star])))
}

function syncPanelLayout(): void {
  const dock = element('control-dock')
  const motionOpen = panelIsOpen('motion')
  const dockPanel = panelNames.find((name) => name !== 'views' && name !== 'motion' && name !== 'spaceship' && panelIsOpen(name))
  if (dockPanel) dock.dataset.open = dockPanel
  else if (motionOpen) dock.dataset.open = 'motion'
  else delete dock.dataset.open
  if (motionOpen) dock.dataset.motionOpen = ''
  else delete dock.dataset.motionOpen
  syncSelectedObjectLayout()
  syncObjectTypeLayout()
  syncVisibilityObserverLayout()
  syncViewCenterInset()
}

// The view centers between the locked card and the selected object card, counting half of the latter:
// it covers only the top of the view, so a full share pushes the center visibly right.
function syncViewCenterInset(): void {
  const name = viewCenteringPanels.find((candidate) => lockedPanels.has(candidate) && panelIsOpen(candidate))
  const scene = element('scene').getBoundingClientRect(), selectedCard = element('selected-object-card')
  const left = selectedCard.hidden ? 0 : Math.max(0, selectedCard.getBoundingClientRect().right - scene.left) / 2
  const inset = name && wideLayout.matches && !touchFirstInput.matches
    ? scene.right - element(`${name}-panel`).getBoundingClientRect().left - left : 0
  viewer?.setViewCenterInset(Math.max(0, inset))
}

function closeObjectTypeCard(restoreFocus = false): void {
  objectTypeRenderRequest++
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
  radiusModules?.comparison.releaseRadiusComparisonTextures()
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

function closeTemperatureCard(restoreFocus = false): void {
  const card = element('temperature-card')
  if (card.hidden) return
  card.hidden = true
  element('temperature-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('temperature-toggle').focus()
}

function closeLuminosityCard(restoreFocus = false): void {
  const card = element('luminosity-card')
  if (card.hidden) return
  card.hidden = true
  element('luminosity-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('luminosity-toggle').focus()
}

function closeMagnitudeCard(restoreFocus = false): void {
  magnitudeRenderRequest++
  const card = element('magnitude-card')
  if (card.hidden) return
  card.hidden = true
  element('magnitude-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('magnitude-toggle').focus()
}

let constellationMagnified = false
let constellationEquatorialGrid = false
let constellationOpenRequest = 0
let constellationCardModule: typeof import('./constellation-card') | undefined
let activeConstellationChart: ConstellationChart | null = null
let constellationStarId: string | undefined
let objectTypeStarId: string | undefined

function sideDetailStar(id: string | undefined): Star | undefined {
  const other = starComparison.other
  return other && other.id === id ? other : starById(selectedId)
}

/** Detail cards compare with the comparison star when one is active, otherwise with the map origin. */
function cardReferences(): { sun: Star; origin: Star; other: Star | undefined; reference: Star } {
  const sun = starById('sun')!
  const origin = starById(referenceId) ?? sun
  const other = starComparison.other
  return { sun, origin, other, reference: other ?? origin }
}

function closeConstellationCard(restoreFocus = false): void {
  constellationOpenRequest++
  const card = element('constellation-card')
  if (card.hidden) return
  card.hidden = true
  constellationCardModule?.resetConstellationInfo(card)
  element('constellation-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('constellation-toggle').focus()
}

function renderConstellationCard(star: Star): void {
  if (!constellationCardModule) return
  constellationStarId = star.id
  if (activeConstellationChart?.name !== star.constellation) {
    const request = ++constellationOpenRequest
    void loadCardFeature('constellation', 'constellation chart', () => loadConstellationChart(star),
      () => request === constellationOpenRequest && sideDetailStar(constellationStarId)?.id === star.id).then((result) => {
      if (!result?.value) return
      activeConstellationChart = result.value
      renderConstellationCard(star)
    })
    return
  }
  constellationCardModule.renderConstellationCard(element('constellation-card'), star, activeConstellationChart, {
    objects: stars, colorMode: starColorMode, distanceUnit, magnified: constellationMagnified, equatorialGrid: constellationEquatorialGrid,
    onSelect: (object) => { void selectConstellationStar(object) },
  })
  syncObjectTypeLayout()
}

/** Companions complete from the loaded chart records unless the caller supplies its source payload. */
async function selectConstellationStar(object: Star, records?: ReadonlyMap<string, Star>): Promise<void> {
  const request = ++constellationSelectionRequest
  const existing = starById(object.id)
  if (!existing) {
    constellationSelectedSystems.set(object.id, records ? completeCompanionRecords([object], records) : completeCatalogCompanions([object]))
    await switchCatalog(activeCatalogId, true)
    if (request !== constellationSelectionRequest) return
  }
  selectStar(object.id)
}

async function toggleConstellationCard(other = false): Promise<void> {
  const star = other ? starComparison.other : starById(selectedId)
  if (!star || !constellationCardAvailable(star)) return
  if (!element('constellation-card').hidden && constellationStarId === star.id) {
    closeConstellationCard(true)
    return
  }
  constellationStarId = star.id
  const request = ++constellationOpenRequest
  closePlanetCard()
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeMassCard()
  closeLuminosityCard()
  closeTemperatureCard()
  closeMagnitudeCard()
  closeDistanceCard()
  closeSpectralCard()
  closePulsarCard()
  element('constellation-card').hidden = false
  element('constellation-toggle').setAttribute('aria-expanded', 'true')
  const result = await loadCardFeature('constellation', 'constellation chart',
    () => Promise.all([import('./constellation-card'), loadConstellationChart(star)]),
    () => request === constellationOpenRequest && sideDetailStar(constellationStarId)?.id === star.id)
  if (!result) return
  const [module, chart] = result.value
  if (!chart) return
  constellationCardModule = module
  activeConstellationChart = chart
  renderConstellationCard(star)
  element('constellation-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  element('constellation-close').focus({ preventScroll: true })
}

function closeSpectralCard(restoreFocus = false): void {
  spectralRenderRequest++
  const card = element('spectral-card')
  if (card.hidden) return
  card.hidden = true
  element('spectral-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('spectral-toggle').focus()
}

let spectralMagnitudeMode: HrMagnitudeMode | null = null
let spectralCatalogStars = false
// 'class' is the classification diagram: M-K for stars, cooling for white dwarfs.
let spectralDiagram: 'hr' | 'class' | 'kiel' = 'hr'

let spectralRenderRequest = 0
const spectralModules = new Map<'hr' | 'mk', typeof import('./hr-diagram') | typeof import('./mk-diagram')>()

async function renderSpectralCard(star: Star): Promise<void> {
  const request = ++spectralRenderRequest
  // White dwarfs have their own cooling diagram; brown dwarfs have no M-K luminosity class.
  const classDiagram = star.type === 'star' ? 'mk' : star.type === 'white_dwarf' ? 'wd' : null
  const diagram = spectralDiagram === 'class' && classDiagram ? classDiagram : spectralDiagram === 'kiel' ? 'kiel' : 'hr'
  // The Kiel diagram shares the H-R module's temperature axis.
  const moduleName = diagram === 'hr' || diagram === 'kiel' ? 'hr' : 'mk'
  let module = spectralModules.get(moduleName)
  if (!module) {
    const result = await loadCardFeature<typeof import('./hr-diagram') | typeof import('./mk-diagram')>('spectral', 'spectral diagram',
      () => moduleName === 'hr' ? import('./hr-diagram') : import('./mk-diagram'),
      () => request === spectralRenderRequest && selectedId === star.id)
    if (!result) return
    module = result.value
    spectralModules.set(moduleName, module)
  } else {
    clearLoadRecovery(element('spectral-card').querySelector<HTMLElement>('.card-scroll-content')!)
  }
  if (request !== spectralRenderRequest || element('spectral-card').hidden || selectedId !== star.id) return
  const { sun, origin, other } = cardReferences()
  const reference = other ?? spectralReference(origin, sun)
  element<HTMLButtonElement>('spectral-mk').disabled = !classDiagram
  element('spectral-mk').hidden = classDiagram === 'wd'
  element('spectral-wd').hidden = classDiagram !== 'wd'
  for (const shown of ['hr', 'mk', 'wd', 'kiel'] as const) {
    element(`spectral-${shown}`).setAttribute('aria-pressed', String(diagram === shown))
    element(`spectral-${shown}-content`).hidden = diagram !== shown
    element(`spectral-${shown}-method`).hidden = diagram !== shown
  }
  // H-R and Kiel share one catalog-stars choice.
  for (const toggle of ['spectral-catalog', 'spectral-kiel-catalog']) element(toggle).setAttribute('aria-pressed', String(spectralCatalogStars))
  if (diagram === 'kiel' && 'renderKielDiagram' in module) module.renderKielDiagram(element('spectral-card'), star, reference, spectralCatalogStars ? stars : null)
  else if ('renderHrDiagram' in module) {
    const { hrMagnitude, renderHrDiagram } = module
    const mode = spectralMagnitudeMode ?? (hrMagnitude(star, 'visual') === null && hrMagnitude(star, 'bolometric') !== null ? 'bolometric' : 'visual')
    renderHrDiagram(element('spectral-card'), star, reference, mode, spectralCatalogStars ? stars : null)
  } else if (diagram === 'wd') module.renderWhiteDwarfDiagram(element('spectral-card'), star, reference, stars)
  else module.renderMkDiagram(element('spectral-card'), star, reference)
  module.renderSpectralFeatures(element('spectral-card'), star, reference)
  syncObjectTypeLayout()
  positionCardHeaderTooltips(element('spectral-card'))
}

function toggleSpectralCard(): void {
  if (element<HTMLButtonElement>('spectral-toggle').disabled) return
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
  closeLuminosityCard()
  closeTemperatureCard()
  closeMagnitudeCard()
  closeDistanceCard()
  closeConstellationCard()
  closePulsarCard()
  element('spectral-card').hidden = false
  element('spectral-toggle').setAttribute('aria-expanded', 'true')
  renderSpectralCard(star)
  element('spectral-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  element('spectral-close').focus({ preventScroll: true })
}

let pulsarRenderRequest = 0
let pulsarDiagramModule: typeof import('./pulsar-diagram') | undefined

function closePulsarCard(restoreFocus = false): void {
  pulsarRenderRequest++
  const card = element('pulsar-card')
  if (card.hidden) return
  card.hidden = true
  element('pulsar-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('pulsar-toggle').focus()
}

/** The diagram places the selection among every catalog pulsar, whatever the current filters show. */
async function renderPulsarCard(star: Star): Promise<void> {
  const request = ++pulsarRenderRequest
  const result = await loadCardFeature('pulsar', 'P–Ṗ diagram',
    () => Promise.all([pulsarDiagramModule ?? import('./pulsar-diagram'), loadCompactRemnants()]),
    () => request === pulsarRenderRequest && selectedId === star.id)
  if (!result || request !== pulsarRenderRequest || element('pulsar-card').hidden || selectedId !== star.id) return
  const [module, population] = result.value
  pulsarDiagramModule = module
  module.renderPulsarDiagram(element('pulsar-card'), star, cardReferences().other ?? null, population)
  syncObjectTypeLayout()
}

function togglePulsarCard(): void {
  if (element<HTMLButtonElement>('pulsar-toggle').disabled) return
  if (!element('pulsar-card').hidden) {
    closePulsarCard(true)
    return
  }
  const star = starById(selectedId)
  if (!star || !pulsarDiagramAvailable(star)) return
  for (const name of detailCardNames) if (name !== 'pulsar') detailCardClosers[name]()
  element('pulsar-card').hidden = false
  element('pulsar-toggle').setAttribute('aria-expanded', 'true')
  void renderPulsarCard(star)
  element('pulsar-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  element('pulsar-close').focus({ preventScroll: true })
}

const pulsarDiagramAvailable = (star: Star) => star.type === 'pulsar' && (star.compact?.period_derivative ?? 0) > 0
  && (star.compact?.rotation_period_s ?? 0) > 0

let activePlanetId: string | null = null
let planetOpenRequest = 0
const planetSections = ['specs', 'info', 'moons'] as const

// Planet details, imagery and the globe renderer load only when a planet is opened.
type PlanetModules = {
  renderPlanetCard: typeof import('./planet-card').renderPlanetCard
  planetDescriptionForId: typeof import('./planet-properties').planetDescriptionForId
  disposePlanetGlobe: typeof import('./planet-globe').disposePlanetGlobe
  resetPlanetGlobe: typeof import('./planet-globe').resetPlanetGlobe
  renderPlanetSection: typeof import('./planet-card').renderPlanetSection
  releasePlanetCardGlobes: typeof import('./planet-card').releasePlanetCardGlobes
}
let planetModules: PlanetModules | undefined
async function loadPlanetModules(): Promise<PlanetModules> {
  if (planetModules) return planetModules
  const [card, properties, globe] = await Promise.all([import('./planet-card'), import('./planet-properties'), import('./planet-globe')])
  return planetModules = {
    renderPlanetCard: card.renderPlanetCard,
    planetDescriptionForId: properties.planetDescriptionForId,
    disposePlanetGlobe: globe.disposePlanetGlobe,
    resetPlanetGlobe: globe.resetPlanetGlobe,
    renderPlanetSection: card.renderPlanetSection,
    releasePlanetCardGlobes: card.releasePlanetCardGlobes,
  }
}

function showPlanetSection(section: typeof planetSections[number]): void {
  for (const candidate of planetSections) {
    element(`planet-${candidate}`).hidden = candidate !== section
    element(`planet-${candidate}-toggle`).setAttribute('aria-expanded', String(candidate === section))
  }
  void planetModules?.renderPlanetSection(element('planet-card'), section).then(syncObjectTypeLayout)
  const globe = element('planet-card').querySelector<HTMLCanvasElement>(section === 'specs' ? '#planet-globe' : `#planet-${section} canvas`)
  if (globe) planetModules?.resetPlanetGlobe(globe)
  element('planet-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  syncObjectTypeLayout()
}

function closePlanetCard(restoreFocus = false): void {
  planetOpenRequest++
  const card = element('planet-card')
  if (card.hidden) return
  card.hidden = true
  planetModules?.releasePlanetCardGlobes(card)
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
  const card = element('planet-card')
  if (!card.hidden && activePlanetId === planetId) {
    closePlanetCard(true)
    return
  }
  const request = ++planetOpenRequest
  const system = element('object-system')
  const hostId = selectedId
  const row = system.querySelector<HTMLElement>(`.planet-row[data-planet-id="${planetId}"]`)
  const selected = row?.querySelector('button')?.getAttribute('aria-pressed') === 'true'
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeMassCard()
  closeLuminosityCard()
  closeTemperatureCard()
  closeMagnitudeCard()
  closeDistanceCard()
  activePlanetId = planetId
  closeSpectralCard()
  closeConstellationCard()
  closePulsarCard()
  // The card opens at once under the row's name; its content streams in once the planet modules load.
  if (!planetModules) {
    element('planet-name').textContent = row?.querySelector('dt')?.textContent ?? ''
    element('planet-icon').style.setProperty('--planet-color', row?.querySelector<HTMLElement>('.star-swatch')?.style.backgroundColor ?? '')
  }
  card.hidden = false
  highlightSystemPlanet(system, planetId, planetId)
  syncObjectTypeLayout()
  const body = card.querySelector<HTMLElement>('.card-scroll-content')!
  const loading = loadWithRecovery(body, loadPlanetModules, {
    label: 'planet details', silent: true,
    retry: () => { closePlanetCard(); void selectSystemPlanet(planetId) },
    isCurrent: () => request === planetOpenRequest && selectedId === hostId && element<HTMLDetailsElement>('object-card-details').open,
    focusTarget: element('planet-close'),
    onChange: syncObjectTypeLayout,
  })
  void streamWhenLoaded(card.querySelector<HTMLElement>('.planet-specs-pinned')!, loading)
  const result = await streamWhenLoaded(body, loading)
  if (!result) return
  const { planetDescriptionForId, renderPlanetCard } = result.value
  const description = planetDescriptionForId(planetId)
  if (!description) {
    closePlanetCard()
    highlightSystemPlanet(system, selected ? null : planetId)
    return
  }
  renderPlanetCard(card, description)
  showPlanetSection('specs')
  element('planet-specs-toggle').focus({ preventScroll: true })
}

let luminosityCardModule: typeof import('./luminosity-card') | undefined

function renderLuminosityCard(star: Star): void {
  if (!luminosityCardModule) return
  const { sun, origin, other } = cardReferences()
  luminosityCardModule.renderLuminosityCard(element('luminosity-card'), star, origin, sun, starColorMode, other)
  syncObjectTypeLayout()
}

function renderTemperatureCard(star: Star): void {
  if (!temperatureCardModule) return
  const { sun, origin, other } = cardReferences()
  temperatureCardModule.renderTemperatureCard(element('temperature-card'), star, origin, sun, starColorMode, other)
  syncObjectTypeLayout()
}

let temperatureCardModule: typeof import('./temperature-card') | undefined

async function toggleTemperatureCard(): Promise<void> {
  if (element<HTMLButtonElement>('temperature-toggle').disabled) return
  if (!element('temperature-card').hidden) {
    closeTemperatureCard(true)
    return
  }
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (!star || !temperatureCardAvailable(star)) return
  closePlanetCard()
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeMassCard()
  closeLuminosityCard()
  closeMagnitudeCard()
  closeDistanceCard()
  closeSpectralCard()
  closeConstellationCard()
  closePulsarCard()
  element('temperature-card').hidden = false
  element('temperature-toggle').setAttribute('aria-expanded', 'true')
  if (!temperatureCardModule) {
    const result = await loadCardFeature('temperature', 'temperature comparison', () => import('./temperature-card'))
    if (!result) return
    temperatureCardModule = result.value
  }
  const current = stars.find((candidate) => candidate.id === selectedId)
  if (!current || element('temperature-card').hidden) return
  renderTemperatureCard(current)
  element('temperature-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  element('temperature-close').focus({ preventScroll: true })
}

let magnitudeRenderRequest = 0
let magnitudeVisibilityInitialized = false
let magnitudeCardModule: typeof import('./magnitude-card') | undefined

async function renderMagnitudeCard(star: Star): Promise<void> {
  const request = ++magnitudeRenderRequest
  if (!magnitudeCardModule) {
    const result = await loadCardFeature('magnitude', 'magnitude comparison', () => import('./magnitude-card'),
      () => request === magnitudeRenderRequest && selectedId === star.id)
    if (!result) return
    magnitudeCardModule = result.value
  }
  const { initializeMagnitudeVisibility, renderMagnitudeCard: renderMagnitudeComparison } = magnitudeCardModule
  if (request !== magnitudeRenderRequest || element('magnitude-card').hidden || selectedId !== star.id) return
  if (!magnitudeVisibilityInitialized) {
    initializeMagnitudeVisibility(element('magnitude-card'), () => {
      const current = stars.find((candidate) => candidate.id === selectedId)
      if (current && !element('magnitude-card').hidden) void renderMagnitudeCard(current)
    }, events.signal)
    magnitudeVisibilityInitialized = true
  }
  const { sun, origin, other } = cardReferences()
  renderMagnitudeComparison(element('magnitude-card'), star, origin, sun, starColorMode, starById('sirius-a'), other)
  syncObjectTypeLayout()
}

function toggleMagnitudeCard(): void {
  if (element<HTMLButtonElement>('magnitude-toggle').disabled) return
  if (!element('magnitude-card').hidden) {
    closeMagnitudeCard(true)
    return
  }
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (!star) return
  closePlanetCard()
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeMassCard()
  closeLuminosityCard()
  closeTemperatureCard()
  closeDistanceCard()
  closeSpectralCard()
  closeConstellationCard()
  closePulsarCard()
  element('magnitude-card').hidden = false
  element('magnitude-toggle').setAttribute('aria-expanded', 'true')
  renderMagnitudeCard(star)
  element('magnitude-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  element('magnitude-close').focus({ preventScroll: true })
}

async function toggleLuminosityCard(): Promise<void> {
  if (element<HTMLButtonElement>('luminosity-toggle').disabled) return
  if (!element('luminosity-card').hidden) {
    closeLuminosityCard(true)
    return
  }
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (!star || !luminosityCardAvailable(star) || element<HTMLButtonElement>('luminosity-toggle').disabled) return
  closeTemperatureCard()
  closeMagnitudeCard()
  closePlanetCard()
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeMassCard()
  closeDistanceCard()
  closeSpectralCard()
  closeConstellationCard()
  closePulsarCard()
  element('luminosity-card').hidden = false
  element('luminosity-toggle').setAttribute('aria-expanded', 'true')
  if (!luminosityCardModule) {
    const result = await loadCardFeature('luminosity', 'luminosity comparison', () => import('./luminosity-card'))
    if (!result) return
    luminosityCardModule = result.value
  }
  const current = stars.find((candidate) => candidate.id === selectedId)
  if (!current || element('luminosity-card').hidden) return
  renderLuminosityCard(current)
  element('luminosity-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  element('luminosity-close').focus({ preventScroll: true })
}

let massCardModule: typeof import('./mass-card') | undefined

function renderMassCard(star: Star): void {
  if (!massCardModule) return
  const { sun, origin, other } = cardReferences()
  massCardModule.renderMassCardContent(element('mass-card'), star, origin, sun, starColorMode, other)
  syncObjectTypeLayout()
}

async function toggleMassCard(): Promise<void> {
  if (element<HTMLButtonElement>('mass-toggle').disabled) return
  if (!element('mass-card').hidden) {
    closeMassCard(true)
    return
  }
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (!star || !massCardAvailable(star) || element<HTMLButtonElement>('mass-toggle').disabled) return
  closeLuminosityCard()
  closeTemperatureCard()
  closeMagnitudeCard()
  closePlanetCard()
  closeObjectTypeCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeDistanceCard()
  closeSpectralCard()
  closeConstellationCard()
  closePulsarCard()
  element('mass-card').hidden = false
  element('mass-toggle').setAttribute('aria-expanded', 'true')
  if (!massCardModule) {
    const result = await loadCardFeature('mass', 'mass comparison', () => import('./mass-card'))
    if (!result) return
    massCardModule = result.value
  }
  const current = stars.find((candidate) => candidate.id === selectedId)
  if (!current || element('mass-card').hidden) return
  renderMassCard(current)
  element('mass-card').querySelector<HTMLElement>('.card-scroll-content')!.scrollTop = 0
  element('mass-close').focus({ preventScroll: true })
}

let distanceReference: 'origin' | 'sun' = 'origin'
let distanceYears = 0
// The Sun-relative facts don't change with the timeline, so they render only when their inputs do.
let distanceFactsKey = ''
let distanceCardModule: typeof import('./distance-comparison') | undefined

function closeDistanceCard(restoreFocus = false): void {
  const card = element('distance-card')
  if (card.hidden) return
  card.hidden = true
  // A reopened card starts at the present; a locked card keeps its time across selections.
  setDistanceYears(0)
  element('distance-toggle').setAttribute('aria-expanded', 'false')
  if (restoreFocus) element('distance-toggle').focus()
}

function renderDistanceCard(star: Star): void {
  if (!distanceCardModule) return
  const { sun, origin, other } = cardReferences()
  const referenceMode = other || origin.id === 'sun' ? 'sun' : distanceReference
  const originLabel = `from ${origin.name}`
  text('distance-reference-origin', originLabel)
  element('distance-reference-origin').hidden = Boolean(other) || origin.id === 'sun'
  element('distance-reference-origin').title = originLabel
  element('distance-reference-origin').setAttribute('aria-label', originLabel)
  for (const mode of ['origin', 'sun'] as const) {
    element(`distance-reference-${mode}`).setAttribute('aria-pressed', String(referenceMode === mode))
  }
  const reference = referenceMode === 'sun' ? sun : origin
  distanceCardModule.renderDistanceComparison(element<HTMLCanvasElement>('distance-comparison'), star, reference, starColorMode, distanceUnit, distanceYears, motionFrame, other)
  const factsKey = [star.id, other?.id, distanceUnit, starColorMode].join('|')
  if (factsKey !== distanceFactsKey) {
    distanceFactsKey = factsKey
    distanceCardModule.renderDistanceFacts(element('distance-card'), star, sun, starColorMode, distanceUnit, other)
  }
  syncObjectTypeLayout()
}

function refreshDistanceCard(): void {
  if (element('distance-card').hidden) return
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (star) renderDistanceCard(star)
}

async function toggleDistanceCard(): Promise<void> {
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
  closeLuminosityCard()
  closeTemperatureCard()
  closeMagnitudeCard()
  closeSpectralCard()
  closeConstellationCard()
  closePulsarCard()
  element('distance-card').hidden = false
  element('distance-toggle').setAttribute('aria-expanded', 'true')
  if (!distanceCardModule) {
    const result = await loadCardFeature('distance', 'distance comparison', () => import('./distance-comparison'))
    if (!result) return
    distanceCardModule = result.value
  }
  const current = stars.find((candidate) => candidate.id === selectedId)
  if (!current || element('distance-card').hidden) return
  renderDistanceCard(current)
  element('distance-close').focus({ preventScroll: true })
}

let radiusReference: RadiusReference = 'auto'
let radiusModules: { comparison: typeof import('./radius-comparison'); card: typeof import('./radius-card') } | undefined

function renderRadiusCard(star: Star): void {
  if (!radiusModules) return
  const { radiusComparison, radiusStats, radiusSummary, renderRadiusComparison } = radiusModules.comparison
  const references = cardReferences()
  const origin = references.other ?? (star.id === referenceId ? references.sun : references.origin)
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
  radiusModules.card.renderRadiusBars(element('radius-card'), star, comparison)
  text('radius-scale-note', renderRadiusComparison(element<HTMLCanvasElement>('radius-comparison'), comparison))
  const rotators = [star, ...comparison.referenceMode === 'origin' && origin.id !== star.id ? [origin] : []]
    .filter((object) => object.stellar_observations?.rotation)
  element('radius-rotation-method').hidden = rotators.length === 0
  element('radius-rotation-method').replaceChildren(...rotators.flatMap((object, index) => {
    const { reference, scope, source_url } = object.stellar_observations!.rotation!
    const link = document.createElement('a')
    link.href = source_url
    link.target = '_blank'
    link.rel = 'noreferrer'
    link.textContent = `${reference} ↗`
    return [...index ? [document.createElement('br')] : [], `${object.name} rotation: ${scope} `, link]
  }))
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

async function toggleRadiusCard(): Promise<void> {
  if (element<HTMLButtonElement>('radius-toggle').disabled) return
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
  closeLuminosityCard()
  closeTemperatureCard()
  closeMagnitudeCard()
  closeSpectralCard()
  closeConstellationCard()
  closePulsarCard()
  element('radius-card').hidden = false
  element('radius-toggle').setAttribute('aria-expanded', 'true')
  if (!radiusModules) {
    const result = await loadCardFeature('radius', 'radius comparison',
      () => Promise.all([import('./radius-comparison'), import('./radius-card')]))
    if (!result) return
    const [comparison, card] = result.value
    radiusModules = { comparison, card }
  }
  const current = stars.find((candidate) => candidate.id === selectedId)
  if (!current || element('radius-card').hidden) return
  renderRadiusCard(current)
  element('radius-close').focus({ preventScroll: true })
}

function renderMetallicityCard(star: Star): void {
  const other = starComparison.other
  const source = catalogSourceFor(star, 'metallicity_dex')
  const value = catalogMeasurement(star, 'metallicity_dex')
  const kind = source?.record.metallicity_kind ?? star.metallicity_kind
  const iron = kind === '[Fe/H]'
  const ratioName = iron ? 'iron-to-hydrogen' : 'metal-to-hydrogen'
  const otherSource = other ? catalogSourceFor(other, 'metallicity_dex') : undefined
  const otherValue = other ? catalogMeasurement(other, 'metallicity_dex') : null
  const otherKind = other ? otherSource?.record.metallicity_kind ?? other.metallicity_kind : undefined
  text('metallicity-heading', `Metallicity ${other && kind !== otherKind ? '' : kind ?? ''}${source ? ' · system' : ''}`.trim())
  const limit = 2
  const outsideScale = value !== null && Math.abs(value) > limit
  const scalePosition = (dex: number | null) => dex === null ? 50 : Math.max(0, Math.min(100, (dex + limit) / (2 * limit) * 100))
  const labelOffset = (percent: number) => percent < 35 ? '0%' : percent > 65 ? '-100%' : '-50%'
  const position = scalePosition(value)
  const scale = element('metallicity-scale')
  scale.classList.toggle('has-comparison', Boolean(other))
  scale.querySelector('[data-comparison-metallicity]')?.remove()
  scale.style.setProperty('--metallicity-position', `${position}%`)
  scale.style.setProperty('--metallicity-label-offset', labelOffset(position))
  const formatPercent = (percent: number): string => `${percent.toLocaleString('en-US', {
    notation: percent > 1000 ? 'compact' : 'standard',
    ...(percent > 1000 ? { maximumSignificantDigits: 3 } : { maximumFractionDigits: percent < 1 ? 2 : 0 }),
    useGrouping: false,
  }).replace('K', 'k')}%`
  const solarPercent = value === null ? null : 10 ** value * 100
  const percentageLabel = solarPercent === null ? '' : `${formatPercent(solarPercent)} of Sun`
  scale.setAttribute('aria-label', `${star.name}${source ? ', unresolved system measurement' : ''}: ${quantity(value, 'dex')}${value === null ? '' : `, ${percentageLabel}`}. Scale −2 to +2 dex: 1%, 10%, 100%, 10 times and 100 times the Sun’s ${ratioName} ratio.${outsideScale ? ' Value is outside the scale; marker shown at the nearest edge.' : ''}`)
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
  let comparisonNote = ''
  if (other) {
    const label = element('metallicity-marker-value')
    label.prepend(document.createTextNode(`${star.name} ${kind ?? ''} · `))
    label.style.maxWidth = `${scale.clientWidth - 16}px`
    const otherLabel = `${other.name} ${otherKind ?? ''}${otherSource ? ' · system' : ''}: ${otherValue === null ? 'unavailable' : `${otherValue > 0 ? '+' : ''}${quantity(otherValue, 'dex', 2)} (${formatPercent(10 ** otherValue * 100)} of Sun)`}`
    scale.setAttribute('aria-label', `${scale.getAttribute('aria-label')} ${otherLabel}.${otherSource ? ` ${otherSource.scope}` : ''}`)
    const marker = document.createElement('span')
    marker.className = 'metallicity-marker metallicity-comparison-marker'
    marker.dataset.comparisonMetallicity = ''
    marker.dataset.objectId = other.id
    const otherPosition = scalePosition(otherValue)
    marker.style.left = `${otherPosition}%`
    marker.style.setProperty('--metallicity-label-offset', labelOffset(otherPosition))
    const caption = document.createElement('span')
    caption.className = 'metallicity-marker-value'
    caption.style.maxWidth = `${scale.clientWidth - 16}px`
    caption.textContent = otherLabel
    marker.append(caption)
    marker.classList.toggle('is-missing', otherValue === null)
    element('metallicity-marker').parentElement!.append(marker)
    if (otherValue === null) comparisonNote += ` ${other.name}: individual metallicity unavailable.`
    else if (otherSource) comparisonNote += ` ${other.name}: unresolved system measurement. ${otherSource.scope}`
    if (otherValue !== null && Math.abs(otherValue) > limit) comparisonNote += ` ${other.name} is outside the displayed range; its marker sits at the nearest edge.`
    if (kind !== otherKind) comparisonNote += ' [Fe/H] and [M/H] describe different abundances; each star’s measurement is labeled on the scale.'
  } else element('metallicity-marker-value').style.removeProperty('max-width')
  let description = `No metallicity measurement is available for ${star.name}. [Fe/H] measures iron relative to hydrogen; [M/H] describes overall metallicity. They are distinct quantities.`
  if (value !== null) {
    description = iron
      ? '[Fe/H] measures iron relative to hydrogen; it does not measure the total abundance of all metals.'
      : '[M/H] measures overall metals relative to hydrogen; it is not an iron-specific [Fe/H] measurement.'
    description += source ? ` Unresolved system value; ${star.name}’s individual metallicity is unavailable. ${source.scope}` : ` ${metallicityContext(star)}`
    if (outsideScale) description += ' Its value is beyond the displayed −2 to +2 dex range; the marker sits at the nearest edge.'
  }
  text('metallicity-description', `${description}${comparisonNote}`)
  syncObjectTypeLayout()
}

/** Pulsar timing companions range from stars to sub-Earth planets; keep each in a readable unit. */
function companionMass(solar: number): string {
  if (solar >= 0.01) return quantity(solar, 'M☉')
  return solar >= 0.1 * JUPITER_MASS_SOLAR ? quantity(solar / JUPITER_MASS_SOLAR, 'M♃', 2) : quantity(solar / EARTH_MASS_SOLAR, 'M⊕', 3)
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
  if (element<HTMLButtonElement>('metallicity-toggle').disabled) return
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
  closeLuminosityCard()
  closeTemperatureCard()
  closeMagnitudeCard()
  closeDistanceCard()
  closeSpectralCard()
  closeConstellationCard()
  closePulsarCard()
  element('metallicity-card').hidden = false
  element('metallicity-toggle').setAttribute('aria-expanded', 'true')
  renderMetallicityCard(star)
  element('metallicity-close').focus({ preventScroll: true })
}

let objectTypeRenderRequest = 0
let objectTypeModule: typeof import('./object-type-info') | undefined

async function renderObjectTypeCard(star: Star): Promise<void> {
  objectTypeStarId = star.id
  const request = ++objectTypeRenderRequest
  if (!objectTypeModule) {
    const result = await loadCardFeature('object-type', 'object type', () => import('./object-type-info'),
      () => request === objectTypeRenderRequest && sideDetailStar(objectTypeStarId)?.id === star.id)
    if (!result) return
    objectTypeModule = result.value
  }
  const { objectTypeIntroduction } = objectTypeModule
  if (request !== objectTypeRenderRequest || element('object-type-card').hidden || sideDetailStar(objectTypeStarId)?.id !== star.id) return
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

function toggleObjectTypeCard(other = false): void {
  const star = other ? starComparison.other : starById(selectedId)
  if (!star) return
  if (!element('object-type-card').hidden && objectTypeStarId === star.id) {
    closeObjectTypeCard(true)
    return
  }
  objectTypeStarId = star.id
  closePlanetCard()
  closeMetallicityCard()
  closeRadiusCard()
  closeMassCard()
  closeLuminosityCard()
  closeTemperatureCard()
  closeMagnitudeCard()
  closeDistanceCard()
  closeSpectralCard()
  closeConstellationCard()
  closePulsarCard()
  element('object-type-card').hidden = false
  element('object-type-toggle').setAttribute('aria-expanded', 'true')
  renderObjectTypeCard(star)
  element('object-type-close').focus({ preventScroll: true })
}

function syncObjectTypeLayout(): void {
  const inspector = element('inspector')
  const selectedCard = element('selected-object-card')
  inspector.style.removeProperty('--object-detail-max-width')
  if (!selectedCard.hidden && !element<HTMLDetailsElement>('object-card-details').open) {
    const inspectorBounds = inspector.getBoundingClientRect()
    const selectedBounds = selectedCard.getBoundingClientRect()
    inspector.style.setProperty('--object-detail-top', `${selectedBounds.bottom - inspectorBounds.top + 12}px`)
    inspector.style.setProperty('--object-detail-left', `${selectedBounds.left - inspectorBounds.left}px`)
  } else if (selectedCard.classList.contains('is-comparing')) {
    const inspectorBounds = inspector.getBoundingClientRect()
    const selectedBounds = selectedCard.getBoundingClientRect()
    const left = selectedBounds.right - inspectorBounds.left + 12
    const remaining = inspectorBounds.width - left - 66
    if (remaining >= 240) {
      inspector.style.setProperty('--object-detail-left', `${left}px`)
      inspector.style.setProperty('--object-detail-max-width', `${remaining}px`)
      inspector.style.removeProperty('--object-detail-top')
    } else {
      const summaryBounds = element('object-card-details').querySelector('summary')!.getBoundingClientRect()
      inspector.style.setProperty('--object-detail-left', `${selectedBounds.left - inspectorBounds.left}px`)
      inspector.style.setProperty('--object-detail-top', `${summaryBounds.bottom - inspectorBounds.top + 12}px`)
    }
  } else {
    inspector.style.removeProperty('--object-detail-top')
    inspector.style.removeProperty('--object-detail-left')
  }
  const motion = element('motion-panel')
  const cards = detailCardNames.map((name) => element(`${name}-card`))
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

function setActiveIndicator(id: 'graph-filter-active' | 'paint-active' | 'motion-active' | 'neighborhood-active' | 'spaceship-active', active: boolean): void {
  const indicator = element(id)
  if (indicator.hidden !== active) return
  indicator.hidden = !active
  syncVisibilityObserverLayout()
}

function syncVisibilityObserverLayout(): void {
  const caption = document.querySelector<HTMLElement>('.visibility-observer')!
  // Active-state buttons beside Info push the caption further left.
  const indicators = document.querySelector<HTMLElement>('.dock-indicators')!
  const indicatorWidth = getComputedStyle(indicators).position === 'absolute' ? indicators.getBoundingClientRect().width : 0
  caption.style.marginRight = indicatorWidth ? `${indicatorWidth + 4}px` : ''
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
  if (!opening || name === 'spaceship') {
    setPanelOpen(name, opening)
    syncPanelLayout()
    return
  }
  for (const candidate of panelNames) {
    if (candidate === name || candidate === 'spaceship') continue
    if (candidate === 'motion' && name !== 'motion' && lockedPanels.has('motion')) continue
    setPanelOpen(candidate, false)
  }
  setPanelOpen(name, true)
  syncPanelLayout()
  const selectedCard = element('selected-object-card')
  const objectDetails = element<HTMLDetailsElement>('object-card-details')
  if (name !== 'motion' && !selectedCard.hidden && objectDetails.open && !cardsHaveClearance(selectedCard, element(`${name}-panel`))) objectDetails.open = false
}

function onSceneInteraction(): void {
  dismissOpenPanel()
  if (touchFirstInput.matches) element<HTMLDetailsElement>('object-card-details').open = false
}

function dismissOpenPanel(): void {
  for (const name of detailCardNames) {
    if (!lockedDetailCards.has(name)) detailCardClosers[name]()
  }
  let changed = false
  for (const name of panelNames) {
    if (!panelIsOpen(name) || name === 'spaceship') continue
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
  syncViewCenterInset()
}

function sceneStatus(message: string | null): void {
  const status = element('scene-status')
  status.textContent = message
  status.hidden = message === null
  sceneBusy = message !== null
  element<HTMLButtonElement>('filter-save').disabled = sceneBusy || !viewer
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

function renderTimeSlider(slider: HTMLInputElement, years: number): string {
  const formatted = formattedSimulationTime(years)
  const position = (years + SIMULATION_YEAR_LIMIT) / (2 * SIMULATION_YEAR_LIMIT) * 100
  slider.value = String(years)
  slider.style.setProperty('--time-fill-start', `${Math.min(50, position)}%`)
  slider.style.setProperty('--time-fill-end', `${Math.max(50, position)}%`)
  slider.setAttribute('aria-valuetext', formatted.accessible)
  return formatted.short
}

function setDistanceYears(years: number): void {
  const clamped = Math.max(-SIMULATION_YEAR_LIMIT, Math.min(SIMULATION_YEAR_LIMIT, years))
  distanceYears = Math.abs(clamped) < 1e-9 ? 0 : clamped
  const formatted = renderTimeSlider(distanceTimeSlider, distanceYears)
  // The card's Now tick already labels the present.
  text('distance-time-value', distanceYears === 0 ? '' : formatted)
  refreshDistanceCard()
}

function renderSimulationTime(): void {
  text('time-value', renderTimeSlider(timeSlider, simulationYears))
  setActiveIndicator('motion-active', simulationYears !== 0 || simulationPlaying)
}

function renderPlaybackState(): void {
  const play = element<HTMLButtonElement>('time-play')
  play.setAttribute('aria-pressed', String(simulationPlaying))
  play.setAttribute('aria-label', simulationPlaying ? 'Pause stellar motion' : 'Play stellar motion')
  icon('time-play-icon', simulationPlaying ? Pause : Play)
  setActiveIndicator('motion-active', simulationYears !== 0 || simulationPlaying)
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
  if (neighborhoodCenter && !simulationPlaying) applyNeighborhood()
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
  if (neighborhoodCenter && !playing) applyNeighborhood()
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
let objectSectionRequest = 0
let systemCardModule: typeof import('./system-card') | undefined
let systemLoad: Promise<void> | undefined
let starInfoModule: typeof import('./star-info') | undefined
let infoContentStarId: string | null = null
let specsContentStar: Star | undefined

function highlightSystemPlanet(...args: Parameters<typeof import('./system-card').highlightSystemPlanet>): void {
  systemCardModule?.highlightSystemPlanet(...args)
}

async function renderActiveObjectSection(): Promise<void> {
  const request = ++objectSectionRequest
  const section = activeObjectSection
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (!star || !element<HTMLDetailsElement>('object-card-details').open) return
  const container = element(`object-${section}`)
  try {
    if (section === 'specs') {
      if (starDetailsLoaded(star)) {
        container.removeAttribute('aria-busy')
        if (specsContentStar !== star) renderSelection()
        return
      }
      container.setAttribute('aria-busy', 'true')
      text('star-notes', 'Loading source notes…')
      await streamWhenLoaded(container, loadStarDetails(star))
    } else if (section === 'info') {
      if (infoContentStarId === star.id) {
        container.removeAttribute('aria-busy')
        return
      }
      container.setAttribute('aria-busy', 'true')
      container.replaceChildren()
      infoContentStarId = null
      await streamWhenLoaded(container, (async () => {
        starInfoModule ??= await import('./star-info')
        await starInfoModule.loadStarInfo(star.id)
        // The hero image streams in with the article instead of appearing afterwards.
        const image = starInfoModule.starInfoForId(star.id)?.image
        if (image) await Object.assign(new Image(), { src: image.src }).decode().catch(() => undefined)
      })())
    } else {
      container.setAttribute('aria-busy', 'true')
      systemLoad ??= import('./system-card')
        .then((module) => { systemCardModule = module })
        .catch((error: unknown) => { systemLoad = undefined; throw error })
      const system = starSystems.get(star.id)
      await streamWhenLoaded(container, Promise.all([systemLoad, loadPlanetarySystem(star.id), system ? loadStellarOrbits(system.id) : Promise.resolve()]))
    }
    if (request !== objectSectionRequest || selectedId !== star.id || container.hidden || !element<HTMLDetailsElement>('object-card-details').open) return
    container.removeAttribute('aria-busy')
    if (section === 'specs') {
      renderSelection()
    } else if (section === 'info') {
      starInfoModule!.renderStarInfo(container, star.id)
      infoContentStarId = star.id
    } else {
      systemCardModule!.renderSystemCard(container, planetarySystemForStar(star.id), starSystems.get(star.id), star, starColorMode, selectSystemPlanet)
      if (activePlanetId && !element('planet-card').hidden) highlightSystemPlanet(container, activePlanetId, activePlanetId)
    }
    syncSelectedObjectLayout()
    syncObjectTypeLayout()
  } catch (error) {
    if (request !== objectSectionRequest || selectedId !== star.id || container.hidden || !element<HTMLDetailsElement>('object-card-details').open) return
    container.removeAttribute('aria-busy')
    const recovery = createLoadError(section === 'specs' ? 'source notes' : section === 'info' ? 'Info' : 'System',
      () => { void renderActiveObjectSection() })
    if (section === 'specs') element('star-notes').replaceChildren(recovery)
    else container.replaceChildren(recovery)
    console.error(`Could not load object ${section}.`, error)
  }
}

function syncObjectInfoAvailability(): void {
  const toggle = element<HTMLButtonElement>('object-info-toggle')
  const available = selectedId !== null && starInfoAvailable(selectedId)
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
  syncObjectTypeLayout()
  void renderActiveObjectSection()
}

for (const section of objectSections) {
  element(`object-${section}-toggle`).addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    const details = element<HTMLDetailsElement>('object-card-details')
    const opening = !details.open || activeObjectSection !== section
    activeObjectSection = section
    details.open = opening
    if (section !== 'system' && !lockedDetailCards.has('planet')) closePlanetCard()
    if (section !== 'specs') {
      closeObjectTypeCard()
      closeMetallicityCard()
      closeRadiusCard()
      closeSpectralCard()
      closeMassCard()
      closeLuminosityCard()
      closeTemperatureCard()
      closeMagnitudeCard()
      closeDistanceCard()
      closeConstellationCard()
      closePulsarCard()
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
  closeLuminosityCard()
  closeTemperatureCard()
  closeMagnitudeCard()
  closeDistanceCard()
  closeConstellationCard()
  closePulsarCard()
  syncObjectSections()
  element('object-system-toggle').focus({ preventScroll: true })
}, { signal: events.signal })
syncObjectSections()

let detailComparisonId: string | undefined
const starComparison = initializeStarComparison({
  context: () => ({ selectedId, unit: distanceUnit, colorMode: starColorMode }),
  star: starById,
  system: (id) => starSystems.get(id),
  select: selectStar,
  detailTarget: (metric) => sideDetailStar(metric === 'object-type' ? objectTypeStarId : constellationStarId)?.id,
  update: (showSpecs) => {
    renderSelection()
    if (!showSpecs) {
      syncObjectTypeLayout()
      return
    }
    activeObjectSection = 'specs'
    element<HTMLDetailsElement>('object-card-details').open = true
    syncObjectSections()
  },
  detailAvailable: (metric) => metric === 'constellation'
    ? Boolean(starComparison.other && constellationCardAvailable(starComparison.other))
    : !element<HTMLButtonElement>(COMPARISON_DETAIL_TOGGLES[metric]!).disabled,
  openDetail: (metric) => {
    if (metric === 'object-type') toggleObjectTypeCard(true)
    else if (metric === 'constellation') void toggleConstellationCard(true)
    else element(COMPARISON_DETAIL_TOGGLES[metric]!).click()
  },
}, events.signal)

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
  selectStar(button.dataset.componentId)
}, { signal: events.signal })

function renderSelection(): void {
  const comparisonId = starComparison.other?.id
  if (comparisonId !== detailComparisonId) {
    // A comparison shows both stars directly; leaving it restores the default references.
    radiusReference = comparisonId ? 'origin' : 'auto'
    detailComparisonId = comparisonId
  }
  starComparison.clearColumns()
  const sun = starById('sun')!
  const reference = starById(referenceId) ?? sun
  const star = stars.find((candidate) => candidate.id === selectedId)
  const magnitudeCard = element('magnitude-card')
  if (magnitudeCard.dataset.objectId !== (star?.id ?? '')) {
    magnitudeCard.dataset.objectId = star?.id ?? ''
    magnitudeCard.dataset.visibilityGuide = magnitudeCard.dataset.defaultVisibilityGuide ?? 'eye'
  }
  text('reference-base', reference.name)
  text('visibility-base', spaceship && spaceshipVisibility ? 'Spaceship' : stars.find((candidate) => candidate.id === observerId)?.name ?? 'Sun')
  const visibilityLock = element('visibility-lock')
  visibilityLock.setAttribute('aria-pressed', String(visibilityLockId !== null))
  visibilityLock.title = visibilityLockId === null ? 'Lock visibility to this object' : 'Unlock visibility'
  visibilityLock.setAttribute('aria-label', visibilityLock.title)
  element('selected-object-card').hidden = !star
  element('star-details').hidden = !star
  syncSelectedObjectLayout()
  syncVisibilityObserverLayout()
  syncViewCenterInset()
  objectList.setSelected(selectedId)
  updateReferenceControl()
  updateObserverControl()
  renderNeighborhood()
  if (!star) {
    starComparison.render()
    if (!lockedDetailCards.has('planet')) closePlanetCard()
    closeObjectTypeCard()
    closeMetallicityCard()
    closeRadiusCard()
    closeMassCard()
    closeLuminosityCard()
    closeTemperatureCard()
    closeMagnitudeCard()
    closeDistanceCard()
    closeSpectralCard()
    closeConstellationCard()
    closePulsarCard()
    element('object-info').replaceChildren()
    infoContentStarId = null
    syncObjectInfoAvailability()
    delete element('inspector').dataset.selectedStar
    element('inspector').style.removeProperty('--selected-star-color')
    text('selection-announcement', 'No object selected.')
    return
  }
  const specs = specValues(star, sun, distanceUnit)
  const displayedDistancePc = selectedDistancePc ?? sunRelativeMetrics(star, reference).distancePc
  const color = starDisplayColor(star, starColorMode).getStyle()
  element('inspector').dataset.selectedStar = star.id
  element('inspector').style.setProperty('--selected-star-color', color)
  const system = starSystems.get(star.id)
  text('star-name', system?.name ?? star.name)
  renderSelectedDistance(displayedDistancePc)
  renderSystemComponents(system, star.id)
  const availablePlanetCount = planetCountForStar(star.id) ?? 0
  const knownPlanetCount = planetCountForStar(star.id) ?? star.known_planets ?? 0
  renderSelectedStarPreview(element<HTMLCanvasElement>('selected-swatch'), star, starColorMode, system?.components.map((component) => component.star), knownPlanetCount > 0)
  if (infoContentStarId !== star.id) {
    element('object-info').replaceChildren()
    infoContentStarId = null
  }
  if (element('object-system').dataset.starId !== star.id) {
    element('object-system').replaceChildren()
    element('object-system').dataset.starId = star.id
  }
  const openPlanet = activePlanetId ? planetModules?.planetDescriptionForId(activePlanetId) : undefined
  const ownsOpenPlanet = openPlanet?.hostStarId === planetHostId(star.id)
  if (!lockedDetailCards.has('planet') && !ownsOpenPlanet) closePlanetCard()
  if (!element('planet-card').hidden && ownsOpenPlanet) highlightSystemPlanet(element('object-system'), activePlanetId, activePlanetId)
  const systemToggle = element<HTMLButtonElement>('object-system-toggle')
  const systemAvailable = Boolean(availablePlanetCount || system)
  systemToggle.disabled = !systemAvailable
  systemToggle.title = systemAvailable ? 'System' : 'System · No data yet'
  systemToggle.setAttribute('aria-label', systemAvailable
    ? `System${system ? `, ${system.components.length} stars` : ''}${availablePlanetCount ? `, ${availablePlanetCount} known planets` : ''}` : systemToggle.title)
  element<HTMLButtonElement>('known-planets').disabled = !availablePlanetCount
  if (!systemAvailable && activeObjectSection === 'system') {
    activeObjectSection = 'specs'
    syncObjectSections()
  }
  syncObjectInfoAvailability()
  if (knownPlanetCount > 0) element<HTMLCanvasElement>('selected-swatch').title = `${knownPlanetCount} known planets · illustrative orbit`
  for (const [id, value] of Object.entries(specs)) if (!SPECS_OWNED_BY_SELECTION.has(id)) showSpec(id, value)
  text('distance-value', specs['distance-toggle']!.text.split(' ')[0]!)
  text('distance-unit', ` ${distanceUnit}`)
  element('distance-toggle').setAttribute('aria-label', `Visualize distance and direction of ${star.name}`)
  refreshDistanceCard()
  element('object-type-toggle').setAttribute('aria-label', `Learn about ${describeObject(star).toLowerCase()}`)
  if (!element('object-type-card').hidden) renderObjectTypeCard(sideDetailStar(objectTypeStarId) ?? star)
  element('constellation-row').hidden = star.id === 'sun'
  const constellationAvailable = constellationCardAvailable(star)
  element<HTMLButtonElement>('constellation-toggle').disabled = !constellationAvailable
  element('constellation-toggle').title = constellationAvailable ? `Show ${star.constellation}` : 'Constellation chart not available yet'
  element('constellation-toggle').setAttribute('aria-label', constellationAvailable ? `Explore ${star.constellation} constellation` : `${star.constellation ?? 'Constellation'}: chart not available yet`)
  const constellationTarget = sideDetailStar(constellationStarId) ?? star
  if (!constellationCardAvailable(constellationTarget)) closeConstellationCard()
  else if (!element('constellation-card').hidden) renderConstellationCard(constellationTarget)
  text('known-planets', String(knownPlanetCount))
  element('known-planets').title = 'Show confirmed planets in this system from the adopted NASA Exoplanet Archive snapshot.'
  element('known-planets').setAttribute('aria-label', `Show system with ${knownPlanetCount} known planets`)
  const subtypes = star.subtypes ?? []
  const subtypeDetails = element<HTMLDetailsElement>('object-subtypes-row')
  subtypeDetails.hidden = subtypes.length === 0
  // During a comparison, the comparison column closes these details only when both lists are empty.
  if (!subtypes.length && !starComparison.other) subtypeDetails.open = false
  text('object-subtypes-count', String(subtypes.length))
  element('object-subtypes').replaceChildren(...subtypes.map((subtype) => {
    const item = document.createElement('li')
    const label = document.createElement('strong')
    label.textContent = subtype
    const description = document.createElement('p')
    description.textContent = objectSubtypeDescription(subtype)
    item.append(label, description)
    return item
  }))
  const compact = star.compact
  const compactObject = isCompactObject(star)
  const nebula = star.nebula
  const nebulaObject = isNebulaObject(star)
  const molecularCloud = star.molecular_cloud
  const molecularCloudObject = isMolecularCloudObject(star)
  const bubble = star.bubble
  const bubbleObject = isBubbleObject(star)
  element('known-planets-row').hidden = knownPlanetCount === 0 || nebulaObject || molecularCloudObject || bubbleObject
  element('object-subtypes-empty-row').hidden = subtypes.length > 0 || nebulaObject || molecularCloudObject || bubbleObject
  const stellarPropertiesHidden = compactObject || nebulaObject || molecularCloudObject || bubbleObject
  for (const row of document.querySelectorAll<HTMLElement>('.stellar-property')) row.hidden = stellarPropertiesHidden
  for (const row of document.querySelectorAll<HTMLElement>('.compact-property')) row.hidden = !compactObject
  for (const row of document.querySelectorAll<HTMLElement>('.nebula-property')) row.hidden = !nebulaObject
  for (const row of document.querySelectorAll<HTMLElement>('.molecular-cloud-property')) row.hidden = !molecularCloudObject
  for (const row of document.querySelectorAll<HTMLElement>('.bubble-property')) row.hidden = !bubbleObject
  element('mass-row').hidden = nebulaObject || bubbleObject
  for (const row of document.querySelectorAll<HTMLElement>('.pulsar-property')) row.hidden = star.type !== 'pulsar'
  for (const row of document.querySelectorAll<HTMLElement>('.rotation-property')) row.hidden = star.type === 'black_hole' || !compactObject
  for (const row of document.querySelectorAll<HTMLElement>('.orbit-property')) {
    row.hidden = !compact || (compact.orbital_period_days === null && compact.companion === null)
      || (row.classList.contains('pulsar-property') && star.type !== 'pulsar')
  }
  element<HTMLButtonElement>('spectral-toggle').disabled = star.spectral_type === null || !hrCardAvailable(star)
  element('spectral-toggle').setAttribute('aria-label', `Explore spectral type of ${star.name}`)
  if (element<HTMLButtonElement>('spectral-toggle').disabled) closeSpectralCard()
  else if (!element('spectral-card').hidden) renderSpectralCard(star)
  sourceCardTooltip('temperature', star, stellarPropertiesHidden)
  const temperatureRange = star.temperature_k === null ? star.stellar_observations?.temperature_range : undefined
  const atmosphereTemperature = star.temperature_k === null ? star.stellar_observations?.atmosphere_temperature : undefined
  if ((temperatureRange || atmosphereTemperature) && !stellarPropertiesHidden) {
    // The row tooltip carries the model or atmosphere scope instead of a native title.
    element('temperature').removeAttribute('title')
    element('temperature-source-tooltip').hidden = false
    element('temperature-source-tooltip').toggleAttribute('data-model-range', Boolean(temperatureRange))
    text('temperature-source-tooltip', temperatureRange?.summary ?? atmosphereTemperature!.scope)
    element('temperature-row').tabIndex = 0
    element('temperature-row').setAttribute('aria-describedby', 'temperature-source-tooltip')
  }
  element<HTMLButtonElement>('temperature-toggle').disabled = !temperatureCardAvailable(star) || stellarPropertiesHidden
  element('temperature-toggle').setAttribute('aria-label', `Explore temperature of ${star.name}`)
  if (element<HTMLButtonElement>('temperature-toggle').disabled) closeTemperatureCard()
  else if (!element('temperature-card').hidden) renderTemperatureCard(star)
  sourceCardTooltip('luminosity', star, stellarPropertiesHidden)
  element<HTMLButtonElement>('luminosity-toggle').disabled = !luminosityCardAvailable(star) || stellarPropertiesHidden
  element('luminosity-toggle').setAttribute('aria-label', `Explore bolometric luminosity of ${star.name}`)
  if (element<HTMLButtonElement>('luminosity-toggle').disabled) closeLuminosityCard()
  else if (!element('luminosity-card').hidden) renderLuminosityCard(star)
  const massRange = star.mass_solar === null ? star.stellar_observations?.mass_range : undefined
  if (massRange) element('mass').setAttribute('aria-label', `Model mass: ${massRange.min_jupiter} to ${massRange.max_jupiter} Jupiter masses, assuming an age of ${massRange.assumed_age_min_gyr} to ${massRange.assumed_age_max_gyr} billion years.`)
  else element('mass').removeAttribute('aria-label')
  element<HTMLButtonElement>('mass-toggle').disabled = star.mass_solar === null || !massCardAvailable(star)
  element('mass-toggle').setAttribute('aria-label', `Explore mass of ${star.name}`)
  if (element<HTMLButtonElement>('mass-toggle').disabled) closeMassCard()
  else if (!element('mass-card').hidden) renderMassCard(star)
  sourceCardTooltip('radius', star, stellarPropertiesHidden)
  const radiusRange = star.radius_solar === null ? star.stellar_observations?.radius_range : undefined
  if (radiusRange && !stellarPropertiesHidden) {
    element('radius').removeAttribute('title')
    element('radius-source-tooltip').hidden = false
    element('radius-source-tooltip').setAttribute('data-model-range', '')
    text('radius-source-tooltip', radiusRange.summary)
    element('radius-row').tabIndex = 0
    element('radius-row').setAttribute('aria-describedby', 'radius-source-tooltip')
  }
  element<HTMLButtonElement>('radius-toggle').disabled = star.radius_solar === null || stellarPropertiesHidden
  element('radius-toggle').setAttribute('aria-label', `Compare radius of ${star.name} with origin`)
  if (element<HTMLButtonElement>('radius-toggle').disabled) closeRadiusCard()
  else if (!element('radius-card').hidden) renderRadiusCard(star)
  element<HTMLButtonElement>('metallicity-toggle').disabled = catalogMeasurement(star, 'metallicity_dex') === null || stellarPropertiesHidden
  element('metallicity-toggle').setAttribute('aria-label', `Explain metallicity of ${star.name}`)
  if (element<HTMLButtonElement>('metallicity-toggle').disabled) closeMetallicityCard()
  else if (!element('metallicity-card').hidden) renderMetallicityCard(star)
  if (!compact || !pulsarDiagramAvailable(star)) closePulsarCard()
  else if (!element('pulsar-card').hidden) void renderPulsarCard(star)
  if (compact) {
    text('compact-status', compact.confidence === 'confirmed' ? 'Confirmed' : 'Candidate')
    const rotation = preciseMeasurement(compact.rotation_period_s, compact.rotation_period_error_s, 's')
    text('rotation-period', compact.rotation_period_s === null ? rotation : `${rotation} (${(1 / compact.rotation_period_s).toLocaleString('en-US', { maximumSignificantDigits: 6 })} Hz)`)
    element<HTMLButtonElement>('pulsar-toggle').disabled = !pulsarDiagramAvailable(star)
    element('pulsar-toggle').setAttribute('aria-label', `Explore spin and slowdown of ${star.name}`)
    text('pulsar-classes', compact.pulsar_classes.join(' · ') || MISSING_VALUE)
    text('period-derivative', preciseMeasurement(compact.period_derivative, compact.period_derivative_error, 's/s'))
    text('radio-luminosity', quantity(compact.radio_luminosity_1400_mjy_kpc2, 'mJy kpc²'))
    text('dispersion-measure', quantity(compact.dispersion_measure_pc_cm3, 'pc cm⁻³'))
    text('transverse-speed', quantity(compact.transverse_velocity_kms, 'km/s', 0))
    text('glitch-count', compact.glitch_count === null ? MISSING_VALUE : String(compact.glitch_count))
    text('pulsar-associations', compact.associations.join('; ') || MISSING_VALUE)
    text('orbital-eccentricity', quantity(compact.eccentricity, '', 6))
    text('companion-mass-limit', compact.companion_min_mass_solar === null ? MISSING_VALUE
      : `≥ ${companionMass(compact.companion_min_mass_solar)} · median ${companionMass(compact.companion_median_mass_solar!)}`)
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
  const infrared = star.stellar_observations?.infrared_photometry
  element('infrared-magnitude-row').hidden = !infrared || stellarPropertiesHidden
  // Leave the hidden row empty, so a comparison column can mark the missing value explicitly.
  if (!infrared) text('infrared-magnitude', '')
  element<HTMLButtonElement>('magnitude-toggle').disabled = !magnitudeCardAvailable(star) || stellarPropertiesHidden
  element('magnitude-toggle').setAttribute('aria-label', `Explore absolute and apparent magnitude of ${star.name}`)
  if (element<HTMLButtonElement>('magnitude-toggle').disabled) closeMagnitudeCard()
  else if (!element('magnitude-card').hidden) renderMagnitudeCard(star)
  const designations = objectDesignations(star).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  element('designations-row').hidden = designations.length === 0
  element('designations-empty-row').hidden = designations.length > 0
  text('designations-empty', MISSING_VALUE)
  if (designations.length === 0 && !starComparison.other) element<HTMLDetailsElement>('designations-row').open = false
  element('object-designations').replaceChildren(...designations.map((name) => {
    const item = document.createElement('li')
    item.textContent = name
    return item
  }))
  const sourceNotes = new Set(['spectral_type', 'temperature_k', 'luminosity_solar', 'mass_solar', 'radius_solar',
    'metallicity_dex', 'age_gyr', 'absolute_mag', 'vx_kms', 'vy_kms', 'vz_kms'].map((field) =>
    catalogSourceFor(star, field as Parameters<typeof catalogSourceFor>[1])).filter((source) => source !== undefined))
  const rvSource = radialVelocitySource(star)
  if (rvSource) sourceNotes.add(rvSource)
  const observations = star.stellar_observations
  const observationNotes = new Set([observations?.mass_range, observations?.temperature_range, observations?.radius_range, observations?.infrared_photometry, observations?.radial_velocity_review, observations?.atmosphere_temperature]
    .filter((observation) => observation !== undefined)
    .map((observation) => `${'scope' in observation ? observation.scope : observation.reason} ${observation.reference}: ${observation.source_url}`))
  text('star-notes', starDetailsLoaded(star) ? [star.notes, ...observationNotes, ...[...sourceNotes].map((source) => `${source.scope} ${source.record.notes}`)]
    .filter(Boolean).join('\n\n') || 'No source notes available.' : 'Loading source notes…')
  specsContentStar = starDetailsLoaded(star) ? star : undefined
  starComparison.render()
  const referenceName = reference.id === 'sun' ? 'the Sun' : reference.name
  text('selection-announcement', `${star.name}, ${formatDistance(displayedDistancePc, distanceUnit)} from ${referenceName}.`)
  void renderActiveObjectSection()
}

function baseObjectListFilter(selected = selectedId): ObjectListFilter {
  const observer = hideFainterObjects ? starById(observerId) : undefined
  // Brightness is seen from the observer, while list distances are from the reference.
  const brightEnough = (star: Star) => !observer || mapVisibilityTier(star, observer, selected, apparentVisualMagnitude(star.absolute_mag, Math.hypot(
    star.x_pc - observer.x_pc,
    star.y_pc - observer.y_pc,
    star.z_pc - observer.z_pc,
  )) ?? Infinity, magnitudeLimit) !== 'background'
  const neighborhood = neighborhoodFilter
  return (star, distancePc) => isObjectMapVisible(star, visibleKeys, selected, observerId, distancePc * LIGHT_YEARS_PER_PARSEC, objectDistanceLimitLy) && brightEnough(star)
    && (!neighborhood || neighborhood(star, distancePc))
}

function currentNeighborhoodBounds() {
  return neighborhoodBounds(neighborhoodRadiusLy, neighborhoodCenter?.id === 'sun' ? neighborhoodBirthYear : null, new Date().getFullYear())
}

function setNeighborhoodCenter(center: Star | null): void {
  neighborhoodCenter = center
  applyNeighborhood()
}

function viewerNeighborhood(): Parameters<StarViewer['setNeighborhood']>[0] {
  if (!neighborhoodCenter) return null
  const { innerLy, outerLy, sphereLy } = currentNeighborhoodBounds()
  return { centerId: neighborhoodCenter.id, innerPc: innerLy / LIGHT_YEARS_PER_PARSEC, outerPc: outerLy / LIGHT_YEARS_PER_PARSEC, spherePc: sphereLy / LIGHT_YEARS_PER_PARSEC }
}

/** The object's map position at the simulated time, as the 3D view moves it. */
function simulatedPosition(star: Star): ReturnType<typeof galacticToWorld> {
  const position = galacticToWorld(star)
  if (simulationYears === 0) return position
  const motions = neighborhoodMotions[motionFrame]
  let motion = motions.get(star)
  if (motion === undefined) motions.set(star, motion = displayMotionForStar(star, motionFrame)?.velocity.multiplyScalar(motionTravelDistancePc(1, 1)) ?? null)
  return motion ? position.addScaledVector(motion, simulationYears) : position
}

/**
 * The 3D view tracks membership as objects move; the lists, Graphs and Paint follow the simulated time
 * whenever playback is paused. The center itself always stays visible.
 */
function applyNeighborhood(): void {
  const center = neighborhoodCenter
  const { innerLy, outerLy } = currentNeighborhoodBounds()
  const centerPosition = center && simulatedPosition(center)
  neighborhoodFilter = center && ((star) => {
    if (star.id === center.id) return true
    const distanceLy = simulatedPosition(star).distanceTo(centerPosition!) * LIGHT_YEARS_PER_PARSEC
    return distanceLy >= innerLy && distanceLy <= outerLy
  })
  viewer?.setNeighborhood(viewerNeighborhood())
  setActiveIndicator('neighborhood-active', !!center)
  updateObjectListFilter()
  renderNeighborhood()
}

/**
 * The smallest larger nearest-objects catalog expected to reach the distance, else the largest. These catalogs
 * fill a sphere around the Sun, so their reach grows with the cube root of their size.
 */
function catalogReaching(distanceLy: number): typeof sliderCatalogs[number] | undefined {
  const active = sliderCatalogs.find((catalog) => catalog.manifest.id === activeCatalogId)
  if (!active) return undefined
  const larger = sliderCatalogs.filter((catalog) => catalog.manifest.objectCount > active.manifest.objectCount)
  return larger.find((catalog) => catalogReachLy * Math.cbrt(catalog.manifest.objectCount / active.manifest.objectCount) >= distanceLy) ?? larger.at(-1)
}

/** The center a new neighborhood starts from. */
function defaultNeighborhoodCenter(): Star | null {
  return starById(selectedId) ?? starById(referenceId) ?? null
}

function renderNeighborhood(): void {
  if (element('neighborhood-panel').hidden) return
  const center = neighborhoodCenter
  element<HTMLButtonElement>('neighborhood-clear').disabled = !center
  text('neighborhood-center-name', center?.name ?? 'Off')
  element('neighborhood-center-swatch').hidden = !center
  if (center) element('neighborhood-center-swatch').style.background = starDisplayColor(center, starColorMode).getStyle()
  // While off, the button starts a neighborhood again.
  const target = center ? starById(selectedId) : defaultNeighborhoodCenter()
  const recenter = element<HTMLButtonElement>('neighborhood-recenter')
  recenter.hidden = !target || target.id === center?.id
  if (target) {
    text('neighborhood-recenter-name', target.name)
    element('neighborhood-recenter-swatch').style.background = starDisplayColor(target, starColorMode).getStyle()
  }
  const sun = center?.id === 'sun'
  const birthYear = sun ? neighborhoodBirthYear : null
  const { outerLy, sphereLy } = currentNeighborhoodBounds()
  const radius = element<HTMLInputElement>('neighborhood-radius')
  radius.disabled = birthYear !== null
  radius.value = String(Math.min(NEIGHBORHOOD_RADIUS_LY.max, birthYear === null ? neighborhoodRadiusLy : sphereLy))
  const radiusText = birthYear === null ? `${neighborhoodRadiusLy} ly` : `${sphereLy} ± ${outerLy - sphereLy} ly`
  radius.setAttribute('aria-valuetext', radiusText.replace('ly', 'light-years'))
  text('neighborhood-radius-value', radiusText)
  element('neighborhood-birth').hidden = !sun
  element('neighborhood-birth-toggle').setAttribute('aria-pressed', String(birthYear !== null))
  element('neighborhood-birth-label').title = `Light now arriving from these stars set out around ${birthYear ?? 'your birth year'}.`
  // The catalog's coverage and the Filter's visibility distance from the origin still apply.
  const reference = starById(referenceId)
  const reach = (from: Star) => !center ? 0 : Math.hypot(center.x_pc - from.x_pc, center.y_pc - from.y_pc, center.z_pc - from.z_pc) * LIGHT_YEARS_PER_PARSEC + outerLy
  const sunReach = reach(starById('sun')!)
  const larger = sunReach > catalogReachLy ? catalogReaching(sunReach) : undefined
  const catalogButton = element<HTMLButtonElement>('neighborhood-catalog')
  catalogButton.hidden = !larger
  catalogButton.dataset.catalogId = larger?.manifest.id ?? ''
  catalogButton.textContent = larger ? `Load ${larger.manifest.label}` : ''
  const notes = [
    sunReach > catalogReachLy ? `The chosen catalog reaches about ${Math.round(catalogReachLy)} ly from the Sun.` : '',
    reference && reach(reference) > objectDistanceLimitLy ? `Filter hides objects beyond ${objectDistanceLimitLy} ly from ${reference.id === 'sun' ? 'the Sun' : reference.name}.` : '',
  ].filter(Boolean)
  element('neighborhood-limit-note').hidden = !notes.length
  element('neighborhood-limit-note').textContent = notes.join(' ')
}

function spaceshipTopSpeedPc(): number {
  return SPACESHIP_SPEEDS_LY_PER_S[spaceshipSpeedLevel]! / LIGHT_YEARS_PER_PARSEC
}

/** Starts a ship where the camera is, facing where it looks. */
function launchSpaceship(): void {
  if (!viewer || sceneBusy) return
  if (observerView) setObserverViewAnchor(null)
  const { position, target } = viewer.getViewState()
  spaceship = createSpaceship(position, target)
  applySpaceship()
}

function applySpaceship(): void {
  viewer?.setSpaceship(spaceship, spaceship ? spaceshipLabels : 'all', spaceshipVisibility)
  applySpaceshipInput()
  renderSpaceship()
  updateObserverControl()
}

/** Leaving parks the ship in view; boarding flies the camera back into it. */
function setSpaceshipPiloting(piloting: boolean): void {
  if (!spaceship) return
  spaceship.piloting = piloting
  spaceshipKeys.clear()
  setSpaceshipThrottle(0)
  applySpaceship()
}

function applySpaceshipInput(): void {
  const held = (key: SpaceshipKey) => spaceshipKeys.has(key) ? 1 : 0
  const piloting = spaceship?.piloting === true
  viewer?.setSpaceshipInput({
    forward: piloting ? spaceshipThrottle || held('w') - held('s') : 0,
    strafe: piloting ? held('d') - held('a') : 0,
    yaw: piloting ? held('q') - held('e') : 0,
    topSpeedPc: spaceshipTopSpeedPc(),
  })
  for (const keycap of element('spaceship-keys').querySelectorAll<HTMLElement>('[data-key]')) {
    keycap.classList.toggle('is-pressed', spaceshipKeys.has(keycap.dataset.key as SpaceshipKey))
  }
}

function setSpaceshipThrottle(value: number): void {
  spaceshipThrottle = Math.max(-1, Math.min(1, value))
  const throttle = element('spaceship-throttle')
  throttle.style.setProperty('--throttle', String(spaceshipThrottle))
  throttle.setAttribute('aria-valuenow', spaceshipThrottle.toFixed(2))
  applySpaceshipInput()
}

function formatSpeed(pcPerSecond: number): string {
  const value = pcPerSecond * (distanceUnit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1)
  return `${value.toLocaleString('en-US', { maximumSignificantDigits: 3 })} ${distanceUnit}/s`
}

function renderSpaceship(): void {
  const cardOpen = panelIsOpen('spaceship')
  setActiveIndicator('spaceship-active', spaceship !== null && !cardOpen)
  // The stats tile rests while the ship is parked and returns on boarding.
  element('spaceship-hud').hidden = spaceship?.piloting !== true
  element('spaceship-throttle').hidden = !touchFirstInput.matches || spaceship?.piloting !== true
  element<HTMLButtonElement>('spaceship-clear').disabled = !spaceship
  element<HTMLButtonElement>('spaceship-exit').disabled = !spaceship
  const parked = spaceship?.piloting === false
  text('spaceship-exit-label', parked ? 'Board ship' : 'Exit ship')
  icon('spaceship-exit-icon', parked ? LogIn : LogOut)
  text('spaceship-speed-level-value', formatSpeed(spaceshipTopSpeedPc()))
  element('spaceship-visibility-selected').setAttribute('aria-pressed', String(!spaceshipVisibility))
  element('spaceship-visibility-ship').setAttribute('aria-pressed', String(spaceshipVisibility))
  renderSpaceshipTelemetry(true)
}

/** The navball follows every frame; numbers update ten times a second so they stay readable. */
function renderSpaceshipTelemetry(force = false): void {
  const telemetry = spaceshipTelemetry
  if (!telemetry || !spaceship || element('spaceship-hud').hidden) return
  updateSpaceshipGizmo(telemetry.orientation, telemetry.selectedDirection)
  const now = performance.now()
  if (!force && telemetry.speedPc > 0 && now - spaceshipStatsTime < 100) return
  spaceshipStatsTime = now
  text('spaceship-speed', `${formatDistance(telemetry.speedPc, distanceUnit)}/s`)
  element('spaceship-speed-row').style.setProperty('--spaceship-speed', String(Math.min(1, telemetry.speedPc / spaceshipTopSpeedPc())))
  text('spaceship-target-name', starById(selectedId)?.name ?? 'No selection')
  text('spaceship-target-distance', telemetry.selectedDistancePc === null ? '–' : formatDistance(telemetry.selectedDistancePc, distanceUnit))
  text('spaceship-travelled', formatDistance(telemetry.travelledPc, distanceUnit))
}

/** The map filter narrowed by any Graphs selection, as the 3D view applies it. */
function objectListFilter(selected = selectedId): ObjectListFilter {
  const base = baseObjectListFilter(selected), graph = graphFilter
  return graph ? (star, distancePc) => base(star, distancePc) && graph(star, distancePc) : base
}

function setGraphFilter(filter: ObjectListFilter | null): void {
  graphFilter = filter
  viewer?.setObjectPredicate(filter)
  setActiveIndicator('graph-filter-active', !!filter)
  updateObjectListFilter()
}

function updateObjectListFilter(): void {
  objectList.setFilter(objectListFilter())
  refitPaint()
  graphs?.refresh()
}

function selectStar(id: string | null, recordHistory = true): void {
  if (id !== null && !starIndex.has(id)) return
  if (starComparison.consumeSelection(id)) return
  constellationSelectionRequest++
  if (recordHistory) selectionHistory.record(id)
  selectedDistancePc = null
  selectedId = id
  if (id !== null) lastSelectedId = id
  if (id !== null && !observerView && visibilityLockId === null) observerId = id
  updateObjectListFilter()
  renderSelection()
  viewer?.select(id)
  renderFollowState()
  updateSelectionHistoryControls()
  if (releaseConstellationSystems()) void switchCatalog(activeCatalogId, true)
}

/** Forgets chart-selected systems that no selection, comparison, anchor or origin still uses. */
function releaseConstellationSystems(): boolean {
  const used = new Set([selectedId, referenceId, visibilityLockId, observerViewAnchorId, starComparison.other?.id])
  let released = false
  for (const [id, system] of constellationSelectedSystems) {
    if (system.some((star) => used.has(star.id))) continue
    constellationSelectedSystems.delete(id)
    released = true
  }
  return released
}

function navigateSelectionHistory(direction: 'back' | 'forward'): void {
  if (starComparison.waiting) {
    const id = direction === 'back' ? selectionHistory.peekBack(selectedStarAvailable) : selectionHistory.peekForward(selectedStarAvailable)
    if (id !== null) selectStar(id)
    return
  }
  const id = selectionHistory[direction](selectedStarAvailable)
  if (id !== null) selectStar(id, false)
}

function setSelectedAsOrigin(): void {
  if (selectedId !== null) setOrigin(selectedId)
}

function setOrigin(id: string): void {
  if (sceneBusy || id === referenceId || !starIndex.has(id)) return
  referenceId = id
  selectedDistancePc = null
  objectList.setReference(referenceId, objectListFilter())
  refitPaint()
  graphs?.refresh()
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
    if (!starIndex.has(anchorId)) return
    observerView = viewer.setObserverView(true, anchorId)
    observerViewAnchorId = observerView ? anchorId : null
    if (observerView) observerId = anchorId
  } else {
    observerView = viewer.setObserverView(false)
    observerViewAnchorId = null
    const restoredId = visibilityLockId ?? selectedId
    if (restoredId !== null) observerId = restoredId
    viewer.setVisibility(observerId, magnitudeLimit, hideFainterObjects)
  }
  updateObjectListFilter()
  renderSelection()
  renderFollowState()
  updateObserverControl()
}

function toggleVisibilityLock(): void {
  if (visibilityLockId === null) visibilityLockId = observerId
  else {
    visibilityLockId = null
    if (!observerView && starIndex.has(lastSelectedId)) observerId = lastSelectedId
    viewer?.setVisibility(observerId, magnitudeLimit, hideFainterObjects)
    updateObjectListFilter()
  }
  viewer?.setVisibilityLocked(visibilityLockId !== null)
  renderSelection()
}

function rollObserverView(direction: 'counterclockwise' | 'center' | 'clockwise'): void {
  viewer?.rollObserverView(direction)
}

function renderDistances(): void {
  element<HTMLInputElement>(`unit-${distanceUnit}`).checked = true
  renderGridScale(currentGridScale)
  objectList.setDistanceUnit(distanceUnit)
  graphs?.refresh()
  if (viewerDistancePc !== null) renderViewerDistance(viewerDistancePc)
  renderSelection()
}

async function switchCatalog(id: string, refresh = false): Promise<void> {
  if (id === activeCatalogId && !refresh) return
  const definition = catalogs.find((catalog) => catalog.manifest.id === id)
  if (!definition) return
  const request = ++catalogRequest
  sceneStatus(`Loading ${definition.manifest.label}...`)
  let nextStars: Star[], reachLy: number
  try {
    const loadOverlay = (types: readonly FilterKey[], load: () => Promise<Star[]>) =>
      types.some((type) => visibleKeys.has(type)) ? load() : Promise.resolve([])
    const loadAdditive = (catalogId: string, enabled: boolean) => enabled && id !== catalogId
      ? catalogs.find((catalog) => catalog.manifest.id === catalogId)!.load() : Promise.resolve([])
    const [selectedCatalog, westernConstellationCatalog, notableDistantCatalog, compactObjects, nebulae, molecularClouds, bubbles] = await Promise.all([
      definition.load(),
      loadAdditive(WESTERN_CONSTELLATION_CATALOG_ID, showWesternConstellationStars),
      // Pulsar companions live here, so visible pulsars bring their systems along.
      loadAdditive(NOTABLE_DISTANT_CATALOG_ID, showNotableDistantStars || visibleKeys.has('pulsar')),
      loadOverlay(COMPACT_OBJECT_TYPES, loadCompactRemnants),
      loadOverlay(NEBULA_OBJECT_TYPES, loadNebulae),
      loadOverlay(MOLECULAR_CLOUD_OBJECT_TYPES, loadMolecularClouds),
      loadOverlay(BUBBLE_OBJECT_TYPES, loadBubbles),
    ])
    reachLy = selectedCatalog.reduce((farthest, star) => Math.max(farthest, Math.hypot(star.x_pc, star.y_pc, star.z_pc)), 0) * LIGHT_YEARS_PER_PARSEC
    const withConstellationStars = mergeCatalogStars(mergeCatalogStars(selectedCatalog, westernConstellationCatalog), notableDistantCatalog)
    nextStars = [...withConstellationStars, ...compactObjects, ...nebulae, ...molecularClouds, ...bubbles]
    nextStars = mergeCatalogStars(nextStars, [...constellationSelectedSystems.values()].flat())
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
  // Source details hydrate only the current scene, never the memoized map payload.
  stars = nextStars.map((star) => ({ ...star }))
  starIndex = new Map(stars.map((star) => [star.id, star]))
  catalogReachLy = reachLy
  constellationBrowser?.refresh()
  starSystems = indexStarSystems(stars)
  activeCatalogId = id
  selectedDistancePc = null
  selectedId = retained.selectedId
  observerId = retained.observerId
  if (visibilityLockId !== null && !starIndex.has(visibilityLockId)) visibilityLockId = null
  if (observerViewAnchorId && !starIndex.has(observerViewAnchorId)) {
    observerView = false
    observerViewAnchorId = null
  }
  referenceId = starIndex.has(referenceId) ? referenceId : 'sun'
  text('catalog-epoch', `J${definition.manifest.epoch.toFixed(1)}`)
  renderCatalogRange(id)
  element('catalog-range').title = `${definition.manifest.description} ${definition.manifest.snapshot}`
  element<HTMLInputElement>('object-search').value = ''
  objectList.setStars(stars, distanceUnit, selectedId, referenceId, objectListFilter())
  graphs?.refresh()
  renderDistances()
  try {
    viewer = createStarViewer(element('scene'), stars, {
      onInteraction: onSceneInteraction,
      onSelect: selectStar,
      onHover: (id) => starComparison.hover(id),
      onContextMenu: openSceneContextMenu,
      onSelectedDistance(distancePc) {
        selectedDistancePc = distancePc
        if (distancePc !== null && selectedId !== null) renderSelectedDistance(distancePc)
      },
      onViewerDistance: renderViewerDistance,
      onGridScale: renderGridScale,
      onSpaceship(telemetry) {
        spaceshipTelemetry = telemetry
        renderSpaceshipTelemetry()
      },
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
  viewer.setVisibilityLocked(visibilityLockId !== null)
  syncViewCenterInset()
  viewer.select(selectedId, false)
  viewer.setVisibility(observerId, magnitudeLimit, hideFainterObjects)
  viewer.setObjectDistanceLimit(objectDistanceLimitLy)
  viewer.setObjectFilter([...visibleKeys])
  viewer.setObjectPredicate(graphFilter)
  viewer.setNeighborhood(viewerNeighborhood())
  viewer.setLabelLimit(labelLimit)
  viewer.setMotionArrowsVisible(motionArrowsVisible)
  viewer.setMotionFrame(motionFrame)
  viewer.setMotionYears(motionYears)
  viewer.setFollowSelection(followSelection)
  viewer.setSimulationYears(simulationYears)
  viewer.setSimulationPlaying(simulationPlaying)
  viewer.setPowerSavingMode(powerSavingMode)
  viewer.setGridVisible(gridVisible)
  viewer.setSkyGrid(skyGridMode)
  viewer.setStarPaintZoomShrink(paintZoomShrink)
  paintVisible(true)
  // Filtering changes the visible objects, not the camera, including the initial overview.
  if (retainedView) {
    viewer.setViewState({ ...retainedView, home: false })
  }
  observerView = viewer.setObserverView(observerView, observerViewAnchorId ?? undefined, retainedView?.observerRollRadians)
  viewer.setObserverTelescope(Boolean(retainedView?.observerTelescope), false)
  if (!observerView) observerViewAnchorId = null
  if (spaceship) applySpaceship()
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
    // Pulsars also load their companions from the notable distant catalog.
    || (!showNotableDistantStars && previous.has('pulsar') !== visibleKeys.has('pulsar'))
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
element('catalog-range-markers').replaceChildren(...sliderCatalogs.map((catalog, index) => {
  const marker = document.createElement('span')
  marker.textContent = String(catalog.manifest.objectCount)
  marker.style.left = `${index / Math.max(1, sliderCatalogs.length - 1) * 100}%`
  return marker
}))

function previewCatalogRange(index: number): void {
  const manifest = sliderCatalogs[index]?.manifest
  if (!manifest) return
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
    updateBrowserDataSize()
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
  remove.textContent = `Delete '${savedView.name}'`
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

function closeSceneContextMenu(): void {
  element('scene-context-menu').hidden = true
  element('scene-context-backdrop').hidden = true
  element('app').inert = false
  sceneMenuTargetId = sceneMenuPointerId = null
  highlightSceneMenuItem(null)
}

function openSceneContextMenu(id: string, x: number, y: number, held: PointerEvent | null): boolean {
  const target = starById(id)
  const selected = starById(selectedId)
  if (!target || !selected) return false
  const distancePc = id === selected.id ? null : viewer?.distanceBetween(id, selected.id) ?? null
  const compare = element('scene-context-compare')
  const origin = element('scene-context-origin')
  compare.hidden = !starComparison.canCompare(id)
  origin.hidden = sceneBusy || id === referenceId
  element('scene-context-distance').hidden = distancePc === null
  if (compare.hidden && origin.hidden && distancePc === null) return false
  const menu = element('scene-context-menu')
  for (const object of menu.querySelectorAll<HTMLElement>('[data-scene-context-object]')) {
    const star = object.dataset.sceneContextObject === 'target' ? target : selected
    object.querySelector<HTMLElement>('.star-swatch')!.style.background = starDisplayColor(star, starColorMode).getStyle()
    object.lastElementChild!.textContent = star.name
  }
  if (distancePc !== null) text('scene-context-distance-value', formatDistance(distancePc, distanceUnit))
  sceneMenuTargetId = id
  sceneMenuPointerId = held?.pointerId ?? null
  menu.style.left = '0px'
  menu.style.top = '0px'
  menu.hidden = false
  element('scene-context-backdrop').hidden = false
  element('app').inert = true
  const bounds = menu.getBoundingClientRect()
  // A finger would cover a menu to its right, so touch opens below left of it; a mouse opens below right.
  const touch = held?.pointerType === 'touch'
  const left = touch ? x - bounds.width - 12 : x + 2
  const top = y + (touch ? 12 : 2)
  menu.style.left = `${Math.max(8, Math.min(left, window.innerWidth - bounds.width - 8))}px`
  menu.style.top = `${Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8))}px`
  // Pointers open this menu, so no item looks chosen until a key or the pointer picks one.
  menu.focus({ preventScroll: true })
  return true
}

function sceneMenuItemAt(event: PointerEvent): HTMLButtonElement | null {
  return document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>('#scene-context-menu [role="menuitem"]:not([hidden])') ?? null
}

function highlightSceneMenuItem(item: HTMLButtonElement | null): void {
  for (const candidate of element('scene-context-menu').querySelectorAll('[role="menuitem"]')) candidate.toggleAttribute('data-highlighted', candidate === item)
}

/** Moves focus between a context menu's visible items with the arrow, Home and End keys. */
function navigateContextMenu(event: KeyboardEvent): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([hidden])')]
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'Home' || index < 0 && event.key === 'ArrowDown' ? 0 : event.key === 'End' || index < 0 ? items.length - 1
    : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus({ preventScroll: true })
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
    showAlwaysBright: false,
    showWesternConstellationStars,
    showNotableDistantStars,
    showFamousClusterStars: false,
    filterCategories: [...filterCategories],
    filterSubtypes: [...filterSubtypes],
    magnitudeLimit,
    hideFainterObjects,
    objectDistanceLimitLy,
    earthOrbitMode,
    milkyWayVisible,
    motionArrowsVisible,
    motionYears,
    motionFrame,
    gridVisible,
    skyGridMode,
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
    graphFilter: graphs?.save() ?? [],
    paint: [...paintSettings].map(([id, level]) => [id, level, [...paintChannelsOf(id)]]),
    ...neighborhoodCenter && { neighborhood: { centerId: neighborhoodCenter.id, radiusLy: neighborhoodRadiusLy } },
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
    originName: starById(referenceId)?.name ?? referenceId,
    savedAt,
    settings,
  }
  const next = [savedView, ...savedViews].sort((first, second) => Date.parse(second.savedAt) - Date.parse(first.savedAt))
  if (!writeSavedViews(next)) return
  input.value = ''
  setSavedViewsStatus(`Saved “${name}”`)
  renderSavedViews()
}

function syncFilterInputs(): void {
  renderCatalogRange(activeCatalogId)
  element<HTMLInputElement>('show-western-constellation-stars').checked = showWesternConstellationStars
  element<HTMLInputElement>('show-notable-distant-stars').checked = showNotableDistantStars
  const distanceIndex = OBJECT_DISTANCE_STEPS_LY.indexOf(objectDistanceLimitLy as typeof OBJECT_DISTANCE_STEPS_LY[number])
  const distanceInput = element<HTMLInputElement>('object-distance-limit')
  distanceInput.value = String(Math.max(0, distanceIndex))
  distanceInput.setAttribute('aria-valuetext', `${objectDistanceLimitLy} light-years`)
  text('object-distance-limit-value', `${objectDistanceLimitLy} ly`)
  const magnitudeInput = element<HTMLInputElement>('magnitude-limit')
  magnitudeInput.value = String(magnitudeLimit)
  text('magnitude-limit-value', String(magnitudeLimit))
  element<HTMLInputElement>('hide-fainter-objects').checked = hideFainterObjects
  renderObjectFilter()
}

function syncSceneAndMotionInputs(): void {
  earthOrbitModeInput.value = String(EARTH_ORBIT_MODES.indexOf(earthOrbitMode))
  earthOrbitModeInput.setAttribute('aria-valuetext', earthOrbitModeLabel(earthOrbitMode))
  text('earth-orbit-mode-value', earthOrbitModeLabel(earthOrbitMode))
  element<HTMLInputElement>('milky-way-visible').checked = milkyWayVisible
  element<HTMLInputElement>('motion-arrows-visible').checked = motionArrowsVisible
  element<HTMLSelectElement>('motion-years').value = String(motionYears)
  element<HTMLInputElement>(`motion-frame-${motionFrame}`).checked = true
}

function resetAllFilters(): void {
  showWesternConstellationStars = false
  showNotableDistantStars = false
  filterCategories.clear()
  DEFAULT_FILTER_CATEGORIES.forEach((category) => filterCategories.add(category))
  filterSubtypes.clear()
  DEFAULT_FILTER_SUBTYPES.forEach((subtype) => filterSubtypes.add(subtype))
  visibleKeys = effectiveFilterKeys(filterCategories, filterSubtypes, availableKeys)
  objectDistanceLimitLy = 100
  magnitudeLimit = 7
  hideFainterObjects = false
  syncFilterInputs()
  renderCatalogRange('nearest-neighbors')
  void switchCatalog('nearest-neighbors', true)
}

function setFilterSaveIndicator(saved: boolean): void {
  icon('filter-save-icon', saved ? SaveCheck : Save)
  element('filter-save').title = saved ? 'Current filter saved as default' : 'Save filter as default'
}

function saveCurrentFilter(): void {
  if (!viewer || sceneBusy) return
  const filter: SavedFilter = {
    version: 1,
    catalogId: activeCatalogId,
    showAlwaysBright: false,
    showWesternConstellationStars,
    showNotableDistantStars,
    filterCategories: [...filterCategories],
    filterSubtypes: [...filterSubtypes],
    magnitudeLimit,
    hideFainterObjects,
    objectDistanceLimitLy,
  }
  try {
    localStorage.setItem(SAVED_FILTER_STORAGE_KEY, JSON.stringify(filter))
    setFilterSaveIndicator(true)
    updateBrowserDataSize()
  } catch {
    setFilterSaveIndicator(false)
    element('filter-save').title = 'Could not save filter. Please try again.'
  }
}

function syncGridInputs(): void {
  const gridButton = element<HTMLButtonElement>('toggle-grid')
  gridButton.setAttribute('aria-pressed', String(gridVisible))
  text('grid-tooltip', gridVisible ? 'Hide grid' : 'Show grid')
  element('grid-legend').hidden = !gridVisible
  for (const frame of ['equatorial', 'galactic'] as const) {
    const active = skyGridMode === frame
    element(`toggle-${frame}-grid`).setAttribute('aria-pressed', String(active))
    text(`${frame}-grid-tooltip`, `${active ? 'Hide' : 'Show'} ${frame} grid`)
  }
}

function syncSavedSettingsInputs(): void {
  syncFilterInputs()
  syncSceneAndMotionInputs()
  syncGridInputs()
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
  // The saved camera replaces the cockpit; the ship stays parked where it is.
  if (spaceship?.piloting) setSpaceshipPiloting(false)
  if (observerView) viewer?.setObserverView(false)
  observerView = false
  observerViewAnchorId = null
  visibilityLockId = null
  showWesternConstellationStars = settings.showWesternConstellationStars || settings.showFamousClusterStars || settings.showAlwaysBright
  showNotableDistantStars = settings.showNotableDistantStars ?? false
  filterCategories.clear()
  settings.filterCategories.forEach((category) => filterCategories.add(category))
  filterSubtypes.clear()
  settings.filterSubtypes.forEach((subtype) => filterSubtypes.add(subtype))
  visibleKeys = effectiveFilterKeys(filterCategories, filterSubtypes, availableKeys)
  magnitudeLimit = settings.magnitudeLimit
  hideFainterObjects = settings.hideFainterObjects ?? false
  objectDistanceLimitLy = settings.objectDistanceLimitLy
  earthOrbitMode = settings.earthOrbitMode
  milkyWayVisible = settings.milkyWayVisible
  motionArrowsVisible = settings.motionArrowsVisible
  motionYears = settings.motionYears
  motionFrame = settings.motionFrame
  gridVisible = settings.gridVisible
  skyGridMode = settings.skyGridMode ?? 'off'
  simulationYears = settings.simulationYears
  simulationDirection = settings.simulationDirection
  playbackSecondsPerThousandYears = settings.playbackSecondsPerThousandYears
  followSelection = settings.followSelection
  selectedId = settings.selectedId === null ? null : legacyStarId(settings.selectedId)
  observerId = legacyStarId(settings.observerId)
  referenceId = legacyStarId(settings.referenceId)
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
  const savedObserverAnchorId = settings.observerViewAnchorId === null ? null : legacyStarId(settings.observerViewAnchorId)
  const anchorAvailable = savedObserverAnchorId !== null && starIndex.has(savedObserverAnchorId)
  if (settings.observerView && anchorAvailable) {
    observerViewAnchorId = savedObserverAnchorId
    observerId = savedObserverAnchorId
    viewer.setVisibility(observerId, magnitudeLimit, hideFainterObjects)
    observerView = viewer.setObserverView(true, savedObserverAnchorId, settings.viewState.observerRollRadians)
    viewer.setObserverTelescope(Boolean(settings.viewState.observerTelescope), false)
    if (!observerView) observerViewAnchorId = null
  }
  selectionHistory.record(selectedId)
  lastSelectedId = selectedId ?? observerId
  objectList.setReference(referenceId, objectListFilter())
  applyPaint(settings.paint ?? [])
  const graphFilter = settings.graphFilter ?? []
  // The graphs module loads only when the view holds a graph filter; failing that, the view opens without it.
  if (graphFilter.length && !graphs) await import('./graphs').then(initializeGraphs, () => undefined)
  graphs?.restore(graphFilter)
  graphs?.refresh()
  // A view restores its neighborhood sphere; the birth-year shell is never part of it.
  neighborhoodBirthYear = null
  neighborhoodRadiusLy = settings.neighborhood?.radiusLy ?? neighborhoodRadiusLy
  setNeighborhoodCenter(settings.neighborhood ? starById(legacyStarId(settings.neighborhood.centerId)) ?? null : null)
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

function updateBrowserDataSize(): void {
  const button = element<HTMLButtonElement>('delete-browser-data')
  try {
    const size = browserDataSize()
    button.textContent = `Delete all Star View browser data (${size})`
    text('browser-data-question', `Do you really want to delete ${size} of Star View data stored on this browser?`)
    button.disabled = false
  } catch {
    button.textContent = 'Delete all Star View browser data (size unavailable)'
    button.disabled = true
  }
}

function positionBrowserDataDialog(): void {
  const dialog = element<HTMLDialogElement>('browser-data-dialog')
  if (!dialog.open) return
  const panel = element('preferences-panel').getBoundingClientRect()
  const bounds = dialog.getBoundingClientRect()
  dialog.style.left = `${Math.max(16, Math.min(panel.left + (panel.width - bounds.width) / 2, window.innerWidth - bounds.width - 16))}px`
  dialog.style.top = `${Math.max(16, Math.min(panel.top + (panel.height - bounds.height) / 2, window.innerHeight - bounds.height - 16))}px`
}

updateBrowserDataSize()
element('delete-browser-data').addEventListener('click', () => {
  updateBrowserDataSize()
  if (element<HTMLButtonElement>('delete-browser-data').disabled) return
  element('browser-data-error').hidden = true
  element('preferences-panel').setAttribute('data-delete-confirmation', '')
  element<HTMLDialogElement>('browser-data-dialog').showModal()
  positionBrowserDataDialog()
}, { signal: events.signal })
element('browser-data-no').addEventListener('click', () => {
  element<HTMLDialogElement>('browser-data-dialog').close()
}, { signal: events.signal })
element('browser-data-dialog').addEventListener('close', () => {
  element('preferences-panel').removeAttribute('data-delete-confirmation')
  updateBrowserDataSize()
  element('delete-browser-data').focus({ preventScroll: true })
}, { signal: events.signal })
element('browser-data-yes').addEventListener('click', () => {
  try {
    deleteBrowserData()
    window.location.reload()
  } catch {
    text('browser-data-error', 'Could not delete all browser data. Please try again.')
    element('browser-data-error').hidden = false
    updateBrowserDataSize()
    positionBrowserDataDialog()
  }
}, { signal: events.signal })
for (const type of ['input', 'change']) {
  element('preferences-panel').addEventListener(type, updateBrowserDataSize, { signal: events.signal })
}
window.addEventListener('storage', updateBrowserDataSize, { signal: events.signal })
window.addEventListener('resize', positionBrowserDataDialog, { signal: events.signal })
syncFilterInputs()
renderCatalogRange(initialCatalogId)
void switchCatalog(initialCatalogId)
if (catalogErrors.length) catalogError(catalogErrors.join('\n'))

element('object-search').addEventListener('input', () => objectList.setQuery(element<HTMLInputElement>('object-search').value), { signal: events.signal })
// Card size and sidebar choices persist across visits.
function storeLayout(key: string, value: string): void {
  try { localStorage.setItem(`star-view-${key}`, value) } catch {}
}
function storedLayout(key: string): string | null {
  try { return localStorage.getItem(`star-view-${key}`) } catch { return null }
}
function setObjectsHeight(height: string): void {
  element('objects-panel').style.setProperty('--objects-height', height)
  storeLayout('objects-height', height)
}
function setObjectsExpanded(expanded: boolean, height = `${element('objects-panel').getBoundingClientRect().height}px`): void {
  const panel = element('objects-panel')
  const search = panel.querySelector<HTMLElement>('.object-search')!
  if (expanded) {
    setObjectsHeight(height)
    panel.querySelector('.objects-heading')!.insertBefore(search, element('objects-shrink'))
  } else {
    panel.insertBefore(search, element('star-list'))
    panel.style.removeProperty('--objects-height')
  }
  panel.classList.toggle('is-expanded', expanded)
  element('objects-shrink').hidden = !expanded
  element('objects-maximize').hidden = !expanded
  element('control-dock').toggleAttribute('data-objects-expanded', expanded)
  const button = element('objects-expand')
  const label = expanded ? 'Collapse objects list' : 'Expand objects list'
  button.setAttribute('aria-expanded', String(expanded))
  button.setAttribute('aria-label', label)
  button.title = label
  icon('objects-expand-icon', expanded ? ChevronsRightLeft : ChevronsLeftRight)
  objectList.setExpanded(expanded)
}
const storedObjectsHeight = storedLayout('objects-height')
if (storedLayout('objects-expanded') === 'true') setObjectsExpanded(true, storedObjectsHeight && /^(\d+(\.\d+)?px|100dvh)$/.test(storedObjectsHeight) ? storedObjectsHeight : '100dvh')
element('objects-expand').addEventListener('click', () => {
  const expanded = !element('objects-panel').classList.contains('is-expanded')
  setObjectsExpanded(expanded)
  storeLayout('objects-expanded', String(expanded))
  syncPanelLayout()
}, { signal: events.signal })
element('objects-shrink').addEventListener('click', () => {
  const panel = element('objects-panel')
  // Keep the heading, table header, one data row, and scrollbar accessible.
  const minimumHeight = panel.querySelector('.objects-heading')!.getBoundingClientRect().height + 50 + 36 + 18
  const currentHeight = panel.getBoundingClientRect().height
  setObjectsHeight(`${Math.min(currentHeight, Math.max(minimumHeight, currentHeight / 2))}px`)
  syncPanelLayout()
}, { signal: events.signal })
element('objects-maximize').addEventListener('click', () => {
  setObjectsHeight('100dvh')
  syncPanelLayout()
}, { signal: events.signal })
// Choosing a Discover card retracts the flyout until the pointer returns to Discover or keyboard navigation resumes.
// Touch taps reopen it through the toolbar's touch toggle.
const discoverControls = element('discover-toggle').parentElement!
element('discover-options').addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('button')) discoverControls.setAttribute('data-dismissed', '')
}, { signal: events.signal })
element('discover-toggle').addEventListener('pointerenter', (event) => { if (event.pointerType !== 'touch') discoverControls.removeAttribute('data-dismissed') }, { signal: events.signal })
document.addEventListener('keydown', (event) => { if (event.key === 'Tab') discoverControls.removeAttribute('data-dismissed') }, { signal: events.signal })
/** Returns focus to Discover after closing one of its cards, without reopening the flyout. */
function focusDiscoverToggle(): void {
  discoverControls.setAttribute('data-dismissed', '')
  element('discover-toggle').focus()
}
element('graph-filter-active').addEventListener('click', () => togglePanel('graphs'), { signal: events.signal })
element('paint-active').addEventListener('click', () => togglePanel('paint'), { signal: events.signal })
element('motion-active').addEventListener('click', () => togglePanel('motion'), { signal: events.signal })
element('neighborhood-active').addEventListener('click', () => togglePanel('neighborhood'), { signal: events.signal })
element('spaceship-active').addEventListener('click', () => togglePanel('spaceship'), { signal: events.signal })
element('spaceship-hud').addEventListener('click', (event) => {
  if (!panelIsOpen('spaceship') && !(event.target instanceof Element && event.target.closest('button'))) togglePanel('spaceship')
}, { signal: events.signal })
element('spaceship-exit').addEventListener('click', () => setSpaceshipPiloting(spaceship?.piloting === false), { signal: events.signal })
element('spaceship-clear').addEventListener('click', () => {
  spaceship = null
  spaceshipTelemetry = null
  spaceshipKeys.clear()
  setSpaceshipThrottle(0)
  applySpaceship()
  renderSelection()
  setPanelOpen('spaceship', false)
  syncPanelLayout()
  focusDiscoverToggle()
}, { signal: events.signal })
for (const [id, fromShip] of [['spaceship-visibility-selected', false], ['spaceship-visibility-ship', true]] as const) {
  element(id).addEventListener('click', () => {
    if (spaceshipVisibility === fromShip) return
    spaceshipVisibility = fromShip
    applySpaceship()
    renderSelection()
  }, { signal: events.signal })
}
element('spaceship-travelled-reset').addEventListener('click', () => {
  if (!spaceship) return
  spaceship.travelledPc = 0
  if (spaceshipTelemetry) spaceshipTelemetry.travelledPc = 0
  renderSpaceshipTelemetry(true)
}, { signal: events.signal })
element('spaceship-speed-level').addEventListener('input', () => {
  const input = element<HTMLInputElement>('spaceship-speed-level')
  spaceshipSpeedLevel = input.valueAsNumber
  input.setAttribute('aria-valuetext', ['Slow', 'Medium', 'Fast'][spaceshipSpeedLevel]!)
  applySpaceshipInput()
  renderSpaceship()
}, { signal: events.signal })
element('spaceship-labels').addEventListener('input', () => {
  const input = element<HTMLInputElement>('spaceship-labels')
  spaceshipLabels = SPACESHIP_LABELS[input.valueAsNumber] ?? spaceshipLabels
  input.setAttribute('aria-valuetext', { none: 'Off', selected: 'Selected object only', all: 'All' }[spaceshipLabels])
  text('spaceship-labels-value', { none: 'Off', selected: 'Selected', all: 'All' }[spaceshipLabels])
  viewer?.setSpaceship(spaceship, spaceship ? spaceshipLabels : 'all', spaceshipVisibility)
}, { signal: events.signal })
// Flight keys by position, ignored while typing; the on-screen keycaps work the same while held.
function spaceshipKey(event: KeyboardEvent): SpaceshipKey | undefined {
  if (event.metaKey || event.ctrlKey || event.altKey) return undefined
  if (event.target instanceof Element && event.target.closest('input:not([type="range"], [type="checkbox"], [type="radio"]), textarea, select, [contenteditable]')) return undefined
  return SPACESHIP_KEYS[event.code as keyof typeof SPACESHIP_KEYS]
}
document.addEventListener('keydown', (event) => {
  const key = spaceship?.piloting ? spaceshipKey(event) : undefined
  if (!key) return
  event.preventDefault()
  if (spaceshipKeys.has(key)) return
  spaceshipKeys.add(key)
  applySpaceshipInput()
}, { signal: events.signal })
document.addEventListener('keyup', (event) => {
  const key = SPACESHIP_KEYS[event.code as keyof typeof SPACESHIP_KEYS]
  if (key && spaceshipKeys.delete(key)) applySpaceshipInput()
}, { signal: events.signal })
window.addEventListener('blur', () => {
  if (!spaceshipKeys.size) return
  spaceshipKeys.clear()
  applySpaceshipInput()
}, { signal: events.signal })
// The touch throttle works like a held joystick: slide up from the touch point to fly forward, down to fly back.
const spaceshipThrottlePad = element('spaceship-throttle')
let spaceshipThrottleOrigin: number | null = null
spaceshipThrottlePad.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  spaceshipThrottlePad.setPointerCapture(event.pointerId)
  spaceshipThrottleOrigin = event.clientY
}, { signal: events.signal })
// OrbitControls follows every pointer on the document once a view drag starts, so throttle moves must not reach it.
spaceshipThrottlePad.addEventListener('pointerup', (event) => event.stopPropagation(), { signal: events.signal })
spaceshipThrottlePad.addEventListener('pointermove', (event) => {
  event.stopPropagation()
  if (spaceshipThrottleOrigin !== null) setSpaceshipThrottle((spaceshipThrottleOrigin - event.clientY) / (spaceshipThrottlePad.clientHeight * 0.4))
}, { signal: events.signal })
spaceshipThrottlePad.addEventListener('lostpointercapture', () => {
  spaceshipThrottleOrigin = null
  setSpaceshipThrottle(0)
}, { signal: events.signal })
touchFirstInput.addEventListener('change', renderSpaceship, { signal: events.signal })
const birthYears = element<HTMLSelectElement>('neighborhood-birth-year')
for (let year = new Date().getFullYear(); year >= FIRST_BIRTH_YEAR; year--) birthYears.add(new Option(String(year)))
element('neighborhood-radius').addEventListener('input', () => {
  neighborhoodRadiusLy = element<HTMLInputElement>('neighborhood-radius').valueAsNumber
  neighborhoodCenter ??= defaultNeighborhoodCenter()
  applyNeighborhood()
}, { signal: events.signal })
// Choosing a year turns the shell on; the toggle switches it off and back on, or opens the list before a year is chosen.
element('neighborhood-birth-toggle').addEventListener('click', () => {
  if (neighborhoodBirthYear === null && !birthYears.value) {
    try { birthYears.showPicker() } catch { birthYears.focus() }
    return
  }
  neighborhoodBirthYear = neighborhoodBirthYear === null ? Number(birthYears.value) : null
  applyNeighborhood()
}, { signal: events.signal })
birthYears.addEventListener('change', () => {
  neighborhoodBirthYear = Number(birthYears.value)
  applyNeighborhood()
}, { signal: events.signal })
element('neighborhood-catalog').addEventListener('click', () => {
  const id = element('neighborhood-catalog').dataset.catalogId
  if (!id) return
  renderCatalogRange(id)
  void switchCatalog(id)
}, { signal: events.signal })
element('neighborhood-recenter').addEventListener('click', () => setNeighborhoodCenter(defaultNeighborhoodCenter()), { signal: events.signal })
element('neighborhood-clear').addEventListener('click', () => {
  setNeighborhoodCenter(null)
  // The button is now disabled, so keyboard focus moves to the slider that starts a neighborhood again.
  element('neighborhood-radius').focus()
}, { signal: events.signal })
function setGraphsCompact(compact: boolean): void {
  element('control-dock').toggleAttribute('data-graphs-compact', compact)
  const button = element('graphs-width')
  const label = `${compact ? 'Widen' : 'Shrink'} graphs card width`
  button.setAttribute('aria-expanded', String(!compact))
  button.setAttribute('aria-label', label)
  button.title = label
  icon('graphs-width-icon', compact ? ChevronsLeftRight : ChevronsRightLeft)
}
if (storedLayout('graphs-compact') === 'true') setGraphsCompact(true)
element('graphs-width').addEventListener('click', () => {
  const compact = !element('control-dock').hasAttribute('data-graphs-compact')
  setGraphsCompact(compact)
  storeLayout('graphs-compact', String(compact))
  syncPanelLayout()
}, { signal: events.signal })
function setSidebarCollapsed(id: string, collapsed: boolean): void {
  const button = element(id)
  button.closest('.glossary-body')!.toggleAttribute('data-sidebar-collapsed', collapsed)
  const label = `${collapsed ? 'Expand' : 'Collapse'} sidebar`
  button.setAttribute('aria-expanded', String(!collapsed))
  button.setAttribute('aria-label', label)
  button.title = label
  icon(`${id}-icon`, collapsed ? PanelLeftOpen : PanelLeftClose)
}
for (const id of ['constellations-sidebar', 'top-lists-sidebar', 'graphs-sidebar']) {
  setSidebarCollapsed(id, storedLayout(`${id}-collapsed`) === 'true')
  element(id).addEventListener('click', () => {
    const collapsed = element(id).getAttribute('aria-expanded') === 'true'
    setSidebarCollapsed(id, collapsed)
    storeLayout(`${id}-collapsed`, String(collapsed))
  }, { signal: events.signal })
}
function setConstellationsMaximized(maximized: boolean): void {
  element('constellations-panel').classList.toggle('is-maximized', maximized)
  const button = element('constellations-maximize')
  const label = `${maximized ? 'Minimize' : 'Maximize'} constellations card height`
  button.setAttribute('aria-label', label)
  button.title = label
  icon('constellations-maximize-icon', maximized ? ChevronsDownUp : ChevronsUpDown)
}
// Without a saved choice, desktop opens the constellations card at full height; smaller and touch-first screens keep the compact card.
const storedConstellationsMaximized = storedLayout('constellations-maximized')
if (storedConstellationsMaximized === null ? wideLayout.matches && !touchFirstInput.matches : storedConstellationsMaximized === 'true') setConstellationsMaximized(true)
element('constellations-maximize').addEventListener('click', () => {
  const maximized = !element('constellations-panel').classList.contains('is-maximized')
  setConstellationsMaximized(maximized)
  storeLayout('constellations-maximized', String(maximized))
  syncPanelLayout()
}, { signal: events.signal })
catalogRange.addEventListener('input', () => previewCatalogRange(catalogRange.valueAsNumber), { signal: events.signal })
element('filter-reset').addEventListener('click', resetAllFilters, { signal: events.signal })
const paintIcon = (shape: IconNode) => createElement(shape, { width: 20, height: 20, 'stroke-width': 1.7, 'aria-hidden': 'true' })
const paintSettingIcons: Record<PaintSettingId, IconNode> = {
  'absolute-magnitude': Sun, mass: Weight, 'bolometric-luminosity': Sparkle, 'radial-velocity': ArrowLeftRight, 'motion-direction': Compass, metallicity: Atom,
  'planet-hosts': Orbit, radius: Radius, density: Box, temperature: Thermometer, 'data-gaps': CircleDashed,
}
element('paint-settings').append(...PAINT_SETTINGS.map((paintSetting) => {
  const { id, label, legend, gradient } = paintSetting
  const setting = document.createElement('section')
  setting.className = 'planet-atmosphere paint-setting'
  setting.dataset.paintSetting = id
  const heading = document.createElement('div')
  heading.className = 'card-subgroup-heading paint-setting-heading'
  const toggle = document.createElement('button')
  Object.assign(toggle, { type: 'button', className: 'paint-setting-toggle', title: `Paint by ${label.toLowerCase()}` })
  toggle.setAttribute('aria-label', toggle.title)
  toggle.setAttribute('aria-pressed', 'false')
  toggle.append(paintIcon(paintSettingIcons[id]))
  const body = document.createElement('div')
  Object.assign(body, { id: `paint-${id}-body`, className: 'paint-setting-body', hidden: true })
  const expand = document.createElement('button')
  Object.assign(expand, { type: 'button', className: 'paint-setting-expand' })
  expand.setAttribute('aria-expanded', 'false')
  expand.setAttribute('aria-controls', body.id)
  expand.append(Object.assign(document.createElement('span'), { textContent: label }))
  const chevron = paintIcon(ChevronUp)
  chevron.classList.add('paint-setting-chevron')
  // Holds the name and scale buttons, so the buttons can wrap below the name beside the toggle and chevron.
  const title = document.createElement('div')
  title.className = 'paint-setting-title'
  title.append(expand)
  if (!('fixed' in paintSetting)) {
    const scale = document.createElement('span')
    scale.className = 'unit-options graph-scale'
    scale.setAttribute('role', 'group')
    scale.setAttribute('aria-label', `${label} scale`)
    scale.append(...(['Rank', 'Linear'] as const).map((name) => {
      const button = Object.assign(document.createElement('button'), { type: 'button', textContent: name, title: name === 'Rank' ? 'Rank the visible objects' : 'Fixed linear scale' })
      button.dataset.paintScale = name
      button.setAttribute('aria-pressed', String(name === 'Rank'))
      return button
    }))
    title.append(scale)
  }
  heading.append(toggle, title, chevron)
  const bar = document.createElement('div')
  bar.className = 'paint-legend'
  const level = document.createElement('input')
  Object.assign(level, { type: 'range', min: String(PAINT_LEVEL_RANGE[0]), max: String(PAINT_LEVEL_RANGE[1]), step: '0.01', value: String(DEFAULT_PAINT_LEVEL) })
  level.setAttribute('aria-label', `${label} midpoint`)
  bar.style.setProperty('--paint-legend', gradient(DEFAULT_PAINT_LEVEL, DEFAULT_PAINT_CONTROLS))
  bar.append(level)
  const bounds = document.createElement('div')
  bounds.className = 'range-bounds'
  bounds.setAttribute('aria-hidden', 'true')
  bounds.append(...legend.bounds.map((bound) => Object.assign(document.createElement('span'), { textContent: bound })))
  // The visible objects' distribution and missing count appear while the setting paints or is open.
  const histogram = Object.assign(document.createElement('div'), { className: 'paint-histogram', hidden: true })
  histogram.setAttribute('aria-hidden', 'true')
  histogram.append(...Array.from({ length: PAINT_HISTOGRAM_BINS }, () => document.createElement('i')))
  body.append(histogram, bar, bounds, Object.assign(document.createElement('p'), { className: 'filter-hint paint-missing', hidden: true }))
  if ('wheel' in legend) {
    const wheel = document.createElement('div')
    wheel.className = 'paint-wheel'
    wheel.setAttribute('aria-hidden', 'true')
    const disc = document.createElement('i')
    disc.style.setProperty('--paint-legend', legend.wheel.gradient(DEFAULT_PAINT_LEVEL, DEFAULT_PAINT_CONTROLS))
    wheel.append(disc, ...legend.wheel.labels.map((text) => Object.assign(document.createElement('span'), { textContent: text })))
    body.append(wheel)
  }
  const channels = document.createElement('div')
  channels.className = 'range-heading paint-control'
  const channelGroup = document.createElement('span')
  channelGroup.className = 'unit-options graph-scale'
  channelGroup.setAttribute('role', 'group')
  channelGroup.setAttribute('aria-label', `${label} paints`)
  channelGroup.append(...PAINT_CHANNELS.map((channel) => {
    const button = Object.assign(document.createElement('button'), { type: 'button', textContent: channel === 'color' ? 'Color' : 'Size' })
    button.dataset.paintChannel = channel
    button.setAttribute('aria-pressed', 'true')
    return button
  }))
  channels.append(Object.assign(document.createElement('span'), { textContent: 'Paints' }), channelGroup)
  body.append(channels, ...('controls' in paintSetting ? paintSetting.controls : []).map(({ name, label: controlLabel, text }) => {
    const control = document.createElement('div')
    control.className = 'range-filter paint-control'
    const input = Object.assign(document.createElement('input'), { id: `paint-${id}-${name}`, type: 'range', min: '0', max: '1', step: '0.01', value: String(DEFAULT_PAINT_CONTROLS[name]) })
    input.dataset.paintControl = name
    const controlHeading = document.createElement('div')
    controlHeading.className = 'range-heading'
    controlHeading.append(Object.assign(document.createElement('label'), { htmlFor: input.id, textContent: controlLabel }),
      Object.assign(document.createElement('output'), { htmlFor: input.id, textContent: text(DEFAULT_PAINT_CONTROLS[name], DEFAULT_PAINT_LEVEL) }))
    control.append(controlHeading, input)
    return control
  }))
  if (legend.note) body.append(Object.assign(document.createElement('p'), { className: 'filter-hint', textContent: legend.note }))
  setting.append(heading, body)
  return setting
}))
function paintSettingParts(setting: HTMLElement) {
  const id = setting.dataset.paintSetting
  if (!isPaintSettingId(id)) return null
  const definition = PAINT_SETTINGS.find((candidate) => candidate.id === id)!
  return {
    id, gradient: definition.gradient, legend: definition.legend,
    toggle: setting.querySelector<HTMLButtonElement>('.paint-setting-toggle')!,
    level: setting.querySelector<HTMLInputElement>('.paint-legend input')!,
    controls: ('controls' in definition ? definition.controls : []).map((control) => ({ control, input: setting.querySelector<HTMLInputElement>(`[data-paint-control="${control.name}"]`)! })),
    bounds: setting.querySelectorAll<HTMLSpanElement>('.range-bounds span'),
    body: setting.querySelector<HTMLElement>('.paint-setting-body')!,
    wheel: setting.querySelector<HTMLElement>('.paint-wheel > i'),
    histogram: setting.querySelector<HTMLElement>('.paint-histogram')!,
    missing: setting.querySelector<HTMLElement>('.paint-missing')!,
    scales: setting.querySelectorAll<HTMLButtonElement>('[data-paint-scale]'),
    channels: setting.querySelectorAll<HTMLButtonElement>('[data-paint-channel]'),
  }
}
element('paint-settings').addEventListener('click', (event) => {
  // The chevron sits right of the scale buttons, outside the expand button, and expands like it.
  const chevron = event.target instanceof Element ? event.target.closest('.paint-setting-chevron') : null
  const button = event.target instanceof Element ? chevron?.parentElement!.querySelector('.paint-setting-expand') ?? event.target.closest('button') : null
  const parts = button ? paintSettingParts(button.closest<HTMLElement>('[data-paint-setting]')!) : null
  if (!button || !parts) return
  if (button instanceof HTMLElement && button.dataset.paintScale) {
    if (button.dataset.paintScale === 'Linear') linearPaintSettings.add(parts.id)
    else linearPaintSettings.delete(parts.id)
    parts.scales.forEach((scale) => scale.setAttribute('aria-pressed', String(scale === button)))
    paintVisible()
    return
  }
  if (button instanceof HTMLElement && button.dataset.paintChannel) {
    const channel = button.dataset.paintChannel as PaintChannel
    const current = paintChannelsOf(parts.id)
    const next = PAINT_CHANNELS.filter((candidate) => candidate === channel ? !current.includes(channel) : current.includes(candidate))
    // A setting keeps at least one channel.
    if (!next.length) return
    paintChannels.set(parts.id, next)
    if (paintSettings.has(parts.id)) claimPaintChannels(parts.id)
    showPaintState()
    paintVisible()
    return
  }
  if (button.classList.contains('paint-setting-expand')) {
    const expanded = button.getAttribute('aria-expanded') !== 'true'
    button.setAttribute('aria-expanded', String(expanded))
    element(button.getAttribute('aria-controls')!).hidden = !expanded
    if (expanded) paintVisible()
    return
  }
  if (!paintSettings.delete(parts.id)) {
    paintSettings.set(parts.id, parts.level.valueAsNumber)
    claimPaintChannels(parts.id)
  }
  showPaintState()
  paintVisible()
}, { signal: events.signal })
element('paint-settings').addEventListener('input', (event) => {
  const input = event.target
  const parts = input instanceof HTMLInputElement ? paintSettingParts(input.closest<HTMLElement>('[data-paint-setting]')!) : null
  if (!parts || !Number.isFinite(parts.level.valueAsNumber)) return
  const changed = parts.controls.find((control) => control.input === input)
  if (changed) paintControls.set(parts.id, { ...paintControls.get(parts.id) ?? DEFAULT_PAINT_CONTROLS, [changed.control.name]: changed.input.valueAsNumber })
  showPaintLevel(parts, parts.level.valueAsNumber)
  if (!paintSettings.has(parts.id)) return
  paintSettings.set(parts.id, parts.level.valueAsNumber)
  paintVisible()
}, { signal: events.signal })
/** Shows a setting's legend and slider readouts at its level and controls. */
function showPaintLevel(parts: NonNullable<ReturnType<typeof paintSettingParts>>, level: number): void {
  const controls = paintControls.get(parts.id) ?? DEFAULT_PAINT_CONTROLS
  parts.level.parentElement!.style.setProperty('--paint-legend', parts.gradient(level, controls))
  if (parts.wheel && 'wheel' in parts.legend) parts.wheel.style.setProperty('--paint-legend', parts.legend.wheel.gradient(level, controls))
  parts.controls.forEach(({ control, input }) => { input.parentElement!.querySelector('output')!.textContent = control.text(controls[control.name], level) })
}
/** Hands the setting's channels over from the other enabled settings, turning off those left without one. */
function claimPaintChannels(id: PaintSettingId): void {
  const claimed = paintChannelsOf(id)
  for (const other of [...paintSettings.keys()]) {
    if (other === id) continue
    const left = paintChannelsOf(other).filter((channel) => !claimed.includes(channel))
    if (left.length) paintChannels.set(other, left)
    else paintSettings.delete(other)
  }
}
/** Shows which settings paint and the channels each one claims. */
function showPaintState(): void {
  element('paint-settings').querySelectorAll<HTMLElement>('[data-paint-setting]').forEach((setting) => {
    const parts = paintSettingParts(setting)!
    const channels = paintChannelsOf(parts.id)
    parts.toggle.setAttribute('aria-pressed', String(paintSettings.has(parts.id)))
    parts.channels.forEach((button) => button.setAttribute('aria-pressed', String(channels.includes(button.dataset.paintChannel as PaintChannel))))
  })
  setActiveIndicator('paint-active', paintSettings.size > 0)
}
/** Paints by the given settings and channels; settings left out are off at their default level. */
function applyPaint(entries: readonly (readonly [PaintSettingId, number, (readonly PaintChannel[])?])[]): void {
  paintSettings.clear()
  linearPaintSettings.clear()
  paintControls.clear()
  paintChannels.clear()
  setPaintZoomShrink(false)
  entries.forEach(([id, level, channels]) => {
    paintSettings.set(id, level)
    if (channels) paintChannels.set(id, channels)
  })
  element('paint-settings').querySelectorAll<HTMLElement>('[data-paint-setting]').forEach((setting) => {
    const parts = paintSettingParts(setting)!
    const level = paintSettings.get(parts.id) ?? DEFAULT_PAINT_LEVEL
    parts.scales.forEach((scale) => scale.setAttribute('aria-pressed', String(scale.dataset.paintScale === 'Rank')))
    parts.level.value = String(level)
    parts.controls.forEach(({ control, input }) => { input.value = String(DEFAULT_PAINT_CONTROLS[control.name]) })
    showPaintLevel(parts, level)
  })
  showPaintState()
  paintVisible(true)
}
/** The objects the map filter shows, leaving out a selection it shows only because it is selected. */
function paintableStars(): Star[] {
  return objectList.mapItems(objectListFilter(null)).map(({ star }) => star)
}
/** Paints by the enabled settings and shows the legends of painting or open settings, fitted to the visible objects; refitting gathers them again. */
function paintVisible(refit = false): void {
  const settings = [...element('paint-settings').querySelectorAll<HTMLElement>('[data-paint-setting]')].map((setting) => paintSettingParts(setting)!)
  const shown = settings.filter((parts) => paintSettings.has(parts.id) || !parts.body.hidden)
  if (!shown.length) paintStars = null
  else if (refit || !paintStars) paintStars = paintableStars()
  const fitted = paintStars && starPainter(paintSettings, paintStars, linearPaintSettings, paintControls, paintChannels)
  settings.forEach((parts) => {
    const legend = fitted?.legends.get(parts.id) ?? (paintStars && shown.includes(parts) ? paintLegend(parts.id, paintStars, linearPaintSettings.has(parts.id)) : undefined)
    const bounds = legend?.bounds ?? parts.legend.bounds
    parts.bounds.forEach((span, index) => { span.textContent = bounds[index]! })
    parts.histogram.hidden = !legend
    parts.missing.hidden = !legend?.missing
    if (!legend) return
    const peak = Math.max(1, ...legend.histogram)
    // Single objects stay visible beside crowded bins.
    legend.histogram.forEach((count, index) => { (parts.histogram.children[index] as HTMLElement).style.height = count ? `max(1px, ${count / peak * 100}%)` : '0' })
    parts.missing.textContent = `${legend.missing.toLocaleString('en-US')} ${legend.missing === 1 ? 'object' : 'objects'} without ${parts.legend.missing}.`
  })
  viewer?.setStarPaint(fitted?.painter ?? null)
}
/** Refits the paint and shown legends when filtering changes which objects are visible. */
function refitPaint(): void {
  if (!paintStars) return
  const stars = paintableStars()
  if (stars.length === paintStars.length && stars.every((star, index) => star === paintStars![index])) return
  paintStars = stars
  paintVisible()
}
function setPaintZoomShrink(enabled: boolean): void {
  paintZoomShrink = enabled
  element('paint-shrink').setAttribute('aria-pressed', String(enabled))
  viewer?.setStarPaintZoomShrink(enabled)
}
element('paint-shrink').addEventListener('click', () => setPaintZoomShrink(!paintZoomShrink), { signal: events.signal })
element('paint-reset').addEventListener('click', () => applyPaint([]), { signal: events.signal })
element('filter-save').addEventListener('click', saveCurrentFilter, { signal: events.signal })
catalogRange.addEventListener('change', () => {
  const catalog = sliderCatalogs[catalogRange.valueAsNumber]
  if (catalog) void switchCatalog(catalog.manifest.id)
}, { signal: events.signal })
element('show-western-constellation-stars').addEventListener('change', () => {
  showWesternConstellationStars = element<HTMLInputElement>('show-western-constellation-stars').checked
  void switchCatalog(activeCatalogId, true)
}, { signal: events.signal })
element('show-notable-distant-stars').addEventListener('change', () => {
  showNotableDistantStars = element<HTMLInputElement>('show-notable-distant-stars').checked
  // Visible pulsars already load these companions.
  if (!visibleKeys.has('pulsar')) void switchCatalog(activeCatalogId, true)
}, { signal: events.signal })
element('distance-units').addEventListener('change', () => {
  distanceUnit = element<HTMLInputElement>('unit-ly').checked ? 'ly' : 'pc'
  try { localStorage.setItem('star-view-distance-unit', distanceUnit) } catch {}
  viewer?.setDistanceUnit(distanceUnit)
  renderDistances()
  renderSpaceship()
}, { signal: events.signal })
element('star-colors').addEventListener('change', () => {
  starColorMode = element<HTMLInputElement>('star-colors-exaggerated').checked ? 'exaggerated' : 'real'
  try { localStorage.setItem('star-view-color-mode', starColorMode) } catch {}
  objectList.setColorMode(starColorMode)
  renderSelection()
  updateSelectionHistoryControls()
  viewer?.setStarColorMode(starColorMode)
  graphs?.refresh()
}, { signal: events.signal })
const magnitudeLimitInput = element<HTMLInputElement>('magnitude-limit')
const magnitudeLimitGuides = MAGNITUDE_VISIBILITY_GUIDES.filter((guide) => guide.limit <= Number(magnitudeLimitInput.max))
element('magnitude-limit-markers').replaceChildren(...magnitudeLimitGuides.map((guide) => {
  const marker = document.createElement('span')
  marker.style.left = `${guide.limit / Number(magnitudeLimitInput.max) * 100}%`
  marker.append(createElement(guide.icon, { width: 12, height: 12, 'stroke-width': 1.7 }))
  return marker
}))
text('magnitude-limit-guides', `Approximate visibility limits: ${magnitudeLimitGuides.map((guide) => `${guide.name.toLowerCase()} +${guide.limit}`).join(', ')}.`)
element('magnitude-limit').addEventListener('input', () => {
  const input = element<HTMLInputElement>('magnitude-limit')
  if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) return
  magnitudeLimit = input.valueAsNumber
  text('magnitude-limit-value', String(magnitudeLimit))
  viewer?.setVisibility(observerId, magnitudeLimit, hideFainterObjects)
}, { signal: events.signal })
element('magnitude-limit').addEventListener('change', () => {
  element<HTMLInputElement>('magnitude-limit').value = String(magnitudeLimit)
  // The list follows once the slider settles; the map already updated while dragging.
  if (hideFainterObjects) updateObjectListFilter()
}, { signal: events.signal })
element('hide-fainter-objects').addEventListener('change', () => {
  hideFainterObjects = element<HTMLInputElement>('hide-fainter-objects').checked
  viewer?.setVisibility(observerId, magnitudeLimit, hideFainterObjects)
  updateObjectListFilter()
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
  if (neighborhoodCenter) applyNeighborhood()
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
element('distance-time-reset').addEventListener('click', () => setDistanceYears(0), { signal: events.signal })
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
distanceTimeSlider.addEventListener('input', () => {
  if (distanceTimeSlider.validity.valid && Number.isFinite(distanceTimeSlider.valueAsNumber)) setDistanceYears(distanceTimeSlider.valueAsNumber)
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
  if (!element('spectral-card').hidden) positionCardHeaderTooltips(element('spectral-card'))
  syncVisibilityObserverLayout()
  syncViewCenterInset()
  const star = stars.find((candidate) => candidate.id === selectedId)
  if (star && !element('radius-card').hidden) renderRadiusCard(star)
  if (star && !element('mass-card').hidden) renderMassCard(star)
  if (star && !element('luminosity-card').hidden) renderLuminosityCard(star)
  if (star && !element('temperature-card').hidden) renderTemperatureCard(star)
  if (star && !element('magnitude-card').hidden) renderMagnitudeCard(star)
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
for (const name of ['motion', 'objects', 'glossary', 'constellations', 'top-lists', 'graphs', 'paint', 'neighborhood', 'spaceship'] as const) {
  element(`${name}-close`).addEventListener('click', () => {
    setPanelOpen(name, false)
    syncPanelLayout()
    const toggle = panelToggleId(name)
    if (toggle === 'discover-toggle') focusDiscoverToggle()
    else element(toggle).focus()
  }, { signal: events.signal })
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
element('saved-view-context-menu').addEventListener('keydown', navigateContextMenu, { signal: events.signal })
element('scene-context-menu').addEventListener('keydown', navigateContextMenu, { signal: events.signal })
element('scene-context-compare').addEventListener('click', () => {
  const id = sceneMenuTargetId
  closeSceneContextMenu()
  if (id !== null) starComparison.compare(id)
}, { signal: events.signal })
element('scene-context-origin').addEventListener('click', () => {
  const id = sceneMenuTargetId
  closeSceneContextMenu()
  if (id !== null) setOrigin(id)
}, { signal: events.signal })
element('scene-context-backdrop').addEventListener('click', closeSceneContextMenu, { signal: events.signal })
element('scene-context-backdrop').addEventListener('contextmenu', (event) => {
  event.preventDefault()
  closeSceneContextMenu()
}, { signal: events.signal })
document.addEventListener('pointermove', (event) => {
  if (event.pointerId === sceneMenuPointerId) highlightSceneMenuItem(sceneMenuItemAt(event))
}, { passive: true, signal: events.signal })
document.addEventListener('pointerup', (event) => {
  if (event.pointerId !== sceneMenuPointerId) return
  const item = sceneMenuItemAt(event)
  sceneMenuPointerId = null
  highlightSceneMenuItem(null)
  item?.click()
}, { signal: events.signal })
document.addEventListener('pointercancel', (event) => {
  if (event.pointerId !== sceneMenuPointerId) return
  sceneMenuPointerId = null
  highlightSceneMenuItem(null)
}, { signal: events.signal })
window.addEventListener('resize', () => {
  closeSavedViewContextMenu()
  closeSceneContextMenu()
}, { signal: events.signal })
document.addEventListener('keydown', (event) => {
  if (element<HTMLDialogElement>('browser-data-dialog').open) return
  if (!element('saved-view-context-menu').hidden) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      closeSavedViewContextMenu(true)
      event.preventDefault()
      return
    }
  }
  if (!element('scene-context-menu').hidden) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      closeSceneContextMenu()
      event.preventDefault()
      return
    }
  }
  if (event.key !== 'Escape') return
  if (starComparison.abort()) {
    event.preventDefault()
    return
  }
  if (!element('constellation-card').hidden) {
    closeConstellationCard(true)
    return
  }
  if (!element('planet-card').hidden) {
    closePlanetCard(true)
    return
  }
  if (!element('mass-card').hidden) {
    closeMassCard(true)
    return
  }
  if (!element('temperature-card').hidden) {
    closeTemperatureCard(true)
    return
  }
  if (!element('luminosity-card').hidden) {
    closeLuminosityCard(true)
    return
  }
  if (!element('magnitude-card').hidden) {
    closeMagnitudeCard(true)
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
  if (!element('pulsar-card').hidden) {
    closePulsarCard(true)
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
  element(panelToggleId(open)).focus()
}, { signal: events.signal })
for (const name of detailCardNames) {
  element(`${name}-close`).addEventListener('click', () => detailCardClosers[name](true), { signal: events.signal })
  element(`${name}-lock`).addEventListener('click', () => {
    if (lockedDetailCards.has(name)) lockedDetailCards.delete(name)
    else lockedDetailCards.add(name)
    element(`${name}-lock`).setAttribute('aria-pressed', String(lockedDetailCards.has(name)))
  }, { signal: events.signal })
}
document.querySelector('.object-type-row')!.addEventListener('click', () => toggleObjectTypeCard(), { signal: events.signal })
document.querySelector('.metallicity-row')!.addEventListener('click', toggleMetallicityCard, { signal: events.signal })
document.querySelector('.distance-row')!.addEventListener('click', toggleDistanceCard, { signal: events.signal })
element('constellation-row').addEventListener('click', () => {
  if (!element<HTMLButtonElement>('constellation-toggle').disabled) void toggleConstellationCard()
}, { signal: events.signal })
element('constellation-magnify').addEventListener('click', () => {
  const star = sideDetailStar(constellationStarId)
  if (!star) return
  constellationMagnified = !constellationMagnified
  renderConstellationCard(star)
}, { signal: events.signal })
element('constellation-grid').addEventListener('click', () => {
  const star = sideDetailStar(constellationStarId)
  if (!star) return
  constellationEquatorialGrid = !constellationEquatorialGrid
  renderConstellationCard(star)
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
element('temperature-row').addEventListener('click', toggleTemperatureCard, { signal: events.signal })
element('luminosity-row').addEventListener('click', toggleLuminosityCard, { signal: events.signal })
element('magnitude-row').addEventListener('click', toggleMagnitudeCard, { signal: events.signal })
document.querySelector('.radius-row')!.addEventListener('click', toggleRadiusCard, { signal: events.signal })
document.querySelector('.spectral-row')!.addEventListener('click', toggleSpectralCard, { signal: events.signal })
element('rotation-row').addEventListener('click', togglePulsarCard, { signal: events.signal })
for (const diagram of ['hr', 'mk', 'wd', 'kiel'] as const) {
  element(`spectral-${diagram}`).addEventListener('click', () => {
    const chosen = diagram === 'mk' || diagram === 'wd' ? 'class' : diagram
    // A second tap on the chosen tab only shows its touch tooltip.
    if (spectralDiagram === chosen) return
    spectralDiagram = chosen
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
for (const toggle of ['spectral-catalog', 'spectral-kiel-catalog']) {
  element(toggle).addEventListener('click', () => {
    spectralCatalogStars = !spectralCatalogStars
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
  gridVisible = !gridVisible
  viewer.setGridVisible(gridVisible)
  syncGridInputs()
}, { signal: events.signal })
for (const frame of ['equatorial', 'galactic'] as const) {
  element(`toggle-${frame}-grid`).addEventListener('click', () => {
    if (!viewer) return
    skyGridMode = skyGridMode === frame ? 'off' : frame
    viewer.setSkyGrid(skyGridMode)
    syncGridInputs()
  }, { signal: events.signal })
}
element('selection-back').addEventListener('click', () => navigateSelectionHistory('back'), { signal: events.signal })
element('selection-forward').addEventListener('click', () => navigateSelectionHistory('forward'), { signal: events.signal })
element('set-origin').addEventListener('click', setSelectedAsOrigin, { signal: events.signal })
element('set-sun-origin').addEventListener('click', () => setOrigin('sun'), { signal: events.signal })
element('go-to-origin').addEventListener('click', () => {
  dismissOpenPanel()
  if (observerView) toggleObserverView()
  selectStar(referenceId)
}, { signal: events.signal })
element('observer-view').addEventListener('click', toggleObserverView, { signal: events.signal })
element('visibility-lock').addEventListener('click', toggleVisibilityLock, { signal: events.signal })
element('observer-view-origin').addEventListener('click', () => setObserverViewAnchor(referenceId), { signal: events.signal })
element('observer-object').addEventListener('click', () => {
  if (observerViewAnchorId !== null) selectStar(observerViewAnchorId)
}, { signal: events.signal })
element('observer-roll-counterclockwise').addEventListener('click', () => rollObserverView('counterclockwise'), { signal: events.signal })
element('observer-telescope').addEventListener('click', () => {
  if (!viewer || sceneBusy || !observerView) return
  viewer.setObserverTelescope(!viewer.getViewState().observerTelescope)
  updateObserverControl()
}, { signal: events.signal })
element('observer-roll-reset').addEventListener('click', () => rollObserverView('center'), { signal: events.signal })
element('observer-roll-clockwise').addEventListener('click', () => rollObserverView('clockwise'), { signal: events.signal })

const selectedObjectLayout = new ResizeObserver(syncObjectTypeLayout)
selectedObjectLayout.observe(element('selected-object-card'))

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
  selectedObjectLayout.disconnect()
  observerDirectionLayout.disconnect()
  if (playbackFrameRequest !== null) cancelAnimationFrame(playbackFrameRequest)
  viewer?.dispose()
  distanceCardModule?.disposeDistanceComparison()
  luminosityCardModule?.disposeLuminosityCard()
  constellationCardModule?.disposeConstellationCard()
  planetModules?.disposePlanetGlobe()
})
