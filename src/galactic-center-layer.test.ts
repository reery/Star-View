import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import compactOrbits from './data/compact-system-orbits.json'
import { completeOrbit, decimalYear, GALACTIC_CENTER_SYSTEM_ID, orbitPointPc, orbitPositionPc, skyBasis } from './galactic-center-layer'
import { projectedOrbitPoint, type StellarOrbit } from './stellar-orbits'
import { galacticToWorld } from './astronomy'
import { equatorialToGalacticPc } from './catalog-model'

const AU_PER_PC = 206264.806
const orbits = compactOrbits.systems.find((system) => system.systemId === GALACTIC_CENTER_SYSTEM_ID)!.orbits as StellarOrbit[]
const orbit = (id: string) => orbits.find((candidate) => candidate.secondaryIds[0] === id)!
const [ra, dec] = [266.416816625, -29.007824972]
const basis = skyBasis(ra, dec)

describe('Galactic Center layer', () => {
  it('draws only complete published orbits', () => {
    expect(orbits.map((candidate) => candidate.secondaryIds[0])).toEqual(['s2', 's29', 's38', 's55', 's4716'])
    expect(orbits.every(completeOrbit)).toBe(true)
  })

  it('puts the depth axis along the line of sight to the black hole, with north and east across it', () => {
    const direction = galacticToWorld(equatorialToGalacticPc(ra, dec, 1)).normalize()
    expect(basis.away.distanceTo(direction)).toBeLessThan(1e-9)
    expect(basis.north.dot(basis.east)).toBeCloseTo(0, 9)
    expect(basis.north.dot(basis.away)).toBeCloseTo(0, 9)
    // Galactic north lies on the north side of Sagittarius A*.
    expect(basis.north.y).toBeGreaterThan(0)
  })

  it('places S2 at its published pericenter distance at the periastron epoch', () => {
    const s2 = orbit('s2')
    const offset = orbitPositionPc(s2, s2.periastronEpoch!, basis, new Vector3())
    expect(offset.length() * AU_PER_PC).toBeCloseTo(s2.semiMajorAxisAu! * (1 - s2.eccentricity!), 3)
    // One period later the star is back at the same place.
    expect(orbitPositionPc(s2, s2.periastronEpoch! + s2.periodYears, basis, new Vector3()).distanceTo(offset)).toBeLessThan(1e-9)
  })

  it('projects onto the sky exactly as the System card draws the orbit', () => {
    for (const candidate of orbits) {
      for (const anomaly of [0, 1, 2.5, 4]) {
        const point = orbitPointPc(candidate, anomaly, basis, new Vector3()).multiplyScalar(AU_PER_PC / candidate.semiMajorAxisAu!)
        const sky = projectedOrbitPoint(candidate, anomaly)
        expect(point.dot(basis.east)).toBeCloseTo(-sky.x, 9)
        expect(point.dot(basis.north)).toBeCloseTo(-sky.y, 9)
      }
    }
  })

  it('counts decimal years from the start of the UTC year', () => {
    expect(decimalYear(new Date(Date.UTC(2026, 0, 1)))).toBe(2026)
    expect(decimalYear(new Date(Date.UTC(2026, 6, 2, 12)))).toBeCloseTo(2026.5, 2)
  })
})
