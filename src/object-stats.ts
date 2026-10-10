import type { Star } from './catalog-model.ts'
import { apparentVisualMagnitude } from './photometry.ts'

export interface ObjectStats {
  subtypes: string[]
  known_planets: number | null
}

export function validObjectStats(value: { subtypes?: unknown; known_planets?: unknown; apparent_mag?: unknown }): boolean {
  return (value.subtypes === undefined || Array.isArray(value.subtypes) && value.subtypes.every((label) => typeof label === 'string' && !!label.trim()))
    && (value.known_planets == null || typeof value.known_planets === 'number' && Number.isInteger(value.known_planets) && value.known_planets >= 0)
    && (value.apparent_mag == null || typeof value.apparent_mag === 'number' && Number.isFinite(value.apparent_mag))
}

export function parseObjectStats(value: unknown): Record<string, ObjectStats> {
  if (!value || typeof value !== 'object') throw new Error('Object stats must be an object.')
  const payload = value as Record<string, unknown>
  if (payload.schemaVersion !== 1 || !payload.objects || typeof payload.objects !== 'object' || Array.isArray(payload.objects)) {
    throw new Error('Invalid object stats supplement.')
  }
  for (const [id, row] of Object.entries(payload.objects)) {
    if (!id || !row || typeof row !== 'object' || !Array.isArray((row as ObjectStats).subtypes)
      || !Object.hasOwn(row, 'known_planets') || !validObjectStats(row as ObjectStats)) {
      throw new Error(`Invalid object stats: ${id}`)
    }
  }
  return payload.objects as Record<string, ObjectStats>
}

/** Enrich every bundled catalog and overlay from the same reviewed identity pool. */
export function supplementObjectStats(stars: readonly Star[], stats: Readonly<Record<string, ObjectStats>>): Star[] {
  return stars.map((star) => {
    const entry = Object.hasOwn(stats, star.id) ? stats[star.id] : undefined
    return {
      ...star,
      subtypes: star.subtypes?.length ? star.subtypes : entry?.subtypes ?? [],
      known_planets: star.known_planets ?? entry?.known_planets ?? null,
      // Inverse distance modulus preserves reviewed component V photometry and
      // its extinction assumptions. Never substitute blended SIMBAD/system V.
      apparent_mag: star.apparent_mag ?? (star.id === 'sun' ? -26.74 :
        apparentVisualMagnitude(star.absolute_mag, Math.hypot(star.x_pc, star.y_pc, star.z_pc))),
    }
  })
}
