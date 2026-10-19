import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { spaceMotionForStar } from './space-motion'
import baseline from '../catalog-work/bright-stars/gap-baseline.json'
import motionReview from '../catalog-work/bright-stars/gap-motion-review.json'
import audit from '../catalog-work/bright-stars/gap-coverage-audit.json'

const payload = JSON.parse(readFileSync(new URL('./data/generated/catalogs/bright-stars.json', import.meta.url), 'utf8')) as { stars: Star[] }
const pool = JSON.parse(readFileSync(new URL('./data/stellar-companions.json', import.meta.url), 'utf8')) as {
  systems: { components: { starId: string, alternateStarIds?: string[] }[] }[]
}
const aliases = new Map(pool.systems.flatMap((s) => s.components.flatMap((c) =>
  [c.starId, ...c.alternateStarIds ?? []].map((id) => [id, c.starId] as const))))
const stars = new Map(payload.stars.filter((s) => s.id !== 'sun').map((s) => [aliases.get(s.id) ?? s.id, s]))

describe('bright catalog gap review', () => {
  it('preserves every previously adopted physical value and RV through runtime expansion', () => {
    expect(stars.size).toBe(199)
    expect([...stars.keys()].sort()).toEqual(Object.keys(baseline.records).sort())
    for (const [id, previous] of Object.entries(baseline.records)) {
      const star = stars.get(id)!
      for (const [field, value] of Object.entries(previous.values)) {
        if (value === null) continue
        const current = field === 'radial_velocity_kms' ? star.raw_astrometry?.radial_velocity_kms : star[field as keyof Star]
        expect(current, `${id}:${field}`).toBe(value)
      }
    }
  })

  it('maps the published Algol A/B/C masses to the exact hierarchical Aa/Ab/B components', () => {
    const source = JSON.parse(readFileSync(new URL('../catalog-work/bright-stars/literature/algol-selected-tables.json', import.meta.url), 'utf8'))
    const massRow = source.tables['5'].find((row: string[]) => row[0] === 'Mass') as string[]
    const ids = ['bright-algol', 'msc-03082+4057-ab', 'msc-03082+4057-b']
    for (const [i, id] of ids.entries()) {
      expect(stars.get(id)!.mass_solar).toBe(parseFloat(massRow[i + 3]!))
    }
    // The Spica Aab record represents an unresolved inner pair, so the
    // published individual Aa/Ab masses must not be attached to Aab or Ac.
    expect(stars.get('bright-spica')!.mass_solar).toBeNull()
    expect(stars.get('bright-antares')!.mass_solar).toBeNull()
  })

  it('labels compiled RV proxies separately from a published fitted systemic solution', () => {
    for (const review of motionReview.systems) {
      for (const id of review.targetIds) {
        const star = stars.get(id)!
        expect(star.raw_astrometry!.radial_velocity_kms).toBe(review.valueKms)
        expect(spaceMotionForStar(star).label).toBe('System bulk motion')
        expect(spaceMotionForStar(star).title).toContain(review.status === 'compiled-system-proxy' ? 'as a proxy' : 'center-of-mass')
      }
    }
    expect(spaceMotionForStar(stars.get('cns5-3442')!).title).toContain('as a proxy')
  })

  it('keeps the complete gap list and counts aligned with the data shipped to the browser', () => {
    expect(audit.records).toHaveLength(stars.size)
    for (const record of audit.records) {
      const star = stars.get(record.id)!
      for (const field of ['temperature_k', 'mass_solar', 'luminosity_solar', 'radius_solar'] as const) {
        expect((record.missing as string[]).includes(field), `${record.id}:${field}`).toBe(star[field] === null)
      }
      expect(star.raw_astrometry?.radial_velocity_kms).not.toBeNull()
      if (record.missing.length) expect(record.remainingGapReason).toBeTruthy()
    }
    expect(audit.coverage.radial_velocity_kms.after).toBe(stars.size)
  })
})
