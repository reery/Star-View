import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseStarCatalog } from './catalog'
import { parseObjectIdentities, supplementObjectIdentities } from './designations'
import { parseObjectStats, supplementObjectStats } from './object-stats'
import { supplementStellarObservations } from './stellar-observations'
import { completeCatalogCompanions } from './stellar-companions'
import { mergeCatalogStars, parseCatalogPayload } from './catalog-runtime'
import { DEFAULT_CATALOG_MANIFEST } from './catalog-manifest'
import { displayMotionForStar } from './astronomy'
import { magnitudeCardAvailable } from './magnitude-card'
import { massProperties } from './mass-properties'
import { missingCatalogMeasurements } from './catalog-source'

const identities = parseObjectIdentities(JSON.parse(readFileSync(new URL('./data/object-designations.json', import.meta.url), 'utf8')))
const stats = parseObjectStats(JSON.parse(readFileSync(new URL('./data/object-stats.json', import.meta.url), 'utf8')))
const catalogs = ['stars.csv', 'catalogs/nearest-100/stars.csv', 'catalogs/nearest-1000/stars.csv'].map((path) => {
  const parsed = parseStarCatalog(readFileSync(new URL(`./data/${path}`, import.meta.url), 'utf8'))
  return { path, stars: supplementObjectStats(supplementObjectIdentities(parsed, identities), stats) }
})

describe('scoped WISE 0855-0714 observations', () => {
  it.each(catalogs)('adds the same sourced range and W2 photometry in $path without adopting them as V, scalar mass or RV', ({ stars }) => {
    const before = stars.find((star) => star.id === 'wise-0855-0714')!
    const completed = completeCatalogCompanions(supplementStellarObservations(stars))
    const wise = completed.find((star) => star.id === before.id)!
    expect(wise.stellar_observations?.mass_range).toMatchObject({
      min_jupiter: 3, max_jupiter: 10, status: 'model-derived',
      assumed_age_min_gyr: 1, assumed_age_max_gyr: 10,
      source_url: 'https://arxiv.org/pdf/1404.6501',
    })
    expect(wise.stellar_observations?.infrared_photometry).toMatchObject({
      instrument: 'WISE', band: 'W2', wavelength_microns: 4.6, system: 'Vega',
      magnitude: 13.89, error_mag: 0.05, observed_on: ['2010-05-04', '2010-11-11'],
    })
    expect(wise.stellar_observations?.infrared_photometry?.scope).toContain('subtracting the two stationary background sources')
    expect(wise.stellar_observations?.radial_velocity_review).toMatchObject({ status: 'withheld' })
    expect(wise).toMatchObject({ mass_solar: null, age_gyr: null, absolute_mag: null, apparent_mag: null,
      vx_kms: null, vy_kms: null, vz_kms: null })
    expect(wise.raw_astrometry).toEqual(before.raw_astrometry)
    expect(wise.radial_velocity_observation).toBeUndefined()
    expect(magnitudeCardAvailable(wise)).toBe(false)
    expect(massProperties(wise)).toMatchObject({ mass: null, gravity: null, kilograms: null })
    for (const frame of ['solar', 'galactic'] as const) expect(displayMotionForStar(wise, frame)?.mode).toBe('transverse')
    expect(missingCatalogMeasurements(before, wise)).toEqual([])
    expect(completed).toHaveLength(completeCatalogCompanions(stars).length)
    const reviewedIds = new Set([wise.id, '10pc-0068', '10pc-0084'])
    expect(completed.filter((star) => !reviewedIds.has(star.id))).toEqual(completeCatalogCompanions(stars).filter((star) => !reviewedIds.has(star.id)))
  })

  it('rejects a mismatched object identity and preserves the observations across payload loading and catalog merging', () => {
    const stars = supplementStellarObservations(catalogs[0]!.stars)
    const wise = stars.find((star) => star.id === 'wise-0855-0714')!
    expect(() => supplementStellarObservations([{ ...wise, name: 'Different object' }])).toThrow('identity drifted')
    expect(() => supplementStellarObservations([{ ...wise, designations: [] }])).toThrow('identity drifted')
    const loaded = parseCatalogPayload({ schemaVersion: 2, catalogId: DEFAULT_CATALOG_MANIFEST.id, sourceObjectCount: stars.length, stars }, DEFAULT_CATALOG_MANIFEST)
    expect(loaded.find((star) => star.id === wise.id)?.stellar_observations).toEqual(wise.stellar_observations)
    const { stellar_observations: _observations, ...withoutObservations } = wise
    expect(mergeCatalogStars([withoutObservations], [wise])[0]?.stellar_observations).toEqual(wise.stellar_observations)
  })
})

describe('cold brown dwarf enrichment', () => {
  it.each(catalogs.slice(1))('preserves J0722 model scenarios and both objects’ infrared scope in $path', ({ stars }) => {
    const completed = supplementStellarObservations(stars)
    const ugps = completed.find((star) => star.id === '10pc-0068')!
    const wise = completed.find((star) => star.id === '10pc-0084')!
    expect(ugps).toMatchObject({ temperature_k: null, mass_solar: null, radius_solar: null, age_gyr: null,
      metallicity_dex: null, absolute_mag: null, apparent_mag: null })
    expect(ugps.stellar_observations).toMatchObject({
      temperature_range: { min_k: 502, max_k: 539 },
      mass_range: { min_jupiter: 10.7, max_jupiter: 25.8, assumed_age_min_gyr: 1, assumed_age_max_gyr: 5 },
      radius_range: { min_jupiter: 0.886, max_jupiter: 1.0192 },
      infrared_photometry: { instrument: 'JWST/NIRISS', band: 'F480M', magnitude: 12.016, error_mag: 0.011 },
    })
    expect(ugps.raw_astrometry).toMatchObject({ radial_velocity_kms: 35.8, radial_velocity_error_kms: 0.16,
      radial_velocity_ref: '2023ApJ...953..170H' })
    expect(ugps.notes).toContain('46.9 +/- 2.5')
    expect(ugps.notes).toContain('https://arxiv.org/abs/1109.2897')
    expect(wise).toMatchObject({ temperature_k: 361, age_gyr: null, metallicity_dex: null,
      absolute_mag: null, apparent_mag: null, vx_kms: null, vy_kms: null, vz_kms: null })
    expect(wise.stellar_observations?.infrared_photometry).toMatchObject({ instrument: 'JWST/NIRCam',
      band: 'F480M', magnitude: 13.487, error_mag: 0.005 })
    expect(wise.notes).toContain('5 +/- 3 Gyr')
    expect(wise.raw_astrometry?.radial_velocity_kms).toBeNull()
    for (const star of [ugps, wise]) expect(magnitudeCardAvailable(star)).toBe(false)
    expect(massProperties(ugps).mass).toBeNull()
    expect(() => supplementStellarObservations([{ ...ugps, designations: ['WISE J163940.83-684738.6'] }])).toThrow('identity drifted')
    const loaded = parseCatalogPayload({ schemaVersion: 2, catalogId: DEFAULT_CATALOG_MANIFEST.id,
      sourceObjectCount: completed.length, stars: completed }, { ...DEFAULT_CATALOG_MANIFEST, objectCount: completed.length })
    expect(loaded.find((star) => star.id === ugps.id)?.stellar_observations).toEqual(ugps.stellar_observations)
  })
})
