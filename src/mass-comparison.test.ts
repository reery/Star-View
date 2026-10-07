import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { MASS_METRICS, massComparison, massComparisonClass, typicalMassClass, typicalMassRangePosition } from './mass-comparison'
import dwarfSequence from './data/stellar-class-references.json'
import whiteDwarfModels from './data/white-dwarf-references.json'

const star = (overrides: Partial<Star> = {}): Star => ({
  id: 'selected', name: 'Selected', type: 'star', spectral_type: 'A1V',
  mass_solar: 2, radius_solar: 2, luminosity_solar: 20,
  temperature_k: null, metallicity_dex: null, age_gyr: null, constellation: null,
  x_pc: 0, y_pc: 0, z_pc: 0, vx_kms: null, vy_kms: null, vz_kms: null,
  absolute_mag: null, epoch: 2000, notes: '', raw_astrometry: null, ...overrides,
})

describe('published typical class references', () => {
  it('uses the published subtype values and derives physically consistent surface properties', () => {
    const sirius = star({ mass_solar: 2.063, radius_solar: 1.7144, luminosity_solar: 24.74 })
    const typical = typicalMassClass(sirius)!
    expect(typical.referenceLabel).toBe('A1V')
    expect(typical.metrics.mass.value).toBe(2.17)
    expect(typical.metrics.mass.range).toEqual([1.63, 2.33])
    expect(typical.rangeLabel).toBe('A0V–A9V sequence')
    expect(typical.source).toContain('emamajek/SpectralType')
    expect(typical.metrics.gravity.value).toBeCloseTo(1.3271244e20 / 695700000 ** 2 * 2.17 / 2.136 ** 2)
    expect(typical.metrics.luminosityPerMass.value).toBeCloseTo(10 ** 1.488 / 2.17)
    expect(massComparison(sirius, star(), 'class').metrics.mass.ratio).toBeCloseTo(2.063 / 2.17)
    // A published typical G2V is not forced to be exactly the Sun.
    const solarClass = typicalMassClass(star({ spectral_type: 'G2V' }))!
    expect(solarClass.metrics.mass.value).toBe(1)
    expect(solarClass.metrics.mass.range).toEqual([0.89, 1.07])
    expect(solarClass.metrics.luminosityPerMass.value).toBeCloseTo(10 ** 0.01)
  })

  it('interpolates fractional subtypes within published coverage without extrapolating', () => {
    const typical = typicalMassClass(star({ spectral_type: 'M5.25Ve' }))!
    expect(typical.metrics.mass.value).toBeCloseTo(0.1385)
    expect(typical.metrics.gravity.value).toBeCloseTo(1.3271244e20 / 695700000 ** 2 * 0.1385 / 0.176 ** 2)
    expect(typical.metrics.luminosityPerMass.value).toBeCloseTo(10 ** -2.656 / 0.1385)
    expect(typical.note).toContain('interpolated')
    const uncalibrated = typicalMassClass(star({ spectral_type: 'O2V' }))!
    expect(uncalibrated.metrics.mass.value).toBe(59)
    expect(uncalibrated.referenceLabel).toBe('O3V')
    expect(uncalibrated.metrics.mass.range).toEqual([18.7, 59])
    expect(uncalibrated.note).toContain('without extrapolation')
  })

  it('uses paired reference rows for ranges rather than combining independent mass and radius extremes', () => {
    for (const family of 'OBAFGKM') {
      const rows = (dwarfSequence.rows as [string, number, number, number][]).filter(([spectral]) => spectral[0] === family)
      const typical = typicalMassClass(star({ spectral_type: rows[0]![0] }))!
      const expectedGravity = rows.map(([, mass, radius]) => 1.3271244e20 / 695700000 ** 2 * mass / radius ** 2)
      expect(typical.metrics.gravity.range![0]).toBeCloseTo(Math.min(...expectedGravity))
      expect(typical.metrics.gravity.range![1]).toBeCloseTo(Math.max(...expectedGravity))
      for (const metric of MASS_METRICS) {
        const [low, high] = typical.metrics[metric].range!
        expect(low).toBeGreaterThan(0)
        expect(high).toBeGreaterThan(low)
        expect(typical.metrics[metric].value).toBeGreaterThanOrEqual(low)
        expect(typical.metrics[metric].value).toBeLessThanOrEqual(high)
      }
    }
  })

  it('uses all-catalog averages for evolved classes, normalizes transition stages and identifies missing-stage proxies', () => {
    expect(massComparisonClass(star({ spectral_type: 'M5.5Ve' }))?.key).toBe('MV')
    expect(massComparisonClass(star({ spectral_type: 'B0Iab' }))?.key).toBe('BI')
    for (const spectral_type of [null, 'A1V+K2V']) {
      expect(typicalMassClass(star({ spectral_type }))).toBeNull()
      expect(massComparison(star({ spectral_type }), star(), 'class').metrics.mass.ratio).toBeNull()
    }
    expect(typicalMassClass(star({ spectral_type: 'G2' }))?.fallbackLabel).toBe('Using G2V for G2')
    for (const spectral_type of ['G2III', 'G2II', 'G2IV', 'G2VI', 'B0Iab', 'G2IV/V', 'G2IV-V', 'B2IV-V', 'B7III']) {
      const typical = typicalMassClass(star({ spectral_type }))!
      expect(typical.benchmarkLabel).toBe('Catalog average')
      for (const metric of MASS_METRICS) {
        expect(typical.metrics[metric].value).toBeGreaterThan(0)
        expect(typical.metrics[metric].range).not.toBeNull()
      }
    }
    const transition = typicalMassClass(star({ spectral_type: 'B2IV-V' }))!
    expect(transition.referenceLabel).toBe('B2IV')
    expect(transition.metrics).toEqual(typicalMassClass(star({ spectral_type: 'B2IV' }))!.metrics)
    expect(typicalMassClass(star({ spectral_type: 'B7III' }))!.referenceLabel).toBe('B7III')
  })

  it('provides sourced mass-only neutron-star guides and a brown-dwarf range without inventing a midpoint', () => {
    for (const type of ['neutron_star', 'pulsar'] as const) expect(typicalMassClass(star({ type }))!.metrics.mass.value).toBe(1.4)
    for (const type of ['neutron_star', 'pulsar', 'brown_dwarf'] as const) {
      const typical = typicalMassClass(star({ type }))!
      for (const metric of ['gravity', 'escapeKms', 'density', 'luminosityPerMass'] as const) {
        expect(typical.metrics[metric]).toEqual({ value: null, range: null })
      }
    }
    const brown = typicalMassClass(star({ type: 'brown_dwarf' }))!
    expect(brown.metrics.mass.value).toBeNull()
    expect(brown.metrics.mass.range![0]).toBeCloseTo(0.01240964)
    expect(brown.metrics.mass.range![1]).toBeCloseTo(0.076367)
    for (const type of ['black_hole', 'sub_brown_dwarf'] as const) expect(typicalMassClass(star({ type }))).toBeNull()
  })

  it('derives white dwarf benchmarks from the published 0.6 solar-mass hydrogen model at the catalog temperature', () => {
    // Original seq_060_thick point: Teff 10051.7695, R 8.928257e8 cm,
    // L 5.798764e30 erg/s, log g (cgs) 7.99952949.
    const selected = star({ type: 'white_dwarf', spectral_type: 'DA2', temperature_k: 10051.7695 })
    const typical = typicalMassClass(selected)!
    expect(typical.referenceLabel).toBe('DA')
    expect(typical.source).toContain('bergeron/CoolingModels')
    expect(typical.metrics.mass).toEqual({ value: 0.6, range: [0.2, 1.3] })
    expect(typical.metrics.gravity.value! / (10 ** 7.99952949 / 100)).toBeCloseTo(1, 3)
    const radiusM = 8.928257e6
    const gm = 0.6 * 1.3271244e20
    expect(typical.metrics.escapeKms.value).toBeCloseTo(Math.sqrt(2 * gm / radiusM) / 1000)
    expect(typical.metrics.density.value).toBeCloseTo(gm / 6.67430e-11 / (4 * Math.PI * radiusM ** 3 / 3) / 1000)
    expect(typical.metrics.luminosityPerMass.value).toBeCloseTo(5.798764e30 / 3.828e33 / 0.6)
    for (const metric of MASS_METRICS) {
      expect(typical.metrics[metric].range![0]).toBeLessThan(typical.metrics[metric].value!)
      expect(typical.metrics[metric].range![1]).toBeGreaterThan(typical.metrics[metric].value!)
    }
    const comparison = massComparison(selected, star(), 'class')
    for (const metric of ['gravity', 'escapeKms', 'density', 'luminosityPerMass'] as const) expect(comparison.metrics[metric].ratio).not.toBeNull()
  })

  it('matches white dwarf temperature and envelope without using the selected mass or radius as its own benchmark', () => {
    const selected = star({ type: 'white_dwarf', spectral_type: 'DA2', temperature_k: 10000 })
    const hydrogen = typicalMassClass(selected)!
    const hot = typicalMassClass({ ...selected, temperature_k: 25000 })!
    const helium = typicalMassClass({ ...selected, spectral_type: 'DB4' })!
    expect(hot.metrics.gravity.value).toBeLessThan(hydrogen.metrics.gravity.value!)
    expect(hot.metrics.luminosityPerMass.value).toBeGreaterThan(hydrogen.metrics.luminosityPerMass.value!)
    expect(helium.metrics.gravity.value).not.toBe(hydrogen.metrics.gravity.value)
    expect(typicalMassClass({ ...selected, spectral_type: 'DQZ' })!.metrics).toEqual(helium.metrics)
    expect(typicalMassClass(star({ ...selected, mass_solar: 1.018, radius_solar: 0.008098, luminosity_solar: 0.02448 }))!.metrics).toEqual(hydrogen.metrics)
    expect(massComparison(selected, star({ mass_solar: 8 }), 'class').metrics).toEqual(massComparison(selected, selected, 'class').metrics)
  })

  it('interpolates white dwarf radius linearly and luminosity logarithmically between published temperatures', () => {
    const temperature = (10051.7695 + 9965.7662) / 2
    const typical = typicalMassClass(star({ type: 'white_dwarf', spectral_type: 'DA', temperature_k: temperature }))!
    const radiusM = (8.928257e8 + 8.924197e8) / 2 / 100
    expect(typical.metrics.gravity.value).toBeCloseTo(0.6 * 1.3271244e20 / radiusM ** 2)
    expect(typical.metrics.luminosityPerMass.value).toBeCloseTo(Math.sqrt(5.798764e30 * 5.597745e30) / 3.828e33 / 0.6)
  })

  it('does not invent a surface average for white dwarfs with missing temperature or unknown/mixed atmospheres', () => {
    const selected = star({ type: 'white_dwarf', spectral_type: 'DA', temperature_k: 10000 })
    for (const overrides of [{ temperature_k: null }, { temperature_k: NaN }, { spectral_type: null }, { spectral_type: 'DC' }, { spectral_type: 'DAB' }, { spectral_type: 'DBA' }, { spectral_type: 'DA+DB' }]) {
      const typical = typicalMassClass({ ...selected, ...overrides })!
      expect(typical.metrics.mass.value).toBe(0.6)
      for (const metric of ['gravity', 'escapeKms', 'density', 'luminosityPerMass'] as const) {
        expect(typical.metrics[metric].value).toBeNull()
        expect(typical.metrics[metric].range![0]).toBeGreaterThan(0)
        expect(typical.metrics[metric].range![1]).toBeGreaterThan(typical.metrics[metric].range![0])
      }
    }
  })

  it('never extrapolates white dwarf cooling tracks outside their published temperatures', () => {
    for (const temperature_k of [100, 200000]) {
      const typical = typicalMassClass(star({ type: 'white_dwarf', spectral_type: 'DA', temperature_k }))!
      expect(typical.metrics.mass.value).toBe(0.6)
      for (const metric of ['gravity', 'escapeKms', 'density', 'luminosityPerMass'] as const) expect(typical.metrics[metric]).toEqual({ value: null, range: null })
    }
    // At 100,000 K the 0.6 hydrogen track has ended; hotter high-mass tracks still cover it.
    const hot = typicalMassClass(star({ type: 'white_dwarf', spectral_type: 'DA', temperature_k: 100000 }))!
    expect(hot.metrics.gravity.value).toBeNull()
    expect(hot.metrics.gravity.range).not.toBeNull()
  })

  it('preserves the complete, ordered published cooling grid', () => {
    expect(whiteDwarfModels.tracks).toHaveLength(46)
    for (const envelope of ['thick', 'thin']) {
      const tracks = whiteDwarfModels.tracks.filter((track) => track.envelope === envelope)
      expect(tracks.map((track) => track.mass_solar)).toEqual(Array.from({ length: 23 }, (_, index) => (20 + index * 5) / 100))
      for (const track of tracks) {
        expect(track.rows.every((row) => row.length === 3 && row.every((value) => Number.isFinite(value) && value > 0))).toBe(true)
        expect(track.rows.every((row, index) => index === 0 || row[0]! > track.rows[index - 1]![0]!)).toBe(true)
      }
    }
  })

  it('keeps the published class reference independent of the origin and preserves solar and origin modes', () => {
    const selected = star()
    const origin = star({ mass_solar: 4, radius_solar: 8, luminosity_solar: 80 })
    const relative = massComparison(selected, origin, 'origin')
    expect(relative.metrics.mass.ratio).toBe(0.5)
    expect(relative.metrics.gravity.ratio).toBe(8)
    expect(relative.metrics.escapeKms.ratio).toBeCloseTo(Math.sqrt(2))
    expect(relative.metrics.density.ratio).toBe(32)
    expect(relative.metrics.luminosityPerMass.ratio).toBe(0.5)
    expect(massComparison(selected, origin, 'sun').metrics.gravity.ratio).toBe(0.5)
    expect(massComparison(selected, origin, 'class').metrics).toEqual(massComparison(selected, selected, 'class').metrics)
    const compactOrigin = massComparison(selected, star({ type: 'black_hole' }), 'origin')
    for (const metric of ['gravity', 'escapeKms', 'density'] as const) expect(compactOrigin.metrics[metric].ratio).toBeNull()
  })

  it('keeps missing measurements unknown', () => {
    for (const mass_solar of [null, 0, -1, NaN, Infinity]) expect(massComparison(star({ mass_solar }), star(), 'class').metrics.mass.ratio).toBeNull()
    expect(massComparison(star({ radius_solar: null }), star(), 'class').metrics.gravity.ratio).toBeNull()
  })

  it('extends the axis for outliers while preserving the typical value and range boundaries', () => {
    expect(typicalMassRangePosition(2, [1, 4], 2)).toEqual({
      low: 1, high: 4, position: 50, rangeLowPosition: 0, rangeHighPosition: 100, typicalPosition: 50,
    })
    const below = typicalMassRangePosition(0.5, [1, 4], 2)
    expect(below.low).toBe(0.5)
    expect(below.high).toBe(4)
    expect(below.position).toBe(0)
    expect(below.rangeLowPosition).toBeCloseTo(100 / 3)
    expect(below.typicalPosition).toBeCloseTo(200 / 3)
    expect(below.rangeHighPosition).toBe(100)
    const above = typicalMassRangePosition(8, [1, 4], 2)
    expect(above.low).toBe(1)
    expect(above.high).toBe(8)
    expect(above.position).toBe(100)
    expect(above.rangeLowPosition).toBe(0)
    expect(above.typicalPosition).toBeCloseTo(100 / 3)
    expect(above.rangeHighPosition).toBeCloseTo(200 / 3)
  })

  it('places Sirius A gravity beyond the class upper bound on the extended horizontal line', () => {
    const sirius = star({ mass_solar: 2.063, radius_solar: 1.7144, luminosity_solar: 24.74 })
    const comparison = massComparison(sirius, star(), 'class')
    const gravity = 1.3271244e20 / 695700000 ** 2 * 2.063 / 1.7144 ** 2
    const { range, value: typical } = comparison.metrics.gravity
    expect(gravity).toBeCloseTo(192.4609)
    expect(range![0]).toBeCloseTo(126.0356)
    expect(range![1]).toBeCloseTo(160.1698)
    const layout = typicalMassRangePosition(gravity, range!, typical)
    expect(layout.position).toBe(100)
    expect(layout.rangeHighPosition).toBeGreaterThan(0)
    expect(layout.rangeHighPosition).toBeLessThan(layout.position!)
    expect(layout.high).toBe(gravity)
    expect(layout.typicalPosition).toBeLessThan(layout.rangeHighPosition)
  })

  it('handles a zero value, a missing measurement and a range with no typical point', () => {
    const zero = typicalMassRangePosition(0, [1, 4], 2)
    expect(zero.position).toBe(0)
    expect(zero.low).toBe(0.1)
    expect(zero.typicalPosition).toBeGreaterThan(zero.rangeLowPosition)
    expect(typicalMassRangePosition(null, [1, 4], 2)).toEqual({
      low: 1, high: 4, position: null, rangeLowPosition: 0, rangeHighPosition: 100, typicalPosition: 50,
    })
    expect(typicalMassRangePosition(2, [1, 4]).typicalPosition).toBeNull()
  })

  it('displays one-star or identical-valued samples without collapsing the axis', () => {
    const point = typicalMassRangePosition(2, [2, 2], 2)
    expect(point.low).toBeLessThan(2)
    expect(point.high).toBeGreaterThan(2)
    expect(point.position).toBeCloseTo(50)
    expect(point.rangeLowPosition).toBeCloseTo(point.typicalPosition!)
    expect(point.rangeHighPosition).toBeCloseTo(point.typicalPosition!)
    const zero = typicalMassRangePosition(0, [0, 0], 0)
    expect(Object.values(zero).every((value) => value === null || Number.isFinite(value))).toBe(true)
    const outlier = typicalMassRangePosition(20, [2, 2], 2)
    expect(outlier.position).toBe(100)
    expect(outlier.typicalPosition).toBeGreaterThan(0)
    expect(outlier.typicalPosition).toBeLessThan(100)
  })
})
