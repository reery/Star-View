import { describe, expect, it } from 'vitest'
import {
  relativeSpectralEmission, spectrumRegion, temperatureCardAvailable, temperatureEvolution,
  temperaturePosition, WIEN_NM_K,
} from './temperature-properties'

describe('temperature and blackbody context', () => {
  it('places the Sun’s wavelength peak near 502 nm and hotter and cooler peaks in the right bands', () => {
    expect(WIEN_NM_K / 5772).toBeCloseTo(502.04, 1)
    expect(spectrumRegion(WIEN_NM_K / 5772)).toBe('visible light')
    expect(spectrumRegion(WIEN_NM_K / 9845)).toBe('UV')
    expect(spectrumRegion(WIEN_NM_K / 3000)).toBe('infrared')
  })

  it('normalizes Planck emission at Wien’s peak across the supported temperature range', () => {
    for (const temperature of [250, 3000, 5772, 9845, 100000]) {
      const peak = WIEN_NM_K / temperature
      expect(relativeSpectralEmission(peak, temperature)).toBeCloseTo(1, 8)
      expect(relativeSpectralEmission(peak * 0.99, temperature)).toBeLessThan(1)
      expect(relativeSpectralEmission(peak * 1.01, temperature)).toBeLessThan(1)
      expect(relativeSpectralEmission(peak / 1000, temperature)).toBe(0)
      expect(relativeSpectralEmission(peak * 100, temperature)).toBeLessThan(0.001)
    }
  })

  it('keeps missing or invalid temperatures unavailable and clips only the display position', () => {
    for (const temperature_k of [null, 0, -5, NaN, Infinity]) expect(temperatureCardAvailable({ type: 'star', temperature_k })).toBe(false)
    expect(temperatureCardAvailable({ type: 'white_dwarf', temperature_k: 39000 })).toBe(true)
    expect(temperaturePosition(5772)).toBeCloseTo(34.74, 1)
    expect(temperaturePosition(250)).toBe(0)
    expect(temperaturePosition(39000)).toBe(100)
  })

  it('uses mass and explicit main-sequence stage for lifespan trends, and cooling context for remnants', () => {
    const star = { type: 'star' as const, spectral_type: 'A1V', mass_solar: 2, temperature_k: 9845 }
    expect(temperatureEvolution(star).value).toBe('Usually shorter-lived')
    expect(temperatureEvolution({ ...star, spectral_type: 'A0mA1Va' }).value).toBe('Usually shorter-lived')
    expect(temperatureEvolution({ ...star, spectral_type: 'M5V', mass_solar: 0.2 }).value).toBe('Usually longer-lived')
    for (const spectral_type of ['A1', 'M1III', null]) expect(temperatureEvolution({ ...star, spectral_type }).value).toBe('Depends on mass & stage')
    expect(temperatureEvolution({ ...star, type: 'white_dwarf' }).value).toBe('Cooling remnant')
    expect(temperatureEvolution({ ...star, type: 'brown_dwarf' }).value).toBe('Cools with age')
  })
})
