import { describe, expect, it } from 'vitest'
import { constellationCharts } from './data/constellations'
import data from './data/top-lists.json'
import planets from './data/nearby-planets.json'

type Entry = { name: string; value?: number; fields?: string[]; distance_pc: number; constellation: string; object: { id: string; planet?: string } | null }
type Group = { title: string; metric?: string; ascending?: boolean; entries: Entry[] }
type List = { title: string; metric?: string; ascending?: boolean; columns?: string[]; entries?: Entry[]; groups?: Group[] }
const lists = data.lists as List[]
const sorted = (values: number[], ascending = false) => [...values].sort((a, b) => ascending ? a - b : b - a)

describe('top lists', () => {
  it('ranks entries by value with chartable constellations', () => {
    for (const list of lists) {
      for (const entry of list.entries ?? list.groups!.flatMap((group) => group.entries)) expect(constellationCharts.has(entry.constellation), entry.name).toBe(true)
      if (!list.metric) continue
      const values = list.entries!.map((entry) => entry.value ?? NaN)
      expect(values, list.title).toEqual(sorted(values, list.ascending))
    }
  })

  it('orders descriptive lists by distance with one field per column', () => {
    for (const list of lists) {
      if (!list.columns) continue
      const distances = list.entries!.map((entry) => entry.distance_pc)
      if (!list.metric) expect(distances).toEqual(sorted(distances, true))
      for (const entry of list.entries!) expect(entry.fields?.length, entry.name).toBe(list.columns.length)
    }
  })

  it('ranks each group by its metric, else by distance, with every entry selectable', () => {
    for (const group of lists.flatMap((list) => list.groups ?? [])) {
      const values = group.entries.map((entry) => group.metric ? entry.value! : entry.distance_pc)
      expect(group.entries.length, group.title).toBeGreaterThan(0)
      expect(values, group.title).toEqual(sorted(values, group.metric ? group.ascending : true))
      expect(group.entries.every((entry) => entry.object), group.title).toBe(true)
    }
  })

  it('opens each listed planet from its own host', () => {
    const hosts = new Map(planets.planets.map((planet) => [planet.id, planet.hostStarId]))
    const aliases: Record<string, string> = planets.aliases
    for (const entry of lists.flatMap((list) => list.groups ?? []).flatMap((group) => group.entries).filter((entry) => entry.object?.planet)) {
      const host = hosts.get(entry.object!.planet!)
      expect(host, entry.name).toBeDefined()
      expect([host, aliases[host!]], entry.name).toContain(entry.object!.id)
    }
  })
})
