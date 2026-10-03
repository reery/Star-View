import { describe, expect, it } from 'vitest'
import { normalizeObjectSearch, sortObjectListItemsByDistance, virtualRange } from './object-list'

describe('virtual object list', () => {
  it('normalizes names and identifiers for search', () => {
    expect(normalizeObjectSearch('  Proxima-Centauri  ')).toBe('proxima centauri')
    expect(normalizeObjectSearch('Gliese  229 A')).toBe('gliese 229 a')
  })

  it('returns an overscanned bounded row range', () => {
    expect(virtualRange(0, 320, 1001)).toEqual({ start: 0, end: 13 })
    expect(virtualRange(4800, 320, 1001)).toEqual({ start: 129, end: 147 })
    expect(virtualRange(36000, 320, 1001)).toEqual({ start: 996, end: 1001 })
  })

  it('orders mixed catalog objects from nearest to farthest', () => {
    const objects = [
      { id: 'pulsar-far', distancePc: 860 },
      { id: 'nearby-star', distancePc: 2.64 },
      { id: 'pulsar-near', distancePc: 210 },
    ]

    expect(sortObjectListItemsByDistance(objects).map(({ id }) => id)).toEqual([
      'nearby-star',
      'pulsar-near',
      'pulsar-far',
    ])
    expect(objects.map(({ id }) => id)).toEqual(['pulsar-far', 'nearby-star', 'pulsar-near'])
  })
})
