import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { spaceMotionForStar } from './space-motion'
import baseline from '../catalog-work/bright-stars/gap-baseline.json'
import motionReview from '../catalog-work/bright-stars/gap-motion-review.json'
import constellationMotion from '../catalog-work/star-systems/reviewed-constellation-motion.json'
import audit from '../catalog-work/bright-stars/gap-coverage-audit.json'
import legacyStarIds from './data/legacy-star-ids.json'

// Bright landmarks now ship in the constellation catalog, some under the surviving ID of the same object.
const payload = JSON.parse(readFileSync(new URL('./data/generated/catalogs/western-constellation-stars.json', import.meta.url), 'utf8')) as { stars: Star[] }
const pool = JSON.parse(readFileSync(new URL('./data/stellar-companions.json', import.meta.url), 'utf8')) as {
  systems: { components: { starId: string, alternateStarIds?: string[] }[] }[], stars: Star[]
}
const aliases = new Map(pool.systems.flatMap((s) => s.components.flatMap((c) =>
  [c.starId, ...c.alternateStarIds ?? []].map((id) => [id, c.starId] as const))))
const shipped = new Map(payload.stars.map((s) => [s.id, s]))
const canonical = new Map(payload.stars.map((s) => [aliases.get(s.id) ?? s.id, s]))
const legacy: Record<string, string> = { ...legacyStarIds.ids, ...legacyStarIds.sharedIds }
const brightIds = [...Object.keys(baseline.records), 'msc-07346+3153-cb', 'msc-13252-1110-ab']
const stars = { get: (id: string) => canonical.get(id) ?? shipped.get(legacy[id] ?? id) }
const componentAudit = JSON.parse(readFileSync(new URL('../catalog-work/star-systems/catalog-companions-audit.json', import.meta.url),'utf8')).componentRecords

describe('bright catalog gap review', () => {
  it('preserves every previously adopted physical value and RV through runtime expansion', () => {
    expect(brightIds).toHaveLength(201)
    for (const id of brightIds) expect(stars.get(id), id).toBeDefined()
    for (const [id, previous] of Object.entries(baseline.records)) {
      const star = stars.get(id)!
      for (const [field, value] of Object.entries(previous.values)) {
        if (value === null) continue
        const current = field === 'radial_velocity_kms' ? star.raw_astrometry?.radial_velocity_kms : star[field as keyof Star]
        const original = pool.stars.find((star) => star.id === id)?.catalog_sources?.some(({ record }) =>
          (field === 'radial_velocity_kms' ? record.raw_astrometry?.radial_velocity_kms : record[field as keyof typeof record]) === value)
        const replaced = componentAudit[id]?.reviewedLiterature?.replaced?.[field]
        expect(current === value || original || (replaced?.value === value && !!replaced.sourceEvidence), `${id}:${field} must remain adopted or retained with source scope`).toBe(true)
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
    // The reviewed split now identifies individual Aa/Ab; Ac remains separate.
    expect(stars.get('bright-spica')!.mass_solar).toBe(11.43)
    expect(stars.get('msc-13252-1110-ab')!.mass_solar).toBe(7.21)
    expect(stars.get('msc-13252-1110-ac')!.mass_solar).toBeNull()
    expect(stars.get('bright-antares')!.mass_solar).toBeNull()
  })

  it('labels compiled RV proxies separately from a published fitted systemic solution', () => {
    for (const review of motionReview.systems) {
      for (const id of review.targetIds) {
        const star = stars.get(id)!
        const newer = constellationMotion.systems.find((system) => id in system.expectedInputs)?.radialVelocity
        expect(star.raw_astrometry!.radial_velocity_kms).toBe(newer?.valueKms ?? review.valueKms)
        expect(spaceMotionForStar(star).label).toBe('System bulk motion')
        expect(spaceMotionForStar(star).title).toContain((newer?.status.includes('proxy') ?? review.status === 'compiled-system-proxy') ? 'as a proxy' : 'center-of-mass')
      }
    }
    expect(spaceMotionForStar(stars.get('cns5-3442')!).title).toContain('as a proxy')
  })

  it('keeps the complete gap list and counts aligned with the data shipped to the browser', () => {
    expect(audit.records).toHaveLength(brightIds.length)
    for (const record of audit.records) {
      const star = stars.get(record.id)!
      for (const field of ['temperature_k', 'mass_solar', 'luminosity_solar', 'radius_solar'] as const) {
        expect((record.missing as string[]).includes(field), `${record.id}:${field}`).toBe(star[field] === null)
      }
      expect(star.raw_astrometry?.radial_velocity_kms).not.toBeNull()
      if (record.missing.length) expect(record.remainingGapReason).toBeTruthy()
    }
    expect(audit.coverage.radial_velocity_kms.after).toBe(brightIds.length)
  })
})
