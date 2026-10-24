import type { CatalogSource, Star } from './catalog-model.ts'

export interface CatalogDetails {
  notes: string
  catalog_sources?: CatalogSource[]
}

/** Keep rules needed by map merging explicit when their source notes are deferred. */
export function catalogFlags(star: Star): NonNullable<Star['catalog_flags']> {
  return star.catalog_flags ?? {
    withheld: star.notes.match(/Withheld individual fields: ([a-z_, ]+)\./)?.[1]?.split(', '),
    barycenter: star.notes.includes('barycenter solution') || undefined,
    source_rv: star.catalog_sources?.some((source) => source.record.raw_astrometry?.radial_velocity_kms != null) || undefined,
  }
}

export function splitCatalogDetails(star: Star, key: string) {
  const { notes, catalog_sources, ...mapStar } = star
  const flags = Object.fromEntries(Object.entries(catalogFlags(star)).filter(([, value]) => value !== undefined))
  return {
    mapStar: { ...mapStar, catalog_detail_key: key, ...(Object.keys(flags).length ? { catalog_flags: flags } : {}) },
    details: { notes, ...(catalog_sources ? { catalog_sources } : {}) } satisfies CatalogDetails,
  }
}
