import { isEarthOrbitMode, type EarthOrbitMode } from './earth-orbit'
import { isFilterCategoryId, isFilterKey, type FilterCategoryId, type FilterKey } from './object-filter'
import { MOTION_YEAR_OPTIONS, SIMULATION_YEAR_LIMIT, type MotionYears, type ViewerViewState } from './viewer'
import type { MotionFrame } from './astronomy'
import type { SkyGridMode } from './sky-grid'
import { isPaintSettingId, PAINT_CHANNELS, PAINT_LEVEL_RANGE, type PaintChannel, type PaintSettingId } from './star-paint'
import type { SavedGraphSelection } from './graphs'

export const SAVED_VIEWS_STORAGE_KEY = 'star-view-saved-views'
export const OBJECT_DISTANCE_STEPS_LY = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 150, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 10000] as const

export interface SavedViewSettings {
  catalogId: string
  /** Legacy saved views use this flag to enable the constellation catalog that now holds the bright stars. */
  showAlwaysBright: boolean
  showWesternConstellationStars: boolean
  /** Absent in entries saved before the catalog existed. */
  showNotableDistantStars?: boolean
  /** Legacy saved views use this flag to enable the combined constellation catalog. */
  showFamousClusterStars: boolean
  filterCategories: FilterCategoryId[]
  filterSubtypes: FilterKey[]
  magnitudeLimit: number
  /** Absent in views saved before the option existed. */
  hideFainterObjects?: boolean
  objectDistanceLimitLy: number
  earthOrbitMode: EarthOrbitMode
  milkyWayVisible: boolean
  motionArrowsVisible: boolean
  motionYears: MotionYears
  motionFrame: MotionFrame
  gridVisible: boolean
  skyGridMode?: SkyGridMode
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
  /** Absent in views saved before graph filters and paint were stored. */
  graphFilter?: SavedGraphSelection[]
  /** Channels are absent in views saved before settings could share the paint. */
  paint?: [PaintSettingId, number, PaintChannel[]?][]
}

export interface SavedView {
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

const isRangeEnd = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value))

function isGraphSelection(value: unknown): value is SavedGraphSelection {
  return isRecord(value) && typeof value.section === 'string' && typeof value.key === 'string' && typeof value.label === 'string'
    && (value.range === undefined || (Array.isArray(value.range) && (value.range.length === 2 || value.range.length === 4) && value.range.every(isRangeEnd)))
}

function isPaintChannels(value: unknown): value is PaintChannel[] {
  return Array.isArray(value) && value.length > 0 && value.every((channel, index) => PAINT_CHANNELS.includes(channel) && value.indexOf(channel) === index)
}

function isPaintEntry(value: unknown): value is [PaintSettingId, number, PaintChannel[]?] {
  return Array.isArray(value) && (value.length === 2 || (value.length === 3 && isPaintChannels(value[2]))) && isPaintSettingId(value[0])
    && typeof value[1] === 'number' && value[1] >= PAINT_LEVEL_RANGE[0] && value[1] <= PAINT_LEVEL_RANGE[1]
}

function isFiniteTuple3(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
}

// Storage is user-controlled input: validate every field before it reaches the viewer.
function isSavedView(value: unknown): value is SavedView {
  if (!isRecord(value) || value.version !== 1 || typeof value.id !== 'string' || typeof value.name !== 'string' || !value.name.trim()
    || typeof value.originName !== 'string' || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) || !isRecord(value.settings)) return false
  const settings = value.settings
  const viewState = settings.viewState
  return typeof settings.catalogId === 'string'
    && typeof settings.showAlwaysBright === 'boolean'
    && typeof settings.showWesternConstellationStars === 'boolean'
    && (settings.showNotableDistantStars === undefined || typeof settings.showNotableDistantStars === 'boolean')
    && typeof settings.showFamousClusterStars === 'boolean'
    && Array.isArray(settings.filterCategories) && settings.filterCategories.every(isFilterCategoryId)
    && Array.isArray(settings.filterSubtypes) && settings.filterSubtypes.every(isFilterKey)
    && typeof settings.magnitudeLimit === 'number' && settings.magnitudeLimit >= 0 && settings.magnitudeLimit <= 25
    && (settings.hideFainterObjects === undefined || typeof settings.hideFainterObjects === 'boolean')
    && typeof settings.objectDistanceLimitLy === 'number' && OBJECT_DISTANCE_STEPS_LY.includes(settings.objectDistanceLimitLy as typeof OBJECT_DISTANCE_STEPS_LY[number])
    && typeof settings.earthOrbitMode === 'string' && isEarthOrbitMode(settings.earthOrbitMode)
    && typeof settings.milkyWayVisible === 'boolean'
    && typeof settings.motionArrowsVisible === 'boolean'
    && typeof settings.motionYears === 'number' && MOTION_YEAR_OPTIONS.includes(settings.motionYears as MotionYears)
    && (settings.motionFrame === 'galactic' || settings.motionFrame === 'solar')
    && typeof settings.gridVisible === 'boolean'
    && (settings.skyGridMode === undefined || settings.skyGridMode === 'off' || settings.skyGridMode === 'equatorial' || settings.skyGridMode === 'galactic')
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
    && (viewState.observerTelescope === undefined || typeof viewState.observerTelescope === 'boolean')
    && (settings.graphFilter === undefined || (Array.isArray(settings.graphFilter) && settings.graphFilter.every(isGraphSelection)))
    && (settings.paint === undefined || (Array.isArray(settings.paint) && settings.paint.every(isPaintEntry)))
}

export function readSavedViews(): SavedView[] {
  try {
    const stored = localStorage.getItem(SAVED_VIEWS_STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter(isSavedView).sort((first, second) => Date.parse(second.savedAt) - Date.parse(first.savedAt)) : []
  } catch {
    return []
  }
}
