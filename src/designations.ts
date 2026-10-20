import type { Star } from './catalog-model.ts'

/** Keep published spellings, collapse padding, and remove repeated names. */
export function uniqueDesignations(values: readonly string[], preferredName?: string): string[] {
  const seen = new Set(preferredName ? [preferredName.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')] : [])
  return values.flatMap((value) => {
    const designation = value.trim().replace(/\s+/g, ' ')
    const key = designation.toLocaleLowerCase('en-US')
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
