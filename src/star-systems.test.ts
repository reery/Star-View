import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseStarCatalog, type Star } from './catalog'
import { completeCatalogCompanions } from './stellar-companions'
import { mapComponentVisibility, MIN_MAP_COMPONENT_SEPARATION_AU } from './star-systems'
import { catalogSourceUrl } from './test-support/catalog-source'

const base = parseStarCatalog(readFileSync(new URL('./data/stars.csv', import.meta.url), 'utf8'))[0]!
const auPerPc = 206264.80624709636
function component(label: string, au: number, fields: Partial<Star> = {}): Star {
  return { ...base, id: `test-${label}`, name: `Test ${label}`, x_pc: 10, y_pc: au / auPerPc, z_pc: 0,
    absolute_mag: null, luminosity_solar: null, ...fields }
}
function visibleIds(stars: Star[]): string[] {
  const visible = mapComponentVisibility(stars)
  return stars.filter((_, index) => visible[index]).map((star) => star.id)
}

describe('close system map representatives', () => {
  it('uses visual brightness before bolometric luminosity and keeps the input intact', () => {
    const stars = [component('A', 0, { absolute_mag: 6, luminosity_solar: 2 }),
      component('B', 30, { absolute_mag: 4, luminosity_solar: 1 })]
    const before = structuredClone(stars)
    expect(visibleIds(stars)).toEqual(['test-B'])
    expect(stars).toEqual(before)
  })

  it('temporarily draws the selected companion alongside the brightest', () => {
    const stars = [component('A', 0, { absolute_mag: 4 }), component('B', 20, { absolute_mag: 8 }),
      component('C', 4000, { absolute_mag: 10 })]
    expect([...mapComponentVisibility(stars)]).toEqual([1, 0, 1])
    expect([...mapComponentVisibility(stars, 'test-B')]).toEqual([1, 1, 1])
    expect([...mapComponentVisibility(stars, 'test-C')]).toEqual([1, 0, 1])
    expect([...mapComponentVisibility(stars, null)]).toEqual([1, 0, 1])
  })

  it('falls back to luminosity, then A even when catalog order is reversed', () => {
    const a = component('A', 0), b = component('B', 20)
    expect(visibleIds([b, a])).toEqual(['test-A'])
    expect(visibleIds([{ ...b, luminosity_solar: .2 }, { ...a, luminosity_solar: .1 }])).toEqual(['test-B'])
  })

  it('collapses close hierarchies while preserving a separate wide subgroup', () => {
    expect(visibleIds([component('Aa', 0), component('Ab', 20), component('Ba', 4000), component('Bb', 4020)]))
      .toEqual(['test-Aa', 'test-Ba'])
    expect(visibleIds([component('A', 0), component('B', 400), component('C', 800)]))
      .toEqual(['test-A'])
  })

  it('applies the display threshold and never groups unrelated nearby stars', () => {
    expect(visibleIds([component('A', 0), component('B', MIN_MAP_COMPONENT_SEPARATION_AU - 1)])).toHaveLength(1)
    expect(visibleIds([component('A', 0), component('B', MIN_MAP_COMPONENT_SEPARATION_AU + 1)])).toHaveLength(2)
    expect(visibleIds([component('A', 0), component('B', 0, { name: 'Unrelated B' })])).toHaveLength(2)
  })

  it.each(['nearest-100', 'nearest-1000', 'bright-stars', 'western-constellation-stars'])(
    'preserves one representative for close companions in %s', (catalog) => {
      const stars = completeCatalogCompanions(parseStarCatalog(readFileSync(catalogSourceUrl(catalog), 'utf8')))
      const shown = new Set(visibleIds(stars))
      for (const [id, expected] of [
        ['sirius-a', true], ['sirius-b', false], ['alpha-centauri-a', true], ['alpha-centauri-b', false],
        ['proxima-centauri', true], ['10pc-0087', true], ['10pc-0088', false], ['10pc-0089', false],
        ['cns5-5665', true], ['cns5-5660', true], ['cns5-5623', true],
      ] as const) {
        if (stars.some((star) => star.id === id)) expect(shown.has(id), id).toBe(expected)
      }
    })
})
