import type { CatalogSource, RawAstrometry, Star } from './catalog-model.ts'
import { hipNumber } from './designations.ts'

export interface CatalogDetails {
  notes: string
  catalog_sources?: CatalogSource[]
  designations?: string[]
  raw_astrometry?: RawAstrometry
}

/** Keep rules needed by map merging explicit when their source notes are deferred. */
export function catalogFlags(star: Star): NonNullable<Star['catalog_flags']> {
  return star.catalog_flags ?? {
    withheld: star.notes.match(/Withheld individual fields: ([a-z_, ]+)\./)?.[1]?.split(', '),
    barycenter: star.notes.includes('barycenter solution') || undefined,
    source_rv: star.catalog_sources?.some((source) => source.record.raw_astrometry?.radial_velocity_kms != null) || undefined,
  }
}

/** The Objects database labels motion from these rows' astrometry, and arrows need it when no velocity is stored. */
function mapNeedsRawAstrometry(star: Star): boolean {
  return [star.vx_kms, star.vy_kms, star.vz_kms].some((value) => value === null || !Number.isFinite(value))
    || Boolean(star.raw_astrometry?.radial_velocity_ref?.includes('; shared systemic velocity approximation'))
}

/** What a row loads on selection; its hash keys the row's detail entry. */
export function catalogDetails(star: Star): CatalogDetails {
  return {
    notes: star.notes,
    ...(star.catalog_sources ? { catalog_sources: star.catalog_sources } : {}),
    ...(star.designations ? { designations: star.designations } : {}),
    ...(star.raw_astrometry && !mapNeedsRawAstrometry(star) ? { raw_astrometry: star.raw_astrometry } : {}),
  }
}

/** `record` keeps designations and astrometry for audits and tests; `mapStar` is what the browser's map loads. */
export function splitCatalogDetails(star: Star, key: string) {
  const { notes: _notes, catalog_sources: _sources, ...rest } = star
  const flags = Object.fromEntries(Object.entries(catalogFlags(star)).filter(([, value]) => value !== undefined))
  const record = { ...rest, catalog_detail_key: key, ...(Object.keys(flags).length ? { catalog_flags: flags } : {}) }
  const details = catalogDetails(star)
  const { designations, ...mapStar }: typeof record & Partial<Pick<Star, 'sky_position' | 'hip_numbers'>> = record
  if (details.raw_astrometry) {
    const { ra_deg, dec_deg } = details.raw_astrometry
    mapStar.raw_astrometry = null
    mapStar.sky_position = { ra_deg, dec_deg }
  }
  const hipNumbers = (designations ?? []).flatMap((designation) => hipNumber(designation) ?? [])
  if (hipNumbers.length) mapStar.hip_numbers = hipNumbers
  return { mapStar, record, details }
}
