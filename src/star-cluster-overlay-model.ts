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

// A measurement with its error and source, or none of them.
function optionalMeasurement(details: Record<string, unknown>, value: string, error: string, source: string): boolean {
  return details[value] === null ? details[error] === null && details[source] === null
    : finite(details[value]) && positive(details[error]) && validSource(details[source])
}

// Open clusters count their Gaia members within a tidal radius; globular clusters have a core and a tidal radius; super
// star clusters, from a compilation without errors, have a half-light radius, perhaps a core, and no tidal edge.
function validDetails(value: unknown, type: StarClusterObjectType): value is StarClusterDetails {
  if (!value || typeof value !== 'object') return false
  const details = value as Record<string, unknown>
  const superStar = type === 'super_star_cluster'
  const palette = details.palette as Record<string, unknown> | undefined
  const members = details.notable_members
  const half = details.half_member_radius_pc as number
  const core = details.core_radius_pc
  const tidal = details.tidal_radius_pc
  const errorOrMissing = (key: string) => positive(details[key]) || (superStar && details[key] === null)
  return ['distance_method', 'age_method', 'position_source', 'model_note'].every((key) => text(details[key]))
    && finite(details.ra_deg) && (details.ra_deg as number) >= 0 && (details.ra_deg as number) < 360
    && finite(details.dec_deg) && Math.abs(details.dec_deg as number) <= 90
    && ['distance_pc', 'distance_error_pc', 'age_myr', 'mass_solar', 'half_member_radius_pc'].every((key) => positive(details[key]))
    && errorOrMissing('age_error_myr') && errorOrMissing('mass_error_solar')
    && optionalMeasurement(details, 'metallicity_fe_h', 'metallicity_error_dex', 'metallicity_source')
    && optionalMeasurement(details, 'radial_velocity_kms', 'radial_velocity_error_kms', 'radial_velocity_source')
    && (superStar || details.radial_velocity_kms !== null)
    && (type === 'open_cluster'
      ? count(details.members_within_tidal_radius) && count(details.members_total) && validSource(details.members_source)
        && (details.members_within_tidal_radius as number) <= (details.members_total as number) && core === null
      : details.members_within_tidal_radius === null && details.members_total === null && details.members_source === null
        && (superStar && core === null || positive(core) && (core as number) < half))
    && (superStar ? tidal === null : positive(tidal) && half < (tidal as number))
    && ['distance_source', 'age_source', 'structure_source'].every((key) => validSource(details[key]))
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
      || !['x_pc', 'y_pc', 'z_pc'].every((field) => finite(object[field]))
      // A super star cluster without a measured space motion has none at all.
      || !(['vx_kms', 'vy_kms', 'vz_kms'].every((field) => finite(object[field]))
        || object.type === 'super_star_cluster' && ['vx_kms', 'vy_kms', 'vz_kms'].every((field) => object[field] === null))
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
