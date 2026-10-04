import { Matrix3, Vector3 } from 'three'
import { ICRS_TO_GALACTIC_ROWS } from './catalog-model'

export const EARTH_OBLIQUITY_DEG = 23.43928
export const EARTH_ORBIT_DISPLAY_RADIUS_PC = 0.35
export const EARTH_AXIS_DISPLAY_HALF_LENGTH_PC = 0.14
export const EARTH_ORBIT_MODES = ['off', 'now', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const
export type EarthOrbitMode = typeof EARTH_ORBIT_MODES[number]

const EARTH_ORBIT_MODE_LABELS: Record<EarthOrbitMode, string> = {
  off: 'Off',
  now: 'Now',
  jan: 'Jan',
  feb: 'Feb',
  mar: 'Mar',
  apr: 'Apr',
  may: 'May',
  jun: 'Jun',
  jul: 'Jul',
  aug: 'Aug',
  sep: 'Sep',
  oct: 'Oct',
  nov: 'Nov',
  dec: 'Dec',
}

const DEGREES_TO_RADIANS = Math.PI / 180
const RADIANS_TO_DEGREES = 180 / Math.PI
const JULIAN_DATE_UNIX_EPOCH = 2440587.5
const JULIAN_DATE_J2000 = 2451545
const MEAN_OBLIQUITY_RADIANS = EARTH_OBLIQUITY_DEG * DEGREES_TO_RADIANS
const ICRS_TO_GALACTIC = new Matrix3().set(
  ...ICRS_TO_GALACTIC_ROWS.flat() as [number, number, number, number, number, number, number, number, number],
)
const ECLIPTIC_TO_ICRS = new Matrix3().set(
  1, 0, 0,
  0, Math.cos(MEAN_OBLIQUITY_RADIANS), -Math.sin(MEAN_OBLIQUITY_RADIANS),
  0, Math.sin(MEAN_OBLIQUITY_RADIANS), Math.cos(MEAN_OBLIQUITY_RADIANS),
)

function wrapDegrees(degrees: number): number {
  return (degrees % 360 + 360) % 360
}

export function isEarthOrbitMode(value: string | null): value is EarthOrbitMode {
  return value !== null && EARTH_ORBIT_MODES.includes(value as EarthOrbitMode)
}

export function earthOrbitModeLabel(mode: EarthOrbitMode): string {
  return EARTH_ORBIT_MODE_LABELS[mode]
}

export function earthOrbitDateForMode(mode: EarthOrbitMode, now = new Date()): Date | null {
  if (mode === 'off') return null
  const timestamp = now.getTime()
  if (!Number.isFinite(timestamp)) throw new RangeError('A valid current date is required.')
  if (mode === 'now') return new Date(timestamp)
  const month = EARTH_ORBIT_MODES.indexOf(mode) - 2
  return new Date(Date.UTC(now.getUTCFullYear(), month, 15, 12))
}

/** Converts a J2000 ecliptic vector into Star View's Galactic-aligned world axes. */
export function eclipticVectorToWorld(vector: Vector3): Vector3 {
  const galactic = vector.clone().applyMatrix3(ECLIPTIC_TO_ICRS).applyMatrix3(ICRS_TO_GALACTIC)
  return new Vector3(galactic.x, galactic.z, -galactic.y)
}

/**
 * Approximate heliocentric ecliptic longitude of Earth for a UTC instant.
 * The low-order solar formula is comfortably more precise than the display marker.
 */
export function earthEclipticLongitude(date: Date): number {
  const timestamp = date.getTime()
  if (!Number.isFinite(timestamp)) throw new RangeError('A valid date is required.')
  const daysSinceJ2000 = timestamp / 86_400_000 + JULIAN_DATE_UNIX_EPOCH - JULIAN_DATE_J2000
  const meanSolarLongitude = wrapDegrees(280.460 + 0.9856474 * daysSinceJ2000)
  const meanSolarAnomaly = wrapDegrees(357.528 + 0.9856003 * daysSinceJ2000) * DEGREES_TO_RADIANS
  const solarLongitude = meanSolarLongitude
    + 1.915 * Math.sin(meanSolarAnomaly)
    + 0.020 * Math.sin(2 * meanSolarAnomaly)
  return wrapDegrees(solarLongitude + 180) * DEGREES_TO_RADIANS
}

export interface EarthOrbitModel {
  orbitPoints: Vector3[]
  earthPosition: Vector3
  axisDirection: Vector3
  eclipticLongitudeDeg: number
}

export type EarthOrbitMarker = Omit<EarthOrbitModel, 'orbitPoints'>

function validateOrbitRadius(radiusPc: number): void {
  if (!Number.isFinite(radiusPc) || radiusPc <= 0) throw new RangeError('Orbit display radius must be positive.')
}

export function earthOrbitPoints(radiusPc = EARTH_ORBIT_DISPLAY_RADIUS_PC, segments = 180): Vector3[] {
  validateOrbitRadius(radiusPc)
  if (!Number.isInteger(segments) || segments < 16) throw new RangeError('Orbit requires at least 16 segments.')
  return Array.from({ length: segments + 1 }, (_, index) => {
    const longitude = index / segments * Math.PI * 2
    return eclipticVectorToWorld(new Vector3(Math.cos(longitude) * radiusPc, Math.sin(longitude) * radiusPc, 0))
  })
}

export function earthOrbitMarker(date = new Date(), radiusPc = EARTH_ORBIT_DISPLAY_RADIUS_PC): EarthOrbitMarker {
  validateOrbitRadius(radiusPc)
  const longitude = earthEclipticLongitude(date)
  const earthPosition = eclipticVectorToWorld(new Vector3(Math.cos(longitude) * radiusPc, Math.sin(longitude) * radiusPc, 0))
  // In ecliptic coordinates, Earth's J2000 north pole is tilted toward +Y.
  const axisDirection = eclipticVectorToWorld(new Vector3(0, Math.sin(MEAN_OBLIQUITY_RADIANS), Math.cos(MEAN_OBLIQUITY_RADIANS))).normalize()
  return { earthPosition, axisDirection, eclipticLongitudeDeg: longitude * RADIANS_TO_DEGREES }
}

export function earthOrbitModel(date = new Date(), radiusPc = EARTH_ORBIT_DISPLAY_RADIUS_PC, segments = 180): EarthOrbitModel {
  return { orbitPoints: earthOrbitPoints(radiusPc, segments), ...earthOrbitMarker(date, radiusPc) }
}
