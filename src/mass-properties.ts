import { isCompactObject, type Star } from './catalog-model.ts'

// IAU 2015 B3 nominal GM and radius: https://arxiv.org/abs/1510.07674
const SOLAR_GM = 1.3271244e20
const SOLAR_RADIUS_M = 695_700_000
const EARTH_GM = 3.986004e14
const G = 6.67430e-11 // CODATA 2022, m³ kg⁻¹ s⁻²
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
  }
}

export function massEvolution(star: Star): { description: string; outcome: string; comment: string } {
  // Broad single-star guidance: https://science.nasa.gov/universe/stars/types/
  const mass = positive(star.mass_solar)
  if (star.type === 'white_dwarf') return {
    description: 'This is a stellar remnant. Its light mainly comes from stored heat, rather than sustained core fusion; luminosity per unit mass describes its present cooling state.',
    outcome: 'Cooling white dwarf',
    comment: 'Already a white dwarf. Its present mass is the surviving core’s mass, not the original star’s birth mass. Accretion or a merger can change its future.',
  }
  if (star.type === 'brown_dwarf' || star.type === 'sub_brown_dwarf') return {
    description: 'This substellar object cannot sustain hydrogen fusion like a main-sequence star. It gradually cools and fades; some brown dwarfs briefly fuse deuterium.',
    outcome: 'Continued cooling and fading',
    comment: 'The approximate 0.08 M☉ hydrogen-burning limit depends on composition. Luminosity here reflects cooling and any temporary fusion, rather than a steady stellar fuel supply.',
  }
  if (isCompactObject(star)) return {
    description: 'This is a compact remnant. Present mass does not describe its progenitor’s fusion rate; any observed light can come from cooling, rotation, or accretion.',
    outcome: star.type === 'black_hole' ? 'Black hole remnant' : 'Neutron star remnant',
    comment: `${star.compact?.confidence === 'candidate' ? 'Candidate classification. ' : ''}The current mass is a remnant mass. Accretion, interactions, and mergers can change its later evolution.`,
  }
  const mainSequence = /\d(?:\.\d+)?\s*V(?!I)/i.test(star.spectral_type ?? '')
  const description = mainSequence
    ? 'Mass is a star’s evolutionary accelerator. On the main sequence, more mass generally creates higher central pressure and temperature, accelerating fusion disproportionately.'
    : 'Mass strongly shapes stellar evolution. Higher birth mass generally accelerates fusion, but current luminosity also depends on evolutionary stage, composition, and mass loss.'
  if (mass === null) return { description, outcome: 'End state unknown', comment: 'No catalog mass is available to suggest an evolutionary path.' }
  if (mass < 0.08) return { description, outcome: 'Hydrogen-burning status uncertain', comment: 'The catalog mass lies below the approximate hydrogen-burning limit. Mass uncertainty and composition matter near this boundary.' }
  if (mass >= 6 && mass <= 10) return { description, outcome: 'White dwarf or core collapse', comment: 'Near the approximate 8 M☉ initial-mass boundary, composition, mass loss, and binary interactions can change the outcome.' }
  if (mass > 10) return { description, outcome: 'Neutron star or black hole', comment: 'Core collapse is favored for a star this massive. The remaining core, mass loss, and binary history determine which remnant forms.' }
  return {
    description,
    outcome: mainSequence ? 'White dwarf' : 'White dwarf possible',
    comment: mainSequence
      ? `A ~${mass.toLocaleString('en-US', { maximumSignificantDigits: 2 })} M☉ star is below the approximate initial-mass range normally associated with core-collapse supernovae.${mass < 0.5 ? ' Low-mass stars can take far longer than the present age of the Universe to reach this stage.' : ''}`
      : 'A low or intermediate birth mass usually leads to a white dwarf. This catalog gives current mass; an evolved or stripped star may have started much heavier.',
  }
}

export function massGravityContext(star: Star): string {
  const { mass, radius, gravityRatio } = massProperties(star)
  if (star.type === 'black_hole') return 'A black hole has an event horizon, not a photosphere. Ordinary surface gravity, escape velocity, and mean stellar density comparisons do not apply.'
  if (isCompactObject(star)) return 'Neutron-star surface gravity and escape require a radius and a relativistic model. No ordinary photosphere comparison is shown.'
  if (mass === null || radius === null || gravityRatio === null) return 'Both catalog mass and radius are needed to derive photosphere gravity, surface escape velocity, and mean density.'
  if (star.id === 'sun') return 'The Sun sets the reference: photosphere gravity depends on mass divided by radius squared.'
  const size = radius.toLocaleString('en-US', { maximumFractionDigits: 3 })
  if (mass > 1 && gravityRatio < 1) return `More massive but weaker surface gravity, because ${star.name} is also ${size}× as wide as the Sun. Gravity decreases with radius squared.`
  if (mass < 1 && gravityRatio > 1) return `Less massive but stronger surface gravity: ${star.name} has only ${size}× the Sun’s radius, concentrating its gravity at a smaller surface.`
  return `${star.name} has ${gravityRatio === 1 ? 'the same' : gravityRatio > 1 ? 'stronger' : 'weaker'} surface gravity than the Sun. Its radius is ${size} R☉; surface gravity scales as mass ÷ radius².`
}

export function solarBarScale(ratio: number): { position: number; low: number; high: number } {
  const decades = Math.max(1, Math.ceil(Math.abs(Math.log10(ratio > 0 ? ratio : 1))))
  return { position: ratio <= 0 ? 0 : (Math.log10(ratio) + decades) / (2 * decades) * 100, low: 10 ** -decades, high: 10 ** decades }
}
