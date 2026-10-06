import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model'
import type { CatalogManifest } from './catalog-manifest'
import { objectDesignations, uniqueDesignations, validDesignations } from './designations'
import { starComponentIdentity } from './star-systems'

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
  supplemented.designations = uniqueDesignations([...objectDesignations(primary), additional.name, ...objectDesignations(additional)], primary.name)
  // A reviewed component may deliberately withhold blended system estimates.
  // An overlapping legacy overlay must not restore those rejected values.
  const withheld = new Set(primary.notes.match(/Withheld individual fields: ([a-z_, ]+)\./)?.[1]?.split(', ') ?? [])
  const fields = OVERLAY_PHYSICAL_FIELDS.filter((field) => !withheld.has(field) && primary[field] === null && additional[field] !== null)
  for (const field of fields) supplemented[field] = additional[field]
  if (fields.length) {
    supplemented.notes = `${primary.notes} Additional catalog supplements ${fields.join(', ')}. ${additional.notes}`.trim()
  }
  return supplemented
}

const SAME_SKY_POSITION_COSINE = Math.cos(Math.PI / (180 * 3600))

function sameSkyPosition(first: Star, second: Star): boolean {
  const firstAstrometry = first.raw_astrometry
  const secondAstrometry = second.raw_astrometry
  if (firstAstrometry && secondAstrometry) {
    const firstRa = firstAstrometry.ra_deg * Math.PI / 180
    const firstDec = firstAstrometry.dec_deg * Math.PI / 180
    const secondRa = secondAstrometry.ra_deg * Math.PI / 180
    const secondDec = secondAstrometry.dec_deg * Math.PI / 180
    const cosine = Math.sin(firstDec) * Math.sin(secondDec) + Math.cos(firstDec) * Math.cos(secondDec) * Math.cos(firstRa - secondRa)
    if (cosine >= SAME_SKY_POSITION_COSINE) return true
  }
  // A dedicated system-motion solution can describe a barycenter while the
  // rendered J2000 position remains component-specific. Only use the rendered
  // direction fallback when a row explicitly documents that distinction; close
  // components such as Sirius A/B must remain separate objects.
  if (!first.notes.includes('barycenter solution') && !second.notes.includes('barycenter solution')) return false
  const firstLength = Math.hypot(first.x_pc, first.y_pc, first.z_pc)
  const secondLength = Math.hypot(second.x_pc, second.y_pc, second.z_pc)
  if (firstLength === 0 || secondLength === 0) return false
  const cosine = (first.x_pc * second.x_pc + first.y_pc * second.y_pc + first.z_pc * second.z_pc) / (firstLength * secondLength)
  return cosine >= SAME_SKY_POSITION_COSINE
}

/** Merge a catalog layer while retaining one marker for objects shared under different catalog IDs. */
export function mergeCatalogStars(primary: readonly Star[], additional: readonly Star[]): Star[] {
  const merged = [...primary]
  const ids = new Map(merged.map((star, index) => [star.id, index]))
  const names = new Map(merged.map((star, index) => [star.name.toLocaleLowerCase('en-US'), index]))
  const components = new Map(merged.flatMap((star, index) => {
    const identity = starComponentIdentity(star.id)
    return identity ? [[identity.canonicalStarId, index] as const] : []
  }))
  for (const star of additional) {
    const normalizedName = star.name.toLocaleLowerCase('en-US')
    const identity = starComponentIdentity(star.id)
    const distinctComponent = (candidate: Star) => {
      const candidateIdentity = starComponentIdentity(candidate.id)
      return identity && candidateIdentity && identity.canonicalStarId !== candidateIdentity.canonicalStarId
    }
    const namedDuplicate = names.get(normalizedName)
    const duplicate = ids.get(star.id) ?? (identity ? components.get(identity.canonicalStarId) : undefined) ??
      (namedDuplicate !== undefined && !distinctComponent(merged[namedDuplicate]!) ? namedDuplicate : undefined) ??
      merged.findIndex((candidate) => !distinctComponent(candidate) && sameSkyPosition(candidate, star))
    if (duplicate >= 0) {
      merged[duplicate] = supplementPhysicalFields(merged[duplicate]!, star)
      ids.set(star.id, duplicate)
      names.set(normalizedName, duplicate)
      if (identity) components.set(identity.canonicalStarId, duplicate)
      continue
    }
    ids.set(star.id, merged.length)
    names.set(normalizedName, merged.length)
    if (identity) components.set(identity.canonicalStarId, merged.length)
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
      typeof star.name !== 'string' || !star.name || typeof star.type !== 'string' || !STELLAR_OBJECT_TYPES.includes(star.type as never) ||
      !validDesignations(star.designations) ||
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
