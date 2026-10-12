import type { Star } from './catalog-model'

export interface HabitableZone {
  readonly innerAu: number
  readonly outerAu: number
}

// Kopparapu et al. (2014), conservative limits for a 1 Earth-mass planet:
// runaway greenhouse (inner) and maximum greenhouse (outer).
// https://personal.ems.psu.edu/~jfk4/ruk15/planets/HZ_coefficients.dat
// S_eff = S_sun + a*T + b*T² + c*T³ + d*T⁴, T = T_eff - 5780 K.
// d = sqrt((L/L_sun) / S_eff) AU. Valid for T_eff = 2600–7200 K.
const INNER = [1.107, 1.332e-4, 1.58e-8, -8.308e-12, -1.931e-15] as const
const OUTER = [0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16] as const

export function habitableZoneForStar(star: Pick<Star, 'luminosity_solar' | 'temperature_k'>): HabitableZone | null {
  const luminosity = star.luminosity_solar
  const temperature = star.temperature_k
  if (luminosity === null || !Number.isFinite(luminosity) || luminosity <= 0
    || temperature === null || !Number.isFinite(temperature) || temperature < 2600 || temperature > 7200) return null
  const t = temperature - 5780
  const flux = ([s, a, b, c, d]: readonly [number, number, number, number, number]) => s + t * (a + t * (b + t * (c + t * d)))
  const innerAu = Math.sqrt(luminosity / flux(INNER))
  const outerAu = Math.sqrt(luminosity / flux(OUTER))
  if (!Number.isFinite(innerAu) || !Number.isFinite(outerAu) || innerAu <= 0 || outerAu <= innerAu) return null
  return { innerAu, outerAu }
}
