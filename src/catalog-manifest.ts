export interface CatalogManifest {
  schemaVersion: 1
  id: string
  label: string
  description: string
  epoch: number
  objectCount: number
  sources: { name: string; url: string }[]
  cutoffPolicy: string
  snapshot: string
}

export const DEFAULT_CATALOG_MANIFEST: CatalogManifest = {
  schemaVersion: 1,
  id: 'nearest-neighbors',
  label: 'Nearest neighbors',
  description: 'The original 21 nearby stellar/substellar objects plus Sun.',
  epoch: 2000,
  objectCount: 22,
  sources: [{ name: 'RECONS nearby-star census', url: 'https://www.recons.org/TOP100.posted.htm' }],
  cutoffPolicy: 'Preserved original individual-object sample; not 20 systems or a complete census.',
  snapshot: 'J2000.0; source notes and adopted values retained per object.',
}

export function parseCatalogManifest(raw: string): CatalogManifest {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw new Error('Catalog manifest must be an object.')
  const manifest = value as Record<string, unknown>
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported catalog schemaVersion.')
  for (const field of ['id', 'label', 'description', 'cutoffPolicy', 'snapshot']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) throw new Error(`Catalog manifest requires ${field}.`)
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id as string)) throw new Error('Invalid catalog id.')
  if (typeof manifest.epoch !== 'number' || !Number.isFinite(manifest.epoch)) throw new Error('Invalid catalog epoch.')
  if (!Number.isInteger(manifest.objectCount) || (manifest.objectCount as number) < 1) throw new Error('Invalid catalog objectCount.')
  if (!Array.isArray(manifest.sources) || !manifest.sources.length || manifest.sources.some((source: unknown) => {
    if (!source || typeof source !== 'object') return true
    const entry = source as Record<string, unknown>
    return typeof entry.name !== 'string' || !entry.name.trim() || typeof entry.url !== 'string' || !/^https?:\/\//.test(entry.url)
  })) throw new Error('Catalog sources require names and http(s) URLs.')
  return manifest as unknown as CatalogManifest
}