import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model.ts'
import { massComparisonClass } from './mass-classification.ts'

// IAU 2015 B3 nominal luminosity/radius and IAU 2012 B2 AU.
export const SOLAR_LUMINOSITY_W = 3.828e26
export const AU_METERS = 149_597_870_700
const SOLAR_RADIUS_METERS = 695_700_000
const SOLAR_SURFACE_AREA_M2 = 4 * Math.PI * SOLAR_RADIUS_METERS ** 2
const SOLAR_SURFACE_FLUX = SOLAR_LUMINOSITY_W / SOLAR_SURFACE_AREA_M2
export const SOLAR_FLUX_AT_AU = SOLAR_LUMINOSITY_W / (4 * Math.PI * AU_METERS ** 2)

export const positiveMeasurement = (value: number | null): value is number => value !== null && Number.isFinite(value) && value > 0

type LuminosityStar = Pick<Star, 'type' | 'luminosity_solar' | 'radius_solar' | 'temperature_k'>
export function luminosityCardAvailable(star: LuminosityStar): boolean {
  return STELLAR_OBJECT_TYPES.some((type) => type === star.type) && positiveMeasurement(star.luminosity_solar)
}

export function luminosityProperties(star: LuminosityStar) {
  const stellar = STELLAR_OBJECT_TYPES.some((type) => type === star.type)
  const areaM2 = stellar && positiveMeasurement(star.radius_solar) ? 4 * Math.PI * (star.radius_solar * SOLAR_RADIUS_METERS) ** 2 : null
  const catalogSolar = luminosityCardAvailable(star) ? star.luminosity_solar! : null
  const catalogWatts = catalogSolar === null ? null : catalogSolar * SOLAR_LUMINOSITY_W
  // Decompose the adopted luminosity; a separately sourced temperature may disagree.
  const surfaceFlux = areaM2 !== null && catalogWatts !== null ? catalogWatts / areaM2 : null
  return {
    areaM2, surfaceFlux, catalogSolar, catalogWatts,
    areaSolar: areaM2 === null ? null : areaM2 / SOLAR_SURFACE_AREA_M2,
    surfaceFluxSolar: surfaceFlux === null ? null : surfaceFlux / SOLAR_SURFACE_FLUX,
  }
}

/** Exterior, unobscured irradiance; equal total flux does not imply equal climate. */
export function equalFluxDistance(selected: LuminosityStar, origin: LuminosityStar): { distanceAu: number | null; insidePhotosphere: boolean } {
  if (!luminosityCardAvailable(selected) || !luminosityCardAvailable(origin)) return { distanceAu: null, insidePhotosphere: false }
  const distanceAu = Math.sqrt(selected.luminosity_solar! / origin.luminosity_solar!)
  const insidePhotosphere = positiveMeasurement(selected.radius_solar) && distanceAu * AU_METERS <= selected.radius_solar * SOLAR_RADIUS_METERS
  return { distanceAu, insidePhotosphere }
}

export function originFluxAtAu(origin: LuminosityStar): number | null {
  if (!luminosityCardAvailable(origin)) return null
  if (positiveMeasurement(origin.radius_solar) && origin.radius_solar * SOLAR_RADIUS_METERS >= AU_METERS) return null
  return origin.luminosity_solar! * SOLAR_FLUX_AT_AU
}

/** Broad spectral family AND explicit evolutionary class; no dwarf inference. */
export function luminosityComparisonClass(star: Pick<Star, 'type' | 'spectral_type'>): { key: string; label: string; letter: string | null; stage: string | null } | null {
  if (star.type === 'star') {
    let spectral_type = star.spectral_type?.replace(/^[OBAFGKM]\d(?:\.\d+)?m([OBAFGKM]\d(?:\.\d+)?)/i, '$1') ?? null
    // Same-family subtype intervals still identify a broad family.
    spectral_type = spectral_type?.replace(/^([OBAFGKM])(\d(?:\.\d+)?)[-/–]\1?(\d(?:\.\d+)?)/i, '$1$2') ?? null
    const classification = massComparisonClass({ ...star, spectral_type })
    if (!classification?.letter || classification.assumedStage) return null
    return { key: classification.key, label: classification.label, letter: classification.letter, stage: classification.stage }
  }
  if (star.type === 'white_dwarf') {
    const family = star.spectral_type?.trim().match(/^D([ABCOQZX])[ABCOQZXHPEV]*(?:\d+(?:\.\d+)?)?(?:[?:]|pec)?$/i)?.[1]?.toUpperCase()
    return family ? { key: `D${family}`, label: `D${family} white dwarf`, letter: null, stage: null } : null
  }
  if (star.type === 'brown_dwarf' || star.type === 'sub_brown_dwarf') {
    const family = star.spectral_type?.trim().match(/^([MLTY])\d(?:\.\d+)?(?:\+\/-\d+(?:\.\d+)?)?(?:[?:]|pec)?$/i)?.[1]?.toUpperCase()
    return family ? { key: `${star.type}:${family}`, label: `${family}-type ${star.type === 'brown_dwarf' ? 'brown dwarf' : 'sub-brown dwarf'}`, letter: null, stage: null } : null
  }
  return null
}

export interface CatalogLuminosityClass {
  key: string; label: string; low: number; high: number; count: number
  median: number; p10: number; p90: number
}
export function buildLuminosityClassReferences(stars: readonly Star[]): CatalogLuminosityClass[] {
  const groups = new Map<string, { key: string; label: string; values: number[] }>()
  for (const star of stars) {
    const classification = luminosityComparisonClass(star)
    if (!classification || !luminosityCardAvailable(star)) continue
    const value = star.luminosity_solar!
    const group = groups.get(classification.key)
    if (group) group.values.push(value)
    else groups.set(classification.key, { key: classification.key, label: classification.label, values: [value] })
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).map(({ key, label, values }) => {
    values.sort((a, b) => a - b)
    const percentile = (fraction: number) => {
      const index = (values.length - 1) * fraction
      const lower = values[Math.floor(index)]!
      return lower + (values[Math.ceil(index)]! - lower) * (index % 1)
    }
    return { key, label, low: values[0]!, high: values.at(-1)!, count: values.length,
      median: percentile(0.5), p10: percentile(0.1), p90: percentile(0.9) }
  })
}
