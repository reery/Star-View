import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseStarCatalog } from './catalog'
import { filterAndSortObjectDatabaseItems, objectDatabaseValue, objectSpectralClass, type ObjectDatabaseItem, type ObjectDatabaseState } from './object-database'

const sun = parseStarCatalog(readFileSync(new URL('./data/stars.csv', import.meta.url), 'utf8')).find((star) => star.id === 'sun')!
const state = (overrides: Partial<ObjectDatabaseState> = {}): ObjectDatabaseState => ({
  sort: 'distance', direction: 'ascending', distance: 'sun',
  filters: { type: null, subtype: null, spectral: null, motion: null, info: null }, ...overrides,
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

  it('sorts objects with Info articles before those without when descending', () => {
    const items = [item('Without'), { ...item('Sun'), star: sun }]
    expect(filterAndSortObjectDatabaseItems(items, state({ sort: 'info', direction: 'descending' })).map(({ star }) => star.name)).toEqual(['Sun', 'Without'])
    expect(objectDatabaseValue(items[0]!, 'info', 'sun')).toBe(0)
    const filters = { type: null, subtype: null, spectral: null, motion: null, info: new Set(['unavailable']) }
    expect(filterAndSortObjectDatabaseItems(items, state({ filters })).map(({ star }) => star.name)).toEqual(['Without'])
  })

  it('combines columns with AND and multiple values within each column with OR', () => {
    const items = [
      item('Cool dwarf', { type: 'star', spectral_type: 'M5.5V', subtypes: ['Main-sequence', 'Variable star'] }),
      item('Sun-like', { type: 'star', spectral_type: 'G2V', subtypes: ['Main-sequence'] }),
      item('Giant', { type: 'star', spectral_type: 'M2I', subtypes: ['Red supergiant'] }),
      item('White dwarf', { type: 'white_dwarf', spectral_type: 'DA2', subtypes: ['Variable star'] }),
    ]
    const filtered = filterAndSortObjectDatabaseItems(items, state({ filters: {
      type: new Set(['star', 'white_dwarf']), subtype: new Set(['Main-sequence', 'Variable star']), spectral: new Set(['G', 'M']), motion: null, info: null,
    } }))
    expect(filtered.map(({ star }) => star.name)).toEqual(['Cool dwarf', 'Sun-like'])
    expect(filterAndSortObjectDatabaseItems(items, state({ filters: { type: new Set(), subtype: null, spectral: null, motion: null, info: null } }))).toEqual([])
  })

  it('combines selected motion statuses and applies other column filters', () => {
    const items = [
      item('Full star', { type: 'star' }),
      item('Full dwarf', { type: 'white_dwarf' }),
      item('Unavailable', { type: 'star', vx_kms: null, vy_kms: null, vz_kms: null, raw_astrometry: null }),
    ]
    const filters = { type: new Set(['star']), subtype: null, spectral: null, motion: new Set(['Full space motion']), info: null }
    expect(filterAndSortObjectDatabaseItems(items, state({ filters })).map(({ star }) => star.name)).toEqual(['Full star'])
    filters.motion.add('unavailable')
    expect(filterAndSortObjectDatabaseItems(items, state({ filters })).map(({ star }) => star.name)).toEqual(['Full star', 'Unavailable'])
    filters.motion.clear()
    expect(filterAndSortObjectDatabaseItems(items, state({ filters }))).toEqual([])
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

  it('keeps scoped radial velocities separate from full component space motion', () => {
    const raw = {
      ra_deg: 0, dec_deg: 0, epoch: 2016, parallax_mas: 100, parallax_error_mas: null,
      pm_ra_cosdec_masyr: 10, pm_ra_error_masyr: null, pm_dec_masyr: 20, pm_dec_error_masyr: null,
      radial_velocity_kms: null, radial_velocity_error_kms: null, astrometry_ref: 'Component astrometry', radial_velocity_ref: null,
    }
    const transverse = item('Component', { vx_kms: null, vy_kms: null, vz_kms: null, raw_astrometry: raw })
    expect(objectDatabaseValue(transverse, 'motion', 'sun')).toBe('Transverse only; radial velocity unavailable')
    const systemRecord = { ...transverse.star, raw_astrometry: { ...raw, radial_velocity_kms: 12 } }
    transverse.star.catalog_sources = [{ catalog_id: 'system', scope: 'Unresolved system', record: systemRecord }]
    expect(objectDatabaseValue(transverse, 'motion', 'sun')).toBe('Transverse component motion')
    transverse.star.radial_velocity_observation = {
      value_kms: 14, error_kms: 1, uncertainty_kind: '1 sigma', observed_from: '2020', observed_to: '2020',
      reference: 'Component observation', source_url: '', scope: 'Includes orbital motion at a different epoch',
    }
    expect(objectDatabaseValue(transverse, 'motion', 'sun')).toBe('Transverse only')
    expect(objectDatabaseValue(item('Full', { raw_astrometry: systemRecord.raw_astrometry }), 'motion', 'sun')).toBe('Full space motion')
    expect(objectDatabaseValue(item('System', { raw_astrometry: {
      ...systemRecord.raw_astrometry, radial_velocity_ref: 'Review; shared systemic velocity approximation',
    } }), 'motion', 'sun')).toBe('System bulk motion')
    const unavailable = item('Unavailable', { vx_kms: null, vy_kms: null, vz_kms: null, raw_astrometry: null })
    expect(objectDatabaseValue(unavailable, 'motion', 'sun')).toBeNull()
    for (const direction of ['ascending', 'descending'] as const) {
      expect(filterAndSortObjectDatabaseItems([unavailable, transverse], state({ sort: 'motion', direction })).at(-1)).toBe(unavailable)
    }
  })
})
