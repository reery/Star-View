import { validDesignations } from './designations.ts'
import { equatorialToGalacticPc, GALAXY_OBJECT_TYPES, type GalaxyDetails, type GalaxyObjectType, type Star } from './catalog-model.ts'

export interface GalaxyOverlayManifest {
  schemaVersion: 1
  id: 'galaxies'
  label: string
  description: string
  epoch: number
  objectCount: number
  counts: Record<GalaxyObjectType, number>
  sources: { name: string; url: string }[]
  cutoffPolicy: string
  snapshot: string
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const positive = (value: unknown): value is number => finite(value) && value > 0
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const color = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

function validSource(value: unknown): boolean {
  const source = value as Record<string, unknown> | null
  return !!source && typeof source === 'object' && text(source.label) && typeof source.url === 'string' && /^https:\/\//.test(source.url)
}

function validDetails(value: unknown): value is GalaxyDetails {
  if (!value || typeof value !== 'object') return false
  const details = value as Record<string, unknown>
  const palette = details.palette as Record<string, unknown> | undefined
  const size = details.angular_size_deg
  const stars = details.star_count
  const mass = details.total_mass as Record<string, unknown> | undefined
  const velocity = details.radial_velocity_kms
  return ['morphology', 'classification', 'distance_method', 'position_source', 'model_note'].every((key) => text(details[key]))
    && finite(details.ra_deg) && (details.ra_deg as number) >= 0 && (details.ra_deg as number) < 360
    && finite(details.dec_deg) && Math.abs(details.dec_deg as number) <= 90
    && ['distance_pc', 'distance_error_pc', 'diameter_pc', 'model_radius_pc'].every((key) => positive(details[key]))
    && validSource(details.distance_source) && validSource(details.size_source) && validSource(details.star_count_source)
    && (size === null || (Array.isArray(size) && size.length === 2 && size.every(positive) && size[0]! >= size[1]!))
    && Array.isArray(stars) && stars.length === 2 && stars.every(positive) && stars[0]! <= stars[1]!
    && (mass === undefined || (['value_solar', 'lower_error_solar', 'upper_error_solar'].every((key) => positive(mass[key]))
      && text(mass.scope) && validSource(mass.source)))
    && (velocity === null
      ? details.radial_velocity_error_kms === null && details.radial_velocity_source === null
      : finite(velocity) && positive(details.radial_velocity_error_kms) && validSource(details.radial_velocity_source))
    && !!palette && color(palette.real) && color(palette.exaggerated)
}

export function parseGalaxyOverlayManifest(raw: string): GalaxyOverlayManifest {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw new Error('Galaxy manifest must be an object.')
  const manifest = value as Record<string, unknown>
  if (manifest.schemaVersion !== 1 || manifest.id !== 'galaxies') throw new Error('Invalid galaxy manifest.')
  if (!finite(manifest.epoch) || !Number.isInteger(manifest.objectCount) || !manifest.counts || typeof manifest.counts !== 'object'
    || !GALAXY_OBJECT_TYPES.every((type) => Number.isInteger((manifest.counts as Record<string, unknown>)[type]))) {
    throw new Error('Invalid galaxy manifest counts.')
  }
  return manifest as unknown as GalaxyOverlayManifest
}

export function parseGalaxyOverlayPayload(value: unknown, manifest: GalaxyOverlayManifest): Star[] {
  if (!value || typeof value !== 'object') throw new Error('Galaxy payload must be an object.')
  const payload = value as Record<string, unknown>
  if (payload.schemaVersion !== 1 || payload.overlayId !== manifest.id || !Array.isArray(payload.objects)) throw new Error('Invalid galaxy payload.')
  const objects = payload.objects as Record<string, unknown>[]
  if (objects.length !== manifest.objectCount || objects.length !== manifest.counts.galaxy) throw new Error('Galaxy count does not match its manifest.')
  const ids = new Set<string>()
  for (const object of objects) {
    if (!object || !text(object.id) || ids.has(object.id) || !text(object.name) || !validDesignations(object.designations)
      || object.type !== 'galaxy' || !['x_pc', 'y_pc', 'z_pc'].every((field) => finite(object[field]))
      || object.epoch !== manifest.epoch || object.absolute_mag !== null || object.mass_solar !== null || !validDetails(object.galaxy)) {
      throw new Error(`Invalid galaxy payload row: ${String(object?.id ?? 'unknown')}`)
    }
    // The map position must be the reviewed center at the reviewed distance.
    const { ra_deg, dec_deg, distance_pc } = object.galaxy
    const expected = equatorialToGalacticPc(ra_deg, dec_deg, distance_pc)
    if (Math.hypot(expected.x_pc - (object.x_pc as number), expected.y_pc - (object.y_pc as number), expected.z_pc - (object.z_pc as number)) > 1) {
      throw new Error(`Galaxy position does not match its center and distance: ${object.id}`)
    }
    ids.add(object.id)
  }
  return objects as unknown as Star[]
}
