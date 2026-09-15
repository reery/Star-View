import Papa from 'papaparse'
import { CATALOG_HEADERS, parseStarCatalog, type Star } from './catalog.ts'

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

export interface CatalogDefinition {
  manifest: CatalogManifest
  csv: string
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

export function loadCatalog(definition: CatalogDefinition): Star[] {
  const stars = parseStarCatalog(definition.csv)
  if (stars.length !== definition.manifest.objectCount) throw new Error('Catalog objectCount does not match CSV rows.')
  if (stars.some((star) => star.epoch !== definition.manifest.epoch)) throw new Error('Catalog manifest epoch does not match CSV.')
  return stars
}

export function catalogSelection(stars: readonly Star[], selectedId: string | null, observerId: string) {
  return {
    selectedId: stars.some((star) => star.id === selectedId) ? selectedId : null,
    observerId: stars.some((star) => star.id === observerId) ? observerId : 'sun',
  }
}

export function catalogCoverage(stars: readonly Star[]) {
  const objects = stars.filter((star) => star.id !== 'sun')
  return {
    objects: objects.length,
    constellations: objects.filter((star) => star.constellation !== null).length,
    magnitudes: objects.filter((star) => star.absolute_mag !== null).length,
    temperatures: objects.filter((star) => star.temperature_k !== null).length,
    masses: objects.filter((star) => star.mass_solar !== null).length,
    luminosities: objects.filter((star) => star.luminosity_solar !== null).length,
    velocities: objects.filter((star) => [star.vx_kms, star.vy_kms, star.vz_kms].every((value) => value !== null)).length,
  }
}

export function buildCatalog(manifest: CatalogManifest, candidatesCsv: string, provenance: unknown) {
  if (manifest.id === DEFAULT_CATALOG_MANIFEST.id) throw new Error('nearest-neighbors is a reserved catalog id.')
  const candidates = parseStarCatalog(candidatesCsv)
  if (manifest.objectCount > candidates.length) throw new Error('Not enough candidates for objectCount.')
  if (candidates.some((star) => star.epoch !== manifest.epoch)) throw new Error('Candidate epoch does not match manifest.')
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) throw new Error('Provide per-object provenance keyed by stable ID.')
  const fields = provenance as Record<string, unknown>
  const distance = (star: Star) => Math.hypot(star.x_pc, star.y_pc, star.z_pc)
  const ranked = candidates.filter((star) => star.id !== 'sun').sort((first, second) =>
    distance(first) - distance(second) || (first.id < second.id ? -1 : first.id > second.id ? 1 : 0))
  const selected = [candidates.find((star) => star.id === 'sun')!, ...ranked.slice(0, manifest.objectCount - 1)]
  for (const star of candidates) {
    const entry = fields[star.id]
    if (!Object.hasOwn(fields, star.id) || !entry || typeof entry !== 'object' || Array.isArray(entry) || !Object.keys(entry).length) {
      throw new Error(`Missing object provenance: ${star.id}`)
    }
  }
  const csv = Papa.unparse({ fields: [...CATALOG_HEADERS], data: selected.map((star) => CATALOG_HEADERS.map((field) => star[field])) }, { newline: '\n' }) + '\n'
  loadCatalog({ manifest, csv })
  return {
    manifest,
    csv,
    provenance: {
      schemaVersion: 1,
      catalogId: manifest.id,
      policy: 'Already vetted native candidates; Sun first, then unrounded vector distance and stable ID. No astrometry, classification or photometry inferred.',
      coverage: catalogCoverage(selected),
      objects: Object.fromEntries(candidates.map((star) => [star.id, fields[star.id]])),
      ranking: ranked.map((star, index) => ({ id: star.id, rank: index + 1, distancePc: distance(star), selected: index < manifest.objectCount - 1 })),
    },
  }
}