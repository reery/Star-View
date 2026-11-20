import { describe, expect, it } from 'vitest'
import { fixedDigits, formatDuration, keplerAxisAu, keplerPeriodYears, relativeSpeedKmS } from './orbit-tool'

describe('binary star orbit tool', () => {
  it('applies Kepler’s third law in years, astronomical units and solar masses', () => {
    expect(keplerPeriodYears(1, 1)).toBeCloseTo(1)
    // Alpha Centauri A–B: catalog masses and axis reproduce the measured 79.76-year period.
    expect(keplerPeriodYears(23.29883726, 1.0788 + 0.9092)).toBeCloseTo(79.76, 1)
    expect(keplerAxisAu(keplerPeriodYears(7.3, 2.4), 2.4)).toBeCloseTo(7.3)
  })

  it('gives orbital speeds from the vis-viva equation', () => {
    expect(relativeSpeedKmS(1, 1, 1)).toBeCloseTo(29.78, 1)
    // Faster at closest approach than at the farthest point.
    expect(relativeSpeedKmS(2, 10, 5)).toBeGreaterThan(relativeSpeedKmS(2, 10, 15))
  })

  it('fixes the live labels’ decimals by the smallest value of the orbit', () => {
    expect(fixedDigits(0.0348)).toBe(3)
    expect(fixedDigits(7)).toBe(1)
    expect(fixedDigits(200)).toBe(0)
  })

  it('formats durations in hours, days or years', () => {
    expect(formatDuration(2 / 365.25 / 24)).toBe('2 hours')
    expect(formatDuration(0.2847947433264887)).toBe('104 days')
    expect(formatDuration(79.762)).toBe('79.8 years')
    expect(formatDuration(0, 25.8)).toBe('0 years')
  })
})
