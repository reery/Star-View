import { validDesignations } from './designations.ts'
import { MOLECULAR_CLOUD_OBJECT_TYPES, type DarkNebulaDetails, type DustGeometry, type MolecularCloudDetails, type MolecularCloudObjectType, type Star } from './catalog-model.ts'
import { finite, finitePositive, parseOverlayManifest } from './overlay-model.ts'

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

function pair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(finite) && value[0]! <= value[1]!
}

function validPalette(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const palette = value as Record<string, unknown>
  return ['body', 'rim'].every((key) => typeof palette[key] === 'string' && /^#[0-9a-f]{6}$/i.test(palette[key] as string))
}

function validGeometry(value: unknown): value is DustGeometry {
  if (!value || typeof value !== 'object') return false
  const details = value as Record<string, unknown>
  const bounds = details.bounds_pc as Record<string, unknown> | undefined
  const palette = details.palette as Record<string, unknown> | undefined
  const points = details.sample_points_pc
  return Number.isInteger(details.catalog_id) && (details.catalog_id as number) >= 0
    && ['mean_density_cm3', 'peak_density_cm3'].every((key) => finitePositive(details[key]))
    && (details.peak_density_cm3 as number) >= (details.mean_density_cm3 as number)
    && Number.isInteger(details.source_voxel_count) && (details.source_voxel_count as number) > 0
    && Array.isArray(points) && points.length >= 3 && points.length % 3 === 0 && points.every(finite)
    && (details.source_voxel_count as number) >= points.length / 3
    && !!bounds && pair(bounds.x) && pair(bounds.y) && pair(bounds.z)
    && !!palette && validPalette(palette.real) && validPalette(palette.exaggerated)
    && finitePositive(details.opacity) && (details.opacity as number) <= 0.3
}

const text = (value: unknown) => typeof value === 'string' && value.length > 0

function validDetails(value: unknown): value is MolecularCloudDetails {
  if (!validGeometry(value)) return false
  const details = value as unknown as Record<string, unknown>
  const association = details.association as Record<string, unknown> | undefined
  return (details.complex_name === null || text(details.complex_name))
    && (association === undefined || (!!association && text(association.name) && text(association.source)))
    && finitePositive(details.distance_pc)
    && finite(details.galactic_longitude_deg) && (details.galactic_longitude_deg as number) >= 0 && (details.galactic_longitude_deg as number) < 360
    && finite(details.galactic_latitude_deg) && Math.abs(details.galactic_latitude_deg as number) <= 90
    && ['equivalent_radius_pc', 'surface_area_pc2', 'volume_pc3'].every((key) => finitePositive(details[key]))
    && ['position_source', 'source_label', 'source_url', 'model_note'].every((field) => text(details[field]))
    && /^https:\/\//.test(details.source_url as string)
}

function validDarkNebula(value: unknown): value is DarkNebulaDetails {
  if (!value || typeof value !== 'object') return false
  const details = value as Record<string, unknown>
  const range = details.distance_range_pc
  return text(details.catalog)
    && finite(details.galactic_longitude_deg) && (details.galactic_longitude_deg as number) >= 0 && (details.galactic_longitude_deg as number) < 360
    && finite(details.galactic_latitude_deg) && Math.abs(details.galactic_latitude_deg as number) <= 90
    && finitePositive(details.angular_diameter_arcmin)
    && (details.opacity_class === null || (Number.isInteger(details.opacity_class) && (details.opacity_class as number) >= 1 && (details.opacity_class as number) <= 6))
    && finitePositive(details.distance_pc) && pair(range) && range[0] <= (details.distance_pc as number) && (details.distance_pc as number) <= range[1]
    && (details.parent_cloud_id === null) === (details.geometry !== null)
    && (details.parent_cloud_id === null || text(details.parent_cloud_id))
    && (details.geometry === null || validGeometry(details.geometry))
    && ['distance_source', 'position_source', 'source_label', 'source_url', 'distance_url'].every((field) => text(details[field]))
    && /^https:\/\//.test(details.source_url as string) && /^https:\/\//.test(details.distance_url as string)
}

function samplesInBounds(geometry: DustGeometry): boolean {
  const { sample_points_pc: points, bounds_pc: bounds } = geometry
  for (let index = 0; index < points.length; index += 3) {
    if (points[index]! < bounds.x[0] || points[index]! > bounds.x[1]
      || points[index + 1]! < bounds.y[0] || points[index + 1]! > bounds.y[1]
      || points[index + 2]! < bounds.z[0] || points[index + 2]! > bounds.z[1]) return false
  }
  return true
}

function matchesDirection(object: Record<string, unknown>, distance: number, longitude: number, latitude: number, tolerancePc: number, toleranceDeg: number): boolean {
  const centerDistance = Math.hypot(object.x_pc as number, object.y_pc as number, object.z_pc as number)
  const centerLongitude = (Math.atan2(object.y_pc as number, object.x_pc as number) * 180 / Math.PI + 360) % 360
  const centerLatitude = Math.asin((object.z_pc as number) / centerDistance) * 180 / Math.PI
  const longitudeDifference = Math.abs(((centerLongitude - longitude + 540) % 360) - 180)
  return Math.abs(centerDistance - distance) <= tolerancePc
    && longitudeDifference * Math.cos(latitude * Math.PI / 180) <= toleranceDeg && Math.abs(centerLatitude - latitude) <= toleranceDeg
}

export function parseMolecularCloudOverlayManifest(raw: string): MolecularCloudOverlayManifest {
  const manifest = parseOverlayManifest<MolecularCloudOverlayManifest>(raw, 'molecular-clouds', 'Molecular-cloud', MOLECULAR_CLOUD_OBJECT_TYPES)
  if (!Number.isInteger(manifest.sourceVoxelCount) || manifest.sourceVoxelCount <= 0
    || !Number.isInteger(manifest.displaySampleCount) || manifest.displaySampleCount <= 0) {
    throw new Error('Invalid molecular-cloud manifest counts.')
  }
  return manifest
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
  const counts: Record<string, number> = { molecular_cloud: 0, dark_nebula: 0 }
  let sourceVoxelCount = 0
  let displaySampleCount = 0
  for (const object of objects) {
    const isCloud = object?.type === 'molecular_cloud'
    if (!object || typeof object.id !== 'string' || !object.id || ids.has(object.id)
      || typeof object.name !== 'string' || !object.name || !validDesignations(object.designations)
      || typeof object.type !== 'string' || !MOLECULAR_CLOUD_OBJECT_TYPES.includes(object.type as never)
      || !['x_pc', 'y_pc', 'z_pc', 'epoch'].every((field) => finite(object[field]))
      || object.epoch !== manifest.epoch || object.absolute_mag !== null
      || (isCloud ? !finite(object.mass_solar) || !validDetails(object.molecular_cloud) : object.mass_solar !== null || !validDarkNebula(object.dark_nebula))) {
      throw new Error(`Invalid molecular-cloud payload row: ${String(object?.id ?? 'unknown')}`)
    }
    if (isCloud) {
      const details = object.molecular_cloud as MolecularCloudDetails
      // Published Cartesian centers are rounded to whole parsecs, while l/b retain
      // a decimal degree; allow the corresponding sub-degree roundoff nearby.
      if (!matchesDirection(object, details.distance_pc, details.galactic_longitude_deg, details.galactic_latitude_deg, 2, 0.5)) {
        throw new Error(`Molecular-cloud center does not match its distance and direction: ${object.id}`)
      }
    } else {
      const details = object.dark_nebula as DarkNebulaDetails
      if (!matchesDirection(object, details.distance_pc, details.galactic_longitude_deg, details.galactic_latitude_deg, 0.1, 0.01)) {
        throw new Error(`Dark-nebula position does not match its distance and direction: ${object.id}`)
      }
    }
    const geometry = isCloud ? object.molecular_cloud as DustGeometry : (object.dark_nebula as DarkNebulaDetails).geometry
    if (geometry) {
      if (!samplesInBounds(geometry)) throw new Error(`Molecular-cloud sample is outside its bounds: ${object.id}`)
      sourceVoxelCount += geometry.source_voxel_count
      displaySampleCount += geometry.sample_points_pc.length / 3
    }
    counts[object.type as string]! += 1
    ids.add(object.id)
  }
  for (const object of objects) {
    const parent = (object.dark_nebula as DarkNebulaDetails | undefined)?.parent_cloud_id
    if (parent && !objects.some((candidate) => candidate.id === parent && candidate.type === 'molecular_cloud')) {
      throw new Error(`Dark nebula is anchored to a missing cloud: ${String(object.id)}`)
    }
  }
  if (Object.entries(counts).some(([type, count]) => (manifest.counts[type as MolecularCloudObjectType] ?? 0) !== count)
    || sourceVoxelCount !== manifest.sourceVoxelCount
    || displaySampleCount !== manifest.displaySampleCount) {
    throw new Error('Molecular-cloud payload totals do not match the manifest.')
  }
  return objects as unknown as Star[]
}
