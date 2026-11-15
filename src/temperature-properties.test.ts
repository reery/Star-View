import { describe, expect, it } from 'vitest'
import {
  relativeSpectralEmission, spectrumRegion, temperatureCardAvailable,
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
})
