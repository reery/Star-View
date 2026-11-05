import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { generatedJsonFetch } from './test-support/generated-json'
import type { Star } from './catalog-model'
import { DEFAULT_CATALOG_MANIFEST } from './catalog-manifest'
import { parseCatalogPayload, mergeCatalogStars } from './catalog-runtime'
import { splitCatalogDetails } from './catalog-detail-model'
import { spaceMotionForStar } from './space-motion'
import { displayMotionForStar } from './astronomy'
import { uniqueDesignations } from './designations'

function mapStars(): Star[] {
  return parseCatalogPayload(JSON.parse(readFileSync(new URL('./data/generated/catalogs/nearest-neighbors.json', import.meta.url), 'utf8')), DEFAULT_CATALOG_MANIFEST)
}

beforeEach(() => { vi.resetModules(); vi.restoreAllMocks(); vi.stubGlobal('fetch', generatedJsonFetch) })
afterEach(() => vi.unstubAllGlobals())

const records = (catalog: string): Record<string, Star> => Object.fromEntries((JSON.parse(readFileSync(new URL(`./data/generated/catalog-records/${catalog}.json`, import.meta.url), 'utf8')) as { stars: Star[] }).stars.map((star) => [star.id, { ...star, notes: '' }]))

it('loads designations and astrometry on selection, keeping on the map what the map reads', async () => {
  const { loadStarDetails } = await import('./selected-star-details')
  const expected = records('nearest-neighbors')
  const stars = mapStars()
  expect(stars.every((star) => star.designations === undefined)).toBe(true)
  const deferred = stars.find((star) => star.sky_position)!
  const record = expected[deferred.id]!
  expect(deferred.raw_astrometry).toBeNull()
  expect(deferred.sky_position).toEqual({ ra_deg: record.raw_astrometry!.ra_deg, dec_deg: record.raw_astrometry!.dec_deg })
  expect(stars.find((star) => star.id === 'sirius-a')!.hip_numbers).toEqual([32349])
  for (const star of stars) {
    const needsAstrometry = displayMotionForStar({ ...star, raw_astrometry: null }) === null && expected[star.id]!.raw_astrometry !== null
    if (needsAstrometry) expect(star.raw_astrometry).toEqual(expected[star.id]!.raw_astrometry)
    expect(displayMotionForStar(star)).toEqual(displayMotionForStar(expected[star.id]!))
    expect(spaceMotionForStar(star)).toEqual(spaceMotionForStar(expected[star.id]!))
    await loadStarDetails(star)
    expect(star.raw_astrometry).toEqual(expected[star.id]!.raw_astrometry)
    expect(star.designations).toEqual(expected[star.id]!.designations)
  }
})

it('restores merged designations in merge order across deferred rows, and leaves the map payload untouched', async () => {
  const { loadStarDetails, starDetailsLoaded } = await import('./selected-star-details')
  const [first, second] = mapStars().filter((star) => star.hip_numbers?.length && star.sky_position)
  const other = { ...second!, id: 'other-catalog-id', name: 'Other catalog name' }
  const full = records('nearest-neighbors')
  const merged = mergeCatalogStars([first!], [{ ...other, sky_position: first!.sky_position }])[0]!
  expect(merged.designations).toBeUndefined()
  expect(merged.hip_numbers).toEqual(expect.arrayContaining([...first!.hip_numbers!, ...other.hip_numbers!]))
  expect(first!.catalog_designation_parts).toBeUndefined()
  const scene = { ...merged }
  expect(starDetailsLoaded(scene)).toBe(false)
  await loadStarDetails(scene)
  expect(scene.designations).toEqual(uniqueDesignations([...full[first!.id]!.designations!, 'Other catalog name', ...full[second!.id]!.designations!], first!.name))
  expect(merged.designations).toBeUndefined()
})

it('searches names at once and designations once their catalog has loaded, retrying a failed load', async () => {
  const fetcher = vi.fn(generatedJsonFetch).mockResolvedValueOnce(new Response('', { status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  const { designationsAvailable, loadCatalogDesignations } = await import('./catalog-designations')
  const { objectSearchText, normalizeObjectSearch } = await import('./object-list')
  const sirius = mapStars().find((star) => star.id === 'sirius-a')!
  const alias = normalizeObjectSearch('HD 48915')
  expect(designationsAvailable(sirius)).toBe(false)
  expect(objectSearchText(sirius)).toContain('sirius')
  expect(objectSearchText(sirius)).not.toContain(alias)
  await expect(loadCatalogDesignations('nearest-neighbors')).rejects.toThrow('503')
  await loadCatalogDesignations('nearest-neighbors')
  expect(designationsAvailable(sirius)).toBe(true)
  expect(objectSearchText(sirius)).toContain(alias)
})

it('keeps notes and complete retained sources out of map files and restores the exact selected record', async () => {
  const payload = JSON.parse(readFileSync(new URL('./data/generated/catalogs/nearest-neighbors.json', import.meta.url), 'utf8'))
  for (const star of payload.stars) {
    expect(star).not.toHaveProperty('notes')
    expect(star).not.toHaveProperty('catalog_sources')
  }
  const invalid = structuredClone(payload)
  delete invalid.stars[0].catalog_detail_key
  expect(() => parseCatalogPayload(invalid, DEFAULT_CATALOG_MANIFEST)).toThrow('Invalid deferred catalog details')
  const stars = mapStars(), star = stars.find((star) => star.id === 'ez-aquarii-a')!
  const { loadStarDetails, starDetailsLoaded } = await import('./selected-star-details')
  const motion = spaceMotionForStar(star)
  const untouched = structuredClone(stars[0])
  const expected = JSON.parse(readFileSync(new URL(`./data/generated/catalog-details/catalog-detail-${star.catalog_detail_key}.json`, import.meta.url), 'utf8'))
  const first = loadStarDetails(star)
  expect(loadStarDetails(star)).toBe(first)
  await first
  expect(star.notes).toBe(expected.notes)
  expect(star.catalog_sources).toEqual(expected.catalog_sources)
  expect(starDetailsLoaded(star)).toBe(true)
  expect(spaceMotionForStar(star)).toEqual(motion)
  expect(stars[0]).toEqual(untouched)
})

it('preserves withheld fields and barycenter identity before notes are loaded', () => {
  const template = mapStars().find((star) => star.id === 'ez-aquarii-a')!
  const merged = mergeCatalogStars([template], [{ ...template, radius_solar: 3, temperature_k: 6000 }])[0]!
  expect(merged.radius_solar).toBeNull()
  expect(merged.temperature_k).toBeNull()
  const primary = { ...template, id: 'primary', catalog_flags: undefined, notes: 'Reviewed barycenter solution.', raw_astrometry: null }
  const additional = { ...primary, id: 'additional', name: 'Other identifier', notes: '' }
  const a = splitCatalogDetails(primary, 'one').mapStar
  const b = splitCatalogDetails(additional, 'two').mapStar
  expect(mergeCatalogStars([{ ...a, notes: '' }], [{ ...b, notes: '' }])).toHaveLength(1)
})

it('matches sky duplicates across declination bands, in row order, and through barycenter rows', () => {
  const template = mapStars().find((star) => star.id === 'sirius-a')!
  const row = (id: string, dec_deg: number, extra: Partial<Star> = {}): Star => ({ ...template, id, name: id, designations: [], catalog_flags: {}, raw_astrometry: { ...template.raw_astrometry!, ra_deg: 10, dec_deg }, ...extra })
  // Bands are 4 arcseconds wide, so 0.01 degrees is a band edge; these rows are 0.72 arcseconds apart.
  expect(mergeCatalogStars([row('below', 0.0099)], [row('above', 0.0101)])).toHaveLength(1)
  expect(mergeCatalogStars([row('far', 0.0099)], [row('apart', 0.0109)])).toHaveLength(2)

  const [first] = mergeCatalogStars([row('upper', 0.0101), row('lower', 0.0099)], [row('between', 0.01)])
  expect(first!.designations).toContain('between')

  const direction = { x_pc: 1, y_pc: 2, z_pc: 3 }
  const barycenter = row('barycenter', 40, { ...direction, catalog_flags: { barycenter: true } })
  const component = row('component', -20, direction)
  expect(mergeCatalogStars([barycenter], [component])).toHaveLength(1)
  expect(mergeCatalogStars([component], [barycenter])).toHaveLength(1)
  expect(mergeCatalogStars([component], [row('other', -20, { ...direction, raw_astrometry: null })])).toHaveLength(2)
})

it('preserves supplemental notes for both deferred catalogs and already loaded chart records', async () => {
  const { loadStarDetails } = await import('./selected-star-details')
  for (const inline of [false, true]) {
    const primary = mapStars().find((star) => star.id === 'sirius-a')!
    primary.radius_solar = null
    const additional = { ...primary, radius_solar: 2 }
    if (inline) {
      await loadStarDetails(additional)
      delete additional.catalog_detail_key
    }
    const merged = mergeCatalogStars([primary], [additional])[0]!
    await loadStarDetails(primary)
    await loadStarDetails(additional)
    await loadStarDetails(merged)
    expect(merged.radius_solar).toBe(2)
    expect(merged.notes).toBe(`${primary.notes} Additional catalog supplements radius_solar. ${additional.notes}`.trim())
  }
})

it('loads and caches only the requested article and shares it with exact component aliases', async () => {
  const fetcher = vi.fn(generatedJsonFetch).mockResolvedValueOnce(new Response('', { status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  const { loadStarInfo, starInfoForId } = await import('./star-info')
  expect(starInfoForId('sirius-a')).toBeUndefined()
  await expect(loadStarInfo('sirius-a')).rejects.toThrow('503')
  const first = loadStarInfo('sirius-a')
  expect(loadStarInfo('sirius-b')).toBe(first)
  await first
  expect(starInfoForId('sirius-a')?.introduction.label).toBe('Sirius')
  expect(starInfoForId('hip-32349')).toBe(starInfoForId('sirius-a'))
  expect(starInfoForId('alpha-centauri-a')).toBeUndefined()
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('loads one planet host, shares concurrent requests, and retries a failed load', async () => {
  const registry = await import('./planetary-system-data')
  const load = vi.spyOn(registry, 'loadPlanetarySystemData').mockRejectedValueOnce(new Error('Temporary failure'))
  const { loadPlanetarySystem, planetarySystemForStar, extrasolarPlanetForId } = await import('./planetary-systems')
  await expect(loadPlanetarySystem('proxima-centauri')).rejects.toThrow('Temporary failure')
  const first = loadPlanetarySystem('proxima-centauri')
  expect(loadPlanetarySystem('proxima-centauri')).toBe(first)
  await first
  expect(load).toHaveBeenCalledTimes(2)
  expect(planetarySystemForStar('proxima-centauri')?.planets.length).toBeGreaterThan(0)
  expect(extrasolarPlanetForId('exo-proxima-cen-b')?.hostStarId).toBe('proxima-centauri')
  expect(planetarySystemForStar('sun')).toBeUndefined()
  await loadPlanetarySystem('unknown')
  expect(load).toHaveBeenCalledTimes(2)
})

it('loads one stellar system, shares concurrent requests, and retries a failed load', async () => {
  const registry = await import('./stellar-orbit-data')
  const load = vi.spyOn(registry, 'loadStellarOrbitData').mockRejectedValueOnce(new Error('Temporary failure'))
  const { loadStellarOrbits, stellarOrbitsForSystem } = await import('./stellar-orbits')
  const { indexStarSystems } = await import('./star-systems')
  const systems = indexStarSystems(mapStars())
  await expect(loadStellarOrbits('sirius')).rejects.toThrow('Temporary failure')
  const first = loadStellarOrbits('sirius')
  expect(loadStellarOrbits('sirius')).toBe(first)
  await first
  expect(load).toHaveBeenCalledTimes(2)
  expect(stellarOrbitsForSystem(systems.get('sirius-a')!).length).toBeGreaterThan(0)
  expect(stellarOrbitsForSystem(systems.get('alpha-centauri-a')!)).toEqual([])
})
