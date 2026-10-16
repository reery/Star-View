import { EARTH_OBLIQUITY_DEG, earthEclipticLongitude } from './earth-orbit'
import type { SkyPosition } from './constellations'

const RAD = Math.PI / 180
export const VISIBILITY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
export const EVENING_SOLAR_HOUR = 22
export const NIGHT_SUN_ALTITUDE_DEG = -18

/** Geometric horizon, without refraction, terrain, or a naked-eye brightness limit. */
export function visibleLatitudeRange(declination: number): { south: number; north: number } | null {
  if (!Number.isFinite(declination) || Math.abs(declination) > 90) return null
  return { south: Math.max(-90, declination - 90), north: Math.min(90, declination + 90) }
}

/** USNO spherical horizon relation; hour angle is sidereal time minus right ascension. */
export function skyAltitude(declination: number, latitude: number, hourAngle: number): number {
  const sine = Math.sin(latitude * RAD) * Math.sin(declination * RAD)
    + Math.cos(latitude * RAD) * Math.cos(declination * RAD) * Math.cos(hourAngle * RAD)
  return Math.asin(Math.max(-1, Math.min(1, sine))) / RAD
}

/**
 * Seasonal guide at 10 pm apparent solar time on each month's 15th.
 * A representative J2000 year keeps the Sun in the catalogue's coordinate frame.
 * The Sun must be below astronomical twilight and the object above the horizon.
 * Longitude, civil time zones, weather, and limiting magnitude are not modeled.
 */
export function eveningVisibilityMonths(position: SkyPosition, latitude: number): boolean[] {
  if (!visibleLatitudeRange(position.dec_deg) || !Number.isFinite(position.ra_deg)
    || !Number.isFinite(latitude) || Math.abs(latitude) > 90) return VISIBILITY_MONTHS.map(() => false)
  const solarHourAngle = (EVENING_SOLAR_HOUR - 12) * 15
  const obliquity = EARTH_OBLIQUITY_DEG * RAD
  return VISIBILITY_MONTHS.map((_, month) => {
    const longitude = earthEclipticLongitude(new Date(Date.UTC(2000, month, 15, 22))) - Math.PI
    const sunRa = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude)) / RAD
    const sunDec = Math.asin(Math.sin(obliquity) * Math.sin(longitude)) / RAD
    return skyAltitude(sunDec, latitude, solarHourAngle) <= NIGHT_SUN_ALTITUDE_DEG
      && skyAltitude(position.dec_deg, latitude, sunRa + solarHourAngle - position.ra_deg) > 1e-8
  })
}

export function latitudeLabel(latitude: number, digits = 0): string {
  return latitude === 0 ? '0°' : `${Math.abs(latitude).toFixed(digits)}° ${latitude < 0 ? 'S' : 'N'}`
}

/** Merge adjoining months, including a season that crosses December/January. */
export function visibilityMonthLabel(months: readonly boolean[]): string {
  if (months.length !== 12 || !months.some(Boolean)) return 'None at 10 pm'
  if (months.every(Boolean)) return 'All year'
  const start = (months.findIndex((visible) => !visible) + 1) % 12
  const groups: number[][] = []
  let group: number[] = []
  for (let offset = 0; offset < 12; offset++) {
    const index = (start + offset) % 12
    if (months[index]) group.push(index)
    else if (group.length) { groups.push(group); group = [] }
  }
  if (group.length) groups.push(group)
  return groups.map((indices) => indices.length === 1 ? VISIBILITY_MONTHS[indices[0]!]!
    : `${VISIBILITY_MONTHS[indices[0]!]!}–${VISIBILITY_MONTHS[indices.at(-1)!]!}`).join(', ')
}
