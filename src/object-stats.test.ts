import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import { parseStarCatalog } from './catalog'
import { mergeCatalogStarLayers } from './catalog-merge'
import { parseObjectStats, supplementObjectStats, validObjectStats } from './object-stats'
import { objectSearchText } from './object-list'

const csv = readFileSync(new URL('./data/stars.csv', import.meta.url), 'utf8')
const stats = parseObjectStats(JSON.parse(readFileSync(new URL('./data/object-stats.json', import.meta.url), 'utf8')))
const stars = supplementObjectStats(parseStarCatalog(csv), stats)

describe('shared selected-object statistics', () => {
  it('counts planets on the actual host rather than every member of its system', () => {
    expect(stats.sun?.known_planets).toBe(8)
    expect(stats['proxima-centauri']?.known_planets).toBe(2)
    expect(stats['alpha-centauri-a']?.known_planets).toBe(0)
    expect(stats['alpha-centauri-b']?.known_planets).toBe(0)
    expect(stats['psr-j1300p1240']?.known_planets).toBe(3)
    expect(stats['10pc-0042']?.known_planets).toBe(0) // Epsilon Indi Ba is not the host A.
  })

  it('retains physical and variability classifications and makes them searchable', () => {
    expect(stats['bright-regor']?.subtypes).toContain('Wolf–Rayet')
    expect(stats['bright-betelgeuse']?.subtypes).toContain('Red supergiant')
    expect(stats['barnards-star']?.subtypes).toContain('BY Draconis variable')
    expect(objectSearchText({ ...stars[0]!, subtypes: stats['bright-regor']!.subtypes })).toContain('wolf rayet')
  })

  it('uses Earth-view V photometry and leaves missing component photometry unavailable', () => {
    expect(stars.find((star) => star.id === 'sun')?.apparent_mag).toBe(-26.74)
    expect(stars.find((star) => star.id === 'sirius-a')?.apparent_mag).toBeCloseTo(-1.46, 1)
    const missing = { ...stars[0]!, id: 'unreviewed', absolute_mag: null, apparent_mag: null, known_planets: null }
    expect(supplementObjectStats([missing], stats)[0]).toMatchObject({ apparent_mag: null, known_planets: null, subtypes: ['Main-sequence'] })
    const component = { ...missing, subtypes: [], id: 'unreviewed-companion' }
    expect(supplementObjectStats([component], stats)[0]).toMatchObject({ apparent_mag: null, known_planets: null, subtypes: [] })
  })

  it('supports custom CSV stats and rejects invalid planet counts', () => {
    const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data
    const extended = rows.map((row) => ({ ...row, subtypes: 'Wolf–Rayet|Variable star', known_planets: '2', apparent_mag: '-1.46' }))
    expect(parseStarCatalog(Papa.unparse(extended))[1]).toMatchObject({ subtypes: ['Wolf–Rayet', 'Variable star'], known_planets: 2, apparent_mag: -1.46 })
    for (const count of ['-1', '1.5']) {
      expect(() => parseStarCatalog(Papa.unparse(extended.map((row) => ({ ...row, known_planets: count }))))).toThrow('known_planets')
    }
    expect(validObjectStats({ known_planets: NaN })).toBe(false)
    expect(validObjectStats({ apparent_mag: Infinity })).toBe(false)
    expect(() => parseObjectStats({ schemaVersion: 1, objects: { invalid: { subtypes: [''], known_planets: 0 } } })).toThrow('Invalid object stats')
  })

  it('keeps shared metadata when overlapping catalog layers merge', () => {
    const primary = { ...stars[0]!, id: 'duplicate', name: 'Duplicate', subtypes: [], known_planets: null, apparent_mag: null }
    const additional = { ...primary, subtypes: ['Variable star'], known_planets: 2, apparent_mag: 5.2 }
    expect(mergeCatalogStarLayers([primary], [additional], () => undefined)[0]).toMatchObject({ subtypes: ['Variable star'], known_planets: 2, apparent_mag: 5.2 })
    const withheld = { ...primary, notes: 'Withheld individual fields: absolute_mag.' }
    expect(mergeCatalogStarLayers([withheld], [additional], () => undefined)[0]?.apparent_mag).toBeNull()
  })
})
