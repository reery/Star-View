import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { magnitudeAxis, magnitudeBrightnessRatio, magnitudeCardAvailable, magnitudeNumber, magnitudePoints, NAKED_EYE_MAGNITUDE } from './magnitude-card'

const sun: Star = {
  id: 'sun', name: 'Sun', type: 'star', spectral_type: 'G2V', mass_solar: 1, radius_solar: 1, luminosity_solar: 1, temperature_k: 5772,
  metallicity_dex: 0, age_gyr: 4.6, constellation: null, x_pc: 0, y_pc: 0, z_pc: 0, vx_kms: 0, vy_kms: 0, vz_kms: 0,
  absolute_mag: 4.83, apparent_mag: -26.74, epoch: 2000, notes: '', raw_astrometry: null,
}
const sirius: Star = { ...sun, id: 'sirius-a', name: 'Sirius A', absolute_mag: 1.42, apparent_mag: -1.46 }

describe('individual visual magnitude comparisons', () => {
  it('keeps zero and negative magnitudes valid and leaves missing measurements unavailable', () => {
    for (const value of [0, -1.46, 4.83]) expect(magnitudeCardAvailable({ ...sun, absolute_mag: value, apparent_mag: null })).toBe(true)
    for (const value of [null, NaN, Infinity, -Infinity]) {
      expect(magnitudeCardAvailable({ ...sun, absolute_mag: value, apparent_mag: value })).toBe(false)
      expect(magnitudeNumber(value)).toBe('—')
    }
    expect(magnitudeNumber(-1.46)).toBe('−1.46')
    expect(magnitudeNumber(4.83)).toBe('+4.83')
    expect(magnitudeNumber(-0)).toBe('0')
  })

  it('orders brighter stars to the right, includes outliers and marks the dark-sky threshold', () => {
    const absolute = magnitudeAxis('absolute', [sun.absolute_mag!, sirius.absolute_mag!, 38, -16])
    expect(absolute.position(sirius.absolute_mag!)).toBeGreaterThan(absolute.position(sun.absolute_mag!))
    expect(absolute.position(38)).toBeGreaterThan(0)
    expect(absolute.position(-16)).toBeLessThan(100)
    // Equal steps in magnitude correspond to equal spacing; 5 mag is a 100× flux ratio.
    expect(absolute.position(5) - absolute.position(10)).toBeCloseTo(absolute.position(0) - absolute.position(5))
    const apparent = magnitudeAxis('apparent', [-1.46, -4.9, 32])
    // The omitted Sun would lie outside the nighttime range.
    expect(apparent.position(-26.74)).toBeGreaterThan(100)
    expect(apparent.position(32)).toBeLessThan(apparent.position(NAKED_EYE_MAGNITUDE))
    expect(apparent.position(-1.46)).toBeGreaterThan(apparent.position(NAKED_EYE_MAGNITUDE))
  })

  it('omits the Sun from the apparent scale for every selection and origin role', () => {
    const points = magnitudePoints('apparent', sirius, sun, sun)
    const axis = magnitudeAxis('apparent', points.map(({ value }) => value))
    expect(axis).toMatchObject({ faint: 16, bright: -6 })
    expect(axis.position(sirius.apparent_mag!)).toBeGreaterThan(75)
    expect(points.some(({ id }) => id === sun.id)).toBe(false)
    expect(magnitudePoints('apparent', sun, sirius, sun).some(({ id }) => id === sun.id)).toBe(false)
    expect(magnitudePoints('absolute', sirius, sun, sun).find(({ id }) => id === sun.id)?.value).toBe(4.83)
  })

  it('derives equal-distance visible brightness from V magnitude rather than bolometric luminosity', () => {
    expect(magnitudeBrightnessRatio(sirius.absolute_mag, sun.absolute_mag)).toBeCloseTo(23.1206, 3)
    expect(magnitudeBrightnessRatio(0, 5)).toBe(100)
    expect(magnitudeBrightnessRatio(5, 0)).toBe(0.01)
    expect(magnitudeBrightnessRatio(-1, -1)).toBe(1)
    expect(magnitudeBrightnessRatio(null, 4.83)).toBeNull()
    expect(magnitudeBrightnessRatio(1.42, NaN)).toBeNull()
  })

  it('merges selected, origin and benchmark roles only for the same object', () => {
    expect(magnitudePoints('absolute', sun, sun, sun)).toMatchObject([{ id: 'sun', selected: true }])
    const points = magnitudePoints('apparent', sirius, sirius, sun, sirius)
    expect(points.filter(({ id }) => id === 'sirius-a')).toHaveLength(1)
    expect(points.find(({ id }) => id === 'sirius-a')).toMatchObject({ selected: true, origin: true, value: -1.46 })
    expect(points.find(({ id }) => id === 'venus')).toMatchObject({ value: -4.9 })
  })

  it('retains Earth-view apparent measurements when the origin changes', () => {
    const otherOrigin = { ...sun, id: 'origin', name: 'Origin', apparent_mag: 7 }
    const selectedBefore = magnitudePoints('apparent', sirius, sun, sun).find(({ selected }) => selected)
    const selectedAfter = magnitudePoints('apparent', sirius, otherOrigin, sun).find(({ selected }) => selected)
    expect(selectedAfter?.value).toBe(selectedBefore?.value)
    expect(magnitudePoints('apparent', sirius, otherOrigin, sun).find(({ origin }) => origin)?.value).toBe(7)
  })

  it('never substitutes unresolved photometry or preserved parent records for a missing component', () => {
    const component: Star = { ...sun, id: 'component-b', name: 'Component B', absolute_mag: null, apparent_mag: null,
      unresolved_photometry: { magnitude_v: 2, error_mag: 0.1, scope: 'Combined A+B', source: 'Source', source_url: null },
      catalog_sources: [{ catalog_id: 'test', scope: 'Combined A+B', record: sun }],
    }
    expect(magnitudeCardAvailable(component)).toBe(false)
    for (const kind of ['absolute', 'apparent'] as const) {
      expect(magnitudePoints(kind, component, sun, sun).some(({ id }) => id === component.id)).toBe(false)
      expect(magnitudePoints(kind, sirius, component, sun).some(({ id }) => id === component.id)).toBe(false)
    }
  })
})
