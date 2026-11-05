import type { DesignationPart, Star } from './catalog-model.ts'

/** Keep published spellings, collapse padding, and remove repeated names. */
export function uniqueDesignations(values: readonly string[], preferredName?: string): string[] {
  const seen = new Set(preferredName ? [preferredName.trim().replace(/\s+/g, ' ').toLowerCase()] : [])
  return values.flatMap((value) => {
    const designation = value.trim().replace(/\s+/g, ' ')
    const key = designation.toLowerCase()
    if (!designation || seen.has(key)) return []
    seen.add(key)
    return [designation]
  })
}

/** Older custom payloads may omit aliases; bundled payloads always carry them. */
export function validDesignations(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((name) => typeof name === 'string' && name.trim().length > 0))
}

export function objectDesignations(star: Star): string[] {
  return uniqueDesignations([
    ...(star.designations ?? []),
    ...(star.nebula?.designations ?? []),
    ...(star.bubble?.designations ?? []),
  ], star.name)
}

/** The number in a whole `HIP n` designation; a component suffix such as `HIP 123 A` is not one. */
export function hipNumber(designation: string): number | null {
  const match = /^HIP(\d+)$/.exec(designation.replace(/\s+/g, ''))
  return match ? Number(match[1]) : null
}

export function objectHipNumbers(star: Star): number[] {
  return star.hip_numbers ?? (star.designations ?? []).flatMap((designation) => hipNumber(designation) ?? [])
}

/** Where a row's designations are found: in its own record, or in its deferred details. */
export function designationParts(star: Star): readonly DesignationPart[] {
  if (star.catalog_designation_parts) return star.catalog_designation_parts
  return star.designations === undefined && star.catalog_detail_key ? [{ key: star.catalog_detail_key }] : [{ names: objectDesignations(star) }]
}

/** Combines two rows' designations with a name between them, as a list when all are loaded and as parts otherwise. */
export function combinedDesignations(first: Star, name: string, second: Star, preferredName: string): Pick<Star, 'designations' | 'catalog_designation_parts' | 'hip_numbers'> {
  const parts = [...designationParts(first), { names: [name] }, ...designationParts(second)]
  if (parts.every((part) => 'names' in part)) {
    return { designations: uniqueDesignations(parts.flatMap((part) => (part as { names: readonly string[] }).names), preferredName) }
  }
  const hipNumbers = [...objectHipNumbers(first), ...(hipNumber(name) === null ? [] : [hipNumber(name)!]), ...objectHipNumbers(second)]
  return { designations: undefined, catalog_designation_parts: parts, hip_numbers: [...new Set(hipNumbers)] }
}

export interface ObjectIdentity {
  name: string
  /** Original reviewed authoring label, independent of the preferred UI name. */
  sourceName?: string
  simbadId?: string
  designations: string[]
  sources: string[]
}

export function parseObjectIdentities(value: unknown): Record<string, ObjectIdentity> {
  if (!value || typeof value !== 'object') throw new Error('Object designations must be an object.')
  const payload = value as Record<string, unknown>
  if (payload.schemaVersion !== 1 || !payload.objects || typeof payload.objects !== 'object' || Array.isArray(payload.objects)) {
    throw new Error('Invalid object designation supplement.')
  }
  for (const [id, value] of Object.entries(payload.objects)) {
    const identity = value as ObjectIdentity | null
    if (!id || !identity || typeof identity.name !== 'string' || !identity.name.trim()
      || identity.sourceName !== undefined && (typeof identity.sourceName !== 'string' || !identity.sourceName.trim())
      || identity.simbadId !== undefined && (typeof identity.simbadId !== 'string' || !identity.simbadId.trim())
      || !Array.isArray(identity.designations) || !validDesignations(identity.designations)
      || !Array.isArray(identity.sources) || !identity.sources.length || !identity.sources.every((source) => typeof source === 'string' && source.trim())) {
      throw new Error(`Invalid object designations: ${id}`)
    }
  }
  return payload.objects as Record<string, ObjectIdentity>
}

/** Apply an offline identity supplement without altering scientific catalog rows. */
export function supplementObjectIdentities(
  stars: readonly Star[],
  identities: Readonly<Record<string, ObjectIdentity>>,
  options: { preserveAuthoredNames?: boolean } = {},
): Star[] {
  return stars.map((star) => {
    const identity = Object.hasOwn(identities, star.id) ? identities[star.id] : undefined
    // Component completion may refine an older system label (A -> Aa, AB -> A).
    // Only an exact reviewed source label authorizes a display-name replacement.
    const name = options.preserveAuthoredNames && identity?.sourceName !== star.name ? star.name : identity?.name ?? star.name
    return {
      ...star,
      name,
      designations: uniqueDesignations([...(identity?.designations ?? []), ...(identity ? [identity.name] : []), star.name, ...objectDesignations(star)], name),
    }
  })
}
