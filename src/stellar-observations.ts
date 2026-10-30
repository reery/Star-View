import type { Star, StellarObservations } from './catalog-model.ts'
import observationData from './data/stellar-observations.json' with { type: 'json' }
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
