import { isEarthOrbitMode, type EarthOrbitMode } from './earth-orbit'
import { isFilterCategoryId, isFilterKey, type FilterCategoryId, type FilterKey } from './object-filter'
import { MOTION_YEAR_OPTIONS, SIMULATION_YEAR_LIMIT, type MotionYears, type ViewerViewState } from './viewer'
import type { MotionFrame } from './astronomy'

export const SAVED_VIEWS_STORAGE_KEY = 'star-view-saved-views'
export const OBJECT_DISTANCE_STEPS_LY = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 150, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 10000] as const

export interface SavedViewSettings {
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
