import { describe, expect, it } from 'vitest'
import { habitableZoneForStar } from './habitable-zone'

describe('conservative habitable zone', () => {
  it('matches the published solar-temperature limits and includes Earth', () => {
    const zone = habitableZoneForStar({ luminosity_solar: 1, temperature_k: 5780 })!
    expect(zone.innerAu).toBeCloseTo(0.95044325, 7)
    expect(zone.outerAu).toBeCloseTo(1.67600381, 7)
    expect(zone.innerAu).toBeLessThan(1)
    expect(zone.outerAu).toBeGreaterThan(1)
  })

  it('uses the cool-star flux correction and square-root luminosity scaling', () => {
    const zone = habitableZoneForStar({ luminosity_solar: 0.01, temperature_k: 3000 })!
    expect(zone.innerAu).toBeCloseTo(0.10414550, 7)
    expect(zone.outerAu).toBeCloseTo(0.20717684, 7)
    const brighter = habitableZoneForStar({ luminosity_solar: 0.04, temperature_k: 3000 })!
    expect(brighter.innerAu).toBeCloseTo(zone.innerAu * 2, 10)
    expect(brighter.outerAu).toBeCloseTo(zone.outerAu * 2, 10)
  })

  it('does not extrapolate beyond the published temperature range', () => {
    for (const temperature_k of [2600, 7200]) {
      const zone = habitableZoneForStar({ luminosity_solar: 1, temperature_k })!
      expect(zone.innerAu).toBeGreaterThan(0)
      expect(zone.outerAu).toBeGreaterThan(zone.innerAu)
    }
    for (const temperature_k of [null, NaN, Infinity, 2599, 7201]) {
      expect(habitableZoneForStar({ luminosity_solar: 1, temperature_k })).toBeNull()
    }
  })

  it('keeps missing or invalid host luminosity unavailable', () => {
    for (const luminosity_solar of [null, NaN, Infinity, 0, -1]) {
      expect(habitableZoneForStar({ luminosity_solar, temperature_k: 5780 })).toBeNull()
    }
  })
})
