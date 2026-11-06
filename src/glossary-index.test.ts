import { describe, expect, it } from 'vitest'
import { OBJECT_TYPES } from './catalog-model'
import { GLOSSARY_GROUPS, GLOSSARY_TERMS, linkGlossaryTerms, loadGlossaryArticles, searchGlossary } from './glossary-index'

const ids = new Set(GLOSSARY_TERMS.map(({ id }) => id))
const titles = (query: string) => searchGlossary(query).map(({ title }) => title)

describe('glossary index', () => {
  it('gives every term a unique id and one article, and every article a term', async () => {
    expect(ids.size).toBe(GLOSSARY_TERMS.length)
    const loaded = await Promise.all(GLOSSARY_GROUPS.map(async (group) => [group, await loadGlossaryArticles(group)] as const))
    for (const { id, group } of GLOSSARY_TERMS) expect(loaded.find(([name]) => name === group)![1][id], id).toBeDefined()
    for (const [, articles] of loaded) for (const id of Object.keys(articles)) expect(ids.has(id), id).toBe(true)
  })

  it('links related terms only to terms that exist', async () => {
    for (const group of GLOSSARY_GROUPS) {
      for (const [id, article] of Object.entries(await loadGlossaryArticles(group))) {
        for (const related of article.related ?? []) expect(ids.has(related), `${id} → ${related}`).toBe(true)
        expect(article.related ?? []).not.toContain(id)
      }
    }
  })

  it('covers every object type and subtype label with a definition', () => {
    for (const type of OBJECT_TYPES) expect(ids.has(type), type).toBe(true)
    for (const { id, summary } of GLOSSARY_TERMS) expect(summary.length, id).toBeGreaterThan(20)
  })

  it('writes article text the way the writing guide asks', async () => {
    for (const group of GLOSSARY_GROUPS) {
      for (const [id, article] of Object.entries(await loadGlossaryArticles(group))) {
        const texts = [article.details, article.deeper, ...(article.sections ?? []).flatMap((section) => [section.title, section.text])].filter((text): text is string => Boolean(text))
        expect(texts.length, id).toBeGreaterThan(0)
        for (const text of texts) {
          expect(text, id).not.toMatch(/['"]/)
          expect(text, id).not.toMatch(/\brecently\b|in the sources reviewed|should be described as|for its class/i)
        }
      }
    }
  })
})

describe('searchGlossary', () => {
  it('ranks title matches above aliases and definitions', () => {
    expect(titles('parallax')[0]).toBe('Parallax')
    const light = titles('light')
    expect(light.indexOf('Lightyear')).toBeLessThan(light.indexOf('Reflection nebula'))
    const spin = titles('spin')
    expect(spin.indexOf('Spin-down power')).toBeLessThan(spin.indexOf('Rotation period'))
  })

  it('finds terms by alias and by words only their definition uses', () => {
    expect(titles('kiloparsec')).toEqual(['Parsec'])
    expect(titles('ultraviolet')).toContain('H II region')
  })

  it('needs every word, ignores case and treats hyphens as spaces', () => {
    expect(titles('MAIN sequence')[0]).toBe('Main-sequence')
    expect(titles('zzzz')).toEqual([])
    expect(titles('hydrogen zzzz')).toEqual([])
  })
})

describe('linkGlossaryTerms', () => {
  const link = (text: string, seen = new Set<string>()) => linkGlossaryTerms(text, seen)

  it('links the first mention of a term, preferring the longest name', () => {
    expect(link('A red giant, a red giant and a neutron star.')).toEqual([
      'A ', { id: 'subtype-red-giant', text: 'red giant' }, ', a red giant and a ', { id: 'neutron_star', text: 'neutron star' }, '.',
    ])
  })

  it('skips the article’s own term and common words, and handles plurals and whole words only', () => {
    expect(link('Parallax of a star near the Sun.', new Set(['parallax']))).toEqual(['Parallax of a star near the Sun.'])
    expect(link('Two pulsars.')).toEqual(['Two ', { id: 'pulsar', text: 'pulsars' }, '.'])
    expect(link('A novalike star.')).toEqual(['A novalike star.'])
  })

  it('recognises the hyphenated spelling of lightyear', () => {
    expect(link('3.26 light-years.')).toEqual(['3.26 ', { id: 'lightyear', text: 'light-years' }, '.'])
  })
})
