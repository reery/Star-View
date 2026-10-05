import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import csv from './data/stars.csv?raw'
import identitiesPayload from './data/object-designations.json'
import { parseStarCatalog } from './catalog'
import { mergeCatalogStars, parseCatalogPayload } from './catalog-runtime'
import { DEFAULT_CATALOG_MANIFEST } from './catalog-manifest'
import { objectDesignations, parseObjectIdentities, supplementObjectIdentities } from './designations'
import { normalizeObjectSearch, objectSearchText } from './object-list'

const identities = parseObjectIdentities(identitiesPayload)
const stars = parseStarCatalog(csv)

describe('object designations', () => {
  it('accepts optional native aliases and preserves them through catalog parsing', () => {
    const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data
    const native = Papa.unparse([{ ...rows[0], designations: '' }, { ...rows[1], designations: ' GJ 551 | HIP 70890 | gj 551 | Proxima Centauri ' }])
    expect(parseStarCatalog(native)[1]!.designations).toEqual(['GJ 551', 'HIP 70890'])
  })

  it('retains both catalogs’ aliases when shared objects merge without changing measurements', () => {
    const primary = { ...stars[1]!, designations: ['GJ 551'] }
    const additional = { ...primary, name: 'Proxima', designations: ['HIP 70890', 'GJ 551'] }
    const merged = mergeCatalogStars([primary], [additional])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toEqual({ ...primary, designations: ['GJ 551', 'Proxima', 'HIP 70890'] })
    expect(primary.designations).toEqual(['GJ 551'])
  })

  it.each([
    ['psr-j0633p1746', 'Geminga', 'PSR J0633+1746'],
    ['psr-j0835m4510', 'Vela Pulsar', 'PSR B0833-45'],
    ['psr-j0659p1414', 'Monogem Pulsar', 'PSR B0656+14'],
    ['psr-j0357p3205', 'Morla', 'PSR J0357+3205'],
    ['psr-j1300p1240', 'Lich', 'PSR B1257+12'],
    ['psr-j2225p6535', 'Guitar Pulsar', 'PSR B2224+65'],
  ])('prefers the common name for %s and keeps its formal identifiers searchable', (id, name, alias) => {
    const object = supplementObjectIdentities([{ ...stars[1]!, id, name: alias }], identities)[0]!
    expect(object.name).toBe(name)
    expect(objectDesignations(object)).toContain(alias)
    expect(objectSearchText(object)).toContain(normalizeObjectSearch(alias))
    expect(objectSearchText(object)).toContain(normalizeObjectSearch(name))
  })

  it('keeps system aliases out of Luhman 16 components and illuminating stars out of nebulae', () => {
    expect(identities['luhman-16-a']!.designations).toContain('Gaia DR2 5353626573555863424')
    expect(identities['luhman-16-a']!.designations).not.toContain('Gaia DR3 5353626573555863424')
    expect(identities['luhman-16-a']!.designations).not.toContain('Gaia EDR3 5353626573555863424')
    expect(identities['luhman-16-b']!.designations).not.toContain('Gaia DR2 5353626573555863424')
    expect(identities['ic-4606']!.designations).not.toContain('Antares')
    expect(identities['vdb-101']!.designations).not.toContain('HD 146834')
    expect(identities['abell-35']!.designations).not.toContain('ACO 35')
    expect(identities['abell-35']!.designations).not.toContain('HIP 62905')
    expect(identities['psr-j2225p6535']!.designations).not.toContain('Guitar Nebula')
  })

  it('recognizes Greek Bayer notation and distinguishes coordinate signs', () => {
    const proxima = supplementObjectIdentities(stars, identities)[1]!
    expect(objectSearchText(proxima)).toContain(normalizeObjectSearch('α Centauri C'))
    expect(normalizeObjectSearch('PSR J0633+1746')).not.toBe(normalizeObjectSearch('PSR J0633-1746'))
    expect(normalizeObjectSearch('PSR J0835−4510')).toBe(normalizeObjectSearch('PSR J0835-4510'))
    expect(identities['bright-beta-gruis']!.name).toBe('Tiaki')
    expect(identities['bright-epsilon-scorpii']!.name).toBe('Larawag')
    expect(identities['10pc-0073']!.name).toBe("van Maanen's Star")
  })

  it('covers every bundled catalog and overlay while preserving the science data', () => {
    const paths = ['stars.csv', ...['nearest-100', 'nearest-1000', 'bright-stars', 'western-constellation-stars', 'famous-cluster-stars'].map((id) => `catalogs/${id}/stars.csv`)]
    for (const path of paths) {
      const original = parseStarCatalog(readFileSync(new URL(`./data/${path}`, import.meta.url), 'utf8'))
      const enriched = supplementObjectIdentities(original, identities)
      for (const [index, star] of original.entries()) {
        expect(identities[star.id], `${path}: ${star.id}`).toBeDefined()
        expect(enriched[index]).toEqual({ ...star, name: enriched[index]!.name, designations: enriched[index]!.designations })
      }
    }
    for (const id of ['compact-remnants', 'nebulae', 'molecular-clouds', 'bubbles']) {
      const payload = JSON.parse(readFileSync(new URL(`./data/overlays/${id}/objects.json`, import.meta.url), 'utf8'))
      for (const star of payload.objects) expect(identities[star.id], `${id}: ${star.id}`).toBeDefined()
    }
  })

  it('rejects malformed alias payloads and leaves legacy and custom identities usable', () => {
    expect(() => parseCatalogPayload({ schemaVersion: 1, catalogId: DEFAULT_CATALOG_MANIFEST.id, stars: stars.map((star) => ({ ...star, designations: [42] })) }, DEFAULT_CATALOG_MANIFEST)).toThrow('Invalid catalog payload row')
    expect(() => parseObjectIdentities({ schemaVersion: 1, objects: { bad: { name: 'Bad', designations: [''], sources: ['source'] } } })).toThrow('Invalid object designations')
    const custom = { ...stars[1]!, id: 'toString', name: 'Custom star', designations: ['Custom identifier'] }
    expect(supplementObjectIdentities([custom], identities)[0]).toEqual(custom)
  })
})
