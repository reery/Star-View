import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model'
import { composeCatalog, type CatalogManifest } from './catalog-manifest'
import { validDesignations } from './designations'
import { mergeCatalogStarLayers } from './catalog-merge'
import { starComponentIdentity } from './star-systems'
import { validObjectStats } from './object-stats'

export { catalogSelection } from './catalog-selection'

export interface CatalogDefinition {
  manifest: CatalogManifest
  load(): Promise<Star[]>
}

/** Use the same cross-catalog identity rules in the map and generated class statistics. */
export function mergeCatalogStars(primary: readonly Star[], additional: readonly Star[]): Star[] {
  return mergeCatalogStarLayers(primary, additional, starComponentIdentity)
}

/** An extending payload holds only additions and replacements; `base` is its parsed base catalog. */
export function parseCatalogPayload(value: unknown, manifest: CatalogManifest, base?: readonly Star[]): Star[] {
  if (!value || typeof value !== 'object') throw new Error('Catalog payload must be an object.')
  const payload = value as Record<string, unknown>
  if (![2, 3].includes(payload.schemaVersion as number) || payload.catalogId !== manifest.id || !Array.isArray(payload.stars)
    || payload.extends !== manifest.extends || Boolean(manifest.extends) !== Boolean(base)) {
    throw new Error(`Invalid catalog payload: ${manifest.id}`)
  }
  const additions = payload.stars as Record<string, unknown>[]
  const ids = new Set<string>()
  for (const star of additions) {
    if (!star || typeof star !== 'object' || typeof star.id !== 'string' || !star.id || ids.has(star.id) ||
      typeof star.name !== 'string' || !star.name || typeof star.type !== 'string' || !STELLAR_OBJECT_TYPES.includes(star.type as never) ||
      !validDesignations(star.designations) ||
      !validObjectStats(star) ||
      !['x_pc', 'y_pc', 'z_pc', 'epoch'].every((field) => typeof star[field] === 'number' && Number.isFinite(star[field]))) {
      throw new Error(`Invalid catalog payload row: ${manifest.id}`)
    }
    ids.add(star.id)
    if (payload.schemaVersion === 3 && (typeof star.catalog_detail_key !== 'string' || !star.catalog_detail_key
      || Object.hasOwn(star, 'notes') || Object.hasOwn(star, 'catalog_sources'))) {
      throw new Error(`Invalid deferred catalog details: ${manifest.id}:${star.id}`)
    }
    if (star.metallicity_dex !== null && (
      typeof star.metallicity_dex !== 'number' || !Number.isFinite(star.metallicity_dex) ||
      (star.metallicity_kind !== '[M/H]' && star.metallicity_kind !== '[Fe/H]')
    ) || star.metallicity_dex === null && star.metallicity_kind != null) {
      throw new Error(`Invalid metallicity quantity in catalog payload: ${manifest.id}:${star.id}`)
    }
    if (star.epoch !== manifest.epoch) throw new Error('Catalog manifest epoch does not match payload.')
  }
  // Companion completion happens during generation, preserving the effective records
  // without downloading the complete physical-data pool in the browser.
  const parsed = additions.map((star) => ({ ...star, notes: star.notes ?? '' })) as unknown as Star[]
  const stars = base ? composeCatalog(base, parsed) : parsed
  if (payload.sourceObjectCount !== manifest.objectCount || stars.length < manifest.objectCount) throw new Error('Catalog objectCount does not match payload rows.')
  if (!stars.some((star) => star.id === 'sun')) throw new Error('Catalog payload requires the Sun reference.')
  return stars
}

/** Fetch and parse a JSON payload once; a failed load is forgotten so it can be retried. */
export function memoizedPayloadLoader<T>(
  label: string,
  loadUrl: () => Promise<string>,
  parse: (value: unknown) => T | Promise<T>,
  fetcher: typeof fetch = fetch,
): () => Promise<T> {
  let cached: Promise<T> | undefined
  return () => cached ??= (async () => {
    const response = await fetcher(await loadUrl())
    if (!response.ok) throw new Error(`Could not load ${label} (${response.status}).`)
    return parse(await response.json())
  })().catch((error: unknown) => {
    cached = undefined
    throw error
  })
}

export function catalogLoader(
  manifest: CatalogManifest,
  url: string | (() => Promise<string>),
  fetcher: typeof fetch = fetch,
  loadBase?: () => Promise<Star[]>,
): () => Promise<Star[]> {
  const loadUrl = typeof url === 'string' ? () => Promise.resolve(url) : url
  let base: Promise<Star[]> | undefined
  const load = memoizedPayloadLoader(manifest.label, loadUrl, async (value) => parseCatalogPayload(value, manifest, base && await base), fetcher)
  // The base catalog's memoized rows are shared, not refetched or copied; both requests run in parallel.
  return () => {
    base = loadBase?.()
    base?.catch(() => undefined)
    return load()
  }
}
