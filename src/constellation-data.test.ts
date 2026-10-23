import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { displayMotionForStar } from './astronomy'
import { spaceMotionForStar } from './space-motion'
import { completeCatalogCompanions } from './stellar-companions'
import { parseStarCatalog } from './catalog'
import { starComponentIdentity } from './star-systems'
import motionReview from '../catalog-work/star-systems/reviewed-constellation-motion.json'
import physicalReview from '../catalog-work/star-systems/reviewed-constellation-data.json'

const data = JSON.parse(readFileSync(new URL('./data/stellar-companions.json', import.meta.url), 'utf8')) as { stars: Star[] }
const pool = new Map(data.stars.map((star) => [star.id, star]))
const velocityFields = ['vx_kms', 'vy_kms', 'vz_kms'] as const

describe('constellation data and common system motion', () => {
  it('propagates all 197 reviewed systems together in both motion frames', () => {
    expect(motionReview.systems).toHaveLength(197)
    let members = 0
    for (const review of motionReview.systems) {
      const primary = pool.get(review.primaryStarId)!
      for (const id of Object.keys(review.expectedInputs)) {
        members++
        const star = pool.get(id)!
        expect(velocityFields.map((field) => star[field]), id).toEqual(velocityFields.map((field) => primary[field]))
        for (const frame of ['galactic', 'solar'] as const) {
          const primaryMotion = displayMotionForStar(primary, frame)!
          const motion = displayMotionForStar(star, frame)!
          expect(motion.mode, id).toBe('full')
          expect(motion.velocity.toArray(), id).toEqual(primaryMotion.velocity.toArray())
        }
        expect(spaceMotionForStar(star).label, id).toBe('System bulk motion')
        expect(spaceMotionForStar(star).title, id).toContain(review.radialVelocity.status.includes('proxy') ? 'as a proxy' : 'center-of-mass')
      }
    }
    expect(members).toBe(519)
  })

  it('preserves every native component motion bundle and its uncertainties as source data', () => {
    for (const review of motionReview.systems) for (const [id, original] of Object.entries(review.expectedInputs)) {
      const star = pool.get(id)!
      expect(star.catalog_sources?.some(({ record }) =>
        JSON.stringify(record.raw_astrometry) === JSON.stringify(original.raw_astrometry)
        && velocityFields.every((field) => record[field] === original[field])), id).toBe(true)
      if (original.raw_astrometry) {
        for (const field of ['ra_deg', 'dec_deg', 'parallax_mas', 'parallax_error_mas',
          'pm_ra_cosdec_masyr', 'pm_ra_error_masyr', 'pm_dec_masyr', 'pm_dec_error_masyr', 'epoch'] as const) {
          expect(star.raw_astrometry?.[field], `${id}:${field}`).toBe(original.raw_astrometry[field])
        }
      }
    }
    const proxima = pool.get('proxima-centauri')!
    expect(proxima.raw_astrometry?.radial_velocity_ref).not.toContain('shared systemic velocity approximation')
    expect(velocityFields.map((field) => proxima[field])).not.toEqual(velocityFields.map((field) => pool.get('alpha-centauri-a')![field]))
    expect(pool.get('msc-06290+2013-ba')!.raw_astrometry?.radial_velocity_kms).toBeNull()
    expect(pool.get('msc-06290+2013-bb')!.raw_astrometry?.radial_velocity_kms).toBeNull()
  })

  it('retains interval conventions rather than turning 95 percent bounds into one-sigma errors', () => {
    expect(pool.get('hip-43109')!.raw_astrometry).toMatchObject({ radial_velocity_kms:35.526,radial_velocity_error_kms:null })
    expect(pool.get('hip-75695')!.raw_astrometry).toMatchObject({ radial_velocity_kms:-19.856,radial_velocity_error_kms:null })
    expect(pool.get('hip-30883')!.raw_astrometry).toMatchObject({ radial_velocity_kms:29.8,radial_velocity_error_kms:.1 })
    expect(pool.get('bright-mizar-a')!.raw_astrometry).toMatchObject({ radial_velocity_kms:-7.309,radial_velocity_error_kms:.081 })
    expect(physicalReview.objects['hip-43109'].fields.mass_solar.uncertaintyKind).toBe('95-percent-HDPI')
  })

  it('maps the Nu Gem close triple explicitly and keeps photometry and derived radii coherent', () => {
    for (const [id,mass,temperature,mag] of [
      ['hip-30883',3.34,15000,5.04],['msc-06290+2013-aa2',3.28,15000,5.76],['msc-06290+2013-ab',3.33,12000,5.31],
    ] as const) {
      const star = pool.get(id)!
      expect(star).toMatchObject({ mass_solar:mass,temperature_k:temperature,apparent_mag:mag,age_gyr:.1 })
      expect(star.absolute_mag).toBeCloseTo(mag-5*Math.log10(Math.hypot(star.x_pc,star.y_pc,star.z_pc)/10),8)
      if (star.radius_solar && star.luminosity_solar) {
        expect(star.radius_solar).toBeCloseTo(Math.sqrt(star.luminosity_solar)*(5772/temperature)**2,8)
        expect(star.notes).toContain('Polar radii')
      }
    }
    const primary=pool.get('hip-30883')!
    expect(primary.metallicity_dex).toBeNull()
    expect(primary.catalog_sources?.some(({record})=>record.metallicity_dex===-1.4197)).toBe(true)
    expect(pool.get('msc-06290+2013-ba')!.mass_solar).toBeNull()
    expect(pool.get('msc-06290+2013-bb')!.mass_solar).toBeNull()
  })

  it('ships the same adopted motion through raw catalog completion and generated browser data', () => {
    for (const catalog of ['western-constellation-stars','nearest-1000']) {
      const raw = parseStarCatalog(readFileSync(new URL(`./data/catalogs/${catalog}/stars.csv`, import.meta.url),'utf8'))
      const completed = completeCatalogCompanions(raw)
      const browser = JSON.parse(readFileSync(new URL(`./data/generated/catalogs/${catalog}.json`,import.meta.url),'utf8')).stars as Star[]
      for (const star of completed) {
        const id=starComponentIdentity(star.id)?.canonicalStarId
        if (!id || !motionReview.systems.some((review)=>id in review.expectedInputs)) continue
        const shipped=browser.find((record)=>record.id===star.id)!
        expect(shipped.raw_astrometry, `${catalog}/${id}`).toEqual(star.raw_astrometry)
        expect(velocityFields.map((field)=>shipped[field])).toEqual(velocityFields.map((field)=>star[field]))
      }
    }
    expect(pool.get('hip-75695')!).toMatchObject({ temperature_k:7980,radius_solar:2.63,luminosity_solar:25.3,mass_solar:1.982 })
    expect(pool.get('orb6-15278+2906-a-b-b')!).toMatchObject({ temperature_k:6750,radius_solar:1.56,luminosity_solar:4.5,mass_solar:1.635 })
  })
})
