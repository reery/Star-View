import { OBJECT_TYPES, type Star } from './catalog-model'
import type { CatalogManifest } from './catalog-manifest'

export interface CatalogDefinition {
  manifest: CatalogManifest
  load(): Promise<Star[]>
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
  return () => cached ??= loadUrl().then((resolvedUrl) => fetcher(resolvedUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Could not load ${manifest.label} (${response.status}).`)
      return parseCatalogPayload(await response.json(), manifest)
    }))
}

export function catalogSelection(stars: readonly Star[], selectedId: string | null, observerId: string) {
  return {
    selectedId: stars.some((star) => star.id === selectedId) ? selectedId : null,
    observerId: stars.some((star) => star.id === observerId) ? observerId : 'sun',
  }
}