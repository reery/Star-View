import type { Star } from './catalog-model.ts'
import companionData from './data/stellar-companions.json' with { type: 'json' }
import { completeCompanionRecords } from './companion-records.ts'

const records = new Map((companionData.stars as Star[]).map((star) => [star.id, star]))

/** Authoring-only full pool. Browser catalogs are completed at generation time. */
export function completeCatalogCompanions(stars: readonly Star[]): Star[] {
  return completeCompanionRecords(stars, records)
}
