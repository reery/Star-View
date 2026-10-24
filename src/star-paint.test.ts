import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { starPainter } from './star-paint'

const sun: Star = {
  id: 'sun', name: 'Sun', type: 'star', spectral_type: 'G2V', mass_solar: 1, radius_solar: 1, luminosity_solar: 1, temperature_k: 5772,
  metallicity_dex: 0, age_gyr: 4.6, constellation: null, x_pc: 0, y_pc: 0, z_pc: 0, vx_kms: 0, vy_kms: 0, vz_kms: 0,
  absolute_mag: 4.83, apparent_mag: -26.74, epoch: 2000, notes: '', raw_astrometry: null,
}

const withMagnitude = (absolute_mag: number | null, id = String(absolute_mag)): Star => ({ ...sun, id, absolute_mag })
const visible = [withMagnitude(-7.8), sun, withMagnitude(-6), withMagnitude(15.5)]
const painter = (level: number, stars = visible) => starPainter(new Map([['absolute-magnitude', level]]), stars)!

describe('star paint', () => {
  it('paints nothing without enabled settings', () => {
    expect(starPainter(new Map(), visible)).toBeNull()
  })

  it('paints absolute magnitude from dark gray to bright white regardless of distance', () => {
    const paint = painter(0.5).painter
    const rigel = paint({ ...visible[0]!, x_pc: 260 })
    const near = paint(sun)
    const dwarf = paint(visible[3]!)
    expect(rigel.color!.r).toBeGreaterThan(near.color!.r)
    expect(near.color!.r).toBeGreaterThan(dwarf.color!.r)
    expect(rigel.magnitude!).toBeLessThan(near.magnitude!)
    expect(near.magnitude!).toBeLessThan(dwarf.magnitude!)
    expect(paint({ ...sun, x_pc: 500 })).toEqual(near)
    expect(rigel.color!.getHexString()).toBe('ffffff')
    expect(dwarf.color!.getHexString()).toBe('333333')
    expect(paint(withMagnitude(null)).color!.getHexString()).toBe('333333')
  })

  it('spreads tiny magnitude differences of the visible objects over the whole scale', () => {
    const dwarfs = [withMagnitude(10.2), withMagnitude(10.1), withMagnitude(10.1, 'twin'), withMagnitude(10)]
    const fitted = painter(0.5, dwarfs)
    const gray = (star: Star) => fitted.painter(star).color!.getHexString()
    expect(fitted.bounds.get('absolute-magnitude')).toEqual(['+10.2', '+10'])
    expect([gray(dwarfs[0]!), gray(dwarfs[3]!)]).toEqual(['333333', 'ffffff'])
    // Equal magnitudes share the middle rank; objects outside the visible range clamp to its ends.
    expect(gray(dwarfs[1]!)).toBe(gray(dwarfs[2]!))
    expect(fitted.painter(dwarfs[1]!).magnitude).toBeCloseTo(4)
    expect(gray(sun)).toBe('ffffff')
    expect(gray(withMagnitude(15.5))).toBe('333333')
  })

  it('keeps the fixed magnitude scale on a linear scale', () => {
    const dwarfs = [withMagnitude(10.2), withMagnitude(10)]
    const fitted = starPainter(new Map([['absolute-magnitude', 0.5]]), dwarfs, new Set(['absolute-magnitude']))!
    expect(fitted.bounds.get('absolute-magnitude')).toEqual(['+16', '−8'])
    expect(fitted.painter(dwarfs[1]!).color!.r).toBeGreaterThan(fitted.painter(dwarfs[0]!).color!.r)
    expect(fitted.painter(dwarfs[1]!).color!.getHexString()).not.toBe('ffffff')
    expect(fitted.painter(withMagnitude(-8)).color!.getHexString()).toBe('ffffff')
  })

  it('leaves fewer stars bright as the midpoint moves toward the bright end', () => {
    const centered = painter(0.5).painter(sun)
    const raised = painter(0.9).painter(sun)
    expect(raised.color!.r).toBeLessThan(centered.color!.r)
    expect(raised.magnitude!).toBeGreaterThan(centered.magnitude!)
    expect(painter(0.9).painter(visible[0]!).color!.getHexString()).toBe('ffffff')
    // Equal slider steps widen the contrast faster toward the right.
    const ranked = [...visible, ...Array.from({ length: 9 }, (_, index) => withMagnitude(index))]
    const strength = (level: number) => -painter(level, ranked).painter(visible[2]!).magnitude!
    expect(strength(0.5) - strength(0.7)).toBeLessThan(strength(0.7) - strength(0.9))
  })

  it('paints mass and bolometric luminosity on logarithmic scales', () => {
    const light = { ...sun, id: 'light', mass_solar: 0.1, luminosity_solar: 0.001 }
    const heavy = { ...sun, id: 'heavy', mass_solar: 20, luminosity_solar: 50000 }
    const unknown = { ...sun, id: 'unknown', mass_solar: null, luminosity_solar: null }
    for (const id of ['mass', 'bolometric-luminosity'] as const) {
      const fitted = starPainter(new Map([[id, 0.5]]), [light, sun, heavy])!
      const gray = (star: Star) => fitted.painter(star).color!.getHexString()
      expect([gray(light), gray(heavy), gray(unknown)]).toEqual(['333333', 'ffffff', '333333'])
      expect(fitted.painter(sun).magnitude).toBeCloseTo(4)
    }
    expect(starPainter(new Map([['mass', 0.5]]), [light, heavy])!.bounds.get('mass')).toEqual(['0.1 M☉', '20 M☉'])
    const linear = starPainter(new Map([['bolometric-luminosity', 0.5]]), [light, heavy], new Set(['bolometric-luminosity']))!
    expect(linear.bounds.get('bolometric-luminosity')).toEqual(['0.00001 L☉', '1,000,000 L☉'])
    // The Sun sits 5 of the 11 decades above the faint end.
    expect(linear.painter(sun).magnitude).toBeCloseTo(10 - 12 * 5 / 11)
  })
})
