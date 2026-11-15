import type { Star } from './catalog-model'

export const TEMPERATURE_MIN_K = 2400
export const TEMPERATURE_MAX_K = 30000
export const WIEN_NM_K = 2.897771955e6
export const SOLAR_TEMPERATURE_K = 5772

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
