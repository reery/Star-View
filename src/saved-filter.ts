import { isFilterCategoryId, isFilterKey, type FilterCategoryId, type FilterKey } from './object-filter'
import { OBJECT_DISTANCE_STEPS_LY } from './saved-views'

export const SAVED_FILTER_STORAGE_KEY = 'star-view-saved-filter'

export interface SavedFilter {
  version: 1
  catalogId: string
  showAlwaysBright: boolean
  showWesternConstellationStars: boolean
  filterCategories: FilterCategoryId[]
  filterSubtypes: FilterKey[]
  magnitudeLimit: number
  objectDistanceLimitLy: number
}

export function readSavedFilter(catalogIds: readonly string[]): SavedFilter | null {
  try {
    const stored = localStorage.getItem(SAVED_FILTER_STORAGE_KEY)
    if (!stored) return null
    const value: unknown = JSON.parse(stored)
    if (typeof value !== 'object' || value === null) return null
    const filter = value as Record<string, unknown>
    if (filter.version !== 1
      || typeof filter.catalogId !== 'string' || !catalogIds.includes(filter.catalogId)
      || typeof filter.showAlwaysBright !== 'boolean'
      || typeof filter.showWesternConstellationStars !== 'boolean'
      || !Array.isArray(filter.filterCategories) || !filter.filterCategories.every(isFilterCategoryId)
      || !Array.isArray(filter.filterSubtypes) || !filter.filterSubtypes.every(isFilterKey)
      || typeof filter.magnitudeLimit !== 'number' || !Number.isFinite(filter.magnitudeLimit) || filter.magnitudeLimit < 0 || filter.magnitudeLimit > 25
      || typeof filter.objectDistanceLimitLy !== 'number' || !OBJECT_DISTANCE_STEPS_LY.includes(filter.objectDistanceLimitLy as typeof OBJECT_DISTANCE_STEPS_LY[number])) return null
    return filter as unknown as SavedFilter
  } catch {
    return null
  }
}
