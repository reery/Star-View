import { validDesignations } from './designations.ts'
import { equatorialToGalacticPc, STAR_CLUSTER_OBJECT_TYPES, type StarClusterDetails, type StarClusterObjectType, type Star } from './catalog-model.ts'
import { finite, finitePositive as positive, parseOverlayManifest } from './overlay-model.ts'

export interface StarClusterOverlayManifest {
  schemaVersion: 1
  id: 'star-clusters'
  label: string
  description: string
  epoch: number
  objectCount: number
  counts: Record<StarClusterObjectType, number>
  sources: { name: string; url: string }[]
  cutoffPolicy: string
  snapshot: string
}

const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const color = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const count = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0

function validSource(value: unknown): boolean {
  const source = value as Record<string, unknown> | null
  return !!source && typeof source === 'object' && text(source.label) && typeof source.url === 'string' && /^https:\/\//.test(source.url)
}

// Open clusters count their Gaia members; globular clusters have a core radius instead.
function validDetails(value: unknown, type: StarClusterObjectType): value is StarClusterDetails {
  if (!value || typeof value !== 'object') return false
  const details = value as Record<string, unknown>
  const globular = type === 'globular_cluster'
  const palette = details.palette as Record<string, unknown> | undefined
  const members = details.notable_members
  return ['distance_method', 'age_method', 'position_source', 'model_note'].every((key) => text(details[key]))
    && finite(details.ra_deg) && (details.ra_deg as number) >= 0 && (details.ra_deg as number) < 360
    && finite(details.dec_deg) && Math.abs(details.dec_deg as number) <= 90
    && ['distance_pc', 'distance_error_pc', 'age_myr', 'age_error_myr', 'metallicity_error_dex', 'mass_solar', 'mass_error_solar',
      'half_member_radius_pc', 'tidal_radius_pc', 'radial_velocity_error_kms'].every((key) => positive(details[key]))
    && finite(details.metallicity_fe_h) && finite(details.radial_velocity_kms)
    && (globular
      ? details.members_within_tidal_radius === null && details.members_total === null && details.members_source === null
        && positive(details.core_radius_pc) && (details.core_radius_pc as number) < (details.half_member_radius_pc as number)
      : count(details.members_within_tidal_radius) && count(details.members_total) && validSource(details.members_source)
        && (details.members_within_tidal_radius as number) <= (details.members_total as number) && details.core_radius_pc === null)
    && (details.half_member_radius_pc as number) < (details.tidal_radius_pc as number)
    && ['distance_source', 'age_source', 'metallicity_source', 'structure_source', 'radial_velocity_source'].every((key) => validSource(details[key]))
    && Array.isArray(members) && members.every((member) => !!member && typeof member === 'object'
      && ['catalog', 'id', 'name'].every((key) => text((member as Record<string, unknown>)[key])))
    && !!palette && color(palette.real) && color(palette.exaggerated)
}

export function parseStarClusterOverlayManifest(raw: string): StarClusterOverlayManifest {
  return parseOverlayManifest(raw, 'star-clusters', 'Star cluster', STAR_CLUSTER_OBJECT_TYPES)
}

export function parseStarClusterOverlayPayload(value: unknown, manifest: StarClusterOverlayManifest): Star[] {
  if (!value || typeof value !== 'object') throw new Error('Star cluster payload must be an object.')
  const payload = value as Record<string, unknown>
  if (payload.schemaVersion !== 1 || payload.overlayId !== manifest.id || !Array.isArray(payload.objects)) throw new Error('Invalid star cluster payload.')
  const objects = payload.objects as Record<string, unknown>[]
  if (objects.length !== manifest.objectCount || STAR_CLUSTER_OBJECT_TYPES.some((type) => objects.filter((object) => object?.type === type).length !== manifest.counts[type])) {
    throw new Error('Star cluster count does not match its manifest.')
  }
  const ids = new Set<string>()
  for (const object of objects) {
    if (!object || !text(object.id) || ids.has(object.id) || !text(object.name) || !validDesignations(object.designations)
      || !STAR_CLUSTER_OBJECT_TYPES.includes(object.type as StarClusterObjectType)
      || !['x_pc', 'y_pc', 'z_pc', 'vx_kms', 'vy_kms', 'vz_kms'].every((field) => finite(object[field]))
      || object.epoch !== manifest.epoch || object.absolute_mag !== null || object.mass_solar !== null || !validDetails(object.cluster, object.type as StarClusterObjectType)) {
      throw new Error(`Invalid star cluster payload row: ${String(object?.id ?? 'unknown')}`)
    }
    // The map position must be the reviewed center at the reviewed distance.
    const { ra_deg, dec_deg, distance_pc } = object.cluster
    const expected = equatorialToGalacticPc(ra_deg, dec_deg, distance_pc)
    if (Math.hypot(expected.x_pc - (object.x_pc as number), expected.y_pc - (object.y_pc as number), expected.z_pc - (object.z_pc as number)) > 0.01) {
      throw new Error(`Star cluster position does not match its center and distance: ${object.id}`)
    }
    ids.add(object.id)
  }
  return objects as unknown as Star[]
}
