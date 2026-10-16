import { describe, expect, it } from 'vitest'
import { eveningVisibilityMonths, latitudeLabel, skyAltitude, visibleLatitudeRange, visibilityMonthLabel } from './constellation-visibility'

const sirius = { ra_deg: 101.287, dec_deg: -16.716 }

describe('Earth visibility geometry', () => {
  it('finds the full latitude range for southern, northern, and equatorial objects', () => {
    expect(visibleLatitudeRange(sirius.dec_deg)!.south).toBe(-90)
    expect(visibleLatitudeRange(sirius.dec_deg)!.north).toBeCloseTo(73.284, 8)
    expect(visibleLatitudeRange(30)).toEqual({ south: -60, north: 90 })
    expect(visibleLatitudeRange(0)).toEqual({ south: -90, north: 90 })
    expect(visibleLatitudeRange(90)).toEqual({ south: 0, north: 90 })
    expect(visibleLatitudeRange(NaN)).toBeNull()
    expect(visibleLatitudeRange(-91)).toBeNull()
  })

  it('puts the visibility limit on the horizon and handles meridian transit and poles', () => {
    expect(skyAltitude(sirius.dec_deg, 73.284, 0)).toBeCloseTo(0, 8)
    expect(skyAltitude(sirius.dec_deg, 40, 0)).toBeCloseTo(33.284, 6)
    expect(skyAltitude(sirius.dec_deg, 80, 0)).toBeLessThan(0)
    expect(skyAltitude(30, 90, 180)).toBeCloseTo(30, 8)
    expect(skyAltitude(0, 90, 0)).toBeCloseTo(0, 8)
  })

  it('uses a winter evening season for Sirius and excludes latitudes where it never rises', () => {
    expect(visibilityMonthLabel(eveningVisibilityMonths(sirius, 40))).toBe('Dec–Apr')
    expect(eveningVisibilityMonths(sirius, 80).some(Boolean)).toBe(false)
    expect(visibilityMonthLabel(eveningVisibilityMonths(sirius, 0))).toBe('Nov–Apr')
  })

  it('excludes summer twilight for a circumpolar northern star', () => {
    const months = eveningVisibilityMonths({ ra_deg: 37.95, dec_deg: 89.26 }, 80)
    expect(months[0]).toBe(true)
    expect(months[5]).toBe(false)
    expect(months[6]).toBe(false)
    expect(months[11]).toBe(true)
    expect(eveningVisibilityMonths({ ra_deg: 0, dec_deg: 0 }, 90).some(Boolean)).toBe(false)
  })

  it('handles the right ascension wrap and invalid sky positions', () => {
    expect(eveningVisibilityMonths({ ra_deg: 359, dec_deg: 20 }, 40))
      .toEqual(eveningVisibilityMonths({ ra_deg: -1, dec_deg: 20 }, 40))
    expect(eveningVisibilityMonths({ ra_deg: NaN, dec_deg: 20 }, 40).some(Boolean)).toBe(false)
    expect(eveningVisibilityMonths(sirius, 91).some(Boolean)).toBe(false)
  })
})

describe('visibility summaries', () => {
  it('formats latitude bounds without losing the hemisphere', () => {
    expect(latitudeLabel(-90)).toBe('90° S')
    expect(latitudeLabel(73.284, 1)).toBe('73.3° N')
    expect(latitudeLabel(0)).toBe('0°')
  })

  it('groups December/January together and retains separated seasons', () => {
    expect(visibilityMonthLabel([true, true, true, false, false, false, false, false, false, false, false, true])).toBe('Dec–Mar')
    expect(visibilityMonthLabel([false, true, true, false, false, true, false, false, false, false, false, false])).toBe('Feb–Mar, Jun')
    expect(visibilityMonthLabel(Array(12).fill(true))).toBe('All year')
    expect(visibilityMonthLabel(Array(12).fill(false))).toBe('None at 10 pm')
  })
})
