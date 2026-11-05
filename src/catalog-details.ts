import type { Star } from './catalog-model'
import type { CatalogDetails } from './catalog-detail-model'
import { loadDataShardEntry } from './data-shards'
import { uniqueDesignations } from './designations'

// Keys end in a content hash; identical notes share one shard entry under that hash.
const DETAIL_KEY = /-([0-9a-f]{16})$/
const pending = new Map<string, Promise<CatalogDetails>>()

function loadDetails(key: string): Promise<CatalogDetails> {
  const hash = DETAIL_KEY.exec(key)?.[1]
  if (!hash) return Promise.reject(new Error(`Invalid catalog source-note key: ${key}`))
  let result = pending.get(hash)
  if (!result) {
    result = loadDataShardEntry<CatalogDetails>('catalog-detail', hash)
      .then((details) => details ?? Promise.reject(new Error(`Missing catalog source notes: ${key}`)))
      .catch((error: unknown) => { pending.delete(hash); throw error })
    pending.set(hash, result)
  }
  return result
}

/** Hydrate only a scene-owned copy, leaving memoized map payloads untouched. */
export async function hydrateStarDetails(star: Star): Promise<void> {
  const parts = star.catalog_designation_parts
  const [details, supplements, designationDetails] = await Promise.all([
    star.catalog_detail_key ? loadDetails(star.catalog_detail_key) : Promise.resolve<CatalogDetails>({ notes: star.notes, catalog_sources: star.catalog_sources }),
    Promise.all(star.catalog_note_supplements?.map(({ key, notes }) => key ? loadDetails(key) : Promise.resolve({ notes: notes ?? '' })) ?? []),
    Promise.all(parts?.map((part) => 'key' in part ? loadDetails(part.key).then((loaded) => loaded.designations ?? []) : Promise.resolve(part.names)) ?? []),
  ])
  let notes = details.notes
  supplements.forEach((supplement, index) => {
    notes = `${notes} Additional catalog supplements ${star.catalog_note_supplements![index]!.fields.join(', ')}. ${supplement.notes}`.trim()
  })
  star.notes = notes
  if (details.catalog_sources) star.catalog_sources = details.catalog_sources
  // A record that carries these itself, such as a chart's, keeps its own.
  if (details.raw_astrometry && star.raw_astrometry === null) star.raw_astrometry = details.raw_astrometry
  if (star.designations === undefined) {
    const designations = parts ? uniqueDesignations(designationDetails.flat(), star.name) : details.designations
    if (designations) star.designations = designations
  }
}
