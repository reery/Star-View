import Papa from 'papaparse'
import { CATALOG_HEADERS, parseStarCatalog, type Star } from './catalog.ts'
import { DEFAULT_CATALOG_MANIFEST, type CatalogManifest } from './catalog-manifest.ts'

export { DEFAULT_CATALOG_MANIFEST, parseCatalogManifest, type CatalogManifest } from './catalog-manifest.ts'
export { catalogSelection } from './catalog-selection.ts'

export interface CatalogDefinition {
  manifest: CatalogManifest
  csv: string
}

export function loadCatalog(definition: CatalogDefinition): Star[] {
  const stars = parseStarCatalog(definition.csv)
  if (stars.length !== definition.manifest.objectCount) throw new Error('Catalog objectCount does not match CSV rows.')
  if (stars.some((star) => star.epoch !== definition.manifest.epoch)) throw new Error('Catalog manifest epoch does not match CSV.')
  return stars
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
    radii: objects.filter((star) => star.radius_solar !== null).length,
    metallicities: objects.filter((star) => star.metallicity_dex !== null).length,
    ages: objects.filter((star) => star.age_gyr !== null).length,
    velocities: objects.filter((star) => [star.vx_kms, star.vy_kms, star.vz_kms].every((value) => value !== null)).length,
    rawAstrometry: objects.filter((star) => star.raw_astrometry !== null).length,
    radialVelocities: objects.filter((star) => star.raw_astrometry?.radial_velocity_kms !== null && star.raw_astrometry?.radial_velocity_kms !== undefined).length,
    transverseOnly: objects.filter((star) => star.raw_astrometry !== null && star.raw_astrometry.radial_velocity_kms === null).length,
  }
}

function catalogRecord(star: Star): Record<typeof CATALOG_HEADERS[number], string | number | null> {
  const raw = star.raw_astrometry
  return {
    type: star.type,
    id: star.id,
    name: star.name,
    spectral_type: star.spectral_type,
    x_pc: star.x_pc,
    y_pc: star.y_pc,
    z_pc: star.z_pc,
    vx_kms: star.vx_kms,
    vy_kms: star.vy_kms,
    vz_kms: star.vz_kms,
    temperature_k: star.temperature_k,
    mass_solar: star.mass_solar,
    luminosity_solar: star.luminosity_solar,
    absolute_mag: star.absolute_mag,
    epoch: star.epoch,
    notes: star.notes,
    constellation: star.constellation,
    radius_solar: star.radius_solar,
    metallicity_dex: star.metallicity_dex,
    age_gyr: star.age_gyr,
    ra_deg: raw?.ra_deg ?? null,
    dec_deg: raw?.dec_deg ?? null,
    astrometry_epoch: raw?.epoch ?? null,
    parallax_mas: raw?.parallax_mas ?? null,
    parallax_error_mas: raw?.parallax_error_mas ?? null,
    pm_ra_cosdec_masyr: raw?.pm_ra_cosdec_masyr ?? null,
    pm_ra_error_masyr: raw?.pm_ra_error_masyr ?? null,
    pm_dec_masyr: raw?.pm_dec_masyr ?? null,
    pm_dec_error_masyr: raw?.pm_dec_error_masyr ?? null,
    radial_velocity_kms: raw?.radial_velocity_kms ?? null,
    radial_velocity_error_kms: raw?.radial_velocity_error_kms ?? null,
    astrometry_ref: raw?.astrometry_ref ?? null,
    radial_velocity_ref: raw?.radial_velocity_ref ?? null,
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
  const csv = Papa.unparse({ fields: [...CATALOG_HEADERS], data: selected.map(catalogRecord) }, { newline: '\n' }) + '\n'
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
