import type { Star } from './catalog-model'
import { designationParts, objectDesignations } from './designations'
import { loadJsonData } from './json-data'

const urls = import.meta.glob<string>([
  './data/generated/catalog-designations/designations-*.json',
  '!./data/generated/catalog-designations/* [0-9]*.json',
], { query: '?url&no-inline', import: 'default', eager: true })

const entries = new Map<string, readonly string[]>()
const pending = new Map<string, Promise<void>>()
const entryKey = (detailKey: string) => detailKey.slice(-16)

/** One request per catalog; a failed request is retried on the next call. */
export function loadCatalogDesignations(catalogId: string): Promise<void> {
  let result = pending.get(catalogId)
  if (!result) {
    result = loadJsonData<Record<string, string[]>>(urls[`./data/generated/catalog-designations/designations-${catalogId}.json`]!)
      .then((loaded) => { for (const [key, names] of Object.entries(loaded)) entries.set(key, names) })
      .catch((error: unknown) => { pending.delete(catalogId); throw error })
    pending.set(catalogId, result)
  }
  return result
}

/** Whether search can already see all of a row's designations. */
export function designationsAvailable(star: Star): boolean {
  return star.designations !== undefined || designationParts(star).every((part) => 'names' in part || entries.has(entryKey(part.key)))
}

/** A row's designations for search: its own once hydrated, otherwise those of the catalogs loaded so far. */
export function searchableDesignations(star: Star): readonly string[] {
  if (star.designations !== undefined) return objectDesignations(star)
  return designationParts(star).flatMap((part) => 'names' in part ? part.names : entries.get(entryKey(part.key)) ?? [])
}
