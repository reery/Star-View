import definitions from './data/planetary-systems.json'

export interface KnownPlanet {
  readonly id: string
  readonly name: string
  readonly semiMajorAxisAu: number
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
const systems = new Map<string, PlanetarySystem>(definitions.systems.map((system) => [system.hostStarId, system]))

export function planetarySystemForStar(starId: string): PlanetarySystem | undefined {
  return systems.get(starId)
}

export function formatOrbitalDistance(planet: KnownPlanet): string {
  return `${planet.semiMajorAxisAu.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AU`
}
