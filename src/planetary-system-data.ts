import type { PlanetarySystem } from './planetary-systems'
import type { ExtrasolarPlanet } from './exoplanet-properties'
import { loadJsonData } from './json-data'

export interface PlanetarySystemPayload {
  system: PlanetarySystem
  planets: ExtrasolarPlanet[]
}

const payloads = import.meta.glob<string>([
  './data/generated/planetary-systems/*.json',
  '!./data/generated/planetary-systems/* [0-9]*.json',
], { query: '?url&no-inline', import: 'default', eager: true })

export function loadPlanetarySystemData(starId: string): Promise<PlanetarySystemPayload> {
  const url = payloads[`./data/generated/planetary-systems/planetary-system-${starId}.json`]
  if (!url) return Promise.reject(new Error(`Missing planetary system: ${starId}`))
  return loadJsonData<PlanetarySystemPayload>(url)
}
