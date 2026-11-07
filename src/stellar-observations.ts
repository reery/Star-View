import type { Star, StellarObservations } from './catalog-model.ts'
import observationData from './data/stellar-observations.json' with { type: 'json' }
import longBaselineData from './data/long-baseline-motion.json' with { type: 'json' }
import { starComponentIdentity } from './star-systems.ts'
import gravityData from './data/surface-gravity.json' with { type: 'json' }

interface ReviewedObservation {
  expected_name: string
  expected_designation: string
  observations: StellarObservations
}

const reviewed = observationData.objects as Record<string, ReviewedObservation>

/** Preserve scoped observations without turning them into physical/motion inputs. */
export function supplementStellarObservations(stars: readonly Star[]): Star[] {
  return stars.map((star) => {
    const entry = Object.hasOwn(reviewed, star.id) ? reviewed[star.id] : undefined
    if (!entry) return star
    if (star.name !== entry.expected_name || !star.designations?.includes(entry.expected_designation)) {
      throw new Error(`Reviewed observation identity drifted: ${star.id}`)
    }
    return { ...star, stellar_observations: { ...star.stellar_observations, ...entry.observations } }
  })
}

const gravity = gravityData.objects as Record<string, NonNullable<StellarObservations['surface_gravity']> & { source_record_id: string }>

/** Attach measured log g; its source record stays in surface-gravity.json. */
export function supplementSurfaceGravity(stars: readonly Star[]): Star[] {
  return stars.map((star) => {
    if (!Object.hasOwn(gravity, star.id)) return star
    const { source_record_id: _record, ...surface_gravity } = gravity[star.id]!
    return { ...star, stellar_observations: { ...star.stellar_observations, surface_gravity } }
  })
}

const longBaseline = longBaselineData.objects as Record<string, {
  previous: number[]
  pm_ra_cosdec_masyr: number
  pm_ra_error_masyr: number
  pm_dec_masyr: number
  pm_dec_error_masyr: number
  delta_velocity_kms: number[]
}>

const moved = (velocity: number | null, delta: number) => velocity === null ? null : Math.round((velocity + delta) * 1e6) / 1e6

/** Replace a proper motion shifted by an unseen orbit or a bad catalog value; the old value stays in the notes. */
export function supplementLongBaselineMotion<T extends Star>(stars: readonly T[]): T[] {
  return stars.map((star) => {
    const entry = Object.hasOwn(longBaseline, star.id) ? longBaseline[star.id] : undefined
    const raw = star.raw_astrometry
    // System members take this motion from the companion pool.
    if (!entry || !raw || starComponentIdentity(star.id)) return star
    const { previous, delta_velocity_kms: delta, ...motion } = entry
    if (raw.pm_ra_cosdec_masyr !== previous[0] || raw.pm_dec_masyr !== previous[1]) throw new Error(`Reviewed proper motion input drifted: ${star.id}`)
    return { ...star,
      raw_astrometry: { ...raw, pm_ra_cosdec_masyr: motion.pm_ra_cosdec_masyr, pm_ra_error_masyr: motion.pm_ra_error_masyr, pm_dec_masyr: motion.pm_dec_masyr, pm_dec_error_masyr: motion.pm_dec_error_masyr,
        astrometry_ref: `${raw.astrometry_ref ?? ''}; proper motion 2021ApJS..254...42B (Hipparcos-Gaia long baseline)` },
      vx_kms: moved(star.vx_kms, delta[0]!), vy_kms: moved(star.vy_kms, delta[1]!), vz_kms: moved(star.vz_kms, delta[2]!),
      notes: `${star.notes} Proper motion is the Hipparcos-Gaia long-baseline value (Brandt 2021), replacing the catalog's ${previous[0]}, ${previous[1]} mas/yr.` }
  })
}
