import type { Star } from './catalog-model'
import { mkPoint } from './mk-properties'

export const TEMPERATURE_MIN_K = 2400
export const TEMPERATURE_MAX_K = 30000
export const WIEN_NM_K = 2.897771955e6
export const SOLAR_TEMPERATURE_K = 5772

type TemperatureStar = Pick<Star, 'type' | 'temperature_k' | 'spectral_type' | 'mass_solar'>

export function temperatureCardAvailable(star: Pick<Star, 'type' | 'temperature_k'>): boolean {
  return ['star', 'white_dwarf', 'brown_dwarf', 'sub_brown_dwarf'].includes(star.type)
    && star.temperature_k !== null && Number.isFinite(star.temperature_k) && star.temperature_k > 0
}

export function temperaturePosition(kelvin: number): number {
  return Math.max(0, Math.min(100, Math.log(kelvin / TEMPERATURE_MIN_K) / Math.log(TEMPERATURE_MAX_K / TEMPERATURE_MIN_K) * 100))
}

export function spectrumRegion(wavelengthNm: number): 'UV' | 'visible light' | 'infrared' {
  return wavelengthNm < 380 ? 'UV' : wavelengthNm <= 780 ? 'visible light' : 'infrared'
}

// Planck Bλ normalized at its wavelength peak. Log arithmetic avoids overflow
// on the short-wavelength tail; this is emission per wavelength, not per frequency.
export function relativeSpectralEmission(wavelengthNm: number, kelvin: number): number {
  if (!(wavelengthNm > 0) || !(kelvin > 0) || !Number.isFinite(wavelengthNm + kelvin)) return 0
  const peak = WIEN_NM_K / kelvin
  const exponent = 1.438776877e7 / (wavelengthNm * kelvin)
  const peakExponent = 1.438776877e7 / WIEN_NM_K
  const logDenominator = exponent > 50 ? exponent : Math.log(Math.expm1(exponent))
  return Math.exp(5 * Math.log(peak / wavelengthNm) + Math.log(Math.expm1(peakExponent)) - logDenominator)
}

export function temperatureAppearance(kelvin: number): string {
  if (kelvin < 1000) return 'Very faint red glow'
  if (kelvin < 3700) return 'Orange-red appearance'
  if (kelvin < 5200) return 'Orange-white appearance'
  if (kelvin < 6000) return 'Warm-white appearance'
  if (kelvin < 7500) return 'White appearance'
  return kelvin < 30000 ? 'Blue-white appearance' : 'Blue appearance'
}

export function temperatureEvolution(star: TemperatureStar): { value: string; note: string } {
  if (star.type === 'white_dwarf') return { value: 'Cooling remnant', note: 'Gradually loses stored heat over time.' }
  if (star.type === 'brown_dwarf' || star.type === 'sub_brown_dwarf') return { value: 'Cools with age', note: 'No sustained hydrogen fusion in its core.' }
  const classification = mkPoint(star)
  if (classification?.luminosityClass === 'V' && star.mass_solar !== null && Number.isFinite(star.mass_solar) && star.mass_solar > 0) {
    if (star.mass_solar > 1.1) return { value: 'Usually shorter-lived', note: 'More massive main-sequence stars use fuel faster.' }
    if (star.mass_solar < 0.9) return { value: 'Usually longer-lived', note: 'Lower-mass main-sequence stars use fuel slowly.' }
    return { value: 'Sun-like fuel use', note: 'Similar-mass main-sequence stars have comparable lifetimes.' }
  }
  return { value: 'Depends on mass & stage', note: 'Surface temperature alone does not determine lifespan.' }
}
