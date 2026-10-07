import { objectTypeLabel, type Star } from './catalog-model.ts'

export const MASS_METRICS = ['mass', 'gravity', 'escapeKms', 'density', 'luminosityPerMass'] as const
export type MassMetric = typeof MASS_METRICS[number]
export type MassRange = readonly [number, number]
export function massComparisonClass(star: Pick<Star, 'type' | 'spectral_type'>) {
  if (star.type !== 'star') {
    if (!['white_dwarf', 'brown_dwarf', 'sub_brown_dwarf', 'neutron_star', 'pulsar', 'black_hole'].includes(star.type)) return null
    return { spectral: star.type, key: star.type, label: objectTypeLabel(star.type), letter: null, subtype: null, stage: null, assumedStage: false }
  }
  // Ignore chemical/rotation annotations, while retaining the stated luminosity stage.
  // Transition classes use the first subtype/stage (B2IV-V -> B2IV).
  // Composite spectra are not treated as a single spectral class.
  let spectrum = star.spectral_type?.trim() ?? ''
  if (/\+\s*(?:[OBAFGKM]\d|D[A-Z]|W[CN])/i.test(spectrum)) return null
  const subdwarf = /^sd[OBAFGKM]/i.test(spectrum)
  const dwarf = /^d[OBAFGKM]/i.test(spectrum)
  spectrum = spectrum.replace(/^sd(?=[OBAFGKM])/i, '').replace(/^d(?=[OBAFGKM])/i, '')
  // For metallic-line classifications, use the hydrogen-line subtype.
  spectrum = spectrum.replace(/^k[OBAFGKM]\d(?:\.\d+)?(?:V)?h([OBAFGKM]\d(?:\.\d+)?)(?:m[OBAFGKM]\d(?:\.\d+)?)?/i, '$1')
  const match = spectrum.match(/^([OBAFGKM])(\d(?:\.\d+)?)(?:\s*[-/]\s*[OBAFGKM]?\d(?:\.\d+)?)?[+\-:\s]*(?:\()?\s*(III|II|IV|VI|V|I)?(ab|a|b)?/i)
  if (!match) return null
  const letter = match[1]!.toUpperCase()
  const subtype = Number(match[2])
  const stage = match[3]?.toUpperCase() ?? (subdwarf ? 'VI' : 'V')
  const stages: Record<string, string> = { I: 'supergiant', II: 'bright giant', III: 'giant', IV: 'subgiant', V: 'main-sequence star', VI: 'subdwarf' }
  return { spectral: `${letter}${subtype}${stage}${match[4]?.toLowerCase() ?? ''}`, key: `${letter}${stage}`, label: `${letter}-type ${stages[stage]}`, letter, subtype, stage, assumedStage: match[3] === undefined && !subdwarf && !dwarf }
}
