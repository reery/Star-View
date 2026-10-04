import { describe, expect, it } from 'vitest'
import {
  availableFilterKeys, categoryAvailable, DEFAULT_FILTER_CATEGORIES, DEFAULT_FILTER_SUBTYPES, effectiveFilterKeys,
  FILTER_CATEGORIES, FILTER_KEYS, filterCategoryForKey, filterKeyForObject, filterSummary,
} from './object-filter'

describe('object filter taxonomy', () => {
  it('lists the requested categories and subtypes in order', () => {
    expect(FILTER_CATEGORIES.map((category) => category.label)).toEqual([
      'Compact objects', 'Stellar systems', 'Interstellar medium', 'Stellar remnants', 'Large-scale structures',
    ])
    expect(FILTER_CATEGORIES.map((category) => category.subtypes.map((subtype) => subtype.label))).toEqual([
      ['Sun', 'Stars', 'Brown dwarfs', 'White dwarfs', 'Neutron stars', 'Pulsars', 'Black holes'],
      ['Binaries', 'Multiple systems'],
      ['Molecular clouds', 'Dark nebulae', 'Reflection nebulae', 'H II regions'],
      ['Planetary nebulae', 'Supernova remnants', 'Pulsar-wind nebulae'],
      ['Bubbles', 'Superbubbles', 'Dust sheets'],
    ])
    expect(new Set(FILTER_KEYS).size).toBe(FILTER_KEYS.length)
  })

  it('maps catalog objects to filter keys', () => {
    expect(filterKeyForObject({ id: 'sun', type: 'star' })).toBe('sun')
    expect(filterKeyForObject({ id: 'sirius-a', type: 'star' })).toBe('star')
    expect(filterKeyForObject({ id: 'wise-0855-0714', type: 'sub_brown_dwarf' })).toBe('brown_dwarf')
    expect(filterKeyForObject({ id: 'gaia-bh1', type: 'black_hole' })).toBe('black_hole')
    expect(filterKeyForObject({ id: 'orion-nebula', type: 'hii_region' })).toBe('hii_region')
    expect(filterKeyForObject({ id: 'local-bubble', type: 'bubble' })).toBe('bubble')
    expect(filterCategoryForKey('hii_region')).toBe('interstellar_medium')
    expect(filterCategoryForKey('bubble')).toBe('large_scale_structures')
    expect(filterCategoryForKey('sun')).toBe('compact_objects')
  })

  it('derives availability from bundled catalogs and positive overlay counts', () => {
    const available = availableFilterKeys({ pulsar: 266, neutron_star: 0, black_hole: 2 }, { reflection_nebula: 1, hii_region: 1 })
    expect([...available].sort()).toEqual(['black_hole', 'brown_dwarf', 'hii_region', 'pulsar', 'reflection_nebula', 'star', 'sun', 'white_dwarf'])
    expect(categoryAvailable('interstellar_medium', available)).toBe(true)
    expect(categoryAvailable('stellar_systems', available)).toBe(false)
    expect(categoryAvailable('large_scale_structures', available)).toBe(false)
  })

  it('requires an enabled category, a checked subtype and data', () => {
    const available = availableFilterKeys({ pulsar: 1, neutron_star: 1, black_hole: 1 }, { reflection_nebula: 1, hii_region: 1 })
    const categories = new Set(DEFAULT_FILTER_CATEGORIES)
    const subtypes = new Set(DEFAULT_FILTER_SUBTYPES)
    expect([...effectiveFilterKeys(categories, subtypes, available)]).toEqual(['sun', 'star', 'brown_dwarf', 'white_dwarf'])
    categories.add('interstellar_medium')
    subtypes.add('dark_nebula')
    expect([...effectiveFilterKeys(categories, subtypes, available)]).toEqual(['sun', 'star', 'brown_dwarf', 'white_dwarf', 'reflection_nebula', 'hii_region'])
    categories.delete('compact_objects')
    expect([...effectiveFilterKeys(categories, subtypes, available)]).toEqual(['reflection_nebula', 'hii_region'])
  })

  it('summarizes effective selections against available types', () => {
    const available = availableFilterKeys({ pulsar: 1, neutron_star: 1, black_hole: 1 }, { reflection_nebula: 1, hii_region: 1 })
    expect(filterSummary(new Set(['sun', 'star', 'brown_dwarf', 'white_dwarf']), available)).toBe('4 of 9')
    expect(filterSummary(available, available)).toBe('All')
  })
})
