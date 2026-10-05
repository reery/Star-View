import { validDesignations } from './designations.ts'
import { equatorialToGalacticPc, NEBULA_OBJECT_TYPES, NEBULA_SHAPE_KINDS, type NebulaDetails, type NebulaObjectType, type Star } from './catalog-model.ts'

export interface NebulaOverlayManifest {
  schemaVersion: 1
  id: 'nebulae'
  label: string
  description: string
  epoch: number
  objectCount: number
  counts: Record<NebulaObjectType, number>
  sources: { name: string; url: string }[]
  cutoffPolicy: string
  snapshot: string
}

const POSITION_TOLERANCE_PC = 0.001

export function parseNebulaOverlayManifest(raw: string): NebulaOverlayManifest {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw new Error('Nebula manifest must be an object.')
  const manifest = value as Record<string, unknown>
  if (manifest.schemaVersion !== 1 || manifest.id !== 'nebulae') throw new Error('Invalid nebula manifest.')
  if (typeof manifest.epoch !== 'number' || !Number.isFinite(manifest.epoch)
    || typeof manifest.objectCount !== 'number' || !Number.isInteger(manifest.objectCount)
    || !manifest.counts || typeof manifest.counts !== 'object'
    || !NEBULA_OBJECT_TYPES.every((type) => Number.isInteger((manifest.counts as Record<string, unknown>)[type]))) {
    throw new Error('Invalid nebula manifest counts.')
  }
  return manifest as unknown as NebulaOverlayManifest
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function strings(value: unknown, minimum = 1): value is string[] {
  return Array.isArray(value) && value.length >= minimum && value.every((entry) => typeof entry === 'string' && entry.length > 0)
}

function validDetails(value: unknown): value is NebulaDetails {
  if (!value || typeof value !== 'object') return false
  const details = value as Record<string, unknown>
  const shape = details.shape as Record<string, unknown> | undefined
  const palette = details.palette as Record<string, unknown> | undefined
  const angular = details.angular_size_arcmin
  const hexes = (colors: unknown) => strings(colors, 2) && colors.every((color) => /^#[0-9a-f]{6}$/i.test(color))
  return strings(details.designations)
    && typeof details.ra_deg === 'number' && details.ra_deg >= 0 && details.ra_deg < 360
    && typeof details.dec_deg === 'number' && Math.abs(details.dec_deg) <= 90
    && finitePositive(details.distance_pc)
    && (details.distance_error_pc === null || finitePositive(details.distance_error_pc))
    && ['distance_source', 'position_source', 'illuminating_stars', 'source_label', 'source_url', 'model_note']
      .every((field) => typeof details[field] === 'string' && (details[field] as string).length > 0)
    && /^https:\/\//.test(details.source_url as string)
    && Array.isArray(angular) && angular.length === 2 && angular.every(finitePositive)
    && !!shape && NEBULA_SHAPE_KINDS.includes(shape.kind as never)
    && Array.isArray(shape.semi_axes_pc) && shape.semi_axes_pc.length === 3 && shape.semi_axes_pc.every(finitePositive)
    && typeof shape.position_angle_deg === 'number' && Number.isFinite(shape.position_angle_deg)
    && Array.isArray(shape.layer_offsets_pc) && shape.layer_offsets_pc.every((offset) => typeof offset === 'number' && Number.isFinite(offset))
    && (shape.kind !== 'layers' || shape.layer_offsets_pc.length > 0)
    && !!palette && hexes(palette.real) && hexes(palette.exaggerated)
    && typeof details.brightness === 'number' && details.brightness > 0 && details.brightness <= 1
    && Number.isInteger(details.puff_count) && (details.puff_count as number) >= 16 && (details.puff_count as number) <= 1024
    && Number.isInteger(details.seed)
}

export function parseNebulaOverlayPayload(value: unknown, manifest: NebulaOverlayManifest): Star[] {
  if (!value || typeof value !== 'object') throw new Error('Nebula payload must be an object.')
  const payload = value as Record<string, unknown>
  if (payload.schemaVersion !== 1 || payload.overlayId !== manifest.id || !Array.isArray(payload.objects)) {
    throw new Error('Invalid nebula payload.')
  }
  if (payload.objects.length !== manifest.objectCount) throw new Error('Nebula count does not match its manifest.')
  const objects = payload.objects as Record<string, unknown>[]
  const ids = new Set<string>()
  for (const object of objects) {
    if (!object || typeof object.id !== 'string' || !object.id || ids.has(object.id)
      || typeof object.name !== 'string' || !object.name || !validDesignations(object.designations)
      || typeof object.type !== 'string' || !NEBULA_OBJECT_TYPES.includes(object.type as never)
      || !['x_pc', 'y_pc', 'z_pc', 'epoch'].every((field) => typeof object[field] === 'number' && Number.isFinite(object[field]))
      || object.epoch !== manifest.epoch || object.absolute_mag !== null || !validDetails(object.nebula)) {
      throw new Error(`Invalid nebula payload row: ${String(object?.id ?? 'unknown')}`)
    }
    const { ra_deg, dec_deg, distance_pc } = object.nebula
    const expected = equatorialToGalacticPc(ra_deg, dec_deg, distance_pc)
    if ((['x_pc', 'y_pc', 'z_pc'] as const).some((axis) => Math.abs((object[axis] as number) - expected[axis]) > POSITION_TOLERANCE_PC)) {
      throw new Error(`Nebula position does not match its RA/Dec/distance: ${object.id}`)
    }
    ids.add(object.id)
  }
  if (NEBULA_OBJECT_TYPES.some((type) => objects.filter((object) => object.type === type).length !== manifest.counts[type])) {
    throw new Error('Nebula type counts do not match the manifest.')
  }
  return objects as unknown as Star[]
}
