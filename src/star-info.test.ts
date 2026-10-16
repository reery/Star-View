import { describe, expect, it } from 'vitest'
import csv from './data/stars.csv?raw'
import nearest100Csv from './data/catalogs/nearest-100/stars.csv?raw'
import definitions from './data/star-info.json'
import nearest100Definitions from './data/nearest-100-info.json'
import { parseStarCatalog } from './catalog'
import { starInfoForId } from './star-info'
import { reviewedStarSystems } from './star-systems'

const stars = parseStarCatalog(csv)

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

describe('nearest-100 articles', () => {
  const nearest100 = parseStarCatalog(nearest100Csv)

  it('covers the Sun and all 100 catalog objects with 76 distinct sourced articles', () => {
    expect(nearest100).toHaveLength(101)
    const articles = nearest100.map(({ id }) => starInfoForId(id))
    expect(nearest100.filter((_, index) => !articles[index]).map(({ id }) => id)).toEqual([])
    expect(new Set(articles).size).toBe(76)
    for (const article of new Set(articles)) {
      expect(article!.introduction.source?.url).toMatch(/^https:\/\//)
      expect(article!.introduction.source?.title).toMatch(/reviewed 2026-10-(11|15)$/)
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

  it('adds 61 concise text-only articles without replacing the original articles', () => {
    const originalKeys = new Set(Object.keys(definitions.articles))
    const addedKeys = Object.keys(nearest100Definitions.articles)
    expect(addedKeys).toHaveLength(61)
    expect(addedKeys.some((key) => originalKeys.has(key))).toBe(false)
    for (const id of addedKeys) {
      const article = starInfoForId(id)!
      expect(article, id).toBeDefined()
      expect(article.image, id).toBeUndefined()
      expect(article.sections.some((section) => section.image), id).toBe(false)
      const words = [article.introduction.text, ...article.sections.flatMap((section) => section.paragraphs.map(({ text }) => text))]
        .join(' ').split(/\s+/).length
      expect(words, id).toBeLessThanOrEqual(150)
    }
  })
})
