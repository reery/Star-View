import { describe, expect, it } from 'vitest'
import csv from './data/stars.csv?raw'
import { parseStarCatalog } from './catalog'
import { starInfoForId } from './star-info'

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
    expect(starInfoForId('tau-ceti')).toBeUndefined()
    expect(starInfoForId('unknown')).toBeUndefined()
  })
})
