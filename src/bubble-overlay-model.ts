import { BUBBLE_OBJECT_TYPES, type BubbleDetails, type BubbleObjectType, type Star } from './catalog-model.ts'

export interface BubbleOverlayManifest {
  schemaVersion: 1
  id: 'bubbles'
  label: string
  description: string
  epoch: number
  objectCount: number
  counts: Record<BubbleObjectType, number>
  sources: { name: string; url: string }[]
  cutoffPolicy: string
  snapshot: string
}

export function parseBubbleOverlayManifest(raw: string): BubbleOverlayManifest {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw new Error('Bubble manifest must be an object.')
  const manifest = value as Record<string, unknown>
  if (manifest.schemaVersion !== 1 || manifest.id !== 'bubbles') throw new Error('Invalid bubble manifest.')
  if (typeof manifest.epoch !== 'number' || !Number.isFinite(manifest.epoch)
    || typeof manifest.objectCount !== 'number' || !Number.isInteger(manifest.objectCount)
    || !manifest.counts || typeof manifest.counts !== 'object'
    || !BUBBLE_OBJECT_TYPES.every((type) => Number.isInteger((manifest.counts as Record<string, unknown>)[type]))) {
    throw new Error('Invalid bubble manifest counts.')
  }
  return manifest as unknown as BubbleOverlayManifest
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function finitePositive(value: unknown): value is number {
  return finite(value) && value > 0
}

function strings(value: unknown, minimum = 1): value is string[] {
  return Array.isArray(value) && value.length >= minimum && value.every((entry) => typeof entry === 'string' && entry.length > 0)
}

function pair(value: unknown, positive = false): value is [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(positive ? finitePositive : finite)) return false
  return value[0]! < value[1]!
}

function triple(value: unknown, positive = false): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(positive ? finitePositive : finite)
}

function validSurfaceGrid(value: unknown, minimum: number, maximum: number): boolean {
  if (!value || typeof value !== 'object') return false
  const grid = value as Record<string, unknown>
  const longitudeSegments = grid.longitude_segments
  const latitudeSegments = grid.latitude_segments
  const radii = grid.radii_pc
  return grid.schema_version === 1
    && typeof grid.source_url === 'string' && /^https:\/\//.test(grid.source_url)
    && typeof grid.source_commit === 'string' && /^[0-9a-f]{40}$/.test(grid.source_commit)
    && typeof grid.sampling === 'string' && grid.sampling.length > 0
    && Number.isInteger(longitudeSegments) && (longitudeSegments as number) >= 16 && (longitudeSegments as number) <= 256
    && Number.isInteger(latitudeSegments) && (latitudeSegments as number) >= 8 && (latitudeSegments as number) <= 128
    && Number.isInteger(grid.source_point_count) && (grid.source_point_count as number) > 0
    && Array.isArray(grid.source_bounds_pc) && grid.source_bounds_pc.length === 6 && grid.source_bounds_pc.every(finite)
    && Array.isArray(radii) && radii.length === (longitudeSegments as number) * ((latitudeSegments as number) + 1)
    && radii.every((radius) => finite(radius) && radius >= minimum && radius <= maximum)
}

function validShape(value: unknown, minimum: number, maximum: number): boolean {
  if (!value || typeof value !== 'object') return false
  const shape = value as Record<string, unknown>
  if (!triple(shape.origin_pc)) return false
  if (shape.kind === 'directional_grid') return validSurfaceGrid(shape.surface_grid, minimum, maximum)
  if (shape.kind !== 'analytic') return false
  const features = shape.features
  return finitePositive(shape.base_radius_pc) && triple(shape.axis_scale, true)
    && Array.isArray(features) && features.every((entry) => {
      if (!entry || typeof entry !== 'object') return false
      const feature = entry as Record<string, unknown>
      return finite(feature.longitude_deg) && feature.longitude_deg >= 0 && feature.longitude_deg < 360
        && finite(feature.latitude_deg) && Math.abs(feature.latitude_deg) <= 90
        && finite(feature.amplitude_pc) && finitePositive(feature.width_deg) && feature.width_deg <= 180
    })
    && finite(shape.roughness_pc) && shape.roughness_pc >= 0 && Number.isInteger(shape.seed)
}

export function hydrateBubbleSurfaceGridFiles(value: unknown, load: (filename: string) => unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const objects = (value as Record<string, unknown>).objects
  if (!Array.isArray(objects)) return value
  for (const object of objects) {
    if (!object || typeof object !== 'object') continue
    const bubble = (object as Record<string, unknown>).bubble
    if (!bubble || typeof bubble !== 'object') continue
    const shape = (bubble as Record<string, unknown>).shape
    if (!shape || typeof shape !== 'object') continue
    const sourceShape = shape as Record<string, unknown>
    if (sourceShape.kind !== 'directional_grid' || typeof sourceShape.surface_grid_file !== 'string') continue
    const filename = sourceShape.surface_grid_file
    if (!/^[a-z0-9-]+\.json$/.test(filename)) throw new Error(`Invalid bubble surface grid file: ${filename}`)
    sourceShape.surface_grid = load(filename)
    delete sourceShape.surface_grid_file
  }
  return value
}

function validDetails(value: unknown): value is BubbleDetails {
  if (!value || typeof value !== 'object') return false
  const details = value as Record<string, unknown>
  const bounds = details.reported_bounds_pc as Record<string, unknown> | undefined
  const shape = details.shape as Record<string, unknown> | undefined
  const palette = details.palette as Record<string, unknown> | undefined
  const distanceRange = details.surface_distance_range_pc
  const openMaximum = Array.isArray(distanceRange) && finite(distanceRange[1])
    ? distanceRange[1] * (details.surface_distance_max_open === true ? 1.1 : 1)
    : NaN
  return strings(details.designations)
    && finitePositive(details.average_radius_pc)
    && pair(distanceRange, true)
    && typeof details.surface_distance_max_open === 'boolean'
    && finitePositive(details.shell_thickness_pc)
    && !!bounds && pair(bounds.x) && pair(bounds.y) && pair(bounds.z)
    && validShape(shape, distanceRange[0], openMaximum)
    && !!palette && /^#[0-9a-f]{6}$/i.test(String(palette.real)) && /^#[0-9a-f]{6}$/i.test(String(palette.exaggerated))
    && finitePositive(details.opacity) && details.opacity <= 0.2
    && ['position_source', 'source_label', 'source_url', 'model_note']
      .every((field) => typeof details[field] === 'string' && (details[field] as string).length > 0)
    && /^https:\/\//.test(details.source_url as string)
}

export function parseBubbleOverlayPayload(value: unknown, manifest: BubbleOverlayManifest): Star[] {
  if (!value || typeof value !== 'object') throw new Error('Bubble payload must be an object.')
  const payload = value as Record<string, unknown>
  if (payload.schemaVersion !== 1 || payload.overlayId !== manifest.id || !Array.isArray(payload.objects)) {
    throw new Error('Invalid bubble payload.')
  }
  if (payload.objects.length !== manifest.objectCount) throw new Error('Bubble count does not match its manifest.')
  const objects = payload.objects as Record<string, unknown>[]
  const ids = new Set<string>()
  for (const object of objects) {
    if (!object || typeof object.id !== 'string' || !object.id || ids.has(object.id)
      || typeof object.name !== 'string' || !object.name
      || typeof object.type !== 'string' || !BUBBLE_OBJECT_TYPES.includes(object.type as never)
      || !['x_pc', 'y_pc', 'z_pc', 'epoch'].every((field) => finite(object[field]))
      || object.epoch !== manifest.epoch || object.absolute_mag !== null || !validDetails(object.bubble)) {
      throw new Error(`Invalid bubble payload row: ${String(object?.id ?? 'unknown')}`)
    }
    ids.add(object.id)
  }
  if (BUBBLE_OBJECT_TYPES.some((type) => objects.filter((object) => object.type === type).length !== manifest.counts[type])) {
    throw new Error('Bubble type counts do not match the manifest.')
  }
  return objects as unknown as Star[]
}
