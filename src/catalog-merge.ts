import type { Star } from './catalog-model.ts'
import { objectDesignations, uniqueDesignations } from './designations.ts'
import { catalogFlags } from './catalog-detail-model.ts'

const OVERLAY_PHYSICAL_FIELDS = [
  'temperature_k', 'mass_solar', 'luminosity_solar', 'radius_solar', 'metallicity_dex', 'age_gyr',
] as const

function supplementPhysicalFields(primary: Star, additional: Star): Star {
  const supplemented = { ...primary }
  supplemented.subtypes = uniqueDesignations([...(primary.subtypes ?? []), ...(additional.subtypes ?? [])])
  supplemented.known_planets = primary.known_planets ?? additional.known_planets ?? null
  supplemented.stellar_observations = primary.stellar_observations ?? additional.stellar_observations
  supplemented.designations = uniqueDesignations([...objectDesignations(primary), additional.name, ...objectDesignations(additional)], primary.name)
  // A reviewed component may deliberately withhold blended system estimates.
  // An overlapping legacy overlay must not restore those rejected values.
  const withheld = new Set(catalogFlags(primary).withheld ?? [])
  supplemented.apparent_mag = primary.apparent_mag ?? (withheld.has('absolute_mag') ? null : additional.apparent_mag ?? null)
  const fields = OVERLAY_PHYSICAL_FIELDS.filter((field) => !withheld.has(field) && primary[field] === null && additional[field] !== null)
  for (const field of fields) {
    supplemented[field] = additional[field]
    if (field === 'metallicity_dex') supplemented.metallicity_kind = additional.metallicity_kind
  }
  if (fields.length) {
    if (primary.catalog_detail_key || additional.catalog_detail_key || primary.catalog_note_supplements || additional.catalog_note_supplements) {
      supplemented.catalog_note_supplements = [...primary.catalog_note_supplements ?? [],
        { ...(additional.catalog_detail_key ? { key: additional.catalog_detail_key } : { notes: additional.notes }), fields },
        ...additional.catalog_note_supplements ?? []]
    } else {
      supplemented.notes = `${primary.notes} Additional catalog supplements ${fields.join(', ')}. ${additional.notes}`.trim()
    }
  }
  return supplemented
}

const SAME_SKY_POSITION_COSINE = Math.cos(Math.PI / (180 * 3600))
// Separation is never below the declination difference; the margin covers rounding in the cosine test.
const SAME_SKY_DECLINATION_WINDOW_DEG = 2 / 3600

const isBarycenter = (star: Star) => Boolean(catalogFlags(star).barycenter)

/** `barycenter` is true when either row documents a barycenter solution. */
function sameSkyPosition(first: Star, second: Star, barycenter: boolean): boolean {
  const firstAstrometry = first.raw_astrometry
  const secondAstrometry = second.raw_astrometry
  if (firstAstrometry && secondAstrometry && Math.abs(firstAstrometry.dec_deg - secondAstrometry.dec_deg) <= SAME_SKY_DECLINATION_WINDOW_DEG) {
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
  if (!barycenter) return false
  const firstLength = Math.hypot(first.x_pc, first.y_pc, first.z_pc)
  const secondLength = Math.hypot(second.x_pc, second.y_pc, second.z_pc)
  if (firstLength === 0 || secondLength === 0) return false
  const cosine = (first.x_pc * second.x_pc + first.y_pc * second.y_pc + first.z_pc * second.z_pc) / (firstLength * secondLength)
  return cosine >= SAME_SKY_POSITION_COSINE
}

/** Merge a catalog layer while retaining one marker for objects shared under different catalog IDs; `merges` records each additional ID that another record absorbed. */
export function mergeCatalogStarLayers(primary: readonly Star[], additional: readonly Star[], componentIdentity: (id: string) => { canonicalStarId: string } | undefined, merges?: Map<string, string>): Star[] {
  const merged = [...primary]
  const ids = new Map(merged.map((star, index) => [star.id, index]))
  const names = new Map(merged.map((star, index) => [star.name.toLocaleLowerCase('en-US'), index]))
  // Parsed once per row instead of once per compared pair.
  const barycenters = merged.map(isBarycenter)
  const components = new Map(merged.flatMap((star, index) => {
    const identity = componentIdentity(star.id)
    return identity ? [[identity.canonicalStarId, index] as const] : []
  }))
  for (const star of additional) {
    const normalizedName = star.name.toLocaleLowerCase('en-US')
    const identity = componentIdentity(star.id)
    const distinctComponent = (candidate: Star) => {
      const candidateIdentity = componentIdentity(candidate.id)
      return identity && candidateIdentity && identity.canonicalStarId !== candidateIdentity.canonicalStarId
    }
    const barycenter = isBarycenter(star)
    const namedDuplicate = names.get(normalizedName)
    const duplicate = ids.get(star.id) ?? (identity ? components.get(identity.canonicalStarId) : undefined) ??
      (namedDuplicate !== undefined && !distinctComponent(merged[namedDuplicate]!) ? namedDuplicate : undefined) ??
      merged.findIndex((candidate, index) => sameSkyPosition(candidate, star, barycenter || barycenters[index]!) && !distinctComponent(candidate))
    if (duplicate >= 0) {
      if (merged[duplicate]!.id !== star.id) merges?.set(star.id, merged[duplicate]!.id)
      merged[duplicate] = supplementPhysicalFields(merged[duplicate]!, star)
      barycenters[duplicate] = isBarycenter(merged[duplicate]!)
      ids.set(star.id, duplicate)
      names.set(normalizedName, duplicate)
      if (identity) components.set(identity.canonicalStarId, duplicate)
      continue
    }
    ids.set(star.id, merged.length)
    names.set(normalizedName, merged.length)
    if (identity) components.set(identity.canonicalStarId, merged.length)
    merged.push(star)
    barycenters.push(isBarycenter(star))
  }
  return merged
}
