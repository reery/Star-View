import { describe, expect, it } from 'vitest'
import { auditCatalogConsistency } from './catalog-consistency'
import { parseStarCatalog } from './catalog'
import csv from './data/stars.csv?raw'

const template = parseStarCatalog(csv).find((star) => star.id === 'sirius-a')!
const identities = {
  primary: { name: 'Primary', simbadId: 'System', designations: [], sources: ['review'] },
  alias: { name: 'Alias', simbadId: 'System', designations: [], sources: ['review'] },
  companion: { name: 'Companion', simbadId: 'System', designations: [], sources: ['review'] },
}
const component = (id: string) => ({ canonicalStarId: id === 'alias' ? 'primary' : id })

describe('adopted catalog consistency', () => {
  it('finds scientific differences under reviewed alternate IDs', () => {
    const result = auditCatalogConsistency([
      { id: 'nearby', stars: [{ ...template, id: 'primary', spectral_type: 'A7', temperature_k: 7760 }] },
      { id: 'landmarks', stars: [{ ...template, id: 'alias', spectral_type: 'A7Vn', temperature_k: 7586 }] },
    ], identities, component)
    expect(result.sharedObjects).toBe(1)
    expect(result.conflicts.map((row) => row.field)).toEqual(['spectral_type', 'temperature_k'])
  })

  it('keeps components distinct when SIMBAD supplies the same system identifier', () => {
    const stars = [{ ...template, id: 'primary' }, { ...template, id: 'companion', spectral_type: 'DQZ' }]
    const result = auditCatalogConsistency([
      { id: 'one', stars }, { id: 'two', stars: stars.map((star) => ({ ...star })) },
    ], identities, component)
    expect(result.sharedObjects).toBe(2)
    expect(result.conflicts).toEqual([])
    const separateCatalogs = auditCatalogConsistency([
      { id: 'one', stars: [stars[0]!] }, { id: 'two', stars: [stars[1]!] },
    ], identities, component)
    expect(separateCatalogs.sharedObjects).toBe(0)
    expect(separateCatalogs.conflicts).toEqual([])
  })

  it('checks missing physical data and complete raw astrometry, allowing formatting and display-name differences', () => {
    const star = { ...template, id: 'primary', spectral_type: 'A7 Vn' }
    const result = auditCatalogConsistency([
      { id: 'one', stars: [star] },
      { id: 'two', stars: [{ ...star, name: 'Another display name', spectral_type: 'A7Vn', mass_solar: null,
        raw_astrometry: { ...star.raw_astrometry!, parallax_mas: 100 } }] },
    ], identities, component)
    expect(result.conflicts.map((row) => row.field)).toEqual(['mass_solar', 'raw_astrometry'])
  })
})
