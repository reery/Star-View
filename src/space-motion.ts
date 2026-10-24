import type { Star } from './catalog-model'
import { catalogFlags } from './catalog-detail-model'

/** Shared motion wording for the selected object and Objects database. */
export function spaceMotionForStar(star: Star) {
  const raw = star.raw_astrometry
  const fullVelocity = [star.vx_kms, star.vy_kms, star.vz_kms].every((value) => value !== null) || (raw !== null && raw.radial_velocity_kms !== null)
  const systemicMotion = raw?.radial_velocity_ref?.includes('; shared systemic velocity approximation') ?? false
  const compiledProxy = systemicMotion && (raw?.radial_velocity_ref?.includes('proxy') ?? false)
  const title = systemicMotion ? compiledProxy
    ? 'Approximate system bulk motion using a compiled stellar radial velocity as a proxy; orbital motion and other stellar velocity shifts are not modeled.'
    : 'Approximate system bulk motion using a shared center-of-mass radial velocity; individual orbital velocities are not modeled.' : ''
  let label = fullVelocity ? systemicMotion ? 'System bulk motion' : 'Full space motion' : raw ? 'Transverse only; radial velocity unavailable' : null
  if (!fullVelocity && raw) {
    if (catalogFlags(star).source_rv) label = 'Transverse component motion'
    if (star.radial_velocity_observation) label = 'Transverse only'
  }
  return { fullVelocity, systemicMotion, label, title }
}
