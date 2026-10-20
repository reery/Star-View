import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseStarCatalog } from './catalog'
import { parseObjectIdentities, supplementObjectIdentities } from './designations'
import { parseObjectStats, supplementObjectStats } from './object-stats'
import { supplementStellarObservations } from './stellar-observations'
import { completeCatalogCompanions } from './stellar-companions'
import type { Star } from './catalog-model'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const archive = '../catalog-work/famous-cluster-stars/retired-catalog/'
const cluster = parseStarCatalog(read(`${archive}stars.csv`))
const western = parseStarCatalog(read('./data/catalogs/western-constellation-stars/stars.csv'))

describe('cluster catalog consolidation', () => {
  it('retains all 42 original landmarks, measurements and source notes in the constellation package', () => {
    expect(cluster.filter((star) => star.id !== 'sun')).toHaveLength(42)
    for (const star of cluster) {
      const { notes, ...measurements } = star
      const adopted = western.find((candidate) => candidate.id === star.id)
      expect(adopted, star.id).toMatchObject(measurements)
      expect(adopted!.notes, star.id).toContain(notes)
    }
    const previous = JSON.parse(read(`${archive}provenance.json`)).objects
    const current = JSON.parse(read('./data/catalogs/western-constellation-stars/provenance.json'))
    expect(current.clusterLandmarks.landmarkIds).toHaveLength(42)
    expect(current.clusterLandmarks.addedSourceIds).toHaveLength(35)
    for (const [id, source] of Object.entries(previous)) {
      expect(current.objects[id].clusterLandmark ?? current.objects[id], id).toEqual(source)
    }
  })

  it('ships all 62 effective cluster components with their complete physical, astrometric and retained source data', () => {
    const identities = parseObjectIdentities(JSON.parse(read('./data/object-designations.json')))
    const stats = parseObjectStats(JSON.parse(read('./data/object-stats.json')))
    const original = supplementStellarObservations(supplementObjectStats(supplementObjectIdentities(cluster, identities), stats))
    const expected = supplementObjectIdentities(completeCatalogCompanions(original), identities, { preserveAuthoredNames: true })
    const payload = JSON.parse(read('./data/generated/catalogs/western-constellation-stars.json'))
    const shipped = new Map<string, Star>(payload.stars.map((star: Star) => [star.id, {
      ...star, ...JSON.parse(read(`./data/generated/catalog-details/catalog-detail-${star.catalog_detail_key}.json`)),
    }]))
    expect(expected.filter((star) => star.id !== 'sun')).toHaveLength(62)
    for (const star of expected) {
      const { notes, catalog_sources, ...measurements } = star
      const adopted = shipped.get(star.id)!
      expect(adopted, star.id).toMatchObject(measurements)
      expect(adopted.notes, star.id).toContain(notes)
      for (const source of catalog_sources ?? []) {
        expect(adopted.catalog_sources, `${star.id}/${source.catalog_id}`).toContainEqual(source)
      }
    }
  })

  it('removes the separate application catalog, payload and filter', () => {
    expect(existsSync(new URL('./data/catalogs/famous-cluster-stars', import.meta.url))).toBe(false)
    expect(existsSync(new URL('./data/generated/catalogs/famous-cluster-stars.json', import.meta.url))).toBe(false)
    expect(read('../index.html')).not.toContain('show-famous-cluster-stars')
  })
})
