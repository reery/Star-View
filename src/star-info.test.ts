import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { generatedJsonFetch } from './test-support/generated-json'
import csv from './data/stars.csv?raw'
import nearest100Csv from './data/catalogs/nearest-100/stars.csv?raw'
import brightStarsCsv from '../catalog-work/bright-stars/retired-catalog/stars.csv?raw'
import definitions from './data/star-info.json'
import nearest100Definitions from './data/nearest-100-info.json'
import brightStarDefinitions from './data/bright-star-info.json'
import legacyStarIds from './data/legacy-star-ids.json'
import westernCsv from './data/catalogs/western-constellation-stars/stars.csv?raw'
import { parseStarCatalog } from './catalog'
import { loadStarInfo, starInfoForId } from './star-info'
import { starInfoAvailable } from './star-info-availability'
import { reviewedStarSystems, starComponentIdentity } from './star-systems'

const stars = parseStarCatalog(csv)
// Retired bright IDs serve their articles from the surviving record.
const surviving = (id: string) => (legacyStarIds.ids as Record<string, string>)[id] ?? id
beforeAll(async () => {
  vi.stubGlobal('fetch', generatedJsonFetch)
  await Promise.all([...Object.keys(definitions.articles), ...Object.keys(nearest100Definitions.articles),
    ...Object.keys(brightStarDefinitions.articles).map(surviving)].map(loadStarInfo))
})
afterAll(() => vi.unstubAllGlobals())

describe('nearest-neighbor articles', () => {
  it('covers all 22 original objects with 15 distinct sourced articles', () => {
    expect(stars).toHaveLength(22)
    const articles = stars.map(({ id }) => starInfoForId(id))
    expect(articles.every(Boolean)).toBe(true)
    expect(new Set(articles).size).toBe(15)
    for (const info of new Set(articles)) {
      expect(info!.introduction.source?.url).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//)
      expect(info!.sections.every((section) => section.source?.url.startsWith('https://'))).toBe(true)
    }
  })

  it.each([
    ['alpha-centauri-a', 'alpha-centauri-b', 'proxima-centauri', 'hip-71683'],
    ['sirius-a', 'sirius-b', 'hip-32349'],
    ['luhman-16-a', 'luhman-16-b'],
    ['luyten-726-8-a', 'luyten-726-8-b'],
    ['ez-aquarii-a', 'ez-aquarii-b', 'ez-aquarii-c'],
  ])('shares one article for %s and its companions or catalog aliases', (...ids) => {
    const article = starInfoForId(ids[0]!)
    expect(article).toBeDefined()
    for (const id of ids.slice(1)) expect(starInfoForId(id)).toBe(article)
  })

  it('does not associate unrelated stars by name or proximity', () => {
    // A familiar name alone is not a reviewed catalog identity.
    expect(starInfoForId('tau-ceti')).toBeUndefined()
    expect(starInfoForId('unknown')).toBeUndefined()
  })
})

describe('bright-star articles', () => {
  const brightStars = parseStarCatalog(brightStarsCsv)

  it('makes Info available for every bright catalog entry, with 114 distinct system articles', () => {
    expect(brightStars).toHaveLength(126)
    expect(brightStars.filter(({ id }) => !starInfoAvailable(surviving(id)) || !starInfoForId(surviving(id))).map(({ id }) => id)).toEqual([])
    expect(new Set(brightStars.map(({ id }) => starInfoForId(surviving(id)))).size).toBe(114)
  })

  it('shares each article with all reviewed components and aliases, including companions outside the bright cutoff', () => {
    const catalogIds = new Set(brightStars.map(({ id }) => id))
    for (const system of reviewedStarSystems) {
      const ids = system.components.flatMap((component) => [component.starId, ...component.alternateStarIds ?? []])
      const representedId = ids.find((id) => catalogIds.has(id))
      if (!representedId) continue
      const article = starInfoForId(representedId)
      expect(article, system.id).toBeDefined()
      for (const id of ids) {
        expect(starInfoForId(id), id).toBe(article)
        expect(starInfoAvailable(id), id).toBe(true)
      }
    }
  })

  it('adds sourced articles without duplicating or replacing existing content', () => {
    const existingKeys = new Set([...Object.keys(definitions.articles), ...Object.keys(nearest100Definitions.articles)])
    expect(Object.keys(brightStarDefinitions.articles)).toHaveLength(109)
    for (const [id, definition] of Object.entries(brightStarDefinitions.articles)) {
      expect(existingKeys.has(id), id).toBe(false)
      const article = starInfoForId(surviving(id))!
      expect(article.introduction.label, id).toBe(definition.name)
      expect(article.introduction.source?.title, id).toMatch(/reviewed 2026-10-26$/)
      expect(article.introduction.source?.url, id).toMatch(/^https:\/\//)
      expect(article.sections.length, id).toBeGreaterThan(0)
      expect(new Set(article.sections.map(({ id }) => id)).size, id).toBe(article.sections.length)
      expect(article.sections.every((section) => section.source?.url.startsWith('https://')), id).toBe(true)
      expect(article.image, id).toBeUndefined()
    }
  })
})

describe('nearest-100 articles', () => {
  const nearest100 = parseStarCatalog(nearest100Csv)

  it('covers the Sun and all 100 catalog objects with 76 distinct sourced articles', () => {
    expect(nearest100).toHaveLength(101)
    const articles = nearest100.map(({ id }) => starInfoForId(id))
    expect(nearest100.filter((_, index) => !articles[index]).map(({ id }) => id)).toEqual([])
    expect(new Set(articles).size).toBe(76)
    for (const article of new Set(articles)) {
      expect(article!.introduction.source?.url).toMatch(/^https:\/\//)
      expect(article!.introduction.source?.title).toMatch(/reviewed 2026-10-26$/)
      expect(article!.sections.length).toBeGreaterThan(0)
      expect(article!.sections.every((section) => section.source?.url.startsWith('https://'))).toBe(true)
    }
  })

  it('shares each system article with every reviewed component and alias, including companions beyond the cutoff', () => {
    const catalogIds = new Set(nearest100.map(({ id }) => id))
    for (const system of reviewedStarSystems) {
      const ids = system.components.flatMap((component) => [component.starId, ...component.alternateStarIds ?? []])
      const representedId = ids.find((id) => catalogIds.has(id))
      if (!representedId) continue
      const article = starInfoForId(representedId)
      expect(article, system.id).toBeDefined()
      for (const id of ids) expect(starInfoForId(id), id).toBe(article)
    }
    expect(starInfoForId('gj-229-bb')!.introduction.label).toBe('Gliese 229')
  })

  it('adds 61 text-only articles without replacing the original articles', () => {
    const originalKeys = new Set(Object.keys(definitions.articles))
    const addedKeys = Object.keys(nearest100Definitions.articles)
    expect(addedKeys).toHaveLength(61)
    expect(addedKeys.some((key) => originalKeys.has(key))).toBe(false)
    for (const id of addedKeys) {
      const article = starInfoForId(id)!
      expect(article, id).toBeDefined()
      expect(article.image, id).toBeUndefined()
      expect(article.sections.some((section) => section.image), id).toBe(false)
    }
  })
})

describe('single-star catalog aliases', () => {
  const westernIds = new Set(parseStarCatalog(westernCsv).map(({ id }) => id))
  const aliased = [definitions, nearest100Definitions, brightStarDefinitions].flatMap((dataset) =>
    Object.entries(dataset.articles as Record<string, { aliases?: string[] }>)
      .flatMap(([id, article]) => (article.aliases ?? []).map((alias) => [id, alias] as const)))

  it('shares articles with the constellation catalog records of the same stars', () => {
    expect(Object.fromEntries(aliased.map(([, alias]) => [alias, starInfoForId(alias)?.introduction.label]))).toEqual({
      'hip-16537': 'Epsilon Eridani', 'hip-8102': 'Tau Ceti', 'hip-97649': 'Altair',
      'hip-91262': 'Vega', 'hip-37826': 'Pollux', 'hip-69673': 'Arcturus', 'hip-67927': 'Muphrid',
    })
    for (const [id, alias] of aliased) {
      expect(westernIds.has(alias), alias).toBe(true)
      expect(starComponentIdentity(alias), alias).toBeUndefined()
      expect(starInfoForId(alias), alias).toBe(starInfoForId(id))
    }
  })
})
