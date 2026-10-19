import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { generatedJsonFetch } from './test-support/generated-json'
import { readFileSync } from 'node:fs'
import { parseStarCatalog } from './catalog'
import { completeCatalogCompanions } from './stellar-companions'
import { indexStarSystems, reviewedStarSystems } from './star-systems'
import { loadStellarOrbits, orbitalPlanePoint, orbitBarycenterVisible, orbitHasGeometry, orbitMassFraction, projectedOrbitPoint, stellarOrbitsForSystem, type StellarOrbit } from './stellar-orbits'
import data from './data/stellar-orbits.json'
import audit from '../catalog-work/star-systems/stellar-orbits-audit.json'

const stars = completeCatalogCompanions(parseStarCatalog(readFileSync(new URL('./data/stars.csv', import.meta.url), 'utf8')))
const systems = indexStarSystems(stars)
beforeAll(async () => {
  vi.stubGlobal('fetch', generatedJsonFetch)
  await Promise.all(data.systems.map((system) => loadStellarOrbits(system.systemId)))
})
afterAll(() => vi.unstubAllGlobals())

describe('reviewed stellar orbits', () => {
  it('keeps the new relative Nunki orbit and close Spica/YY Gem scope explicit', () => {
    const nunki = data.systems.find((system) => system.systemId === 'msc-18553-2618')!.orbits[0]!
    expect(nunki.primaryIds).toEqual(['bright-nunki'])
    expect(nunki.secondaryIds).toEqual(['msc-18553-2618-ab'])
    expect(nunki.periodYears * 365.25).toBeCloseTo(134.779, 6)
    expect(nunki.semiMajorAxisAu).toBe(1.26)
    expect(nunki.sourceUrl).toContain('2603.17011')
    const spica = data.systems.find((system) => system.systemId === 'msc-13252-1110')!.orbits[0]!
    expect(spica.secondaryIds).toEqual(['msc-13252-1110-ab'])
    expect(spica.periodYears * 365.25).toBeCloseTo(4.0145, 6)
    expect(orbitHasGeometry(spica)).toBe(false)
    const castor = data.systems.find((system) => system.systemId === 'msc-07346+3153')!.orbits
    const yyGem = castor.find((orbit) => orbit.primary === 'Ca' && orbit.secondary === 'Cb')!
    expect(yyGem.eccentricity).toBe(0)
    expect(yyGem.periastronEpoch).toBeNull() // Eclipse timing is not periastron.
    expect(orbitHasGeometry(yyGem)).toBe(false)
    expect(castor.find((orbit) => orbit.secondary === 'C')?.secondaryIds)
      .toEqual(['msc-07346+3153-c', 'msc-07346+3153-cb'])
  })

  it('reproduces published signed offsets and keeps the beta Aur HJD convention distinct from MJD', () => {
    const predict = (orbit: StellarOrbit, elapsedDays: number, angularAxisMas: number) => {
      const mean = 2 * Math.PI * ((elapsedDays / (orbit.periodYears * 365.25) % 1 + 1) % 1)
      let anomaly = mean
      for (let step = 0; step < 15; step++) anomaly -= (anomaly - orbit.eccentricity! * Math.sin(anomaly) - mean)
        / (1 - orbit.eccentricity! * Math.cos(anomaly))
      const point = projectedOrbitPoint(orbit, anomaly)
      return { east: -point.x * angularAxisMas, north: -point.y * angularAxisMas }
    }
    const nunki = data.systems.find((system) => system.systemId === 'msc-18553-2618')!.orbits[0]!
    for (const [mjd, east, north] of [[57950.11, -22.76, 11.08], [57992.06, -3.58, 19.55], [58005.07, 5.05, 14.47]]) {
      const point = predict(nunki, mjd! - nunki.periastronEpoch!, 18)
      expect(Math.abs(point.east - east!)).toBeLessThan(.1)
      expect(Math.abs(point.north - north!)).toBeLessThan(.1)
    }
    const betaAur = data.systems.find((system) => system.systemId === 'orb6-05595+4457-aa-ab')!.orbits[0]!
    expect(betaAur.epochKind).toBe('HJD')
    expect(betaAur.periastronEpoch).toBe(2453827.2048)
    for (const [mjd, east, north] of [[60232.4493, -2.003, .238], [60234.5388, 2.377, -.496], [60259.3951, 1.507, -1.401]]) {
      // Omitting the small heliocentric correction is adequate at this 0.04 mas
      // tolerance; confusing reduced HJD with MJD shifts the orbit by 0.5 day.
      const point = predict(betaAur, mjd! + 2400000.5 - betaAur.periastronEpoch!, 3.36514)
      expect(Math.abs(point.east - east!)).toBeLessThan(.04)
      expect(Math.abs(point.north - north!)).toBeLessThan(.04)
    }
  })

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
  })

  it('matches both EZ Aquarii orbits to the A/C inner pair and AC–B outer pair', () => {
    const system = systems.get('ez-aquarii-c')!
    expect(system.id).toBe('ez-aquarii')
    const orbits = stellarOrbitsForSystem(system)
    expect(orbits).toHaveLength(2)
    const inner = orbits.find((o) => o.primary === 'A' && o.secondary === 'C')!
    expect(inner.primaryIds).toEqual(['ez-aquarii-a'])
    expect(inner.secondaryIds).toEqual(['ez-aquarii-c'])
    expect(inner.periodYears * 365.25).toBeCloseTo(3.786516, 6)
    expect(inner.eccentricity).toBe(0)
    expect(inner.semiMajorAxisAu).toBeNull()
    expect(inner.nodeDeg).toBeNull()
    expect(orbitHasGeometry(inner)).toBe(false)
    const outer = orbits.find((o) => o.primary === 'AC' && o.secondary === 'B')!
    expect(outer.primaryIds).toEqual(['ez-aquarii-a', 'ez-aquarii-c'])
    expect(outer.secondaryIds).toEqual(['ez-aquarii-b'])
    expect(outer.periodYears * 365.25).toBeCloseTo(822.6)
    expect(outer.eccentricity).toBe(0.439)
    expect(outer.semiMajorAxisAu).toBeCloseTo(0.3473 * 1000 / 293.6, 7)
    expect(orbitHasGeometry(outer)).toBe(true)
    expect(stellarOrbitsForSystem({ ...system, components: system.components.filter((c) => c.label !== 'C') })).toHaveLength(0)
  })

  it('covers the formerly name-only nearby systems and records no unaudited UI groups', () => {
    expect(audit.unreviewedNameGroups).toEqual([])
    for (const id of ['luhman-16', 'luyten-726-8', 'ross-614', 'wolf-424', 'gj-1245',
      'ei-cancri', 'stein-2051', 'xi-bootis', 'p-eridani', 'l-601-78']) {
      expect(data.systems.find((s) => s.systemId === id)!.orbits.length).toBeGreaterThan(0)
    }
    const luhman = data.systems.find((s) => s.systemId === 'luhman-16')!.orbits[0]!
    expect(luhman.epochKind).toBe('Julian year')
    expect(luhman.periastronEpoch).toBe(2018.06)
  })

  it('reconciles flat close-pair labels without assigning their outer companions to the inner orbit', () => {
    const gj105 = data.systems.find((s) => s.systemId === 'gj-105')!.orbits
    expect(gj105).toHaveLength(1)
    expect(gj105[0]!.secondaryIds).toEqual(['gj-105-c'])
    const gj22 = data.systems.find((s) => s.systemId === 'gj-22')!.orbits
    expect(gj22.find((o) => o.secondary === 'C')!.primaryIds).toEqual(['cns5-0155'])
    expect(gj22.find((o) => o.secondary === 'B')!.primaryIds).toEqual(['cns5-0155', 'gj-22-c'])
    const gj570 = data.systems.find((s) => s.systemId === 'gj-570')!.orbits
    expect(gj570.find((o) => o.primary === 'B')!.secondaryIds).toEqual(['10pc-0146'])
    expect(gj570.find((o) => o.primary === 'A')!.secondaryIds).toEqual(['10pc-0145', '10pc-0146'])
    const gj1245 = data.systems.find((s) => s.systemId === 'gj-1245')!.orbits
    expect(gj1245.find((o) => o.secondary === 'C')!.secondaryIds).toEqual(['10pc-0088'])
    expect(gj1245.find((o) => o.secondary === 'B')!.primaryIds).toEqual(['10pc-0087', '10pc-0088'])
  })

  it('resolves explicitly cataloged nested centers of mass', () => {
    const mintaka = data.systems.find((s) => s.systemId === 'msc-05320-0018')!.orbits
    const outer = mintaka.find((o) => o.primary === 'Aa')!
    expect(outer.primaryIds).toHaveLength(2)
    expect(outer.secondaryIds).toEqual(['msc-05320-0018-ab'])
    const lambda = data.systems.find((s) => s.systemId === 'msc-04007+1229')!.orbits
    expect(lambda.find((o) => o.primary === 'Aab')!.primaryIds).toHaveLength(2)
    const tau = data.systems.find((s) => s.systemId === 'msc-04422+2257')!.orbits
    expect(tau.find((o) => o.primary === 'Aab')!.primaryIds).toEqual(['hip-21881', 'msc-04422+2257-ab'])
    expect(tau.find((o) => o.primary === 'Aa')!.periodYears * 365.25).toBeCloseTo(2.9565)
    const orion = data.systems.find((s) => s.systemId === 'msc-05353-0524')!.orbits
    expect(orion).toHaveLength(1)
    expect(orion[0]!.primaryIds).toEqual(['trapezium-theta1-orionis-a'])
    expect(orion[0]!.secondaryIds).toEqual(['msc-05353-0524-aa2'])
  })

  it('keeps every letter of compound orbit sides and reconciles Algol hierarchy levels', () => {
    const castor = data.systems.find((s) => s.systemId === 'msc-07346+3153')!.orbits
    expect(castor.find((o) => o.primary === 'AB')!.primaryIds).toHaveLength(4)
    const ashlesha = data.systems.find((s) => s.systemId === 'msc-08468+0625')!.orbits
    const outer = ashlesha.find((o) => o.primary === 'AB')!
    expect(outer.primaryIds).toEqual(['hip-43109', 'msc-08468+0625-b'])
    expect(outer.secondaryIds).toEqual(['msc-08468+0625-ca', 'msc-08468+0625-cb'])
    const algol = data.systems.find((s) => s.systemId === 'msc-03082+4057')!.orbits
    expect(algol.find((o) => o.primary === 'Aa')!.periodYears * 365.25).toBeCloseTo(2.867328)
    expect(algol.find((o) => o.primary === 'A')!.primaryIds).toEqual(['bright-algol', 'msc-03082+4057-ab'])
    const gj667 = data.systems.find((s) => s.systemId === 'gj-667')!.orbits
    expect(gj667.find((o) => o.primary === 'AB')!.primaryIds).toEqual(['cns5-4252', 'gj-667-b'])
  })

  it('requires source cross-references for implicit ORB6 pair labels and preserves photocenter limits', () => {
    const wasat = data.systems.find((s) => s.systemId === 'msc-07201+2159')!.orbits
    expect(wasat.every((o) => o.catalog === 'ORB6')).toBe(true)
    const inner = wasat.find((o) => o.primary === 'Aa')!
    expect(inner.grade).toBe(9)
    expect(inner.semiMajorAxisAu).toBeNull()
    expect(orbitHasGeometry(inner)).toBe(false)
    expect(audit.reconciled.some((r) => r.systemId === 'msc-07201+2159' && r.sourcePair === '')).toBe(true)
  })

  it('does not turn missing subcomponents, planets or adjacent systems into stellar pairs', () => {
    for (const id of ['wolf-1561', 'gj-810', 'gj-835']) expect(data.systems.find((s) => s.systemId === id)!.orbits).toEqual([])
    const cephei = data.systems.find((s) => s.systemId === 'gamma-cephei')!.orbits
    expect(cephei.every((o) => o.periodYears > 10)).toBe(true)
    const tau = data.systems.find((s) => s.systemId === 'msc-04287+1552')!.orbits
    expect(tau).toHaveLength(1)
    expect(tau[0]!.periodYears).toBe(16.26)
    const theta2 = data.systems.find((s) => s.systemId === 'orb6-04287+1552-aa-ab')!.orbits
    expect(theta2).toHaveLength(1)
    expect(theta2[0]!).toMatchObject({ primary: 'Aa', secondary: 'Ab', primaryIds: ['hip-20894'] })
    expect(theta2[0]!.periodYears).toBeCloseTo(140.730 / 365.25)
    expect(theta2[0]!.semiMajorAxisAu).toBeGreaterThan(0)
    expect(audit.identityAmbiguities.some((r) => r.wdsId === '05353-0523')).toBe(true)
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
