import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { EARTH_RADIUS_KM, JUPITER_RADIUS_KM, SOLAR_RADIUS_KM, radiusComparison, radiusStats, radiusSummary } from './radius-comparison'

function star(id: string, radius: number | null, type: Star['type'] = 'star'): Star {
  return {
    id, name: id === 'sun' ? 'Sun' : id, type, radius_solar: radius,
    temperature_k: 5772, spectral_type: 'G2V', mass_solar: null, luminosity_solar: null,
    metallicity_dex: null, age_gyr: null, constellation: null, absolute_mag: null,
    x_pc: 0, y_pc: 0, z_pc: 0, vx_kms: null, vy_kms: null, vz_kms: null,
    epoch: 2000, notes: '', raw_astrometry: null,
  }
}

const sun = star('sun', 1)

describe('radius comparison', () => {
  it('converts radii without compressing extreme physical ratios', () => {
    const comparison = radiusComparison(star('Betelgeuse', 682.1352), sun)
    expect(comparison.selected.radiusKm).toBeCloseTo(474_561_458.64, 2)
    expect(comparison.selected.radiusKm! / comparison.reference.radiusKm!).toBeCloseTo(682.1352, 5)
    expect(comparison.jupiterBenchmark).toBe(false)
  })

  it('derives diameter, squared surface area, and cubed volume', () => {
    const comparison = radiusComparison(star('Twice solar radius', 2), sun)
    const stats = radiusStats(comparison)
    expect(stats.find((row) => row.label === 'Diameter')!.values[0]!.value).toBe('2,783,000 km')
    expect(stats.find((row) => row.label === 'Surface area')!.values[0]!.value).toBe('4 A☉')
    expect(stats.find((row) => row.label === 'Volume')!.values[0]!.value).toBe('8 V☉')
    expect(radiusSummary(comparison)).toContain('2× the diameter of Sun, with 8× its volume')
  })

  it('uses Jupiter at the inclusive two-Jupiter-radius boundary only when Sun is origin', () => {
    const dwarf = star('Dwarf', 2 * JUPITER_RADIUS_KM / SOLAR_RADIUS_KM, 'brown_dwarf')
    expect(radiusComparison(dwarf, sun).reference.name).toBe('Jupiter')
    expect(radiusComparison({ ...dwarf, radius_solar: dwarf.radius_solar! + 0.000001 }, sun).jupiterBenchmark).toBe(false)
    const dwarfPair = radiusComparison(dwarf, star('Other dwarf', 0.1, 'brown_dwarf'))
    expect(dwarfPair.reference.name).toBe('Other dwarf')
    expect(dwarfPair.jupiterBenchmark).toBe(false)
  })

  it('accounts for Jupiter flattening in the volume comparison', () => {
    const comparison = radiusComparison(star('Jupiter-sized sphere', JUPITER_RADIUS_KM / SOLAR_RADIUS_KM, 'brown_dwarf'), sun)
    const stats = radiusStats(comparison)
    expect(stats.find((row) => row.label === 'Radius')!.values[0]!.unit).toBe('1 R♃')
    // A sphere at Jupiter's equatorial radius exceeds its oblate volume by ~6.94%.
    expect(stats.find((row) => row.label === 'Volume')!.values[0]!.value).toBe('1.069 V♃')
    expect(stats.find((row) => row.label === 'Volume')!.values[1]!.value).toBe('1 V♃')
    expect(radiusSummary(comparison)).toContain('1× the diameter of Jupiter, with 1.069× its volume')
  })

  it('lets the Origin button override the automatic Jupiter benchmark', () => {
    const dwarf = star('Small dwarf', 0.1, 'brown_dwarf')
    expect(radiusComparison(dwarf, sun).referenceMode).toBe('jupiter')
    const comparison = radiusComparison(dwarf, sun, 'origin')
    expect(comparison.reference.name).toBe('Sun')
    expect(comparison.reference.radiusKm).toBe(SOLAR_RADIUS_KM)
    expect(comparison.jupiterBenchmark).toBe(false)
  })

  it('uses explicit planetary benchmarks independently of the scene origin', () => {
    const selected = star('Selected', 1)
    const origin = star('Different origin', 5)
    const jovian = radiusComparison(selected, origin, 'jupiter')
    expect(jovian.reference.name).toBe('Jupiter')
    const terrestrial = radiusComparison(selected, origin, 'earth')
    expect(terrestrial.reference.radiusKm).toBe(EARTH_RADIUS_KM)
    expect(radiusStats(terrestrial).find((row) => row.label === 'Radius')!.values[1]!.unit).toBe('1 R⊕')
    expect(radiusStats(terrestrial).find((row) => row.label === 'Volume')!.values[1]!.value).toBe('1 V⊕')
    expect(radiusSummary(terrestrial)).toContain('the diameter of Earth')
    expect(origin.radius_solar).toBe(5)
  })

  it('keeps missing and invalid radii unknown without substituting a benchmark', () => {
    for (const radius of [null, 0, -1, NaN, Infinity]) {
      const comparison = radiusComparison(star('Unknown', radius), sun)
      expect(comparison.selected.radiusKm).toBeNull()
      expect(comparison.jupiterBenchmark).toBe(false)
      expect(radiusStats(comparison).every((row) => row.values[0]!.value === 'Not available')).toBe(true)
      expect(radiusSummary(comparison)).toContain('No catalog radius is available for Unknown')
    }
  })

  it('retains the selected radius when the origin has no comparable stellar radius', () => {
    const comparison = radiusComparison(star('Selected star', 1.03), star('Cloud origin', 10, 'molecular_cloud'))
    expect(comparison.selected.radiusKm).toBeCloseTo(716_571)
    expect(comparison.reference.radiusKm).toBeNull()
    expect(radiusSummary(comparison)).toContain('Cloud origin')
  })
})
