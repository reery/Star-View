import type { Star } from './catalog-model.ts'
import type { ObjectIdentity } from './designations.ts'

const scientificFields = [
  'type', 'spectral_type', 'temperature_k', 'mass_solar', 'radius_solar',
  'luminosity_solar', 'metallicity_dex', 'metallicity_kind', 'age_gyr',
  'absolute_mag', 'constellation', 'epoch', 'x_pc', 'y_pc', 'z_pc',
  'vx_kms', 'vy_kms', 'vz_kms', 'raw_astrometry',
  'subtypes', 'known_planets', 'apparent_mag',
] as const satisfies readonly (keyof Star)[]

/** Exact identities only; shared system identifiers must not merge components. */
export function auditCatalogConsistency(
  catalogs: readonly { id: string; stars: readonly Star[] }[],
  identities: Readonly<Record<string, ObjectIdentity>>,
  componentIdentity: (id: string) => { canonicalStarId: string } | undefined,
) {
  const rows = catalogs.flatMap((catalog) => catalog.stars.map((star) => {
    const component = componentIdentity(star.id)
    return { catalog: catalog.id, star, component,
      canonical: component?.canonicalStarId ?? star.id,
      simbad: identities[star.id]?.simbadId?.trim().replace(/\s+/g, ' ') }
  }))
  const bySimbad = new Map<string, typeof rows>()
  for (const row of rows) {
    if (row.simbad) bySimbad.set(row.simbad, [...bySimbad.get(row.simbad) ?? [], row])
  }
  const ambiguous = new Set([...bySimbad].filter(([, members]) =>
    new Set(members.filter((row) => row.component).map((row) => row.canonical)).size > 1
    || [...new Set(members.map((row) => row.catalog))].some((catalog) =>
      new Set(members.filter((row) => row.catalog === catalog).map((row) => row.canonical)).size > 1))
    .map(([id]) => id))
  const groups = new Map<string, typeof rows>()
  for (const row of rows) {
    const exactComponent = row.simbad && !ambiguous.has(row.simbad)
      ? bySimbad.get(row.simbad)?.find((member) => member.component)?.canonical : undefined
    const key = row.component || exactComponent ? `id:${exactComponent ?? row.canonical}`
      : row.simbad && !ambiguous.has(row.simbad) ? `simbad:${row.simbad}` : `id:${row.canonical}`
    groups.set(key, [...groups.get(key) ?? [], row])
  }
  const conflicts: { identity: string; field: string; rows: { catalog: string; id: string; value: unknown }[] }[] = []
  let sharedObjects = 0
  for (const [identity, members] of groups) {
    if (new Set(members.map((row) => row.catalog)).size < 2) continue
    sharedObjects++
    for (const field of scientificFields) {
      const values = members.map(({ catalog, star }) => ({ catalog, id: star.id,
        value: field === 'spectral_type' ? star.spectral_type?.replace(/\s+/g, '') ?? null : star[field] ?? null }))
      if (new Set(values.map((row) => JSON.stringify(row.value))).size > 1) conflicts.push({ identity, field, rows: values })
    }
  }
  return { uniqueObjects: groups.size, sharedObjects, conflicts }
}
