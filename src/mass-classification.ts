import { objectTypeLabel, type Star } from './catalog-model.ts'

export const MASS_METRICS = ['mass', 'gravity', 'escapeKms', 'density', 'luminosityPerMass'] as const
export type MassMetric = typeof MASS_METRICS[number]
export type MassRange = readonly [number, number]

export function typicalMassRangePosition(value: number | null, [rangeLow, rangeHigh]: MassRange, typical: number | null = null) {
  // Keep the published range intact and extend the logarithmic axis for outliers.
  // Zero luminosity cannot be placed on a log axis; reserve a decade below the guide.
  const pointRange = rangeLow === rangeHigh
  const domainLow = rangeLow <= 0 ? rangeHigh > 0 ? rangeHigh / 10 : 0.1 : pointRange ? rangeLow / Math.sqrt(10) : rangeLow
  const domainHigh = rangeHigh <= 0 ? 1 : pointRange ? rangeHigh * Math.sqrt(10) : rangeHigh
  const low = value === null ? domainLow : Math.min(domainLow, value > 0 ? value : domainLow / 10)
  const high = value === null ? domainHigh : Math.max(domainHigh, value)
  const position = (entry: number) => entry <= 0 ? 0 : Math.log(entry / low) / Math.log(high / low) * 100
  return {
    low, high,
    position: value === null ? null : position(value),
    rangeLowPosition: position(rangeLow),
    rangeHighPosition: position(rangeHigh),
    typicalPosition: typical === null ? null : position(typical),
  }
}

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
