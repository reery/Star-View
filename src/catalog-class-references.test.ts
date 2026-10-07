import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { buildCatalogClassReferences, closestCatalogClass } from './catalog-class-references'
import { massComparisonClass } from './mass-classification'
import { massProperties } from './mass-properties'
import { typicalMassClass } from './mass-comparison'

const star = (id: string, overrides: Partial<Star> = {}): Star => ({
  id, name: id, type: 'star', spectral_type: 'A0V', mass_solar: 2, radius_solar: 1, luminosity_solar: 10,
  temperature_k: null, metallicity_dex: null, age_gyr: null, constellation: null,
  x_pc: 1, y_pc: 0, z_pc: 0, vx_kms: null, vy_kms: null, vz_kms: null,
  absolute_mag: null, epoch: 2000, notes: '', raw_astrometry: null, ...overrides,
})

describe('catalog class statistics', () => {
  it('averages an exact class across every catalog, counting each star once and retaining measured bounds', () => {
    const catalogs = Array.from({ length: 6 }, (_, index) => ({
      id: `catalog-${index}`, stars: [star(`star-${index}`, { mass_solar: index + 1 }), star('repeated', { mass_solar: 7 })],
    }))
    catalogs[0]!.stars.push(star('other-class', { spectral_type: 'A1V', mass_solar: 100 }))
    const result = buildCatalogClassReferences(catalogs)
    const sample = result.classes.find((row) => row.spectral === 'A0V')!
    expect(result.catalogIds).toHaveLength(6)
    expect(result.uniqueObjects).toBe(8)
    expect(sample.count).toBe(7)
    expect(sample.metrics.mass).toEqual({ value: 4, range: [1, 7], count: 7 })
    expect(result).toEqual(buildCatalogClassReferences([...catalogs].reverse()))
  })

  it('derives each surface metric from paired measurements before averaging and omits missing measurements per metric', () => {
    const members = [star('first'), star('second', { mass_solar: 4, radius_solar: 2, luminosity_solar: 40 }),
      star('incomplete', { mass_solar: 6, radius_solar: null, luminosity_solar: null })]
    const sample = buildCatalogClassReferences([{ id: 'all', stars: members }]).classes[0]!
    expect(sample.metrics.mass).toEqual({ value: 4, range: [2, 6], count: 3 })
    for (const metric of ['gravity', 'escapeKms', 'density', 'luminosityPerMass'] as const) {
      const first = massProperties(members[0]!)[metric]!
      const second = massProperties(members[1]!)[metric]!
      expect(sample.metrics[metric]).toEqual({ value: (first + second) / 2, range: [Math.min(first, second), Math.max(first, second)], count: 2 })
    }
  })

  it('merges reviewed aliases but preserves distinct companions and deliberately withheld fields', () => {
    const components = new Map([['a', 'a'], ['alias-a', 'a'], ['b', 'b']])
    const identity = (id: string) => components.has(id) ? { canonicalStarId: components.get(id)! } : undefined
    const result = buildCatalogClassReferences([
      { id: 'nearest-1000', stars: [star('a', { mass_solar: 2 }), star('b', { name: 'a', mass_solar: 4 }),
        star('withheld', { mass_solar: null, notes: 'Withheld individual fields: mass_solar.' })] },
      { id: 'bright-stars', stars: [star('alias-a', { mass_solar: 20 }), star('withheld', { mass_solar: 100 })] },
    ], identity)
    expect(result.uniqueObjects).toBe(3)
    expect(result.classes[0]!.metrics.mass).toEqual({ value: 3, range: [2, 4], count: 2 })
  })

  it('normalizes annotations and transition stages while retaining exact-class samples', () => {
    for (const spectral_type of ['A0V', 'A0Vn', 'A0VpSi']) expect(massComparisonClass(star('x', { spectral_type }))?.spectral).toBe('A0V')
    expect(massComparisonClass(star('x', { spectral_type: 'B2IV-V' }))?.spectral).toBe('B2IV')
    expect(massComparisonClass(star('x', { spectral_type: 'B0Iab' }))?.spectral).toBe('B0Iab')
    expect(massComparisonClass(star('x', { spectral_type: 'sdM3' }))?.spectral).toBe('M3VI')
    expect(massComparisonClass(star('x', { spectral_type: 'kA5hF0VpSr' }))?.spectral).toBe('F0V')
    expect(massComparisonClass(star('x', { spectral_type: 'kF3VhF5mF5(II-III)' }))?.spectral).toBe('F5II')
    expect(massComparisonClass(star('x', { spectral_type: 'B2IV+B3V' }))).toBeNull()
    const result = buildCatalogClassReferences([{ id: 'all', stars: [star('a'), star('b', { spectral_type: 'A0VpSi' }),
      star('c', { spectral_type: 'B2IV-V' }), star('d', { spectral_type: 'B2IV' }), star('uncertain', { spectral_type: 'B2' })] }])
    expect(result.classes.map(({ spectral, count }) => [spectral, count])).toEqual([['A0V', 2], ['B2IV', 2]])
  })

  it('uses the closest subtype in the same stage and exposes per-metric fallback classes', () => {
    const result = buildCatalogClassReferences([{ id: 'all', stars: [
      star('exact', { spectral_type: 'B2IV', radius_solar: null }),
      star('neighbor', { spectral_type: 'B3IV', mass_solar: 5 }),
      star('dwarf', { spectral_type: 'B2V', mass_solar: 9 }),
      star('giant', { spectral_type: 'B7III', mass_solar: 12 }),
    ] }])
    const selected = star('exact', { spectral_type: 'B2IV-V' })
    expect(closestCatalogClass(selected, result.classes, 'mass')?.spectral).toBe('B2IV')
    expect(closestCatalogClass(selected, result.classes, 'gravity')?.spectral).toBe('B3IV')
    const typical = typicalMassClass(selected, result.classes)!
    expect(typical.metrics.mass.value).toBe(2)
    expect(typical.metrics.gravity.referenceLabel).toBe('B3IV')
    expect(typicalMassClass(star('x', { spectral_type: 'B2.5IV' }), result.classes)?.referenceLabel).toBe('B2IV')
    expect(typicalMassClass(star('x', { spectral_type: 'B7III' }), result.classes)?.metrics.mass.value).toBe(12)
    expect(typicalMassClass(star('x', { spectral_type: 'A0V' }), result.classes)?.metrics.mass.value).toBe(2.33)
  })
})
