import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseStarCatalog } from './catalog'
import { filterAndSortObjectDatabaseItems, objectDatabaseValue, objectSpectralClass, type ObjectDatabaseItem, type ObjectDatabaseState } from './object-database'

const sun = parseStarCatalog(readFileSync(new URL('./data/stars.csv', import.meta.url), 'utf8')).find((star) => star.id === 'sun')!
const state = (overrides: Partial<ObjectDatabaseState> = {}): ObjectDatabaseState => ({
  sort: 'distance', direction: 'ascending', distance: 'sun',
  filters: { type: null, subtype: null, spectral: null }, ...overrides,
})
const item = (name: string, fields: Partial<ObjectDatabaseItem['star']> = {}, distances = [1, 1]): ObjectDatabaseItem => ({
  star: { ...sun, name, id: name, ...fields }, sunDistancePc: distances[0]!, distancePc: distances[1]!, color: '#ffffff',
})

describe('Objects database', () => {
  it('sorts actual numbers and keeps unknown measurements last in either direction', () => {
    const items = [item('Unknown', { mass_solar: null }), item('Heavy', { mass_solar: 10 }), item('Light', { mass_solar: 0.04 }), item('Invalid', { mass_solar: NaN })]
    expect(filterAndSortObjectDatabaseItems(items, state({ sort: 'mass' })).map(({ star }) => star.name)).toEqual(['Light', 'Heavy', 'Invalid', 'Unknown'])
    expect(filterAndSortObjectDatabaseItems(items, state({ sort: 'mass', direction: 'descending' })).map(({ star }) => star.name)).toEqual(['Heavy', 'Light', 'Invalid', 'Unknown'])
    expect(items[0]?.star.name).toBe('Unknown')
  })

  it('distinguishes a reviewed zero planet count from unavailable host coverage', () => {
    const items = [item('Unknown', { known_planets: null }), item('Companion', { known_planets: 0 }), item('Host', { known_planets: 3 })]
    expect(filterAndSortObjectDatabaseItems(items, state({ sort: 'planets', direction: 'descending' })).map(({ star }) => star.name)).toEqual(['Host', 'Companion', 'Unknown'])
    expect(objectDatabaseValue(items[1]!, 'planets', 'sun')).toBe(0)
  })

  it('combines columns with AND and multiple values within each column with OR', () => {
    const items = [
      item('Cool dwarf', { type: 'star', spectral_type: 'M5.5V', subtypes: ['Main-sequence', 'Variable star'] }),
      item('Sun-like', { type: 'star', spectral_type: 'G2V', subtypes: ['Main-sequence'] }),
      item('Giant', { type: 'star', spectral_type: 'M2I', subtypes: ['Red supergiant'] }),
      item('White dwarf', { type: 'white_dwarf', spectral_type: 'DA2', subtypes: ['Variable star'] }),
    ]
    const filtered = filterAndSortObjectDatabaseItems(items, state({ filters: {
      type: new Set(['star', 'white_dwarf']), subtype: new Set(['Main-sequence', 'Variable star']), spectral: new Set(['G', 'M']),
    } }))
    expect(filtered.map(({ star }) => star.name)).toEqual(['Cool dwarf', 'Sun-like'])
    expect(filterAndSortObjectDatabaseItems(items, state({ filters: { type: new Set(), subtype: null, spectral: null } }))).toEqual([])
  })

  it('filters the leading spectral class without treating white or brown dwarfs as main classes', () => {
    expect(objectSpectralClass({ spectral_type: 'M5.5Ve' })).toBe('M')
    expect(objectSpectralClass({ spectral_type: 'sdM1' })).toBe('M')
    expect(objectSpectralClass({ spectral_type: 'esdK7' })).toBe('K')
    expect(objectSpectralClass({ spectral_type: 'DA2' })).toBe('other')
    expect(objectSpectralClass({ spectral_type: 'T8' })).toBe('other')
    expect(objectSpectralClass({ spectral_type: null })).toBe('unavailable')
  })

  it('changes displayed-distance sorting when switching from Sun to origin', () => {
    const items = [item('Sun', {}, [0, 4]), item('Origin', {}, [4, 0]), item('Third', {}, [3, 2])]
    expect(filterAndSortObjectDatabaseItems(items, state()).map(({ star }) => star.name)).toEqual(['Sun', 'Third', 'Origin'])
    expect(filterAndSortObjectDatabaseItems(items, state({ distance: 'origin' })).map(({ star }) => star.name)).toEqual(['Origin', 'Third', 'Sun'])
  })

  it('keeps catalog photometry and age independent of the distance reference', () => {
    const measured = item('Measured', { absolute_mag: 4.83, apparent_mag: -26.74, age_gyr: null }, [1, 10])
    expect(objectDatabaseValue(measured, 'apparent', 'origin')).toBe(-26.74)
    expect(objectDatabaseValue(measured, 'absolute', 'origin')).toBe(4.83)
    expect(objectDatabaseValue(measured, 'age', 'origin')).toBeNull()
  })
})
