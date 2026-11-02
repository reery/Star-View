import type { PlanetarySystem } from './planetary-systems'
import type { ExtrasolarPlanet } from './exoplanet-properties'
import { loadDataShardEntry } from './data-shards'

export interface PlanetarySystemPayload {
  system: PlanetarySystem
  planets: ExtrasolarPlanet[]
}

export async function loadPlanetarySystemData(starId: string): Promise<PlanetarySystemPayload> {
  const payload = await loadDataShardEntry<PlanetarySystemPayload>('planetary-system', starId)
  if (!payload) throw new Error(`Missing planetary system: ${starId}`)
  return payload
}
