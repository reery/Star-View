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
    expect(completed.filter((star) => star.id !== wise.id)).toEqual(completeCatalogCompanions(stars).filter((star) => star.id !== wise.id))
  })

  it('rejects a mismatched object identity and preserves the observations across payload loading and catalog merging', () => {
    const stars = supplementStellarObservations(catalogs[0]!.stars)
    const wise = stars.find((star) => star.id === 'wise-0855-0714')!
    expect(() => supplementStellarObservations([{ ...wise, name: 'Different object' }])).toThrow('identity drifted')
    expect(() => supplementStellarObservations([{ ...wise, designations: [] }])).toThrow('identity drifted')
    const loaded = parseCatalogPayload({ schemaVersion: 1, catalogId: DEFAULT_CATALOG_MANIFEST.id, stars }, DEFAULT_CATALOG_MANIFEST)
    expect(loaded.find((star) => star.id === wise.id)?.stellar_observations).toEqual(wise.stellar_observations)
    const { stellar_observations: _observations, ...withoutObservations } = wise
    expect(mergeCatalogStars([withoutObservations], [wise])[0]?.stellar_observations).toEqual(wise.stellar_observations)
  })
})
