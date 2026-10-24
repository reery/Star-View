import type { Star } from './catalog-model'
import { completeCompanionRecords } from './companion-records'

// Each chart carries only its reviewed component records, including companions.
const payloads = import.meta.glob<Star[]>([
  './data/generated/constellation-companions/*.json',
  '!./data/generated/constellation-companions/* [0-9]*.json',
], { import: 'default' })
const pending = new Map<string, Promise<void>>()
const records = new Map<string, Star>()

export function loadConstellationCompanions(name: string): Promise<void> {
  let loaded = pending.get(name)
  if (!loaded) {
    const load = payloads[`./data/generated/constellation-companions/${name}.json`]
    if (!load) return Promise.reject(new Error(`Missing constellation components: ${name}`))
    loaded = load().then((stars) => { for (const star of stars) records.set(star.id, star) })
      .catch((error: unknown) => { pending.delete(name); throw error })
    pending.set(name, loaded)
  }
  return loaded
}

export function completeLoadedCompanions(stars: readonly Star[]): Star[] {
  return completeCompanionRecords(stars, records)
}
