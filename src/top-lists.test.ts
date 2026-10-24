import { describe, expect, it } from 'vitest'
import { constellationCharts } from './data/constellations'
import data from './data/top-lists.json'

describe('top lists', () => {
  it('ranks entries by descending value with chartable constellations', () => {
    for (const list of data.lists) {
      for (const entry of list.entries) expect(constellationCharts.has(entry.constellation), entry.name).toBe(true)
      if (!('metric' in list)) continue
      const values = list.entries.map((entry) => 'value' in entry ? entry.value : NaN)
      expect(values).toEqual([...values].sort((a, b) => b - a))
    }
  })

  it('orders descriptive lists by distance with one field per column', () => {
    for (const list of data.lists) {
      if (!('columns' in list) || !list.columns) continue
      const distances = list.entries.map((entry) => entry.distance_pc)
      expect(distances).toEqual([...distances].sort((a, b) => a - b))
      for (const entry of list.entries) expect('fields' in entry && entry.fields.length, entry.name).toBe(list.columns.length)
    }
  })
})
