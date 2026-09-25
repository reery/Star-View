import { Color, Matrix3, Vector3 } from 'three'
import type { RawAstrometry, Star } from './catalog-model'

export const LIGHT_YEARS_PER_PARSEC = 3.261563777
export const SOLAR_GALACTIC_VELOCITY_KMS = Object.freeze({ vx_kms: 12.9, vy_kms: 245.6, vz_kms: 7.78 })
const ICRS_TO_GALACTIC = new Matrix3().set(
  -0.0548755604, -0.8734370902, -0.4838350155,
  0.4941094279, -0.4448296300, 0.7469822445,
  -0.8676661490, -0.1980763734, 0.4559837762,
)
export type Position = Pick<Star, 'x_pc' | 'y_pc' | 'z_pc'>
export type MotionMode = 'full' | 'transverse'
export type MotionFrame = 'galactic' | 'solar'

export interface DisplayMotion {
  velocity: Vector3
  mode: MotionMode
}

export type DistanceUnit = 'pc' | 'ly'

export function gridSpacingPc(distanceLy: number): number {
  if (distanceLy <= 100) return 0.5
  if (distanceLy <= 150) return 1
  if (distanceLy <= 200) return 2
  if (distanceLy <= 300) return 5
  if (distanceLy <= 500) return 10
  if (distanceLy <= 1000) return 20
  if (distanceLy <= 1500) return 30
  return 40
}

export function formatDistance(distancePc: number, unit: DistanceUnit, digits = 2): string {
  const converted = distancePc * (unit === 'ly' ? LIGHT_YEARS_PER_PARSEC : 1)
  const value = Math.abs(converted) < 0.5 * 10 ** -digits ? 0 : converted
  return `${value.toFixed(digits)} ${unit}`
}

export function apparentVisualMagnitude(absoluteMagnitude: number | null, distancePc: number): number | null {
  if (absoluteMagnitude === null || !Number.isFinite(absoluteMagnitude) || !Number.isFinite(distancePc) || distancePc <= 0) return null
  const magnitude = absoluteMagnitude + 5 * (Math.log10(distancePc) - 1)
  return Number.isFinite(magnitude) ? magnitude : null
}

export function visibilityTier(target: Pick<Star, 'id' | 'absolute_mag'> & Position, observer: Pick<Star, 'id'> & Position, limit: number): 'base' | 'eligible' | 'background' {
  if (target.id === observer.id) return 'base'
  const distance = Math.hypot(target.x_pc - observer.x_pc, target.y_pc - observer.y_pc, target.z_pc - observer.z_pc)
  const magnitude = apparentVisualMagnitude(target.absolute_mag, distance)
  return magnitude !== null && magnitude <= limit ? 'eligible' : 'background'
}

export function galacticToWorld(position: Position): Vector3 {
  return new Vector3(position.x_pc, position.z_pc, -position.y_pc)
}

export function galacticVelocityToWorld(star: Pick<Star, 'vx_kms' | 'vy_kms' | 'vz_kms'>): Vector3 | null {
  const { vx_kms, vy_kms, vz_kms } = star
  if (vx_kms === null || vy_kms === null || vz_kms === null) return null
  if (![vx_kms, vy_kms, vz_kms].every(Number.isFinite)) return null
  if (vx_kms === 0 && vy_kms === 0 && vz_kms === 0) return null
  return new Vector3(vx_kms, vz_kms, -vy_kms)
}

export function galactocentricVelocityToWorld(star: Pick<Star, 'id' | 'vx_kms' | 'vy_kms' | 'vz_kms'>): Vector3 | null {
  if (star.id === 'sun') return galacticVelocityToWorld(SOLAR_GALACTIC_VELOCITY_KMS)
  const { vx_kms, vy_kms, vz_kms } = star
  if (vx_kms === null || vy_kms === null || vz_kms === null) return null
  return galacticVelocityToWorld({
    vx_kms: vx_kms + SOLAR_GALACTIC_VELOCITY_KMS.vx_kms,
    vy_kms: vy_kms + SOLAR_GALACTIC_VELOCITY_KMS.vy_kms,
    vz_kms: vz_kms + SOLAR_GALACTIC_VELOCITY_KMS.vz_kms,
  })
}

export function rawAstrometryVelocityToWorld(raw: RawAstrometry, includeRadial = raw.radial_velocity_kms !== null): Vector3 | null {
  if (!Number.isFinite(raw.parallax_mas) || raw.parallax_mas <= 0) return null
  const alpha = raw.ra_deg * Math.PI / 180
  const delta = raw.dec_deg * Math.PI / 180
  const radial = new Vector3(Math.cos(delta) * Math.cos(alpha), Math.cos(delta) * Math.sin(alpha), Math.sin(delta))
  const east = new Vector3(-Math.sin(alpha), Math.cos(alpha), 0)
  const north = new Vector3(-Math.sin(delta) * Math.cos(alpha), -Math.sin(delta) * Math.sin(alpha), Math.cos(delta))
  const scale = 4.74047 / raw.parallax_mas
  const equatorial = east.multiplyScalar(scale * raw.pm_ra_cosdec_masyr)
    .add(north.multiplyScalar(scale * raw.pm_dec_masyr))
  if (includeRadial) {
    if (raw.radial_velocity_kms === null || !Number.isFinite(raw.radial_velocity_kms)) return null
    equatorial.add(radial.multiplyScalar(raw.radial_velocity_kms))
  }
  const galactic = equatorial.applyMatrix3(ICRS_TO_GALACTIC)
  return galacticVelocityToWorld({ vx_kms: galactic.x, vy_kms: galactic.y, vz_kms: galactic.z })
}

export function displayMotionForStar(
  star: Pick<Star, 'id' | 'vx_kms' | 'vy_kms' | 'vz_kms' | 'raw_astrometry'>,
  frame: MotionFrame = 'galactic',
): DisplayMotion | null {
  const hasStoredMotion = [star.vx_kms, star.vy_kms, star.vz_kms]
    .every((value) => value !== null && Number.isFinite(value))
  if (hasStoredMotion) {
    const stored = frame === 'galactic' ? galactocentricVelocityToWorld(star) : galacticVelocityToWorld(star)
    return stored ? { velocity: stored, mode: 'full' } : null
  }
  const raw = star.raw_astrometry
  if (!raw) return null
  const velocity = rawAstrometryVelocityToWorld(raw)
  if (!velocity) return null
  if (raw.radial_velocity_kms === null || frame === 'solar') return { velocity, mode: raw.radial_velocity_kms === null ? 'transverse' : 'full' }
  const solar = galacticVelocityToWorld(SOLAR_GALACTIC_VELOCITY_KMS)
  if (!solar) return null
  velocity.add(solar)
  return velocity.lengthSq() === 0 ? null : { velocity, mode: 'full' }
}

export function sunRelativeMetrics(star: Position, sun: Position) {
  const offsetX = star.x_pc - sun.x_pc
  const offsetY = star.y_pc - sun.y_pc
  const heightPc = star.z_pc - sun.z_pc
  const distancePc = Math.hypot(offsetX, offsetY, heightPc)
  const planeDistancePc = Math.hypot(offsetX, offsetY)
  const side = Math.abs(heightPc) < 1e-9 ? 'on' : heightPc > 0 ? 'above' : 'below'
  return { distancePc, distanceLy: distancePc * LIGHT_YEARS_PER_PARSEC, planeDistancePc, heightPc, side }
}

const TEMPERATURE_COLORS = [
  { kelvin: 250, color: 0xff3d22 },
  { kelvin: 600, color: 0xff4c29 },
  { kelvin: 1000, color: 0xff6038 },
  { kelvin: 3000, color: 0xffac63 },
  { kelvin: 5772, color: 0xffe6bc },
  { kelvin: 7000, color: 0xeff3ff },
  { kelvin: 9845, color: 0xbad6ff },
  { kelvin: 20000, color: 0x94b5ff },
  { kelvin: 40000, color: 0x82a8ff },
] as const

const BROWN_DWARF_COLORS = [
  { kelvin: 250, color: 0xa06a48 },
  { kelvin: 1300, color: 0xbd7b48 },
  { kelvin: 2400, color: 0xd9985f },
] as const

// Color-only stand-ins for blank brown dwarf temperatures; never shown as data.
const BROWN_DWARF_CLASS_KELVIN = { M: 2400, L: 1800, T: 1000, Y: 350 } as const
const STAR_CLASS_KELVIN = { O: 30000, B: 15000, A: 8500, F: 6500, G: 5500, K: 4500, M: 3500 } as const

function interpolateColor(stops: readonly { kelvin: number; color: number }[], kelvin: number): Color {
  if (kelvin <= stops[0]!.kelvin) return new Color(stops[0]!.color)
  for (let index = 1; index < stops.length; index++) {
    const lower = stops[index - 1]!
    const upper = stops[index]!
    if (kelvin <= upper.kelvin) {
      const fraction = (kelvin - lower.kelvin) / (upper.kelvin - lower.kelvin)
      return new Color(lower.color).lerp(new Color(upper.color), fraction)
    }
  }
  return new Color(stops.at(-1)!.color)
}

export function temperatureToColor(kelvin: number | null): Color {
  if (kelvin === null) return new Color(0xb8b8b8)
  if (!Number.isFinite(kelvin) || kelvin <= 0) throw new RangeError('Temperature must be positive and finite.')
  return interpolateColor(TEMPERATURE_COLORS, kelvin)
}

export function starDisplayColor(star: Pick<Star, 'type' | 'temperature_k' | 'spectral_type'>): Color {
  if (star.type !== 'brown_dwarf' && star.type !== 'sub_brown_dwarf') {
    const spectralClass = star.type === 'star' ? star.spectral_type?.match(/([OBAFGKM])/)?.[1] as keyof typeof STAR_CLASS_KELVIN | undefined : undefined
    return temperatureToColor(star.temperature_k ?? (spectralClass ? STAR_CLASS_KELVIN[spectralClass] : null))
  }
  const temperature = star.temperature_k
  if (temperature !== null && Number.isFinite(temperature) && temperature > 0) return interpolateColor(BROWN_DWARF_COLORS, temperature)
  const spectralClass = star.spectral_type?.match(/([MLTY])\d/)?.[1] as keyof typeof BROWN_DWARF_CLASS_KELVIN | undefined
  return interpolateColor(BROWN_DWARF_COLORS, spectralClass ? BROWN_DWARF_CLASS_KELVIN[spectralClass] : 1300)
}
