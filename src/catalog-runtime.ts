import { OBJECT_TYPES, type Star } from './catalog-model'
import type { CatalogManifest } from './catalog-manifest'

export { catalogSelection } from './catalog-selection'

export interface CatalogDefinition {
  manifest: CatalogManifest
  load(): Promise<Star[]>
}

const OVERLAY_PHYSICAL_FIELDS = [
  'temperature_k', 'mass_solar', 'luminosity_solar', 'radius_solar', 'metallicity_dex', 'age_gyr',
] as const

function supplementPhysicalFields(primary: Star, additional: Star): Star {
  const supplemented = { ...primary }
  const fields = OVERLAY_PHYSICAL_FIELDS.filter((field) => primary[field] === null && additional[field] !== null)
  for (const field of fields) supplemented[field] = additional[field]
  if (fields.length) {
    supplemented.notes = `${primary.notes} Bright-star overlay supplements ${fields.join(', ')}. ${additional.notes}`.trim()
  }
  return supplemented
}

export function mergeCatalogStars(primary: readonly Star[], additional: readonly Star[]): Star[] {
  const merged = [...primary]
  for (const star of additional) {
    const duplicate = merged.findIndex((candidate) => candidate.id === star.id ||
      Math.hypot(candidate.x_pc - star.x_pc, candidate.y_pc - star.y_pc, candidate.z_pc - star.z_pc) < 0.01)
    if (duplicate >= 0) {
      merged[duplicate] = supplementPhysicalFields(merged[duplicate]!, star)
      continue
    }
    merged.push(star)
  }
  return merged
}

export function parseCatalogPayload(value: unknown, manifest: CatalogManifest): Star[] {
  if (!value || typeof value !== 'object') throw new Error('Catalog payload must be an object.')
  const payload = value as Record<string, unknown>
  if (payload.schemaVersion !== 1 || payload.catalogId !== manifest.id || !Array.isArray(payload.stars)) {
    throw new Error(`Invalid catalog payload: ${manifest.id}`)
  }
  const stars = payload.stars as Record<string, unknown>[]
  if (stars.length !== manifest.objectCount) throw new Error('Catalog objectCount does not match payload rows.')
  const ids = new Set<string>()
  for (const star of stars) {
    if (!star || typeof star !== 'object' || typeof star.id !== 'string' || !star.id || ids.has(star.id) ||
      typeof star.name !== 'string' || !star.name || typeof star.type !== 'string' || !OBJECT_TYPES.includes(star.type as never) ||
      !['x_pc', 'y_pc', 'z_pc', 'epoch'].every((field) => typeof star[field] === 'number' && Number.isFinite(star[field]))) {
      throw new Error(`Invalid catalog payload row: ${manifest.id}`)
    }
    ids.add(star.id)
    if (star.epoch !== manifest.epoch) throw new Error('Catalog manifest epoch does not match payload.')
  }
  if (!ids.has('sun')) throw new Error('Catalog payload requires the Sun reference.')
  return stars as unknown as Star[]
}

export function catalogLoader(manifest: CatalogManifest, url: string | (() => Promise<string>), fetcher: typeof fetch = fetch): () => Promise<Star[]> {
  let cached: Promise<Star[]> | undefined
  const loadUrl = typeof url === 'string' ? () => Promise.resolve(url) : url
  return () => cached ??= (async () => {
    const response = await fetcher(await loadUrl())
    if (!response.ok) throw new Error(`Could not load ${manifest.label} (${response.status}).`)
    return parseCatalogPayload(await response.json(), manifest)
  })()
}
