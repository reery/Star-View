import index from './data/generated/startup-index.json'
import { MISSING_VALUE } from './format'
import type { ExtrasolarPlanet } from './exoplanet-properties'

export interface KnownPlanet {
  readonly id: string
  readonly name: string
  readonly semiMajorAxisAu: number | null
  readonly distanceKind?: string
  readonly distanceLimit?: number
  readonly color: string
}

export interface PlanetarySystem {
  readonly hostStarId: string
  readonly name: string
  readonly source: { readonly label: string; readonly url: string; readonly epoch: string; readonly note: string }
  readonly planets: readonly KnownPlanet[]
}

// Reviewed host identities only. An absent entry means coverage is unavailable,
// rather than that the star has no planets.
const systems = new Map<string, PlanetarySystem>()
const planets = new Map<string, ExtrasolarPlanet>()
const pending = new Map<string, Promise<void>>()
// Exact catalog IDs of the same host in another catalog, sharing that host's system.
const hostAliases: Readonly<Record<string, string>> = index.planetHostAliases

/** Catalog ID under which this star's planets are stored. */
export function planetHostId(starId: string): string {
  return hostAliases[starId] ?? starId
}

/** Fetch only this exact host, including its planet measurements for detail cards. */
export function loadPlanetarySystem(starId: string): Promise<void> {
  if (planetCountForStar(starId) === undefined) return Promise.resolve()
  let result = pending.get(starId)
  if (!result) {
    result = import('./planetary-system-data').then(({ loadPlanetarySystemData }) => loadPlanetarySystemData(planetHostId(starId)))
      .then((payload) => {
        systems.set(starId, { ...payload.system, hostStarId: starId })
        for (const planet of payload.planets) planets.set(planet.id, planet)
      }).catch((error: unknown) => { pending.delete(starId); throw error })
    pending.set(starId, result)
  }
  return result
}

export function extrasolarPlanetForId(id: string): ExtrasolarPlanet | undefined {
  return planets.get(id)
}

export function planetCountForStar(starId: string): number | undefined {
  return (index.planetCounts as Readonly<Record<string, number>>)[planetHostId(starId)]
}

export function planetarySystemForStar(starId: string): PlanetarySystem | undefined {
  return systems.get(starId)
}

export function formatOrbitalDistance(planet: KnownPlanet): string {
  if (planet.semiMajorAxisAu === null) return MISSING_VALUE
  const prefix = planet.distanceLimit === 1 ? '< ' : planet.distanceLimit === -1 ? '> ' : ''
  const precision = planet.distanceKind ? { maximumSignificantDigits: 3 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  return `${prefix}${planet.semiMajorAxisAu.toLocaleString('en-US', precision)} AU${planet.distanceKind === 'projected' ? ' projected' : ''}`
}
