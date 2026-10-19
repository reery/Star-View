import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { generatedJsonFetch } from './test-support/generated-json'
import { parseStarCatalog } from './catalog'
import type { Star } from './catalog-model'
import { missingCatalogMeasurements } from './catalog-source'
import { mergeCatalogStars } from './catalog-runtime'
import { completeCatalogCompanions } from './stellar-companions'
import { indexStarSystems, starComponentIdentity } from './star-systems'
import { loadStellarOrbits, orbitBarycenterVisible, orbitHasGeometry, orbitMassFraction, projectedOrbitPoint, stellarOrbitsForSystem } from './stellar-orbits'
import { temperatureCardAvailable } from './temperature-properties'
import vela from './data/constellations/vela.json'

const source = (catalog: string, id: string) => parseStarCatalog(readFileSync(new URL(`./data/catalogs/${catalog}/stars.csv`, import.meta.url), 'utf8')).find((star) => star.id === id)!
const bright = source('bright-stars', 'bright-regor')
const western = source('western-constellation-stars', 'hip-39953')
beforeAll(async () => {
  vi.stubGlobal('fetch', generatedJsonFetch)
  await loadStellarOrbits('msc-08095-4720')
})
afterAll(() => vi.unstubAllGlobals())

describe('reviewed Regor component and orbital coverage', () => {
  it.each([bright, western, vela.stars.find((star) => star.hip === 39953)!.object as Star])('retains source measurements and exact components through $id selection', (parent) => {
    const stars = completeCatalogCompanions([parent])
    const system = indexStarSystems(stars).get(parent.id)!
    expect(system.components.map((component) => component.label)).toEqual(['Aa', 'Ab', 'Ba', 'Bb', 'C'])
    const wr = stars.find((star) => star.id === parent.id)!
    expect(wr).toMatchObject({ name: 'Regor Aa', spectral_type: 'WC8', mass_solar: 8.3, radius_solar: 3.4, luminosity_solar: 110000,
      temperature_k: null, absolute_mag: null, apparent_mag: null, age_gyr: null, unresolved_photometry: { magnitude_v: 1.83 } })
    expect(wr.stellar_observations?.atmosphere_temperature).toMatchObject({ value_k: 57100, error_k: 1700, quantity: 'T*' })
    expect(temperatureCardAvailable(wr)).toBe(false)
    expect(missingCatalogMeasurements(parent, wr)).toEqual([])
    const o = stars.find((star) => star.id === 'msc-08095-4720-ab')!
    expect(o).toMatchObject({ name: 'Regor Ab', spectral_type: 'O7.5III-V', mass_solar: 26.4, radius_solar: 13.5,
      temperature_k: 35000, luminosity_solar: 250000, age_gyr: .0069, subtypes: [], apparent_mag: null, absolute_mag: null })
    expect(temperatureCardAvailable(o)).toBe(true)
    expect(o.stellar_observations?.atmosphere_temperature).toBeUndefined()
    expect(stars.find((star) => star.name === 'Regor C')).toMatchObject({ spectral_type: 'B6V', apparent_mag: 7.29 })
    expect(completeCatalogCompanions(stars)).toEqual(stars)
    expect(completeCatalogCompanions([o])[0]).toEqual(o)
    expect(starComponentIdentity(parent.id)).toMatchObject({ systemId: 'msc-08095-4720', label: 'Aa' })
  })

  it('does not restore blended temperatures or duplicate components when overlays merge in either order', () => {
    const a = completeCatalogCompanions([bright]), b = completeCatalogCompanions([western])
    for (const merged of [mergeCatalogStars(a, b), mergeCatalogStars(b, a)]) {
      expect(merged).toHaveLength(5)
      expect(merged.find((star) => star.name === 'Regor Aa')?.temperature_k).toBeNull()
      expect(merged.find((star) => star.name === 'Regor Ab')?.mass_solar).toBe(26.4)
    }
  })

  it('uses the published relative axis, WR argument and masses without inventing wide or spectroscopic geometry', () => {
    const system = indexStarSystems(completeCatalogCompanions([bright])).get(bright.id)!
    const orbits = stellarOrbitsForSystem(system)
    expect(orbits).toHaveLength(2)
    const inner = orbits.find((orbit) => orbit.primary === 'Aa')!
    expect(inner).toMatchObject({ primaryIds: ['bright-regor'], secondaryIds: ['msc-08095-4720-ab'],
      semiMajorAxisAu: 1.170, eccentricity: .322, inclinationDeg: 65, nodeDeg: 247, projectionNodeDeg: 67, argumentDeg: 67.5,
      argumentComponent: 'Aa', periastronEpoch: 60250.44, epochKind: 'MJD', axisDerivation: null,
      axisSource: { adoptedDistancePc: 336 } })
    expect(inner.periodYears * 365.25).toBeCloseTo(78.524, 6)
    expect(orbitHasGeometry(inner)).toBe(true)
    expect(orbitMassFraction(system, inner)).toBeCloseTo(26.4 / 34.7)
    expect(orbitBarycenterVisible(system, inner)).toBe(true)
    expect(Math.abs(inner.semiMajorAxisAu! ** 3 / inner.periodYears ** 2 - 34.7)).toBeLessThan(.1)
    // Independent GRAVITY RA/Dec positions of WR relative to O (Table 1).
    // The app draws O relative to WR, east left and north up. These four
    // epochs catch a reversed argument, node convention or time convention.
    for (const [mjd, ra, dec] of [[60261.316, -2.26, -1.58], [60268.313, -3.41, -1.29],
      [60354.048, -3.70, -.61], [60375.130, -1.10, 1.62]]) {
      const mean = 2 * Math.PI * (mjd! - inner.periastronEpoch!) / (inner.periodYears * 365.25)
      let anomaly = mean
      for (let i = 0; i < 12; i++) anomaly -= (anomaly - inner.eccentricity! * Math.sin(anomaly) - mean) / (1 - inner.eccentricity! * Math.cos(anomaly))
      const point = projectedOrbitPoint(inner, anomaly)
      expect(Math.abs(point.x * 3.483 - ra!)).toBeLessThan(.06)
      expect(Math.abs(point.y * 3.483 - dec!)).toBeLessThan(.06)
    }
    const b = orbits.find((orbit) => orbit.primary === 'Ba')!
    expect(b.periodYears * 365.25).toBeCloseTo(1.4826)
    expect(orbitHasGeometry(b)).toBe(false)
    expect(orbits.some((orbit) => orbit.primaryIds.length > 1 || orbit.secondary === 'C')).toBe(false)
  })
})
