import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseStarCatalog } from './catalog'
import { completeCatalogCompanions } from './stellar-companions'
import { catalogMeasurement } from './catalog-source'
import { mapComponentVisibility } from './star-systems'
import { catalogSourceUrl } from './test-support/catalog-source'

describe('Izar effective data in both landmark catalogs', () => {
  it.each(['bright-stars', 'western-constellation-stars'])('keeps accurate geometry and withdrawn source fields in %s', (catalog) => {
    const input = parseStarCatalog(readFileSync(catalogSourceUrl(catalog), 'utf8'))
    const stars = completeCatalogCompanions(input)
    const a = stars.find((s) => s.id === 'bright-izar' || s.id === 'hip-72105')!
    const b = stars.find((s) => s.id === 'msc-14450+2704-b')!
    const d = stars.find((s) => s.id === 'msc-14450+2704-d')!
    expect(b.temperature_k).toBe(9009)
    expect(catalogMeasurement(b, 'metallicity_dex')).toBeNull()
    expect(catalogMeasurement(d, 'apparent_mag')).toBeNull()
    expect(d.type).toBe('brown_dwarf')
    const visible = mapComponentVisibility([a, b, d])
    expect([...visible]).toEqual([1, 0, 1])
  })
})
