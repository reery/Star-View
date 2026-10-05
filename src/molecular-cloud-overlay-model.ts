import { validDesignations } from './designations.ts'
import { MOLECULAR_CLOUD_OBJECT_TYPES, type MolecularCloudDetails, type MolecularCloudObjectType, type Star } from './catalog-model.ts'

export interface MolecularCloudOverlayManifest {
  schemaVersion: 1
  id: 'molecular-clouds'
  label: string
  description: string
  epoch: number
  objectCount: number
  counts: Record<MolecularCloudObjectType, number>
  sourceVoxelCount: number
  displaySampleCount: number
  sources: { name: string; url: string }[]
  cutoffPolicy: string
  snapshot: string
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function finitePositive(value: unknown): value is number {
  return finite(value) && value > 0
}

function pair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(finite) && value[0]! <= value[1]!
}

function validPalette(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const palette = value as Record<string, unknown>
  return ['body', 'rim'].every((key) => typeof palette[key] === 'string' && /^#[0-9a-f]{6}$/i.test(palette[key] as string))
}

function validDetails(value: unknown): value is MolecularCloudDetails {
  if (!value || typeof value !== 'object') return false
  const details = value as Record<string, unknown>
  const bounds = details.bounds_pc as Record<string, unknown> | undefined
  const palette = details.palette as Record<string, unknown> | undefined
  const points = details.sample_points_pc
  return Number.isInteger(details.catalog_id) && (details.catalog_id as number) >= 0
    && (details.complex_name === null || (typeof details.complex_name === 'string' && details.complex_name.length > 0))
    && finitePositive(details.distance_pc)
    && finite(details.galactic_longitude_deg) && (details.galactic_longitude_deg as number) >= 0 && (details.galactic_longitude_deg as number) < 360
    && finite(details.galactic_latitude_deg) && Math.abs(details.galactic_latitude_deg as number) <= 90
    && ['equivalent_radius_pc', 'mean_density_cm3', 'peak_density_cm3', 'surface_area_pc2', 'volume_pc3'].every((key) => finitePositive(details[key]))
    && (details.peak_density_cm3 as number) >= (details.mean_density_cm3 as number)
    && Number.isInteger(details.source_voxel_count) && (details.source_voxel_count as number) > 0
    && Array.isArray(points) && points.length >= 3 && points.length % 3 === 0 && points.every(finite)
    && (details.source_voxel_count as number) >= points.length / 3
    && !!bounds && pair(bounds.x) && pair(bounds.y) && pair(bounds.z)
    && !!palette && validPalette(palette.real) && validPalette(palette.exaggerated)
    && finitePositive(details.opacity) && (details.opacity as number) <= 0.3
    && ['position_source', 'source_label', 'source_url', 'model_note']
      .every((field) => typeof details[field] === 'string' && (details[field] as string).length > 0)
    && /^https:\/\//.test(details.source_url as string)
}

export function parseMolecularCloudOverlayManifest(raw: string): MolecularCloudOverlayManifest {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw new Error('Molecular-cloud manifest must be an object.')
  const manifest = value as Record<string, unknown>
  if (manifest.schemaVersion !== 1 || manifest.id !== 'molecular-clouds') throw new Error('Invalid molecular-cloud manifest.')
  if (!finite(manifest.epoch) || !Number.isInteger(manifest.objectCount)
    || !manifest.counts || typeof manifest.counts !== 'object'
    || !MOLECULAR_CLOUD_OBJECT_TYPES.every((type) => Number.isInteger((manifest.counts as Record<string, unknown>)[type]))
    || !Number.isInteger(manifest.sourceVoxelCount) || (manifest.sourceVoxelCount as number) <= 0
    || !Number.isInteger(manifest.displaySampleCount) || (manifest.displaySampleCount as number) <= 0) {
    throw new Error('Invalid molecular-cloud manifest counts.')
  }
  return manifest as unknown as MolecularCloudOverlayManifest
}

export function parseMolecularCloudOverlayPayload(value: unknown, manifest: MolecularCloudOverlayManifest): Star[] {
  if (!value || typeof value !== 'object') throw new Error('Molecular-cloud payload must be an object.')
  const payload = value as Record<string, unknown>
  if (payload.schemaVersion !== 1 || payload.overlayId !== manifest.id || !Array.isArray(payload.objects)) {
    throw new Error('Invalid molecular-cloud payload.')
  }
  if (payload.objects.length !== manifest.objectCount) throw new Error('Molecular-cloud count does not match its manifest.')
  const objects = payload.objects as Record<string, unknown>[]
  const ids = new Set<string>()
  let sourceVoxelCount = 0
  let displaySampleCount = 0
  for (const object of objects) {
    if (!object || typeof object.id !== 'string' || !object.id || ids.has(object.id)
      || typeof object.name !== 'string' || !object.name || !validDesignations(object.designations)
      || typeof object.type !== 'string' || !MOLECULAR_CLOUD_OBJECT_TYPES.includes(object.type as never)
      || !['x_pc', 'y_pc', 'z_pc', 'epoch', 'mass_solar'].every((field) => finite(object[field]))
      || object.epoch !== manifest.epoch || object.absolute_mag !== null || !validDetails(object.molecular_cloud)) {
      throw new Error(`Invalid molecular-cloud payload row: ${String(object?.id ?? 'unknown')}`)
    }
    const details = object.molecular_cloud
    const centerDistance = Math.hypot(object.x_pc as number, object.y_pc as number, object.z_pc as number)
    if (Math.abs(centerDistance - details.distance_pc) > 2) throw new Error(`Molecular-cloud distance does not match its center: ${object.id}`)
    const centerLongitude = (Math.atan2(object.y_pc as number, object.x_pc as number) * 180 / Math.PI + 360) % 360
    const centerLatitude = Math.asin((object.z_pc as number) / centerDistance) * 180 / Math.PI
    const longitudeDifference = Math.abs(((centerLongitude - details.galactic_longitude_deg + 540) % 360) - 180)
    // Published Cartesian centers are rounded to whole parsecs, while l/b retain
    // a decimal degree; allow the corresponding sub-degree roundoff nearby.
    if (longitudeDifference > 0.5 || Math.abs(centerLatitude - details.galactic_latitude_deg) > 0.5) {
      throw new Error(`Molecular-cloud direction does not match its center: ${object.id}`)
    }
    for (let index = 0; index < details.sample_points_pc.length; index += 3) {
      const x = details.sample_points_pc[index]!
      const y = details.sample_points_pc[index + 1]!
      const z = details.sample_points_pc[index + 2]!
      if (x < details.bounds_pc.x[0] || x > details.bounds_pc.x[1]
        || y < details.bounds_pc.y[0] || y > details.bounds_pc.y[1]
        || z < details.bounds_pc.z[0] || z > details.bounds_pc.z[1]) {
        throw new Error(`Molecular-cloud sample is outside its bounds: ${object.id}`)
      }
    }
    sourceVoxelCount += details.source_voxel_count
    displaySampleCount += details.sample_points_pc.length / 3
    ids.add(object.id)
  }
  if (objects.length !== manifest.counts.molecular_cloud
    || sourceVoxelCount !== manifest.sourceVoxelCount
    || displaySampleCount !== manifest.displaySampleCount) {
    throw new Error('Molecular-cloud payload totals do not match the manifest.')
  }
  return objects as unknown as Star[]
}
