import { describe, expect, it } from 'vitest'
import defaultCsv from './data/stars.csv?raw'
import nearest100Csv from './data/catalogs/nearest-100/stars.csv?raw'
import nearest1000Csv from './data/catalogs/nearest-1000/stars.csv?raw'
import brightCsv from './data/catalogs/bright-stars/stars.csv?raw'
import westernCsv from './data/catalogs/western-constellation-stars/stars.csv?raw'
import clusterCsv from './data/catalogs/famous-cluster-stars/stars.csv?raw'
import { parseStarCatalog } from './catalog'
import { radiusComparison, radiusStats, radiusSummary } from './radius-comparison'

describe('bundled solar reference', () => {
  it.each([
    ['nearest-neighbors', defaultCsv], ['nearest-100', nearest100Csv], ['nearest-1000', nearest1000Csv],
    ['bright-stars', brightCsv], ['western-constellation-stars', westernCsv], ['famous-cluster-stars', clusterCsv],
  ])('provides the same supported Sun properties in %s', (_catalog, csv) => {
    expect(parseStarCatalog(csv).find((star) => star.id === 'sun')).toMatchObject({
      radius_solar: 1, mass_solar: 1, luminosity_solar: 1, temperature_k: 5772,
      spectral_type: 'G2V', absolute_mag: 4.83, metallicity_dex: 0, metallicity_kind: '[M/H]', age_gyr: 4.6,
      constellation: null, x_pc: 0, y_pc: 0, z_pc: 0,
    })
  })

  it('calculates the radius card with the actual bundled Sun as origin', () => {
    const stars = parseStarCatalog(defaultCsv)
    const sun = stars.find((star) => star.id === 'sun')!
    const sirius = stars.find((star) => star.id === 'sirius-a')!
    const comparison = radiusComparison(sirius, sun)
    expect(comparison.reference.radiusKm).toBe(695_700)
    expect(comparison.selected.radiusKm).not.toBeNull()
    expect(radiusSummary(comparison)).not.toContain('No catalog radius')
    expect(radiusStats(comparison).find((row) => row.label === 'Volume')!.values[1]!.value).toBe('1.410e18 km³')
  })
})
