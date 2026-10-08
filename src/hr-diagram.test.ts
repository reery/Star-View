import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { HR_SUN, hrAxes, hrCardAvailable, hrMagnitude, hrPoint, hrPosition } from './hr-diagram'
import { spectralReference } from './spectral-chart'

const sun = { type: 'star', temperature_k: 5772, absolute_mag: 4.83, luminosity_solar: 1 } as Star

describe('Hertzsprung–Russell coordinates', () => {
  it('keeps visual and bolometric magnitudes distinct, with the adopted solar references', () => {
    expect(hrPoint(sun, 'visual')).toEqual({ temperature: HR_SUN.temperature, magnitude: 4.83 })
    expect(hrPoint(sun, 'bolometric')).toEqual({ temperature: HR_SUN.temperature, magnitude: 4.74 })
    expect(hrMagnitude({ ...sun, luminosity_solar: 100 }, 'bolometric')).toBeCloseTo(-0.26)
    expect(hrMagnitude({ ...sun, luminosity_solar: 0.01 }, 'bolometric')).toBeCloseTo(9.74)
  })

  it('places hot bright stars above and left of the Sun, cool faint stars below and right', () => {
    const axes = hrAxes(null)
    const solar = hrPosition(hrPoint(sun, 'visual')!, axes)
    const hot = hrPosition({ temperature: 25000, magnitude: -5 }, axes)
    const cool = hrPosition({ temperature: 2800, magnitude: 16 }, axes)
    expect(hot.x).toBeLessThan(solar.x)
    expect(hot.y).toBeLessThan(solar.y)
    expect(cool.x).toBeGreaterThan(solar.x)
    expect(cool.y).toBeGreaterThan(solar.y)
    // Equal temperature ratios must occupy equal distances on a log axis.
    const x = (temperature: number) => hrPosition({ temperature, magnitude: 0 }, axes).x
    expect(x(10000) - x(20000)).toBeCloseTo(x(5000) - x(10000))
  })

  it('uses a white dwarf’s temperature and brightness without assuming the main sequence', () => {
    const siriusB = { ...sun, type: 'white_dwarf' as const, temperature_k: 25369, absolute_mag: 11.18, luminosity_solar: 0.0245 }
    const axes = hrAxes(null)
    const whiteDwarf = hrPosition(hrPoint(siriusB, 'visual')!, axes)
    const solar = hrPosition(hrPoint(sun, 'visual')!, axes)
    expect(whiteDwarf.x).toBeLessThan(solar.x)
    expect(whiteDwarf.y).toBeGreaterThan(solar.y)
  })

  it('plots a brown dwarf bolometrically without substituting infrared light for V', () => {
    const dwarf = { ...sun, type: 'brown_dwarf' as const, temperature_k: 1305, absolute_mag: null, luminosity_solar: 2.18776e-5 }
    expect(hrPoint(dwarf, 'visual')).toBeNull()
    expect(hrPoint(dwarf, 'bolometric')!.magnitude).toBeCloseTo(16.3900, 3)
  })

  it('retains zero and negative visual magnitudes, while keeping absent or invalid inputs unavailable', () => {
    for (const absolute_mag of [0, -6]) expect(hrPoint({ ...sun, absolute_mag }, 'visual')!.magnitude).toBe(absolute_mag)
    for (const temperature_k of [null, 0, -1, NaN, Infinity]) expect(hrPoint({ ...sun, temperature_k }, 'visual')).toBeNull()
    for (const absolute_mag of [null, NaN, Infinity]) expect(hrPoint({ ...sun, absolute_mag }, 'visual')).toBeNull()
    for (const luminosity_solar of [null, 0, -1, NaN, Infinity]) expect(hrPoint({ ...sun, luminosity_solar }, 'bolometric')).toBeNull()
  })

  it('extends the axes for very hot white dwarfs and cold Y dwarfs without clamping either marker', () => {
    for (const point of [{ temperature: 150000, magnitude: -14 }, { temperature: 200, magnitude: 29 }]) {
      const axes = hrAxes(point)
      const selected = hrPosition(point, axes)
      const solar = hrPosition({ temperature: 5772, magnitude: 4.83 }, axes)
      for (const position of [selected, solar]) {
        expect(position.x).toBeGreaterThan(0)
        expect(position.x).toBeLessThan(1)
        expect(position.y).toBeGreaterThan(0)
        expect(position.y).toBeLessThan(1)
      }
    }
  })

  it('excludes compact and extended objects, even if imported rows have physical fields', () => {
    for (const type of ['black_hole', 'neutron_star', 'pulsar', 'planetary_nebula', 'molecular_cloud', 'bubble'] as const) {
      expect(hrCardAvailable({ type })).toBe(false)
      expect(hrPoint({ ...sun, type }, 'visual')).toBeNull()
      expect(hrPoint({ ...sun, type }, 'bolometric')).toBeNull()
    }
  })

  it('uses the stellar origin directly and falls back to Sun only for nonstellar origins', () => {
    for (const type of ['star', 'white_dwarf', 'brown_dwarf', 'sub_brown_dwarf'] as const) {
      const origin = { ...sun, type, id: 'origin-star' }
      expect(spectralReference(origin, sun)).toBe(origin)
    }
    for (const type of ['black_hole', 'pulsar', 'hii_region', 'molecular_cloud', 'bubble'] as const) {
      expect(spectralReference({ ...sun, type }, sun)).toBe(sun)
    }
    const originWithoutData = { ...sun, temperature_k: null, absolute_mag: null, luminosity_solar: null }
    expect(spectralReference(originWithoutData, sun)).toBe(originWithoutData)
    expect(hrPoint(originWithoutData, 'visual')).toBeNull()
  })

  it('keeps both positions inside the diagram when the comparison star is an outlier', () => {
    const selected = hrPoint(sun, 'visual')!
    for (const reference of [{ temperature: 150000, magnitude: -14 }, { temperature: 200, magnitude: 29 }]) {
      const axes = hrAxes(selected, reference)
      for (const point of [selected, reference]) {
        const position = hrPosition(point, axes)
        expect(position.x).toBeGreaterThan(0)
        expect(position.x).toBeLessThan(1)
        expect(position.y).toBeGreaterThan(0)
        expect(position.y).toBeLessThan(1)
      }
    }
  })
})
