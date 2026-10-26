import { isCompactObject, type Star } from './catalog-model.ts'
import { massComparisonClass } from './mass-classification.ts'
import { SOLAR_RADIUS_METERS as SOLAR_RADIUS_M } from './luminosity-properties.ts'

// IAU 2015 B3 nominal GM: https://arxiv.org/abs/1510.07674
const SOLAR_GM = 1.3271244e20
const EARTH_GM = 3.986004e14
const G = 6.67430e-11 // CODATA 2022, m³ kg⁻¹ s⁻²
const LIGHT_SPEED = 299792458
// IAU 2015 B3 nominal Jupiter GM divided by nominal solar GM.
export const JUPITER_MASS_SOLAR = 1.2668653e17 / SOLAR_GM
export const EARTH_MASS_SOLAR = EARTH_GM / SOLAR_GM
const SOLAR_GRAVITY = SOLAR_GM / SOLAR_RADIUS_M ** 2
const SOLAR_ESCAPE_KMS = Math.sqrt(2 * SOLAR_GM / SOLAR_RADIUS_M) / 1000
const SOLAR_DENSITY = (SOLAR_GM / G) / (4 * Math.PI * SOLAR_RADIUS_M ** 3 / 3) / 1000

export function massCardAvailable(star: Star): boolean {
  return ['star', 'white_dwarf', 'brown_dwarf', 'sub_brown_dwarf', 'neutron_star', 'pulsar', 'black_hole'].includes(star.type)
}

function positive(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null
}

export function massProperties(star: Pick<Star, 'type' | 'mass_solar' | 'radius_solar' | 'luminosity_solar'>) {
  const mass = positive(star.mass_solar)
  // A horizon is not a photosphere; neutron-star surfaces require relativistic models.
  const radius = isCompactObject(star) ? null : positive(star.radius_solar)
  const luminosity = star.luminosity_solar !== null && Number.isFinite(star.luminosity_solar) && star.luminosity_solar >= 0 ? star.luminosity_solar : null
  const gravityRatio = mass === null || radius === null ? null : mass / radius ** 2
  const escapeRatio = mass === null || radius === null ? null : Math.sqrt(mass / radius)
  const densityRatio = mass === null || radius === null ? null : mass / radius ** 3
  const gm = mass === null ? null : mass * SOLAR_GM
  return {
    mass, radius, luminosity,
    kilograms: gm === null ? null : gm / G,
    earthMasses: gm === null ? null : gm / EARTH_GM,
    gravityRatio, gravity: gravityRatio === null ? null : gravityRatio * SOLAR_GRAVITY,
    escapeRatio, escapeKms: escapeRatio === null ? null : escapeRatio * SOLAR_ESCAPE_KMS,
    densityRatio, density: densityRatio === null ? null : densityRatio * SOLAR_DENSITY,
    luminosityPerMass: mass === null || luminosity === null ? null : luminosity / mass,
    // Non-rotating (Schwarzschild) horizon radius.
    horizonKm: star.type !== 'black_hole' || gm === null ? null : 2 * gm / LIGHT_SPEED ** 2 / 1000,
  }
}

export type MassFuel =
  | { kind: 'lifetime'; gyr: number; lowerBound: boolean }
  | { kind: 'burn-rate'; ratio: number; reason: string }
  | { kind: 'density'; density: number | null; reason: string }
  | { kind: 'no-fusion'; label: string; reason: string }
  | { kind: 'unavailable'; reason: string }

/** Main-sequence fuel lifetime, or why it does not apply and what the card shows instead. */
export function massFuel(star: Star): MassFuel {
  const { mass, luminosity, luminosityPerMass, density } = massProperties(star)
  if (star.type === 'white_dwarf') return { kind: 'density', density, reason: density === null ? 'No fuel left; it shines by stored heat. Catalog radius needed for density.' : 'No fuel left; it shines by stored heat.' }
  if (star.type === 'brown_dwarf' || star.type === 'sub_brown_dwarf') {
    // Deuterium burning starts near 13 Jupiter masses: https://arxiv.org/abs/1008.5150
    const deuterium = mass !== null && mass >= 13 * JUPITER_MASS_SOLAR
    return deuterium ? { kind: 'no-fusion', label: 'Deuterium only', reason: 'Too light to fuse hydrogen; brief deuterium fusion, then it cools and fades.' }
      : { kind: 'no-fusion', label: 'None', reason: mass === null ? 'Too light to fuse hydrogen; it cools and fades.' : 'Too light for any fusion; it cools from its formation heat.' }
  }
  if (star.type === 'black_hole') return { kind: 'no-fusion', label: 'None', reason: 'A remnant: any glow comes from infalling matter.' }
  if (isCompactObject(star)) return { kind: 'no-fusion', label: 'None', reason: 'A remnant: light comes from cooling, rotation or accretion.' }
  const classification = massComparisonClass(star)
  // An explicit V or VI class; annotated stages such as A0mA1Va keep their stated V.
  const mainSequence = (classification?.stage === 'V' || classification?.stage === 'VI')
    && (!classification.assumedStage || /\d(?:\.\d+)?\s*V(?!I)/i.test(star.spectral_type ?? ''))
  const reason = mainSequence ? '' : classification === null ? 'Evolutionary stage unknown; no lifetime estimate.'
    : classification.assumedStage ? 'Luminosity class unknown; no lifetime estimate.'
      : 'Left the main sequence: its lifetime estimate no longer applies.'
  if (luminosityPerMass === null || luminosityPerMass <= 0) return { kind: 'unavailable', reason: mass === null ? 'Catalog mass needed.' : luminosity === null ? 'Catalog luminosity needed.' : 'No measurable luminosity.' }
  // Fuel scales with mass and consumption with luminosity, calibrated to the Sun's ~10 Gyr.
  // Fully convective dwarfs burn almost all of their hydrogen, so the estimate is a lower bound.
  if (mainSequence) return { kind: 'lifetime', gyr: 10 / luminosityPerMass, lowerBound: mass! < 0.35 }
  return { kind: 'burn-rate', ratio: luminosityPerMass, reason }
}

export function solarBarScale(ratio: number): { position: number; low: number; high: number } {
  const decades = Math.max(1, Math.ceil(Math.abs(Math.log10(ratio > 0 ? ratio : 1))))
  return { position: ratio <= 0 ? 0 : (Math.log10(ratio) + decades) / (2 * decades) * 100, low: 10 ** -decades, high: 10 ** decades }
}
