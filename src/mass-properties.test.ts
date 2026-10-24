import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { JUPITER_MASS_SOLAR, massCardAvailable, massFuel, massProperties, solarBarScale } from './mass-properties'

function star(overrides: Partial<Star> = {}): Star {
  return {
    id: 'sirius-a', name: 'Sirius A', type: 'star', spectral_type: 'A1V',
    mass_solar: 2.063, radius_solar: 1.7144, luminosity_solar: 24.74,
    temperature_k: 9845, metallicity_dex: null, age_gyr: null, constellation: null,
    x_pc: 0, y_pc: 0, z_pc: 0, vx_kms: null, vy_kms: null, vz_kms: null,
    absolute_mag: null, epoch: 2000, notes: '', raw_astrometry: null, ...overrides,
  }
}

describe('mass-derived physical properties', () => {
  it('reproduces Sirius A physical comparisons', () => {
    const properties = massProperties(star())
    expect(properties.kilograms! / 1e30).toBeCloseTo(4.102, 3)
    expect(properties.earthMasses).toBeCloseTo(686900, -2)
    expect(properties.gravity).toBeCloseTo(192.6, 0)
    expect(properties.gravityRatio).toBeCloseTo(0.702, 3)
    expect(properties.escapeKms).toBeCloseTo(677.6, 0)
    expect(properties.density).toBeCloseTo(0.577, 2)
    expect(properties.luminosityPerMass).toBeCloseTo(11.99, 2)
  })

  it('anchors all relative quantities to the Sun', () => {
    const properties = massProperties(star({ id: 'sun', mass_solar: 1, radius_solar: 1, luminosity_solar: 1 }))
    expect(properties.gravityRatio).toBe(1)
    expect(properties.escapeRatio).toBe(1)
    expect(properties.densityRatio).toBe(1)
    expect(properties.luminosityPerMass).toBe(1)
  })

  it('keeps missing and invalid measurements unknown without inventing radii', () => {
    for (const value of [null, 0, -1, NaN, Infinity]) {
      const missingMass = massProperties(star({ mass_solar: value }))
      expect(missingMass.kilograms).toBeNull()
      expect(missingMass.gravity).toBeNull()
      const missingRadius = massProperties(star({ radius_solar: value }))
      expect(missingRadius.gravity).toBeNull()
      expect(missingRadius.escapeKms).toBeNull()
      expect(missingRadius.density).toBeNull()
    }
    expect(massProperties(star({ luminosity_solar: null })).luminosityPerMass).toBeNull()
  })

  it('does not derive photosphere quantities for compact remnants', () => {
    for (const type of ['black_hole', 'neutron_star', 'pulsar'] as const) {
      const remnant = star({ type })
      expect(massProperties(remnant).gravity).toBeNull()
      expect(massProperties(remnant).escapeKms).toBeNull()
    }
    expect(massCardAvailable(star({ type: 'molecular_cloud' }))).toBe(false)
  })

  it('estimates main-sequence fuel lifetimes and explains every case where they do not apply', () => {
    expect(massFuel(star({ id: 'sun', spectral_type: 'G2V', mass_solar: 1, luminosity_solar: 1 }))).toEqual({ kind: 'lifetime', gyr: 10, lowerBound: false })
    expect(massFuel(star())).toMatchObject({ kind: 'lifetime', lowerBound: false })
    expect((massFuel(star()) as { gyr: number }).gyr).toBeCloseTo(0.834, 3)
    // Fully convective red dwarfs burn nearly all hydrogen: the solar scaling is a lower bound.
    expect(massFuel(star({ spectral_type: 'M5.5Ve', mass_solar: 0.122, luminosity_solar: 0.00155 }))).toMatchObject({ kind: 'lifetime', lowerBound: true })
    expect(massFuel(star({ spectral_type: 'sdM1', mass_solar: 0.3, luminosity_solar: 0.01 })).kind).toBe('lifetime')
    expect(massFuel(star({ spectral_type: 'B8Ia', mass_solar: 21, luminosity_solar: 120000 }))).toMatchObject({ kind: 'burn-rate', reason: expect.stringContaining('Left the main sequence') })
    expect((massFuel(star({ spectral_type: 'B8Ia', mass_solar: 20, luminosity_solar: 120000 })) as { ratio: number }).ratio).toBe(6000)
    expect(massFuel(star({ spectral_type: 'G2' }))).toMatchObject({ kind: 'burn-rate', reason: expect.stringContaining('Luminosity class unknown') })
    expect(massFuel(star({ spectral_type: 'K0V+M2V' }))).toMatchObject({ kind: 'burn-rate', reason: expect.stringContaining('stage unknown') })
    expect(massFuel(star({ luminosity_solar: null }))).toEqual({ kind: 'unavailable', reason: 'Catalog luminosity needed.' })
    expect(massFuel(star({ mass_solar: null }))).toEqual({ kind: 'unavailable', reason: 'Catalog mass needed.' })
    const whiteDwarf = massFuel(star({ type: 'white_dwarf', spectral_type: 'DA2', mass_solar: 1.018, radius_solar: 0.0084 }))
    expect(whiteDwarf.kind).toBe('density')
    expect((whiteDwarf as { density: number }).density).toBeGreaterThan(1e6)
    expect(massFuel(star({ type: 'white_dwarf', radius_solar: null }))).toMatchObject({ kind: 'density', density: null })
    expect(massFuel(star({ type: 'brown_dwarf', mass_solar: 40 * JUPITER_MASS_SOLAR }))).toMatchObject({ kind: 'no-fusion', label: 'Deuterium only' })
    expect(massFuel(star({ type: 'sub_brown_dwarf', mass_solar: 5 * JUPITER_MASS_SOLAR }))).toMatchObject({ kind: 'no-fusion', label: 'None' })
    for (const type of ['black_hole', 'neutron_star', 'pulsar'] as const) expect(massFuel(star({ type })).kind).toBe('no-fusion')
  })

  it('derives a Schwarzschild horizon only for black holes', () => {
    expect(massProperties(star({ type: 'black_hole', mass_solar: 1 })).horizonKm).toBeCloseTo(2.953, 3)
    expect(massProperties(star({ type: 'black_hole', mass_solar: null })).horizonKm).toBeNull()
    expect(massProperties(star({ type: 'neutron_star' })).horizonKm).toBeNull()
    expect(massProperties(star()).horizonKm).toBeNull()
  })

  it('keeps logarithmic comparisons labeled and legible across extreme ranges', () => {
    expect(solarBarScale(1).position).toBe(50)
    expect(solarBarScale(0).position).toBe(0)
    expect(solarBarScale(0.7).position).toBeLessThan(50)
    expect(solarBarScale(12).position).toBeGreaterThan(50)
    for (const ratio of [1e-7, 1e7]) {
      const scale = solarBarScale(ratio)
      expect(scale.position).toBeGreaterThanOrEqual(0)
      expect(scale.position).toBeLessThanOrEqual(100)
      expect(scale.high).toBeGreaterThanOrEqual(ratio)
      expect(scale.low).toBeLessThanOrEqual(ratio)
    }
  })
})
