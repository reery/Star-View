import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { massCardAvailable, massEvolution, massGravityContext, massProperties, solarBarScale } from './mass-properties'

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
    expect(massGravityContext(star())).toContain('More massive but weaker')
    expect(massEvolution(star()).outcome).toBe('White dwarf')
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

  it('adapts to remnants and substellar objects rather than interpreting their current masses as birth masses', () => {
    expect(massEvolution(star({ type: 'white_dwarf' })).outcome).toBe('Cooling white dwarf')
    expect(massEvolution(star({ type: 'brown_dwarf', mass_solar: 0.04 })).outcome).toBe('Continued cooling and fading')
    for (const type of ['black_hole', 'neutron_star', 'pulsar'] as const) {
      const remnant = star({ type })
      expect(massProperties(remnant).gravity).toBeNull()
      expect(massProperties(remnant).escapeKms).toBeNull()
      expect(massEvolution(remnant).comment).toContain('remnant mass')
    }
    expect(massEvolution(star({ spectral_type: 'K2III' })).outcome).toBe('White dwarf possible')
    expect(massEvolution(star({ mass_solar: 8 })).outcome).toBe('White dwarf or core collapse')
    expect(massEvolution(star({ mass_solar: 15 })).outcome).toBe('Neutron star or black hole')
    expect(massEvolution(star({ mass_solar: null })).outcome).toBe('End state unknown')
    expect(massCardAvailable(star({ type: 'molecular_cloud' }))).toBe(false)
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
