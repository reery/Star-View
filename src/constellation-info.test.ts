import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ConstellationChart } from './constellations'
import { constellationInfoAvailable } from './constellation-info'

const json = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T
const files = readdirSync(new URL('./data/constellation-info/', import.meta.url)).filter((file) => file.endsWith('.json'))
const catalogIds = new Set(readdirSync(new URL('./data/catalogs/', import.meta.url)).flatMap((catalog) =>
  readFileSync(new URL(`./data/catalogs/${catalog}/stars.csv`, import.meta.url), 'utf8').split('\n').slice(1).map((row) => row.split(',')[1])))
const overlayIds = new Set(readdirSync(new URL('./data/overlays/', import.meta.url)).flatMap((overlay) => {
  const path = `./data/overlays/${overlay}/objects.json`
  if (!existsSync(new URL(path, import.meta.url))) return []
  const data = json<{ id: string }[] | { objects: { id: string }[] }>(path)
  return (Array.isArray(data) ? data : data.objects).map((object) => object.id)
}))

describe('constellation Info articles', () => {
  it.each(files)('%s links only to existing stars, objects and schematics', (file) => {
    const article = json<{ name: string; introduction: string; sections: { paragraphs: string[]; image?: { file: string } }[] }>(`./data/constellation-info/${file}`)
    const chart = json<ConstellationChart>(`./data/constellations/${file}`)
    expect(article.name).toBe(chart.name)
    expect(constellationInfoAvailable(chart.name)).toBe(true)
    const text = [article.introduction, ...article.sections.flatMap((section) => section.paragraphs)].join(' ')
    const links = [...text.matchAll(/\[[^\]]+\]\((hip|id):([^)]+)\)/g)]
    expect(links.length).toBeGreaterThan(0)
    for (const [link, kind, reference] of links) {
      if (kind === 'hip') expect(chart.stars.some((star) => star.hip === Number(reference)), link).toBe(true)
      else expect(catalogIds.has(reference!) || overlayIds.has(reference!), link).toBe(true)
    }
    for (const { image } of article.sections) {
      if (image) expect(existsSync(new URL(`./assets/constellations/${image.file}.svg`, import.meta.url)), image.file).toBe(true)
    }
  })
})
