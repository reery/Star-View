import type { MassMetric, MassRange } from './mass-classification.ts'

/** `null` means an unknown or mixed atmosphere: both envelopes apply. */
export type WhiteDwarfEnvelope = 'thick' | 'thin' | null
export type WhiteDwarfSurfaceMetric = Exclude<MassMetric, 'mass'>
export interface WhiteDwarfMetric { value: number | null; range: MassRange | null }
export interface WhiteDwarfReference {
  /** Whether the 0.6 M☉ track covers the temperature, giving single surface benchmark values. */
  benchmark: boolean
  metrics: Record<WhiteDwarfSurfaceMetric, WhiteDwarfMetric>
}
export type WhiteDwarfReferenceResolver = (envelope: WhiteDwarfEnvelope, temperature: number | null) => WhiteDwarfReference | undefined

export const WHITE_DWARF_SURFACE_METRICS: readonly WhiteDwarfSurfaceMetric[] = ['gravity', 'escapeKms', 'density', 'luminosityPerMass']

export function whiteDwarfEnvelope(spectralType: string | null | undefined): WhiteDwarfEnvelope {
  const spectral = spectralType?.trim().toUpperCase() ?? ''
  return /[+/]/.test(spectral) ? null : /^DA(?![BOQ])/.test(spectral) ? 'thick'
    : /^D(?:B(?!A)|O(?!A)|Q(?!A)|Z)/.test(spectral) ? 'thin' : null
}

export function whiteDwarfTemperature(temperature: number | null | undefined): number | null {
  return temperature !== null && temperature !== undefined && Number.isFinite(temperature) && temperature > 0 ? temperature : null
}

export function whiteDwarfReferenceKey(envelope: WhiteDwarfEnvelope, temperature: number | null): string {
  return `${envelope ?? 'mixed'}:${temperature ?? 'none'}`
}

type WhiteDwarfInput = { type: string; spectral_type: string | null; temperature_k: number | null }

/** Every envelope/temperature combination the given objects request, plus each envelope without a temperature. */
export function requiredWhiteDwarfReferences(stars: Iterable<WhiteDwarfInput>): Map<string, [WhiteDwarfEnvelope, number | null]> {
  const inputs = new Map<string, [WhiteDwarfEnvelope, number | null]>()
  for (const envelope of ['thick', 'thin', null] as const) inputs.set(whiteDwarfReferenceKey(envelope, null), [envelope, null])
  for (const star of stars) {
    if (star.type !== 'white_dwarf') continue
    const envelope = whiteDwarfEnvelope(star.spectral_type)
    const temperature = whiteDwarfTemperature(star.temperature_k)
    inputs.set(whiteDwarfReferenceKey(envelope, temperature), [envelope, temperature])
  }
  return new Map([...inputs].sort(([first], [second]) => first.localeCompare(second)))
}
