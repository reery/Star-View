import { describe, expect, it } from 'vitest'
import defaultCsv from './data/stars.csv?raw'
import nearest100Csv from './data/catalogs/nearest-100/stars.csv?raw'
import nearest1000Csv from './data/catalogs/nearest-1000/stars.csv?raw'
import nearest100Provenance from './data/catalogs/nearest-100/provenance.json'
import nearest1000Provenance from './data/catalogs/nearest-1000/provenance.json'
import review from '../catalog-work/shared-enrichment/ez-aquarii-review.json'
import { parseStarCatalog } from './catalog'
import { completeCatalogCompanions } from './stellar-companions'

const ids = ['ez-aquarii-a', 'ez-aquarii-b', 'ez-aquarii-c'] as const
const published = [
  { id: ids[0], mass_solar: 0.1187, absolute_mag: 15.39, spectral_type: 'M5.5V' },
  { id: ids[1], mass_solar: 0.1145, absolute_mag: 15.64, spectral_type: 'M5.5:V' },
  { id: ids[2], mass_solar: 0.0930, absolute_mag: 17.43, spectral_type: 'M7:V' },
]

describe('EZ Aquarii component literature', () => {
  it('keeps inner A/C and outer B identities and published photometry consistent in every catalog', () => {
    for (const csv of [defaultCsv, nearest100Csv, nearest1000Csv]) {
      const catalog = parseStarCatalog(csv)
      const effective = completeCatalogCompanions(catalog)
      for (const expected of published) {
        for (const records of [catalog, effective]) {
          const star = records.find((candidate) => candidate.id === expected.id)!
          expect(star).toMatchObject(expected)
          expect(star.raw_astrometry).toMatchObject({
            parallax_mas: 293.6, parallax_error_mas: 0.9,
            radial_velocity_kms: -50.08, radial_velocity_error_kms: 0.01,
          })
        }
      }
    }
  })

  it('retains source errors and uncertain luminosity flags without inventing component temperatures or radii', () => {
    const effective = completeCatalogCompanions(parseStarCatalog(defaultCsv))
    for (const [index, id] of ids.entries()) {
      const star = effective.find((candidate) => candidate.id === id)!
      expect(star).toMatchObject({ temperature_k: null, radius_solar: null, age_gyr: null, metallicity_dex: null })
      expect(star.catalog_sources?.some((source) => source.record.temperature_k === 3060
        && source.scope.includes('unresolved system'))).toBe(true)
      for (const provenance of [nearest100Provenance, nearest1000Provenance]) {
        const object = provenance.objects.find((candidate) => candidate.id === id)!
        const adopted = (object as any).sharedObjectAdoption.sourceSelections.resolvedPhysical.adoptedFields
        expect(adopted.mass_solar).toMatchObject({ uncertainty: [0.0011, 0.0012, 0.0008][index], status: 'measured' })
        expect(adopted.absolute_mag).toMatchObject({ uncertainty: [0.07, 0.08, 0.40][index], passband: 'Johnson V' })
        expect(adopted.temperature_k.status).toBe('withheld')
      }
    }
    for (const [id, logarithm] of [[ids[0], -3.11], [ids[2], -3.92]] as const) {
      expect(effective.find((star) => star.id === id)!.luminosity_solar).toBeCloseTo(10 ** logarithm, 12)
      expect(review.objects[id].adoptedFields.luminosity_solar).toMatchObject({
        status: 'estimated', uncertainty: null, inputs: { sourceUncertaintyFlag: ':' },
      })
    }
    expect(effective.find((star) => star.id === ids[1])!.luminosity_solar).toBeNull()
    expect(review.literatureReview.torres2010B).toMatchObject({ status: 'withheld', temperature_k: 2650, radius_solar: 0.21 })
    expect(review.literatureReview.taylor2024.status).toBe('unresolved-system-model')
  })

  it('completes the same three reviewed components when only one member is supplied', () => {
    const catalog = parseStarCatalog(defaultCsv)
    for (const id of ids) {
      const completed = completeCatalogCompanions([catalog.find((star) => star.id === id)!])
      for (const expected of published) expect(completed.find((star) => star.id === expected.id)).toMatchObject(expected)
    }
  })
})
