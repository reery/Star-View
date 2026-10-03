import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  EARTH_OBLIQUITY_DEG, EARTH_ORBIT_DISPLAY_RADIUS_PC, EARTH_ORBIT_MODES, earthEclipticLongitude, earthOrbitDateForMode,
  earthOrbitModeLabel, earthOrbitModel, eclipticVectorToWorld, isEarthOrbitMode,
} from './earth-orbit'

function angularDistanceDegrees(first: number, second: number): number {
  const difference = Math.abs(first - second) % 360
  return Math.min(difference, 360 - difference)
}

describe('Earth orbit reference overlay', () => {
  it('maps the slider stops to now or the middle of each UTC month', () => {
    const now = new Date('2026-10-03T21:15:30Z')
    expect(earthOrbitDateForMode('off', now)).toBeNull()
    expect(earthOrbitDateForMode('now', now)?.toISOString()).toBe(now.toISOString())
    expect(earthOrbitDateForMode('jan', now)?.toISOString()).toBe('2026-01-15T12:00:00.000Z')
    expect(earthOrbitDateForMode('dec', now)?.toISOString()).toBe('2026-12-15T12:00:00.000Z')
    expect(EARTH_ORBIT_MODES.map(earthOrbitModeLabel)).toEqual([
      'Off', 'Now', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ])
    expect(isEarthOrbitMode('jul')).toBe(true)
    expect(isEarthOrbitMode('january')).toBe(false)
  })

  it('places Earth at the seasonal heliocentric longitudes', () => {
    const longitude = (date: string) => earthEclipticLongitude(new Date(date)) * 180 / Math.PI
    expect(angularDistanceDegrees(longitude('2026-03-20T12:00:00Z'), 180)).toBeLessThan(2)
    expect(angularDistanceDegrees(longitude('2026-06-21T12:00:00Z'), 270)).toBeLessThan(2)
    expect(angularDistanceDegrees(longitude('2026-09-23T12:00:00Z'), 0)).toBeLessThan(2)
    expect(angularDistanceDegrees(longitude('2026-12-21T12:00:00Z'), 90)).toBeLessThan(2)
  })

  it('keeps the exaggerated ring circular in the J2000 ecliptic plane', () => {
    const model = earthOrbitModel(new Date('2026-10-03T12:00:00Z'))
    expect(model.orbitPoints).toHaveLength(181)
    expect(model.orbitPoints[0]!.distanceTo(model.orbitPoints.at(-1)!)).toBeLessThan(1e-12)
    expect(model.earthPosition.length()).toBeCloseTo(EARTH_ORBIT_DISPLAY_RADIUS_PC, 9)
    for (const point of model.orbitPoints) expect(point.length()).toBeCloseTo(EARTH_ORBIT_DISPLAY_RADIUS_PC, 9)

    const eclipticNorth = eclipticVectorToWorld(new Vector3(0, 0, 1)).normalize()
    for (const point of model.orbitPoints) expect(Math.abs(point.dot(eclipticNorth))).toBeLessThan(2e-11)
  })

  it('draws the spin axis at Earth obliquity to the orbit normal', () => {
    const model = earthOrbitModel(new Date('2026-10-03T12:00:00Z'))
    const eclipticNorth = eclipticVectorToWorld(new Vector3(0, 0, 1)).normalize()
    const tilt = Math.acos(model.axisDirection.dot(eclipticNorth)) * 180 / Math.PI
    expect(tilt).toBeCloseTo(EARTH_OBLIQUITY_DEG, 5)
  })

  it('rejects invalid dates and display geometry', () => {
    expect(() => earthEclipticLongitude(new Date('invalid'))).toThrow(RangeError)
    expect(() => earthOrbitModel(new Date(), 0)).toThrow(RangeError)
    expect(() => earthOrbitModel(new Date(), 1, 8)).toThrow(RangeError)
  })
})
