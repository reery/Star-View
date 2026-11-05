import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Star } from './catalog-model'
import { spaceMotionForStar } from './space-motion'
import baseline from '../catalog-work/bright-stars/gap-baseline.json'
import motionReview from '../catalog-work/bright-stars/gap-motion-review.json'
import constellationMotion from '../catalog-work/star-systems/reviewed-constellation-motion.json'
import legacyStarIds from './data/legacy-star-ids.json'

// Bright landmarks now ship in the constellation catalog, some under the surviving ID of the same object.
const westernProvenance = JSON.parse(readFileSync(new URL('./data/catalogs/western-constellation-stars/provenance.json', import.meta.url), 'utf8')) as { objects: Record<string, unknown> }
const retirements = JSON.parse(readFileSync(new URL('../catalog-work/reviewed-data-retirements.json', import.meta.url), 'utf8')).retirements as { id: string, field: string, expectedPrevious: unknown }[]
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
// Reviews may replace a value, as long as the review or the object's provenance records what it replaced.
const reviewRecords = (id: string) => [readFileSync(new URL('../catalog-work/shared-enrichment/hot-star-temperature-review.json', import.meta.url), 'utf8'), JSON.stringify(westernProvenance.objects[id] ?? '')].join()
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
        const original = pool.stars.find((source) => source.id === star.id)?.catalog_sources?.some(({ record }) =>
          (field === 'radial_velocity_kms' ? record.raw_astrometry?.radial_velocity_kms : record[field as keyof typeof record]) === value)
        const replaced = componentAudit[id]?.reviewedLiterature?.replaced?.[field]
        const reviewed = retirements.some((retirement) => retirement.id === star.id && retirement.field === field && Number(retirement.expectedPrevious) === value)
          || reviewRecords(star.id).includes(String(value))
        expect(current === value || original || reviewed || (replaced?.value === value && !!replaced.sourceEvidence), `${id}:${field} must remain adopted or retained with source scope`).toBe(true)
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
        // The Izar review withholds a radial velocity from the candidate brown dwarf D.
        if (id === 'msc-14450+2704-d') continue
        const star = stars.get(id)!
        const newer = constellationMotion.systems.find((system) => id in system.expectedInputs)?.radialVelocity
        expect(star.raw_astrometry!.radial_velocity_kms).toBe(newer?.valueKms ?? review.valueKms)
        expect(spaceMotionForStar(star).label).toBe('System bulk motion')
        expect(spaceMotionForStar(star).title).toContain((newer?.status.includes('proxy') ?? review.status === 'compiled-system-proxy') ? 'as a proxy' : 'center-of-mass')
      }
    }
    expect(spaceMotionForStar(stars.get('cns5-3442')!).title).toContain('as a proxy')
  })
})
