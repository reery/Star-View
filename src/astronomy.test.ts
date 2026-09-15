import { describe, expect, it } from 'vitest'
import csv from './data/stars.csv?raw'
import { parseStarCatalog } from './catalog'
import { galacticToWorld, galacticVelocityToWorld, galactocentricVelocityToWorld, SOLAR_GALACTIC_VELOCITY_KMS, sunRelativeMetrics, temperatureToColor } from './astronomy'

const stars = parseStarCatalog(csv)
const sun = stars.find((star) => star.id === 'sun')!
const sirius = stars.find((star) => star.id === 'sirius-a')!

describe('Sun-centered Galactic coordinates', () => {
  it('preserves the right-handed basis and distances', () => {
    const axisX = galacticToWorld({ x_pc: 1, y_pc: 0, z_pc: 0 })
    const axisY = galacticToWorld({ x_pc: 0, y_pc: 1, z_pc: 0 })
    const axisZ = galacticToWorld({ x_pc: 0, y_pc: 0, z_pc: 1 })
    expect(axisX.clone().cross(axisY).equals(axisZ)).toBe(true)
    expect(galacticToWorld(sirius!).length()).toBeCloseTo(2.64, 2)
    expect(galacticToWorld(sirius!).y).toBeCloseTo(-0.408, 3)
    expect(galacticToWorld(sirius!).z).toBeCloseTo(1.914, 3)
  })

  it('reports Sirius below the plane, with distance in pc and light-years', () => {
    const metrics = sunRelativeMetrics(sirius!, sun!)
    expect(metrics.distancePc).toBeCloseTo(2.64, 2)
    expect(metrics.distanceLy).toBeCloseTo(8.6088, 2)
    expect(metrics.heightPc).toBeCloseTo(-0.408, 3)
    expect(metrics.side).toBe('below')
    expect(Math.hypot(metrics.planeDistancePc, metrics.heightPc)).toBeCloseTo(metrics.distancePc)
  })

  it('handles the Sun and above-plane positions without zero-length artifacts', () => {
    expect(sunRelativeMetrics(sun!, sun!)).toMatchObject({ distancePc: 0, distanceLy: 0, heightPc: 0, side: 'on' })
    expect(sunRelativeMetrics({ x_pc: 0, y_pc: 0, z_pc: 1 }, sun!).side).toBe('above')
  })

  it('keeps the bundled objects distance-ordered through the full EZ Aquarii tie', () => {
    const distances = stars.slice(1).map((star) => sunRelativeMetrics(star, sun).distancePc)
    expect(distances.every((distance, index) => index === 0 || distance >= distances[index - 1]! - 1e-6)).toBe(true)
    expect(stars.slice(-3).map((star) => star.id)).toEqual(['ez-aquarii-a', 'ez-aquarii-b', 'ez-aquarii-c'])
    expect(distances.at(-1)).toBeCloseTo(1000 / 293.6, 5)
  })
})

describe('Galactic velocity directions', () => {
  it('uses the same handedness as positions without changing the source', () => {
    const velocity = { vx_kms: 3, vy_kms: -4, vz_kms: 12 }
    expect(galacticVelocityToWorld(velocity)?.toArray()).toEqual([3, 12, 4])
    expect(galacticVelocityToWorld(velocity)?.length()).toBe(13)
    expect(velocity).toEqual({ vx_kms: 3, vy_kms: -4, vz_kms: 12 })
    expect(galacticVelocityToWorld({ vx_kms: 1e-12, vy_kms: 0, vz_kms: 0 })).not.toBeNull()
  })

  it.each([
    [null, null, null], [1, null, 2], [null, 1, 2], [1, 2, null],
    [0, 0, 0], [NaN, 1, 2], [1, Infinity, 2], [1, 2, -Infinity],
  ])('omits incomplete, zero or invalid motion %j', (vx_kms, vy_kms, vz_kms) => {
    expect(galacticVelocityToWorld({ vx_kms, vy_kms, vz_kms })).toBeNull()
  })
})

describe('Galactic rest-frame motion', () => {
  it('gives the Sun its adopted Galactic motion without changing catalog metadata', () => {
    expect(galactocentricVelocityToWorld(sun)?.toArray()).toEqual([12.9, 7.78, -245.6])
    expect(galactocentricVelocityToWorld({ ...sun, vx_kms: null, vy_kms: null, vz_kms: null })?.toArray()).toEqual([12.9, 7.78, -245.6])
    expect(sun).toMatchObject({ x_pc: 0, y_pc: 0, z_pc: 0, vx_kms: 0, vy_kms: 0, vz_kms: 0 })
  })

  it('adds the same solar vector to stellar velocities and preserves their relative motion', () => {
    const converted = galactocentricVelocityToWorld(sirius)!
    expect(converted.x).toBeCloseTo(27.86)
    expect(converted.y).toBeCloseTo(-3.564)
    expect(converted.z).toBeCloseTo(-245.857)
    expect(converted.sub(galactocentricVelocityToWorld(sun)!).distanceTo(galacticVelocityToWorld(sirius)!)).toBeLessThan(1e-12)
    expect(sirius).toMatchObject({ vx_kms: 14.96, vy_kms: 0.257, vz_kms: -11.344 })
    expect(galactocentricVelocityToWorld({ id: 'comoving', vx_kms: 0, vy_kms: 0, vz_kms: 0 })?.toArray()).toEqual([12.9, 7.78, -245.6])
  })

  it.each([
    [null, null, null], [1, null, 2], [null, 1, 2], [1, 2, null],
    [NaN, 1, 2], [1, Infinity, 2], [1, 2, -Infinity],
  ])('does not invent a stellar motion from incomplete or invalid data %j', (vx_kms, vy_kms, vz_kms) => {
    expect(galactocentricVelocityToWorld({ id: 'unknown', vx_kms, vy_kms, vz_kms })).toBeNull()
  })

  it('omits a zero vector after the frame conversion', () => {
    expect(galactocentricVelocityToWorld({
      id: 'stationary',
      vx_kms: -SOLAR_GALACTIC_VELOCITY_KMS.vx_kms,
      vy_kms: -SOLAR_GALACTIC_VELOCITY_KMS.vy_kms,
      vz_kms: -SOLAR_GALACTIC_VELOCITY_KMS.vz_kms,
    })).toBeNull()
  })
})

describe('temperature color', () => {
  it('gives the hotter Sirius a bluer color than the Sun', () => {
    const warm = temperatureToColor(sun!.temperature_k)
    const cool = temperatureToColor(sirius!.temperature_k)
    expect(warm.r).toBeGreaterThan(warm.b)
    expect(cool.b).toBeGreaterThan(cool.r)
    expect(cool.getHex()).not.toBe(warm.getHex())
  })

  it.each([200, 250, 500, 1000, 3000, 5772, 6500, 9845, 20000, 40000, 100000])('returns finite in-range RGB for %s K', (temperature) => {
    for (const channel of temperatureToColor(temperature).toArray()) {
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(1)
    }
  })

  it('clamps extremes and rejects invalid inputs', () => {
    expect(temperatureToColor(200).equals(temperatureToColor(250))).toBe(true)
    expect(temperatureToColor(500).equals(temperatureToColor(1000))).toBe(false)
    expect(temperatureToColor(100000).equals(temperatureToColor(40000))).toBe(true)
    for (const temperature of [0, -1, NaN, Infinity]) {
      expect(() => temperatureToColor(temperature)).toThrow(RangeError)
    }
  })

  it('does not use magnitude, luminosity, or motion for position and color', () => {
    const altered = { ...sirius!, absolute_mag: -10, luminosity_solar: 100000, vx_kms: 100 }
    expect(galacticToWorld(altered).equals(galacticToWorld(sirius!))).toBe(true)
    expect(temperatureToColor(altered.temperature_k).equals(temperatureToColor(sirius!.temperature_k))).toBe(true)
  })
})