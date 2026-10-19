import { describe, expect, it } from 'vitest'
import nearest100Csv from './data/catalogs/nearest-100/stars.csv?raw'
import nearest1000Csv from './data/catalogs/nearest-1000/stars.csv?raw'
import review from '../catalog-work/shared-enrichment/nearby-gaps-review.json'
import { parseStarCatalog } from './catalog'
import { completeCatalogCompanions } from './stellar-companions'

describe('reviewed GJ 412, GJ 687 and Lacaille 8760 gaps', () => {
  it('keeps individual Johnson V photometry consistent across nearby catalogs and effective components', () => {
    for (const csv of [nearest100Csv, nearest1000Csv]) {
      const raw = parseStarCatalog(csv)
      const effective = completeCatalogCompanions(raw)
      for (const stars of [raw, effective]) {
        for (const [id, magnitude] of [['10pc-0100', 8.77], ['10pc-0101', 14.44], ['10pc-0080', 9.15]] as const) {
          const star = stars.find((candidate) => candidate.id === id)!
          const distance = Math.hypot(star.x_pc, star.y_pc, star.z_pc)
          expect(star.absolute_mag! + 5 * Math.log10(distance / 10)).toBeCloseTo(magnitude, 5)
        }
      }
      const a = effective.find((star) => star.id === '10pc-0100')!
      const b = effective.find((star) => star.id === '10pc-0101')!
      expect(a.apparent_mag).toBeCloseTo(8.77, 5)
      expect(b.apparent_mag).toBeCloseTo(14.44, 5)
      expect(a.name).toBe('BD+44 2051 A')
      expect(b.name).toBe('WX UMa')
    }
  })

  it('adds empirical physical estimates while preserving independent data and motion', () => {
    for (const [catalog, csv] of [['nearest-100', nearest100Csv], ['nearest-1000', nearest1000Csv]] as const) {
      const stars = completeCatalogCompanions(parseStarCatalog(csv))
      const lacaille = stars.find((star) => star.id === '10pc-0060')!
      expect(lacaille).toMatchObject({ mass_solar: 0.627, radius_solar: 0.593, temperature_k: 3795, age_gyr: null })
      expect(lacaille.luminosity_solar).toBeCloseTo(0.593 ** 2 * (3795 / 5772) ** 4, 11)
      const gj687 = stars.find((star) => star.id === '10pc-0080')!
      expect(gj687).toMatchObject({ mass_solar: 0.413, temperature_k: 3430, radius_solar: 0.47864288, luminosity_solar: 0.021436334 })
      for (const id of ['10pc-0060', '10pc-0080', '10pc-0100', '10pc-0101'] as const) {
        const star = stars.find((candidate) => candidate.id === id)!
        const previous = review.previousCatalogs[catalog][id].record
        for (const field of ['x_pc', 'y_pc', 'z_pc', 'vx_kms', 'vy_kms', 'vz_kms', 'metallicity_dex'] as const) {
          expect(star[field]).toBe(Number(previous[field]))
        }
      }
    }
  })

  it('retains errors and methods without presenting calibrated or derived estimates as direct measurements', () => {
    const lacaille = review.objects['10pc-0060'].adoptedFields
    expect(lacaille.mass_solar).toMatchObject({ status: 'empirical-relation', uncertainty: null })
    expect(lacaille.radius_solar).toMatchObject({ status: 'empirical-relation', uncertainty: null })
    expect(lacaille.luminosity_solar).toMatchObject({ status: 'derived', uncertainty: null })
    expect(review.objects['10pc-0080'].adoptedFields.mass_solar).toMatchObject({ uncertainty: 0.041, status: 'empirical-relation' })
    expect(review.sources.lindgren2017.sourceValues['GJ 825'].Ks_error).toBe(0.230)
  })
})
