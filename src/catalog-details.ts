import type { Star } from './catalog-model'
import type { CatalogDetails } from './catalog-detail-model'
import { loadJsonData } from './json-data'

const payloads = import.meta.glob<string>([
  './data/generated/catalog-details/*.json',
  '!./data/generated/catalog-details/* [0-9]*.json',
], { query: '?url&no-inline', import: 'default', eager: true })
const pending = new Map<string, Promise<CatalogDetails>>()

function loadDetails(key: string): Promise<CatalogDetails> {
  let result = pending.get(key)
  if (!result) {
    const url = payloads[`./data/generated/catalog-details/catalog-detail-${key}.json`]
    if (!url) return Promise.reject(new Error(`Missing catalog source notes: ${key}`))
    result = loadJsonData<CatalogDetails>(url).catch((error: unknown) => { pending.delete(key); throw error })
    pending.set(key, result)
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
