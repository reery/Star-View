import { describe, expect, it } from 'vitest'
import { solarBarScale } from './mass-properties'
import { radiusComparison, SOLAR_RADIUS_KM } from './radius-comparison'
import { typicalRadiusPosition, typicalRadiusRange } from './radius-properties'
import type { Star } from './catalog-model'

describe('radius scales', () => {
  it('keeps each reference centered and includes extreme selected ratios', () => {
    for (const ratio of [0.000001, 0.01, 0.8, 1, 2, 100, 100000]) {
      const { low, high, position } = solarBarScale(ratio)
      expect(low).toBeLessThanOrEqual(ratio)
      expect(high).toBeGreaterThanOrEqual(ratio)
      expect(position).toBeGreaterThanOrEqual(0)
      expect(position).toBeLessThanOrEqual(100)
      expect(Math.sqrt(low * high)).toBeCloseTo(1)
    }
  })

  it('places small, medium and large white dwarfs on the same fixed range', () => {
    const range = typicalRadiusRange({ type: 'white_dwarf', spectral_type: 'DA2' })!
    expect(typicalRadiusPosition(0.006 * SOLAR_RADIUS_KM, range).description).toBe('')
    expect(typicalRadiusPosition(0.01 * SOLAR_RADIUS_KM, range)).toEqual({ position: 50, description: '' })
    expect(typicalRadiusPosition(0.018 * SOLAR_RADIUS_KM, range).description).toBe('')
    expect(typicalRadiusPosition(0.004 * SOLAR_RADIUS_KM, range)).toEqual({ position: 0, description: 'Below typical range' })
    expect(typicalRadiusPosition(0.03 * SOLAR_RADIUS_KM, range)).toEqual({ position: 100, description: 'Above typical range' })
  })

  it('distinguishes main-sequence stars from evolved stars with the same spectral color', () => {
    const range = (spectral_type: string) => typicalRadiusRange({ type: 'star', spectral_type })!
    expect(range('G2V').label).toBe('G-type main-sequence star')
    expect(range('G2IV').label).toBe('Subgiant')
    expect(range('G2III').label).toBe('Giant')
    expect(range('G2II').label).toBe('Bright giant')
    expect(range('G2Iab').label).toBe('Supergiant')
    expect(range('M4.0Ve').low).toBe(0.1)
    expect(range('B2IV').low).toBeGreaterThan(range('G2V').high)
  })

  it('uses Jovian units for substellar objects and discloses the age assumption', () => {
    for (const type of ['brown_dwarf', 'sub_brown_dwarf'] as const) {
      const range = typicalRadiusRange({ type, spectral_type: null })!
      expect(range.unit).toBe('R♃')
      expect(range.note).toContain('Young objects can be much larger')
    }
  })

  it('does not infer a luminosity class or assign photosphere ranges to compact objects', () => {
    expect(typicalRadiusRange({ type: 'star', spectral_type: null })).toBeNull()
    expect(typicalRadiusRange({ type: 'star', spectral_type: 'M3' })).toBeNull()
    expect(typicalRadiusRange({ type: 'star', spectral_type: 'G2VI' })).toBeNull()
    expect(typicalRadiusRange({ type: 'black_hole', spectral_type: null })).toBeNull()
  })

  it('keeps typical size independent of the selected comparison object', () => {
    const selected = { type: 'white_dwarf', name: 'White dwarf', radius_solar: 0.01, spectral_type: 'DA2', temperature_k: 10000 } as Star
    const origin = { type: 'star', name: 'Sun', radius_solar: 1, spectral_type: 'G2V', temperature_k: 5772 } as Star
    const range = typicalRadiusRange(selected)!
    const positions = (['origin', 'jupiter', 'earth'] as const).map((mode) =>
      typicalRadiusPosition(radiusComparison(selected, origin, mode).selected.radiusKm!, range).position)
    expect(positions).toEqual([50, 50, 50])
  })
})
