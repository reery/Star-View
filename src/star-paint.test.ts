import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { DEFAULT_PAINT_CONTROLS, PAINT_HISTOGRAM_BINS, paintLegend, starPainter } from './star-paint'

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
    expect(fitted.legends.get('absolute-magnitude')!.bounds).toEqual(['+10.2', '+10'])
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
    expect(fitted.legends.get('absolute-magnitude')!.bounds).toEqual(['+16', '−8'])
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
    expect(starPainter(new Map([['mass', 0.5]]), [light, heavy])!.legends.get('mass')!.bounds).toEqual(['0.1 M☉', '20 M☉'])
    const linear = starPainter(new Map([['bolometric-luminosity', 0.5]]), [light, heavy], new Set(['bolometric-luminosity']))!
    expect(linear.legends.get('bolometric-luminosity')!.bounds).toEqual(['0.00001 L☉', '1,000,000 L☉'])
    // The Sun sits 5 of the 11 decades above the faint end.
    expect(linear.painter(sun).magnitude).toBeCloseTo(10 - 12 * 5 / 11)
  })

  it('paints approaching objects blue and receding ones red, brightening the side the midpoint moves toward', () => {
    const moving = (radial: number): Star => ({ ...sun, id: `rv${radial}`, x_pc: 10, vx_kms: radial })
    const stars = [moving(-40), moving(-10), moving(10), moving(30), moving(60)]
    const fitted = (level: number, linear = false) => starPainter(new Map([['radial-velocity', level]]), stars, new Set(linear ? ['radial-velocity'] as const : []))!
    const centered = fitted(0.5)
    expect(centered.legends.get('radial-velocity')!.bounds).toEqual(['−40 km/s', '+60 km/s'])
    const approaching = centered.painter(stars[0]!).color!, receding = centered.painter(stars[4]!).color!
    expect(approaching.b).toBeGreaterThan(approaching.r)
    expect(receding.r).toBeGreaterThan(receding.b)
    expect(centered.painter(moving(0)).color!.getHexString()).toBe('333333')
    expect(centered.painter(sun).color!.getHexString()).toBe('333333')
    // Toward the red end, the fastest receding objects stand out further from slower ones and approaching objects fade.
    const contrast = (level: number) => fitted(level).painter(stars[4]!).magnitude! - fitted(level).painter(stars[3]!).magnitude!
    expect(contrast(1)).toBeLessThan(contrast(0.5))
    // Closely ranked fast objects still separate clearly near the end.
    const fast = [...stars, moving(-70), moving(-130)]
    const strength = (star: Star) => 10 - starPainter(new Map([['radial-velocity', 0.1]]), fast)!.painter(star).magnitude!
    expect(strength(fast.at(-1)!) - strength(fast.at(-2)!)).toBeGreaterThan(4)
    expect(fitted(1).painter(stars[0]!).magnitude).toBe(10)
    expect(fitted(1).painter(stars[4]!).color!.getHexString()).toBe(centered.painter(stars[4]!).color!.getHexString())
    const linear = fitted(0.5, true)
    expect(linear.legends.get('radial-velocity')!.bounds).toEqual(['−100 km/s', '+100 km/s'])
    expect(linear.painter(moving(50)).magnitude).toBeCloseTo(4)
    // Full dimness takes up to 5 magnitudes off weaker objects, leaving the fastest unchanged.
    const dimmed = starPainter(new Map([['radial-velocity', 0.5]]), stars, new Set(['radial-velocity']), new Map([['radial-velocity', { ...DEFAULT_PAINT_CONTROLS, dimness: 1 }]]))!
    expect(dimmed.painter(moving(100)).color!.getHexString()).toBe(linear.painter(moving(100)).color!.getHexString())
    expect(dimmed.painter(moving(50)).magnitude).toBeCloseTo(4 + 2.5)
    expect(dimmed.painter(moving(50)).color!.r).toBeCloseTo(linear.painter(moving(50)).color!.r * 10 ** -1, 1)
    expect(dimmed.painter(moving(0)).color!.getHexString()).toBe('010101')
  })

  it('paints metallicity and radius like the other ranked settings', () => {
    const poor = { ...sun, id: 'poor', metallicity_dex: -1.5, radius_solar: 0.1 }
    const rich = { ...sun, id: 'rich', metallicity_dex: 0.3, radius_solar: 100 }
    for (const id of ['metallicity', 'radius'] as const) {
      const fitted = starPainter(new Map([[id, 0.5]]), [poor, sun, rich])!
      expect([poor, rich, { ...sun, metallicity_dex: null, radius_solar: null }].map((star) => fitted.painter(star).color!.getHexString())).toEqual(['333333', 'ffffff', '333333'])
    }
    expect(starPainter(new Map([['metallicity', 0.5]]), [poor, rich])!.legends.get('metallicity')!.bounds).toEqual(['−1.5 dex', '+0.3 dex'])
    expect(starPainter(new Map([['radius', 0.5]]), [poor], new Set(['radius']))!.legends.get('radius')!.bounds).toEqual(['0.01 R☉', '1,000 R☉'])
  })

  it('brightens a temperature band in spectrum colors and spreads it with the width', () => {
    const hot = (temperature_k: number | null): Star => ({ ...sun, id: String(temperature_k), temperature_k })
    // Level 0.5 centers the band on the logarithmic midpoint of 250–40,000 K, 3,162 K.
    const band = (width: number, dimness = 0) => starPainter(new Map([['temperature', 0.5]]), [], new Set(), new Map([['temperature', { width, dimness }]]))!.painter
    const narrow = band(0.5)
    expect(narrow(hot(3162)).magnitude).toBeCloseTo(-2)
    expect(narrow(hot(5772)).magnitude).toBe(10)
    expect(band(1)(hot(5772)).magnitude).toBeCloseTo(-2)
    const red = narrow(hot(3162)).color!
    expect(red.r).toBeGreaterThan(red.b)
    expect(narrow(hot(null)).color!.getHexString()).toBe('333333')
    expect(band(0.5, 1)(hot(30000)).color!.getHexString()).toBe('000001')
    expect(starPainter(new Map([['temperature', 0.5]]), [])!.legends.get('temperature')!.bounds).toEqual(['250 K', '40,000 K'])
  })
  it('paints the direction of motion in the Galactic plane as hue and its speed as saturation', () => {
    const moving = (vx_kms: number | null, vy_kms: number | null): Star => ({ ...sun, id: `v${vx_kms},${vy_kms}`, vx_kms, vy_kms })
    const stars = [moving(0, 0), moving(10, 0), moving(0, 40), moving(-80, 0), moving(null, null)]
    const fitted = starPainter(new Map([['motion-direction', 0.5]]), stars)!
    expect(fitted.legends.get('motion-direction')).toMatchObject({ bounds: ['0 km/s', '80 km/s'], missing: 1 })
    // Inward motion is red, motion along rotation turns toward green and outward motion is cyan.
    const inward = fitted.painter(moving(500, 0)).color!, forward = fitted.painter(moving(0, 500)).color!, outward = fitted.painter(stars[3]!).color!
    expect(inward.getHexString()).toBe('ff0000')
    expect(forward.g).toBeGreaterThan(forward.b)
    expect(outward.r).toBeLessThan(Math.min(outward.g, outward.b))
    // Faster objects are more saturated and larger; co-moving objects share their paint.
    const slow = fitted.painter(stars[1]!), fast = fitted.painter(moving(80, 0))
    expect(slow.color!.g / slow.color!.r).toBeGreaterThan(fast.color!.g / fast.color!.r)
    expect(fast.magnitude!).toBeLessThan(slow.magnitude!)
    expect(fitted.painter(moving(80, 0))).toEqual(fitted.painter({ ...moving(80, 0), id: 'twin', x_pc: 30 }))
    expect(fitted.painter(stars[4]!).color!.getHexString()).toBe('333333')
    const linear = starPainter(new Map([['motion-direction', 0.5]]), stars, new Set(['motion-direction']))!
    expect(linear.legends.get('motion-direction')!.bounds).toEqual(['0 km/s', '100 km/s'])
    expect(linear.painter(moving(50, 0)).magnitude).toBeCloseTo(4)
  })

  it('paints density from mass and radius on a logarithmic scale', () => {
    const giant = { ...sun, id: 'giant', mass_solar: 1, radius_solar: 100 }
    const whiteDwarf = { ...sun, id: 'white-dwarf', mass_solar: 1, radius_solar: 0.01 }
    const fitted = starPainter(new Map([['density', 0.5]]), [giant, sun, whiteDwarf, { ...sun, id: 'unknown', radius_solar: null }])!
    expect(fitted.legends.get('density')).toMatchObject({ bounds: ['1.41 × 10⁻⁶ g/cm³', '1.41 × 10⁶ g/cm³'], missing: 1 })
    expect([giant, whiteDwarf].map((star) => fitted.painter(star).color!.getHexString())).toEqual(['333333', 'ffffff'])
    expect(fitted.painter(sun).magnitude).toBeCloseTo(4)
    expect(starPainter(new Map([['density', 0.5]]), [], new Set(['density']))!.legends.get('density')!.bounds).toEqual(['1 × 10⁻⁸ g/cm³', '1 × 10⁷ g/cm³'])
  })

  it('paints planet hosts on a fixed scale that grows with their planets', () => {
    const hosting = (known_planets: number | null): Star => ({ ...sun, id: `p${known_planets}`, known_planets })
    const fitted = starPainter(new Map([['planet-hosts', 0.5]]), [hosting(0), hosting(1), hosting(7), hosting(null)], new Set())!
    expect(fitted.legends.get('planet-hosts')).toMatchObject({ bounds: ['No planets', '7 planets'], missing: 1 })
    const magnitude = (planets: number | null) => fitted.painter(hosting(planets)).magnitude
    expect(magnitude(0)).toBe(10)
    expect(magnitude(null)).toBe(10)
    expect(magnitude(1)).toBeCloseTo(4)
    expect(magnitude(3)).toBeLessThan(magnitude(1)!)
    expect(magnitude(7)).toBeCloseTo(-2)
  })

  it('brightens objects that lack more catalog properties', () => {
    const sparse = { ...sun, id: 'sparse', spectral_type: null, mass_solar: null, metallicity_dex: null, age_gyr: null, vx_kms: null, vy_kms: null, vz_kms: null }
    const fitted = starPainter(new Map([['data-gaps', 0.5]]), [sun, sparse], new Set(['data-gaps']))!
    expect(fitted.legends.get('data-gaps')).toMatchObject({ bounds: ['0 of 9 unknown', '9 of 9 unknown'], missing: 0 })
    // The Sun's own record has no radial velocity relative to itself.
    expect(fitted.painter(sun).magnitude).toBeCloseTo(10 - 12 / 9)
    expect(fitted.painter(sparse).magnitude).toBeCloseTo(10 - 12 * 5 / 9)
    expect(starPainter(new Map([['data-gaps', 0.5]]), [sun, sparse])!.legends.get('data-gaps')!.bounds).toEqual(['1 of 9 unknown', '5 of 9 unknown'])
  })

  it('takes color and size from different settings, each channel from the last setting claiming it', () => {
    const rich = { ...sun, id: 'rich', metallicity_dex: 0.3, known_planets: 0 }
    const host = { ...sun, id: 'host', metallicity_dex: -1, known_planets: 3 }
    const stars = [rich, host]
    const levels = new Map([['metallicity', 0.5], ['planet-hosts', 0.5]] as const)
    const fitted = starPainter(levels, stars, new Set(), new Map(), new Map([['metallicity', ['color']], ['planet-hosts', ['size']]]))!
    const metallicity = starPainter(new Map([['metallicity', 0.5]]), stars)!.painter, planets = starPainter(new Map([['planet-hosts', 0.5]]), stars)!.painter
    for (const star of stars) expect(fitted.painter(star)).toEqual({ color: metallicity(star).color, magnitude: planets(star).magnitude })
    // Without given channels, the later setting in display order paints both.
    expect(starPainter(levels, stars)!.painter(host)).toEqual(planets(host))
    expect(starPainter(new Map([['metallicity', 0.5]]), stars, new Set(), new Map(), new Map([['metallicity', ['size']]]))!.painter(host).color).toBeUndefined()
  })

  it('counts the visible objects of each painted setting in histogram bins between its bounds', () => {
    const stars = [0.1, 0.1, 1, 10].map((mass_solar, index) => ({ ...sun, id: String(index), mass_solar }))
    const nebula = { ...sun, id: 'nebula', type: 'hii_region', mass_solar: 100, nebula: {} } as Star
    const { histogram, missing } = starPainter(new Map([['mass', 0.5]]), [...stars, nebula, { ...sun, id: 'unknown', mass_solar: null }])!.legends.get('mass')!
    expect(missing).toBe(1)
    expect(histogram).toHaveLength(PAINT_HISTOGRAM_BINS)
    expect([histogram[0], histogram[PAINT_HISTOGRAM_BINS / 2], histogram.at(-1)]).toEqual([2, 1, 1])
    expect(histogram.reduce((sum, count) => sum + count, 0)).toBe(4)
    // Open settings show the same legend without painting.
    expect(paintLegend('mass', [...stars, nebula], false)).toMatchObject({ histogram, missing: 0 })
  })
})
