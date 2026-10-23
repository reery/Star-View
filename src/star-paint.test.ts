import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { starPainter } from './star-paint'

const sun: Star = {
  id: 'sun', name: 'Sun', type: 'star', spectral_type: 'G2V', mass_solar: 1, radius_solar: 1, luminosity_solar: 1, temperature_k: 5772,
  metallicity_dex: 0, age_gyr: 4.6, constellation: null, x_pc: 0, y_pc: 0, z_pc: 0, vx_kms: 0, vy_kms: 0, vz_kms: 0,
  absolute_mag: 4.83, apparent_mag: -26.74, epoch: 2000, notes: '', raw_astrometry: null,
}

describe('star paint', () => {
  it('paints nothing without enabled settings', () => {
    expect(starPainter(new Map())).toBeNull()
  })

  it('paints absolute magnitude from dark gray to bright white regardless of distance', () => {
    const paint = starPainter(new Map([['absolute-magnitude', 0.5]]))!
    const rigel = paint({ ...sun, absolute_mag: -7.8, x_pc: 260 })
    const near = paint(sun)
    const dwarf = paint({ ...sun, absolute_mag: 15.5 })
    expect(rigel.color!.r).toBeGreaterThan(near.color!.r)
    expect(near.color!.r).toBeGreaterThan(dwarf.color!.r)
    expect(rigel.magnitude!).toBeLessThan(near.magnitude!)
    expect(near.magnitude!).toBeLessThan(dwarf.magnitude!)
    expect(paint({ ...sun, x_pc: 500 })).toEqual(near)
    expect(rigel.color!.getHexString()).toBe('fdfdfd')
    expect(paint({ ...sun, absolute_mag: null }).color!.getHexString()).toBe('333333')
  })

  it('leaves fewer stars bright as the midpoint moves toward the bright end', () => {
    const centered = starPainter(new Map([['absolute-magnitude', 0.5]]))!(sun)
    const raised = starPainter(new Map([['absolute-magnitude', 0.9]]))!(sun)
    expect(raised.color!.r).toBeLessThan(centered.color!.r)
    expect(raised.magnitude!).toBeGreaterThan(centered.magnitude!)
    const rigel = { ...sun, absolute_mag: -8 }
    expect(starPainter(new Map([['absolute-magnitude', 0.9]]))!(rigel).color!.getHexString()).toBe('ffffff')
    // Equal slider steps widen the contrast faster toward the right.
    const giant = { ...sun, absolute_mag: -6 }
    const strength = (level: number) => -starPainter(new Map([['absolute-magnitude', level]]))!(giant).magnitude!
    expect(strength(0.5) - strength(0.7)).toBeLessThan(strength(0.7) - strength(0.9))
  })
})
