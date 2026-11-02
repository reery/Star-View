import type { CatalogSource, Star } from './catalog-model.ts'

/** Individual measurements always win. The retained source is display-only. */
export function catalogSourceFor(star: Star, field: keyof CatalogSource['record']): CatalogSource | undefined {
  if (star[field] != null || star.withheld_source_fields?.includes(field)) return undefined
  return star.catalog_sources?.find((source) => source.record[field] != null)
}

export function catalogMeasurement<T extends keyof CatalogSource['record']>(star: Star, field: T): Exclude<Star[T], undefined> | null {
  return (star[field] ?? catalogSourceFor(star, field)?.record[field] ?? null) as Exclude<Star[T], undefined> | null
}

/** Check source-to-component replacement, including nested uncertainties.
 * A changed value may be adopted, but the original known value must remain
 * in the same source snapshot when it differs from the adopted component.
 */
export function missingCatalogMeasurements(source: Star, component: Star): string[] {
  const retained = component.catalog_sources?.filter((entry) => entry.record.id === source.id).map((entry) => entry.record) ?? []
  const missing: string[] = []
  const equal = (a: unknown, b: unknown): boolean => typeof a === 'number' && typeof b === 'number'
    ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)) : JSON.stringify(a) === JSON.stringify(b)
  for (const field of Object.keys(source) as (keyof Star)[]) {
    if (['id', 'name', 'designations', 'notes', 'catalog_sources'].includes(field)) continue
    const value = source[field]
    if (value == null || Array.isArray(value) && value.length === 0) continue
    const adopted = component[field]
    if (equal(value, adopted) || Array.isArray(value) && Array.isArray(adopted) && value.every((entry) => adopted.some((candidate) => equal(entry, candidate)))
      || retained.some((record) => equal(value, record[field as keyof typeof record]))) continue
    if (field === 'raw_astrometry' && value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) {
        if (entry != null && !equal(entry, component.raw_astrometry?.[key as keyof NonNullable<Star['raw_astrometry']>])
          && !retained.some((record) => equal(entry, record.raw_astrometry?.[key as keyof NonNullable<Star['raw_astrometry']>]))) missing.push(`${field}.${key}`)
      }
    } else missing.push(field)
  }
  return missing
}


export interface ReviewedRetirement { id: string; field: string; expectedPrevious: unknown }

/** A reviewed correction retires a wrong value: the review ledger keeps it,
 * but shipped records never do, not even as a retained source value. */
export function withoutRetiredValues(stars: readonly Star[], retirements: readonly ReviewedRetirement[]): Star[] {
  const byId = new Map<string, ReviewedRetirement[]>()
  for (const entry of retirements) byId.set(entry.id, [...byId.get(entry.id) ?? [], entry])
  // Ledger values are CSV text; shipped records hold parsed numbers and lists.
  const same = (previous: unknown, value: unknown) => typeof value === 'number' && previous !== '' && Number.isFinite(Number(previous))
    ? Math.abs(Number(previous) - value) <= 1e-9 * Math.max(1, Math.abs(value)) : JSON.stringify(previous) === JSON.stringify(value)
  return stars.map((star) => {
    const sources = star.catalog_sources?.map((source) => {
      const retired = byId.get(source.record.id)?.filter(({ field, expectedPrevious }) =>
        source.record[field as keyof typeof source.record] != null && same(expectedPrevious, source.record[field as keyof typeof source.record]))
      return retired?.length ? { ...source, record: { ...source.record, ...Object.fromEntries(retired.map(({ field }) => [field, null])) } } : source
    })
    return sources?.some((source, index) => source !== star.catalog_sources![index]) ? { ...star, catalog_sources: sources } : star
  })
}
