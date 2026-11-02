import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { generatedJsonFetch } from './test-support/generated-json'
import nearby from './data/nearby-planets.json'
import stats from './data/object-stats.json'
import { extrasolarPhysicalSpecs, extrasolarOrbitalSpecs, type ExtrasolarPlanet } from './exoplanet-properties'
import { planetDescriptionForId } from './planet-properties'
import { loadPlanetarySystem, planetarySystemForStar, planetCountForStar, planetHostId, formatOrbitalDistance } from './planetary-systems'

const extrasolarPlanets = nearby.planets as readonly ExtrasolarPlanet[]
beforeAll(async () => {
  vi.stubGlobal('fetch', generatedJsonFetch)
  await Promise.all(nearby.systems.map((system) => loadPlanetarySystem(system.hostStarId)))
})
afterAll(() => vi.unstubAllGlobals())

describe('nearby exoplanet coverage and scientific qualifications', () => {
  it('covers every frozen host count and connects all rows to a detail card', () => {
    // 256 nearest-5000 and western constellation stellar hosts plus the pulsars Lich and PSR J1719-1438.
    expect(nearby.systems).toHaveLength(258)
    expect(extrasolarPlanets).toHaveLength(433)
    for (const system of nearby.systems) {
      const hostStats = stats.objects[system.hostStarId as keyof typeof stats.objects]
      expect(system.planets).toHaveLength(hostStats.known_planets!)
      expect(planetarySystemForStar(system.hostStarId)).toBeDefined()
      for (const planet of system.planets) {
        const description = planetDescriptionForId(planet.id)!
        expect(description.hostStarId).toBe(system.hostStarId)
        expect(JSON.stringify(extrasolarPhysicalSpecs(description as typeof extrasolarPlanets[number]))).not.toMatch(/NaN|Infinity|undefined/)
      }
    }
  })

  it('serves another catalog ID of the same host from that host system', async () => {
    // Ran in the western constellation catalog is Epsilon Eridani in nearest-100.
    expect(planetHostId('hip-16537')).toBe('epsilon-eridani')
    expect(planetCountForStar('hip-16537')).toBe(planetCountForStar('epsilon-eridani'))
    await loadPlanetarySystem('hip-16537')
    expect(planetarySystemForStar('hip-16537')).toMatchObject({ hostStarId: 'hip-16537', planets: planetarySystemForStar('epsilon-eridani')!.planets })
  })

  it('distinguishes minimum mass, calculated radii and equilibrium temperature', () => {
    const planet = extrasolarPlanets.find((planet) => planet.id === 'exo-proxima-cen-b')!
    const specs = extrasolarPhysicalSpecs(planet)
    expect(specs.find((spec) => spec.id === 'mass')).toMatchObject({ label: 'Minimum mass (m sin i)', comparison: '1.06×Earth' })
    expect(specs.find((spec) => spec.id === 'radius')!.value).toContain('estimated')
    expect(specs.find((spec) => spec.id === 'temperature')!.detail).toContain('Not a measured surface temperature')
    expect(specs.map((spec) => spec.id)).not.toContain('surface-gravity')
  })

  it('omits unavailable properties and preserves upper limits in comparisons', () => {
    const planet = extrasolarPlanets[0]!
    expect(extrasolarPhysicalSpecs({ ...planet, metrics: {} })).toEqual([])
    const limited = extrasolarPhysicalSpecs({ ...planet, metrics: { pl_bmasse: { ...planet.metrics.pl_bmasse!, limit: 1 } } })[0]!
    expect(limited.value).toMatch(/^< /)
    expect(limited.comparison).toMatch(/^< /)
    const missing = extrasolarPlanets.find((planet) => planet.name === 'GJ 367 c')!
    expect(extrasolarOrbitalSpecs(missing).map((spec) => spec.id)).not.toContain('semi-major-axis')
    expect(formatOrbitalDistance(planetarySystemForStar(missing.hostStarId)!.planets.find((planet) => planet.id === missing.id)!)).toBe('—')
  })
})
