import index from './data/generated/startup-index.json'
import { MISSING_VALUE } from './format'

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
let nearbyLoad: Promise<void> | undefined

/** The large exoplanet dataset stays out of the startup bundle. */
export function loadPlanetarySystems(): Promise<void> {
  return nearbyLoad ??= Promise.all([import('./data/planetary-systems.json'), import('./data/nearby-planets.json')]).then(([{ default: definitions }, { default: nearby }]) => {
    for (const system of [...definitions.systems, ...nearby.systems]) systems.set(system.hostStarId, system)
  }).catch((error: unknown) => {
    nearbyLoad = undefined
    throw error
  })
}

export function planetCountForStar(starId: string): number | undefined {
  return (index.planetCounts as Readonly<Record<string, number>>)[starId]
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
