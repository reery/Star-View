import { describe, expect, it } from 'vitest'
import csv from './data/stars.csv?raw'
import nearest100Csv from './data/catalogs/nearest-100/stars.csv?raw'
import nearest1000Csv from './data/catalogs/nearest-1000/stars.csv?raw'
import provenanceRaw from './data/catalogs/nearest-100/provenance.json?raw'
import { parseStarCatalog } from './catalog'
import { completeCatalogCompanions } from './stellar-companions'
import { apparentVisualMagnitude, displayMotionForStar } from './astronomy'
import { magnitudeCardAvailable } from './magnitude-card'

describe('resolved Luhman 16 observations', () => {
  it.each([['default', csv], ['nearest-100', nearest100Csv], ['nearest-1000', nearest1000Csv]])(
    'keeps individual photometry and observed RVs through %s component completion', (_catalog, source) => {
      const stars = completeCatalogCompanions(parseStarCatalog(source))
      for (const [component, magnitude, velocity, error] of [
        ['a', 23.25, 16.7, 0.3], ['b', 24.07, 20.4, 0.4],
      ] as const) {
        const star = stars.find((candidate) => candidate.id === `luhman-16-${component}`)!
        expect(star.apparent_mag).toBeCloseTo(magnitude, 6)
        expect(star.resolved_photometry).toMatchObject({
          magnitude_v: magnitude, error_mag: 0.1, observed_on: '2013-06-16',
          reference: '2014A&A...561L...4B:Table 2',
        })
        const distance = Math.hypot(star.x_pc, star.y_pc, star.z_pc)
        expect(apparentVisualMagnitude(star.absolute_mag, distance)).toBeCloseTo(magnitude, 6)
        expect(star.absolute_mag).toBeCloseTo(component === 'a' ? 26.75 : 27.57, 2)
        expect(magnitudeCardAvailable(star)).toBe(true)
        expect(star.radial_velocity_observation).toMatchObject({
          value_kms: velocity, error_kms: error,
          observed_from: '2018-04-21', observed_to: '2018-06-29',
          reference: '2025MNRAS.539.1088I:Table 2',
        })
        expect(star.radial_velocity_observation!.uncertainty_kind).toContain('not a formal standard error')
        expect(star.radial_velocity_observation!.scope).toContain('not the binary systemic velocity')
        expect(star).toMatchObject({ vx_kms: null, vy_kms: null, vz_kms: null })
        expect(star.raw_astrometry?.radial_velocity_kms).toBeNull()
        for (const frame of ['solar', 'galactic'] as const) expect(displayMotionForStar(star, frame)?.mode).toBe('transverse')
      }
      expect(stars.find((star) => star.id === 'wise-0855-0714')?.radial_velocity_observation).toBeUndefined()
    },
  )

  it('retains source uncertainties, original astrometry and absolute-magnitude inputs in provenance', () => {
    const objects = JSON.parse(provenanceRaw).objects
    for (const component of ['a', 'b']) {
      const record = objects.find((item: { id: string }) => item.id === `luhman-16-${component}`)
      expect(record.reviewedPhysical.photometry.uncertainty).toBe(0.1)
      expect(record.reviewedPhysical.absoluteMagnitudeDerivation).toMatchObject({ status: 'derived', apparentMagnitudeUncertainty: 0.1 })
      expect(record.reviewedPhysical.absoluteMagnitudeDerivation.distancePc).toBeCloseTo(1.996, 3)
      expect(record.radialVelocityObservation.scope).toContain('Display-only observation')
      expect(record.sourceMeasurements).toHaveProperty('RV')
    }
  })
})
