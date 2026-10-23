import { describe, expect, it } from 'vitest'
import { constellationCharts } from './data/constellations'
import data from './data/top-lists.json'

describe('top lists', () => {
  it('ranks entries by descending value with chartable constellations', () => {
    for (const list of data.lists) {
      const values = list.entries.map((entry) => entry.value)
      expect(values).toEqual([...values].sort((a, b) => b - a))
      for (const entry of list.entries) expect(constellationCharts.has(entry.constellation), entry.name).toBe(true)
    }
  })
})
