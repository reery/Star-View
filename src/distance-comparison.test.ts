import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseStarCatalog } from './catalog'
import type { Star } from './catalog-model'
import { closestApproach, distanceGeometry, parallaxDistance } from './distance-comparison'
import { catalogSourceUrl } from './test-support/catalog-source'

function star(id: string, x: number, y: number, z: number): Star {
  return {
    id, name: id, type: 'star', x_pc: x, y_pc: y, z_pc: z,
    vx_kms: null, vy_kms: null, vz_kms: null, raw_astrometry: null,
    temperature_k: null, spectral_type: null, radius_solar: null, mass_solar: null, luminosity_solar: null,
    metallicity_dex: null, age_gyr: null, constellation: null, absolute_mag: null, epoch: 2000, notes: '',
  }
}

describe('distance card Galactic orientation', () => {
  const sun = star('sun', 0, 0, 0)
  it('puts forward up in the top view and left when facing the Galactic center', () => {
    const forward = distanceGeometry(star('forward', 0, 4, 0), sun)
    expect(forward.topX).toBe(0)
    expect(forward.topY).toBe(-4)
    expect(forward.sideX).toBe(-4)
    expect(forward.heightPc).toBe(0)
    expect(distanceGeometry(star('center', 4, 0, 0), sun).topX).toBe(4)
  })
  it('preserves physical 3D distance and signed vertical separation from a non-Sun origin', () => {
    const result = distanceGeometry(star('selected', 13, 24, 42), star('origin', 10, 20, 30))
    expect(result.distancePc).toBe(13)
    expect(result.heightPc).toBe(12)
    expect(result.sideY).toBe(-12)
    expect(distanceGeometry(star('below', 0, 0, -2), sun).sideY).toBe(2)
    expect(distanceGeometry(sun, sun).distancePc).toBe(0)
  })
  it('uses moving positions in either motion frame without adding a false Sun-relative shift', () => {
    const origin = { ...star('origin', 0, 0, 0), vx_kms: 0, vy_kms: 0, vz_kms: 0 }
    const selected = { ...star('selected', 1, 0, 0), vx_kms: 10, vy_kms: 20, vz_kms: -30 }
    const solar = distanceGeometry(selected, origin, 1_000_000, 'solar')
    const galactic = distanceGeometry(selected, origin, 1_000_000, 'galactic')
    expect(solar.distancePc).toBeGreaterThan(1)
    expect(solar.heightPc).toBeLessThan(0)
    expect(galactic.distancePc).toBeCloseTo(solar.distancePc, 9)
    expect(galactic.heightPc).toBeCloseTo(solar.heightPc, 9)
  })
  it('moves stars backward for past times', () => {
    const selected = { ...star('selected', 1, 0, 0), vx_kms: 10, vy_kms: 0, vz_kms: 0 }
    const past = distanceGeometry(selected, star('sun', 0, 0, 0), -100_000, 'solar')
    const future = distanceGeometry(selected, star('sun', 0, 0, 0), 100_000, 'solar')
    expect(past.topX).toBeCloseTo(2 - future.topX, 9)
    expect(past.topX).toBeLessThan(1)
  })
})

describe('distance card measurements', () => {
  const nearest = parseStarCatalog(readFileSync(catalogSourceUrl('nearest-100'), 'utf8'))
  const byId = (id: string) => nearest.find((candidate) => candidate.id === id)!
  const distance = (object: Star) => Math.hypot(object.x_pc, object.y_pc, object.z_pc)

  it('finds well-measured straight-line encounters within the timeline', () => {
    const barnard = closestApproach(byId('barnards-star'))!
    expect(barnard.years).toBeGreaterThan(9_000)
    expect(barnard.years).toBeLessThan(10_500)
    expect(barnard.distancePc).toBeLessThan(distance(byId('barnards-star')))
    expect(closestApproach(byId('wolf-359'))!.years).toBeLessThan(0)
  })

  it('omits encounters without a radial velocity or with a mismatched parallax distance', () => {
    const transverse = nearest.find((candidate) => candidate.raw_astrometry && candidate.raw_astrometry.radial_velocity_kms === null)!
    expect(closestApproach(transverse)).toBeNull()
    // Without a radial velocity, the Sun's Galactic orbit must not separate the pair.
    const galactic = distanceGeometry(transverse, byId('sun'), 500_000, 'galactic')
    expect(galactic.distancePc).toBeCloseTo(distanceGeometry(transverse, byId('sun'), 500_000, 'solar').distancePc, 6)
    const proxima = byId('proxima-centauri')
    expect(closestApproach({ ...proxima, x_pc: proxima.x_pc * 1.1, y_pc: proxima.y_pc * 1.1, z_pc: proxima.z_pc * 1.1 })).toBeNull()
  })

  it('adopts the parallax error only when the catalog distance lies within it', () => {
    const proxima = byId('proxima-centauri')
    expect(parallaxDistance(proxima, distance(proxima))?.adopted).toBe(true)
    expect(parallaxDistance(proxima, distance(proxima) * 1.01)?.adopted).toBe(false)
    expect(parallaxDistance({ ...proxima, raw_astrometry: null }, distance(proxima))).toBeNull()
  })
})
