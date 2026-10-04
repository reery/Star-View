import { COMPACT_OBJECT_TYPES, type CompactObjectDetails, type Star } from './catalog-model.ts'

export interface CompactOverlayManifest {
  schemaVersion: 1
  id: string
  label: string
  description: string
  epoch: number
  objectCount: number
  radiusLy: number
  counts: Record<'pulsar' | 'neutron_star' | 'black_hole', number>
  sources: { name: string; url: string }[]
  cutoffPolicy: string
  snapshot: string
}

export function parseCompactOverlayManifest(raw: string): CompactOverlayManifest {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw new Error('Compact-object manifest must be an object.')
  const manifest = value as Record<string, unknown>
  if (manifest.schemaVersion !== 1 || manifest.id !== 'compact-remnants') throw new Error('Invalid compact-object manifest.')
  if (typeof manifest.epoch !== 'number' || !Number.isFinite(manifest.epoch)
    || typeof manifest.objectCount !== 'number' || !Number.isInteger(manifest.objectCount)
    || typeof manifest.radiusLy !== 'number' || !Number.isFinite(manifest.radiusLy)) {
    throw new Error('Invalid compact-object manifest counts or range.')
  }
  return manifest as unknown as CompactOverlayManifest
}

function finiteOrNull(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function isSafeSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.username === '' && url.password === ''
  } catch {
    return false
  }
}

function validDetails(value: unknown): value is CompactObjectDetails {
  if (!value || typeof value !== 'object') return false
  const details = value as Record<string, unknown>
  return (details.confidence === 'confirmed' || details.confidence === 'candidate')
    && ['distance_method', 'distance_source', 'position_source', 'detection_method', 'source_label'].every((field) => typeof details[field] === 'string')
    && isSafeSourceUrl(details.source_url)
    && ['mass_error_solar', 'rotation_period_s', 'rotation_period_error_s', 'radio_luminosity_1400_mjy_kpc2', 'characteristic_age_yr', 'surface_magnetic_field_gauss', 'spin_down_power_erg_s', 'orbital_period_days', 'orbital_period_error_days'].every((field) => finiteOrNull(details[field]))
    && (details.companion === null || typeof details.companion === 'string')
    && typeof details.ra_deg === 'number' && Number.isFinite(details.ra_deg)
    && typeof details.dec_deg === 'number' && Number.isFinite(details.dec_deg)
}

export function parseCompactOverlayPayload(value: unknown, manifest: CompactOverlayManifest): Star[] {
  if (!value || typeof value !== 'object') throw new Error('Compact-object payload must be an object.')
  const payload = value as Record<string, unknown>
  if (payload.schemaVersion !== 1 || payload.overlayId !== manifest.id || !Array.isArray(payload.objects)) {
    throw new Error('Invalid compact-object payload.')
  }
  if (payload.objects.length !== manifest.objectCount) throw new Error('Compact-object count does not match its manifest.')
  const objects = payload.objects as Record<string, unknown>[]
  const ids = new Set<string>()
  for (const object of objects) {
    if (!object || typeof object.id !== 'string' || !object.id || ids.has(object.id)
      || typeof object.name !== 'string' || !object.name
      || typeof object.type !== 'string' || !COMPACT_OBJECT_TYPES.includes(object.type as never)
      || !['x_pc', 'y_pc', 'z_pc', 'epoch'].every((field) => typeof object[field] === 'number' && Number.isFinite(object[field]))
      || object.epoch !== manifest.epoch || !validDetails(object.compact)) {
      throw new Error(`Invalid compact-object payload row: ${String(object.id ?? 'unknown')}`)
    }
    ids.add(object.id)
  }
  const counts = Object.fromEntries(COMPACT_OBJECT_TYPES.map((type) => [type, objects.filter((object) => object.type === type).length]))
  if (COMPACT_OBJECT_TYPES.some((type) => counts[type] !== manifest.counts[type])) throw new Error('Compact-object type counts do not match the manifest.')
  return objects as unknown as Star[]
}
