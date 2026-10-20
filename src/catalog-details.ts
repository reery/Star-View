import type { Star } from './catalog-model'
import type { CatalogDetails } from './catalog-detail-model'
import { loadJsonData } from './json-data'

// Keys end in a content hash; vite.config.ts emits each payload under that hash.
const DETAIL_KEY = /-([0-9a-f]{16})$/
const pending = new Map<string, Promise<CatalogDetails>>()

function loadDetails(key: string): Promise<CatalogDetails> {
  const hash = DETAIL_KEY.exec(key)?.[1]
  if (!hash) return Promise.reject(new Error(`Invalid catalog source-note key: ${key}`))
  let result = pending.get(hash)
  if (!result) {
    result = loadJsonData<CatalogDetails>(`${import.meta.env.BASE_URL}assets/catalog-details/${hash}.json`)
      .catch((error: unknown) => { pending.delete(hash); throw error })
    pending.set(hash, result)
  }
  return result
}

/** Hydrate only a scene-owned copy, leaving memoized map payloads untouched. */
export async function hydrateStarDetails(star: Star): Promise<void> {
  const [details, ...supplements] = await Promise.all([
    star.catalog_detail_key ? loadDetails(star.catalog_detail_key) : Promise.resolve({ notes: star.notes, catalog_sources: star.catalog_sources }),
    ...star.catalog_note_supplements?.map(({ key, notes }) => key ? loadDetails(key) : Promise.resolve({ notes: notes ?? '' })) ?? [],
  ])
  let notes = details!.notes
  supplements.forEach((supplement, index) => {
    notes = `${notes} Additional catalog supplements ${star.catalog_note_supplements![index]!.fields.join(', ')}. ${supplement.notes}`.trim()
  })
  star.notes = notes
  if (details!.catalog_sources) star.catalog_sources = details!.catalog_sources
}
