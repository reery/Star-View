import type { Color } from 'three'
import { describe, expect, it } from 'vitest'
import csv from './data/stars.csv?raw'
import { parseStarCatalog } from './catalog'
import type { ObjectType } from './catalog-model'
import { displayMotionForStar, galacticToWorld, galacticVelocityToWorld, galactocentricVelocityToWorld, gridSpacingPc, rawAstrometryVelocityToWorld, SOLAR_GALACTIC_VELOCITY_KMS, starDisplayColor, sunRelativeMetrics, temperatureToColor } from './astronomy'

const stars = parseStarCatalog(csv)
const sun = stars.find((star) => star.id === 'sun')!
const sirius = stars.find((star) => star.id === 'sirius-a')!

describe('adaptive grid spacing', () => {
  it.each([
    [5, 0.5], [100, 0.5], [150, 1], [200, 2], [300, 5], [500, 10], [1000, 20], [1500, 30], [2000, 40],
  ])('uses %d ly visibility with %d pc cells', (distance, spacing) => {
    expect(gridSpacingPc(distance)).toBe(spacing)
  })
})

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

  it('uses raw proper motion as transverse-only motion when radial velocity is unavailable', () => {
    const raw = {
      ra_deg: 43.771985935, dec_deg: -47.016728356, epoch: 2016,
      parallax_mas: 205.4251, parallax_error_mas: 0.1857,
      pm_ra_cosdec_masyr: 1012.444720371, pm_ra_error_masyr: 0.18216792,
      pm_dec_masyr: -554.030838673, pm_dec_error_masyr: 0.24066855,
      radial_velocity_kms: null, radial_velocity_error_kms: null,
      astrometry_ref: 'Gaia EDR3', radial_velocity_ref: null,
    }
    const velocity = rawAstrometryVelocityToWorld(raw)!
    const expectedSpeed = 4.74047 / raw.parallax_mas * Math.hypot(raw.pm_ra_cosdec_masyr, raw.pm_dec_masyr)
    expect(velocity.length()).toBeCloseTo(expectedSpeed, 8)
    expect(displayMotionForStar({ id: 'denis', vx_kms: null, vy_kms: null, vz_kms: null, raw_astrometry: raw })).toMatchObject({ mode: 'transverse' })
  })

  it('prefers stored full velocity and derives full motion from raw radial velocity as a fallback', () => {
    expect(displayMotionForStar(sirius)).toEqual({ velocity: galactocentricVelocityToWorld(sirius), mode: 'full' })
    const raw = {
      ra_deg: 0, dec_deg: 0, epoch: 2016, parallax_mas: 100, parallax_error_mas: null,
      pm_ra_cosdec_masyr: 0, pm_ra_error_masyr: null, pm_dec_masyr: 0, pm_dec_error_masyr: null,
      radial_velocity_kms: 10, radial_velocity_error_kms: null,
      astrometry_ref: 'fixture', radial_velocity_ref: 'fixture',
    }
    const motion = displayMotionForStar({ id: 'raw-full', vx_kms: null, vy_kms: null, vz_kms: null, raw_astrometry: raw })!
    expect(motion.mode).toBe('full')
    expect(motion.velocity.clone().sub(galacticVelocityToWorld(SOLAR_GALACTIC_VELOCITY_KMS)!).length()).toBeCloseTo(10)
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

describe('star display color', () => {
  const brownDwarf = (temperature_k: number | null, spectral_type: string | null, type: ObjectType = 'brown_dwarf') =>
    starDisplayColor({ type, temperature_k, spectral_type })
  const luminance = (color: Color) => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
  const srgb = (color: Color) => {
    const hex = color.getHex()
    return { r: hex >> 16 & 255, g: hex >> 8 & 255, b: hex & 255 }
  }

  it('keeps measured temperature colors and uses stellar class only as a display fallback', () => {
    const ordinary = stars.filter((star) => star.type === 'star' || star.type === 'white_dwarf')
    expect(ordinary.length).toBeGreaterThan(10)
    for (const star of ordinary) expect(starDisplayColor(star).equals(temperatureToColor(star.temperature_k))).toBe(true)
    expect(starDisplayColor({ type: 'star', temperature_k: null, spectral_type: 'M9' }).equals(temperatureToColor(3500))).toBe(true)
    expect(starDisplayColor({ type: 'star', temperature_k: null, spectral_type: null }).equals(temperatureToColor(null))).toBe(true)
    expect(starDisplayColor({ type: 'white_dwarf', temperature_k: null, spectral_type: 'DA7' }).equals(temperatureToColor(null))).toBe(true)
  })

  it.each([
    [100, null], [250, 'Y4'], [950, 'T6'], [1420, 'L8+/-1'], [2400, 'M9'], [5000, 'M9'],
    [null, 'M9.5Ve'], [null, 'L9'], [null, 'T7.5'], [null, 'Y0pec'], [null, '> T9'], [null, 'sdM3'], [null, null], [null, 'unknown'],
  ])('renders %s K %s brown dwarfs in a visible brown', (temperature, spectralType) => {
    const color = brownDwarf(temperature, spectralType)
    const { r, g, b } = srgb(color)
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
    expect(r - b).toBeGreaterThanOrEqual(64)
    expect((luminance(color) + 0.05) / 0.05).toBeGreaterThanOrEqual(4.5)
  })

  it('darkens cooler brown dwarfs and uses spectral class only when the temperature is blank', () => {
    expect(luminance(brownDwarf(250, null))).toBeLessThan(luminance(brownDwarf(1420, null)))
    const byClass = ['Y1', 'T6', 'L5', 'M9'].map((spectralType) => luminance(brownDwarf(null, spectralType)))
    expect(byClass.every((value, index) => index === 0 || value > byClass[index - 1]!)).toBe(true)
    expect(brownDwarf(1420, 'Y4').equals(brownDwarf(1420, 'M9'))).toBe(true)
    expect(brownDwarf(1420, 'Y4').equals(brownDwarf(null, 'Y4'))).toBe(false)
  })

  it('reads the primary spectral class through prefixes and suffixes', () => {
    expect(brownDwarf(null, '> T9').equals(brownDwarf(null, 'T6'))).toBe(true)
    expect(brownDwarf(null, 'sdM3').equals(brownDwarf(null, 'M9.5Ve'))).toBe(true)
    expect(brownDwarf(null, 'M9.5+T5').equals(brownDwarf(null, 'M8'))).toBe(true)
    expect(brownDwarf(null, 'Y0pec').equals(brownDwarf(null, 'Y4'))).toBe(true)
    expect(brownDwarf(null, null).equals(brownDwarf(1300, null))).toBe(true)
    expect(brownDwarf(null, 'unknown').equals(brownDwarf(1300, null))).toBe(true)
  })

  it('colors bundled brown and sub-brown dwarfs brown instead of gray or red', () => {
    const substellar = stars.filter((star) => star.type === 'brown_dwarf' || star.type === 'sub_brown_dwarf')
    expect(substellar.map((star) => star.id)).toEqual(['luhman-16-a', 'luhman-16-b', 'wise-0855-0714'])
    for (const star of substellar) {
      expect(starDisplayColor(star).equals(brownDwarf(star.temperature_k, star.spectral_type))).toBe(true)
      expect(starDisplayColor(star).equals(temperatureToColor(star.temperature_k))).toBe(false)
    }
    expect(brownDwarf(null, 'T6', 'sub_brown_dwarf').equals(brownDwarf(null, 'T6'))).toBe(true)
  })
})
