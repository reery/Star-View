import { describe, expect, it, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseStarCatalog } from './catalog'
import { completeCatalogCompanions } from './stellar-companions'
import { indexStarSystems, primarySystemStarId, reviewedStarSystems } from './star-systems'
import { loadStellarOrbits, orbitalPlanePoint, orbitBarycenterVisible, orbitHasGeometry, orbitMassFraction, projectedOrbitPoint, stellarOrbitsForSystem, type StellarOrbit } from './stellar-orbits'
import data from './data/stellar-orbits.json'

const stars = completeCatalogCompanions(parseStarCatalog(readFileSync(new URL('./data/stars.csv', import.meta.url), 'utf8')))
const systems = indexStarSystems(stars)
beforeAll(loadStellarOrbits)

describe('reviewed stellar orbits', () => {
  it('audits every reviewed system and retains exact disjoint component scopes', () => {
    expect(new Set(data.systems.map((s) => s.systemId))).toEqual(new Set(reviewedStarSystems.map((s) => s.id)))
    for (const system of data.systems) {
      const ids = new Set(reviewedStarSystems.find((s) => s.id === system.systemId)!.components.map((c) => c.starId))
      const pairs = new Set<string>()
      for (const orbit of system.orbits) {
        expect(orbit.periodYears).toBeGreaterThan(0)
        expect(orbit.primaryIds.length).toBeGreaterThan(0)
        expect(orbit.secondaryIds.length).toBeGreaterThan(0)
        for (const id of [...orbit.primaryIds, ...orbit.secondaryIds]) expect(ids.has(id)).toBe(true)
        expect(orbit.primaryIds.some((id) => orbit.secondaryIds.includes(id))).toBe(false)
        if (orbit.semiMajorAxisAu !== null) expect(orbit.semiMajorAxisAu).toBeGreaterThan(0)
        if (orbit.eccentricity !== null) {
          expect(orbit.eccentricity).toBeGreaterThanOrEqual(0)
          expect(orbit.eccentricity).toBeLessThan(1)
        }
        const pair = [orbit.primaryIds.slice().sort().join(','), orbit.secondaryIds.slice().sort().join(',')].sort().join('|')
        expect(pairs.has(pair)).toBe(false)
        pairs.add(pair)
        if (orbit.grade === 9) expect(orbit.semiMajorAxisAu).toBeNull()
      }
    }
  })

  it('uses the Sirius relative axis, not either individual barycentric axis', () => {
    const system = systems.get('sirius-b')!
    const [orbit] = stellarOrbitsForSystem(system)
    expect(orbit!.periodYears).toBeCloseTo(50.1284)
    expect(orbit!.semiMajorAxisAu).toBeCloseTo(19.7666, 3)
    expect(orbitHasGeometry(orbit!)).toBe(true)
    expect(orbitBarycenterVisible(system, orbit!)).toBe(true)
    const fraction = orbitMassFraction(system, orbit!)!
    expect(fraction).toBeGreaterThan(0.3)
    expect(fraction).toBeLessThan(0.4)
    expect(primarySystemStarId(system)).toBe('sirius-a')
  })

  it('attaches Proxima to the AB center of mass and hides unavailable catalog branches', () => {
    const system = systems.get('proxima-centauri')!
    const outer = stellarOrbitsForSystem(system).find((o) => o.secondary === 'C')!
    expect(outer.primaryIds).toEqual(['alpha-centauri-a', 'alpha-centauri-b'])
    expect(outer.secondaryIds).toEqual(['proxima-centauri'])
    expect(outer.periodYears).toBe(547000)
    expect(stellarOrbitsForSystem({ ...system, components: system.components.filter((c) => c.label !== 'C') })).toHaveLength(1)
  })

  it('does not invent a barycenter when a required mass is unavailable', () => {
    const system = systems.get('sirius-a')!
    const orbit = stellarOrbitsForSystem(system)[0]!
    const missing = { ...system, components: system.components.map((c) => ({ ...c, star: { ...c.star, mass_solar: null } })) }
    expect(orbitMassFraction(missing, orbit)).toBeNull()
    expect(orbitBarycenterVisible(missing, orbit)).toBe(false)
  })

  it('suppresses an interior barycenter and incomplete orbital geometry', () => {
    const system = systems.get('sirius-a')!
    const orbit = stellarOrbitsForSystem(system)[0]!
    expect(orbitBarycenterVisible(system, { ...orbit, semiMajorAxisAu: 0.001 })).toBe(false)
    expect(orbitHasGeometry({ ...orbit, inclinationDeg: null })).toBe(false)
  })

  it('projects face-on and edge-on orbits in the astronomical sky convention', () => {
    const orbit = { eccentricity: 0, inclinationDeg: 0, nodeDeg: 0, argumentDeg: 0, primary: 'A', argumentComponent: 'B' } as StellarOrbit
    expect(projectedOrbitPoint(orbit, 0).y).toBeCloseTo(-1)
    expect(projectedOrbitPoint(orbit, Math.PI / 2).x).toBeCloseTo(-1)
    expect(projectedOrbitPoint({ ...orbit, inclinationDeg: 90 }, Math.PI / 2).x).toBeCloseTo(0)
    expect(projectedOrbitPoint({ ...orbit, argumentComponent: 'A' }, 0).y).toBeCloseTo(1)
  })

  it('shows the unforeshortened orbital ellipse from above', () => {
    const orbit = { eccentricity: 0.5, inclinationDeg: 90, nodeDeg: 123, argumentDeg: 42 } as StellarOrbit
    expect(orbitalPlanePoint(orbit, 0).x).toBeCloseTo(0.5)
    expect(orbitalPlanePoint(orbit, Math.PI).x).toBeCloseTo(-1.5)
    const top = orbitalPlanePoint(orbit, Math.PI / 2)
    expect(top.x).toBeCloseTo(-0.5)
    expect(top.y).toBeCloseTo(-Math.sqrt(0.75))
    expect(orbitalPlanePoint({ ...orbit, inclinationDeg: 0, nodeDeg: 0, argumentDeg: 0 }, Math.PI / 2)).toEqual(top)
  })
})
