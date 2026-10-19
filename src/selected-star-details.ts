import type { Star } from './catalog-model'

const loaded = new WeakSet<Star>()
const pending = new WeakMap<Star, Promise<void>>()

export function starDetailsLoaded(star: Star): boolean {
  return !star.catalog_detail_key && !star.catalog_note_supplements?.length || loaded.has(star)
}

export function loadStarDetails(star: Star): Promise<void> {
  if (starDetailsLoaded(star)) return Promise.resolve()
  let result = pending.get(star)
  if (!result) {
    result = import('./catalog-details').then(({ hydrateStarDetails }) => hydrateStarDetails(star))
      .then(() => { loaded.add(star) })
      .catch((error: unknown) => { pending.delete(star); throw error })
    pending.set(star, result)
  }
  return result
}
