import type { Star } from './catalog-model'
import { typicalMassRangePosition } from './mass-classification'
import { JUPITER_RADIUS_KM, SOLAR_RADIUS_KM } from './radius-comparison'

export interface TypicalRadiusRange {
  label: string
  low: number
  high: number
  unit: string
  radiusKmPerUnit: number
  note: string
  source: string
  sourceLabel: string
}

const dwarfSource = 'https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt'
// Rounded envelopes of the mean radii for each spectral class in Mamajek's
// dwarf sequence (2021.03.02). These are guides, not population percentiles.
const mainSequenceRanges: Record<string, [number, number]> = {
  O: [7.5, 13.5], B: [2.4, 7.2], A: [1.7, 2.2], F: [1.1, 1.8],
  G: [0.85, 1.1], K: [0.6, 0.85], M: [0.1, 0.6],
}

export function typicalRadiusRange(star: Pick<Star, 'type' | 'spectral_type'>): TypicalRadiusRange | null {
  const solarRange = (label: string, low: number, high: number, note: string, source: string, sourceLabel: string): TypicalRadiusRange =>
    ({ label, low, high, unit: 'R☉', radiusKmPerUnit: SOLAR_RADIUS_KM, note, source, sourceLabel })
  if (star.type === 'white_dwarf') return solarRange('White dwarf', 0.005, 0.02,
    'Broad white dwarf range; more massive white dwarfs are generally smaller. Temperature and composition also affect radius.',
    'https://www.astro.bas.bg/~rz/AFinBS/pap/2026.AF.LectureNotes.pdf', 'White dwarf radii: astronomical lecture notes')
  if (star.type === 'brown_dwarf' || star.type === 'sub_brown_dwarf') return {
    label: star.type === 'brown_dwarf' ? 'Brown dwarf' : 'Sub-brown dwarf',
    low: 0.8, high: 1.5, unit: 'R♃', radiusKmPerUnit: JUPITER_RADIUS_KM,
    note: 'Guide for mature substellar objects, based on brown dwarf radii. Young objects can be much larger; age and irradiation matter. For sub-brown dwarfs this is a mature Jovian-size comparison, not a universal class range.',
    source: 'https://arxiv.org/abs/2503.05115', sourceLabel: 'Brown dwarf sizes: Zhang et al.',
  }
  if (star.type !== 'star') return null
  // Require a luminosity class: color alone does not distinguish a dwarf from a giant.
  const spectral = star.spectral_type?.trim().match(/^([OBAFGKM])\d(?:\.\d+)?\s*(III|II|IV|VI|V|I)(?=$|[^IV])/i)
  if (!spectral) return null
  const letter = spectral[1]!.toUpperCase()
  const luminosityClass = spectral[2]!.toUpperCase()
  if (luminosityClass === 'V') {
    const [low, high] = mainSequenceRanges[letter]!
    return solarRange(`${letter}-type main-sequence star`, low, high,
      'Approximate range across this spectral class from the mean dwarf sequence. Evolution, composition and rotation can shift an individual radius.',
      dwarfSource, 'Main-sequence sizes: Pecaut & Mamajek')
  }
  // Broad, illustrative H–R diagram envelopes for evolved classes. Do not
  // interpret their midpoint as a measured mean or their bounds as hard limits.
  if (luminosityClass === 'IV') return solarRange('Subgiant', 1.5, 10,
    'Broad guide for expanded stars leaving the main sequence; the range depends strongly on mass and evolutionary stage.',
    'https://courses.ems.psu.edu/astro801/content/l6_p2.html', 'Stellar expansion: Penn State astronomy')
  if (luminosityClass === 'III' || luminosityClass === 'II') return solarRange(
    luminosityClass === 'II' ? 'Bright giant' : 'Giant', 5, 200,
    'Illustrative giant-star range. Hot giants can be smaller, and cool evolved giants can exceed the upper end.',
    'https://astronomy.nmsu.edu/geas/lectures/lecture23/hr22.html', 'Stellar size ranges: NMSU astronomy')
  if (luminosityClass === 'I') return solarRange('Supergiant', 20, 1500,
    'Illustrative supergiant range spanning compact hot stars and extended cool stars. Some objects lie outside it.',
    'https://sites.uni.edu/morgans/astro/course/Notes/section2/new9.html', 'Supergiant sizes: UNI astronomy')
  return null
}

export function typicalRadiusPosition(radiusKm: number, range: TypicalRadiusRange) {
  return typicalMassRangePosition(radiusKm / range.radiusKmPerUnit,
    [range.low, range.high], Math.sqrt(range.low * range.high))
}
