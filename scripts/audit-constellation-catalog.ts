/** Read-only scientific census using the same completion chain as catalog generation.
 * Coverage is availability, not evidence that a value is independently measured.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { loadCatalog, parseCatalogManifest, DEFAULT_CATALOG_MANIFEST } from '../src/catalogs.ts'
import { completeCatalogCompanions } from '../src/stellar-companions.ts'
import { starComponentIdentity, reviewedStarSystems } from '../src/star-systems.ts'
import { parseObjectIdentities, supplementObjectIdentities } from '../src/designations.ts'
import { parseObjectStats, supplementObjectStats } from '../src/object-stats.ts'
import { supplementStellarObservations } from '../src/stellar-observations.ts'
import { auditCatalogConsistency } from '../src/catalog-consistency.ts'
import { missingCatalogMeasurements } from '../src/catalog-source.ts'
import type { Star } from '../src/catalog-model.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const inputs = new Map<string, string>()
function read(path: string): string {
  const text = readFileSync(root + path, 'utf8')
  inputs.set(path, createHash('sha256').update(text).digest('hex'))
  return text
}
function json<T>(path: string): T { return JSON.parse(read(path)) as T }
const known = (value: unknown): boolean => value != null && value !== ''
const canonical = (id: string): string => starComponentIdentity(id)?.canonicalStarId ?? id
const fields = ['temperature_k', 'mass_solar', 'radius_solar', 'luminosity_solar',
  'metallicity_dex', 'age_gyr', 'absolute_mag', 'spectral_type'] as const
const core = ['temperature_k', 'mass_solar', 'radius_solar', 'luminosity_solar'] as const
const identities = parseObjectIdentities(json('src/data/object-designations.json'))
const stats = parseObjectStats(json('src/data/object-stats.json'))
const supplement = (stars: readonly Star[]): Star[] => supplementStellarObservations(
  supplementObjectStats(supplementObjectIdentities(stars, identities), stats))

interface Chart { name: string; stars: { hip: number; object: Star }[] }
interface LiteratureReview {
  reviewedOn: string
  scope: string
  sources: { id: string; url: string; finding: string; releaseStatus?: string }[]
  systems: { systemId: string; expectedMembers: Record<string, string>; finding: string; sourceIds: string[]; action: string; adoptionStatus?: string }[]
}

function build() {
  // Hash imported scientific inputs too; this report never relies on generated payloads.
  for (const path of ['src/data/stellar-companions.json', 'src/data/stellar-system-identities.json',
    'src/data/stellar-observations.json', 'src/companion-records.ts', 'src/catalog.ts',
    'src/catalog-consistency.ts', 'src/star-systems.ts', 'src/designations.ts',
    'src/object-stats.ts', 'src/stellar-observations.ts', 'scripts/audit-constellation-catalog.ts']) read(path)
  const literature = json<LiteratureReview>('catalog-work/constellation-audit/source-review.json')
  const catalogs = ['src/data', ...readdirSync(root + 'src/data/catalogs', { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => `src/data/catalogs/${entry.name}`)].map((directory) => {
    const manifest = directory === 'src/data' ? DEFAULT_CATALOG_MANIFEST : parseCatalogManifest(read(`${directory}/catalog.json`))
    const raw = supplement(loadCatalog({ manifest, csv: read(`${directory}/stars.csv`) }))
    const effective = completeCatalogCompanions(raw)
    for (const star of raw) {
      const completed = effective.find((candidate) => candidate.id === star.id)!
      const lost = missingCatalogMeasurements(star, completed)
      if (lost.length) throw new Error(`Unretained input: ${manifest.id}/${star.id}: ${lost.join(', ')}`)
    }
    return { id: manifest.id, raw, effective }
  })
  const consistency = auditCatalogConsistency(catalogs.map((catalog) => ({ id: catalog.id, stars: catalog.effective })),
    identities, starComponentIdentity)
  if (consistency.conflicts.length) throw new Error(`Cross-catalog conflict: ${JSON.stringify(consistency.conflicts)}`)
  const western = catalogs.find((catalog) => catalog.id === 'western-constellation-stars')!
  const rawById = new Map(western.raw.map((star) => [canonical(star.id), star]))
  const effective = western.effective.filter((star) => star.id !== 'sun')
  const byId = new Map(effective.map((star) => [canonical(star.id), star]))
  if (byId.size !== effective.length) throw new Error('Duplicate effective component identity')
  const chartFiles = readdirSync(root + 'src/data/constellations').filter((file) => file.endsWith('.json') && !/ \d/.test(file)).sort()
  const charts = chartFiles.map((file) => json<Chart>(`src/data/constellations/${file}`))
  const hips = new Set(charts.flatMap((chart) => chart.stars.map((star) => star.hip)))
  const provenance = json<{ uniqueHipparcosStars: number; figureConstellations: number; objects: Record<string, unknown> }>(
    'src/data/catalogs/western-constellation-stars/provenance.json')
  if (charts.length !== 88 || hips.size !== provenance.uniqueHipparcosStars || charts.length !== provenance.figureConstellations) {
    throw new Error('Constellation membership/coverage drift')
  }
  const figures = new Map<string, Set<string>>()
  const chartDifferences: { chart: string; starId: string; field: string; embedded: unknown; catalog: unknown }[] = []
  const comparisonFields = [...fields, 'x_pc', 'y_pc', 'z_pc', 'vx_kms', 'vy_kms', 'vz_kms', 'raw_astrometry'] as const
  for (const chart of charts) for (const figure of chart.stars) {
    const id = canonical(figure.object.id)
    if (!byId.has(id)) throw new Error(`Chart vertex missing from overlay: ${chart.name}/${id}`)
    if (!figures.has(id)) figures.set(id, new Set())
    figures.get(id)!.add(chart.name)
    // Companion replacement is also used for unloaded chart selections in the app.
    const fallback = completeCatalogCompanions([{ ...figure.object, id }])[0]!
    const current = byId.get(id)!
    for (const field of comparisonFields) if (!isDeepStrictEqual(fallback[field] ?? null, current[field] ?? null)) {
      chartDifferences.push({ chart: chart.name, starId: id, field, embedded: fallback[field] ?? null, catalog: current[field] ?? null })
    }
  }
  const articleIds = new Set<string>()
  for (const file of ['star-info', 'nearest-100-info', 'constellation-star-info']) {
    for (const id of Object.keys(json<{ articles: Record<string, unknown> }>(`src/data/${file}.json`).articles)) articleIds.add(id)
  }
  const hasInfo = (star: Star): boolean => {
    const identity = starComponentIdentity(star.id)
    return [identity?.systemId ?? star.id, identity?.canonicalStarId ?? star.id].some((id) => articleIds.has(id))
  }
  const coverage = (stars: readonly Star[]) => ({ objects: stars.length,
    fields: Object.fromEntries(fields.map((field) => [field, { available: stars.filter((star) => known(star[field])).length,
      missing: stars.filter((star) => !known(star[field])).length }])),
    infoArticles: stars.filter(hasInfo).length,
    noCorePhysicalFields: stars.filter((star) => core.every((field) => !known(star[field]))).length,
    allCorePhysicalFields: stars.filter((star) => core.every((field) => known(star[field]))).length,
    radialVelocity: stars.filter((star) => known(star.raw_astrometry?.radial_velocity_kms)).length,
    radialVelocityWithError: stars.filter((star) => known(star.raw_astrometry?.radial_velocity_kms) && known(star.raw_astrometry?.radial_velocity_error_kms)).length,
    properMotionWithBothErrors: stars.filter((star) => known(star.raw_astrometry?.pm_ra_cosdec_masyr)
      && known(star.raw_astrometry?.pm_dec_masyr) && known(star.raw_astrometry?.pm_ra_error_masyr) && known(star.raw_astrometry?.pm_dec_error_masyr)).length,
  })
  const componentAuditPath = 'catalog-work/star-systems/catalog-companions-audit.json'
  const componentAudit = json<{ componentRecords: Record<string, unknown> }>(componentAuditPath)
  const objects = effective.map((star) => {
    const id = canonical(star.id), identity = starComponentIdentity(id), raw = rawById.get(id)
    return { starId: id, catalogStarId: star.id, name: star.name, systemId: identity?.systemId ?? null,
      component: identity?.label ?? null, figureConstellations: [...figures.get(id) ?? []].sort(),
      addedBySystemCompletion: !raw, hasInfoArticle: hasInfo(star),
      values: Object.fromEntries(fields.map((field) => [field, star[field] ?? null])),
      missingFields: fields.filter((field) => !known(star[field])),
      fieldsSuppliedByCompletion: raw ? fields.filter((field) => !known(raw[field]) && known(star[field])) : [],
      withheldIndividualFields: star.notes.match(/Withheld individual fields: ([^.]+)\./)?.[1]?.split(', ') ?? [],
      retainedSourceCount: star.catalog_sources?.length ?? 0,
      unresolvedPhotometry: star.unresolved_photometry ?? null,
      rawAstrometry: star.raw_astrometry,
      evidenceLocation: identity && componentAudit.componentRecords[id] ? `${componentAuditPath}#/componentRecords/${id}`
        : `src/data/catalogs/western-constellation-stars/provenance.json#/objects/${star.id}`,
      notes: star.notes }
  }).sort((a, b) => a.starId.localeCompare(b.starId, 'en'))
  const systems = reviewedStarSystems.filter((system) => system.components.some((member) => byId.has(member.starId))).map((system) => {
    const stars = system.components.map((member) => {
      const star = byId.get(member.starId)
      if (!star) throw new Error(`System closure incomplete: ${system.id}/${member.starId}`)
      return star
    })
    return { systemId: system.id, name: system.name, members: stars.map((star) => canonical(star.id)), coverage: coverage(stars) }
  }).sort((a, b) => b.coverage.noCorePhysicalFields - a.coverage.noCorePhysicalFields || a.systemId.localeCompare(b.systemId, 'en'))
  for (const review of literature.systems) {
    const system = systems.find((entry) => entry.systemId === review.systemId)
    if (!system || !isDeepStrictEqual([...system.members].sort(), Object.keys(review.expectedMembers).sort())) {
      throw new Error(`Literature-review membership drift: ${review.systemId}`)
    }
    for (const [id, name] of Object.entries(review.expectedMembers)) if (byId.get(id)?.name !== name) {
      throw new Error(`Literature-review name drift: ${id}`)
    }
    for (const id of review.sourceIds) if (!literature.sources.some((source) => source.id === id)) throw new Error(`Missing literature source: ${id}`)
  }
  const manifests = ['catalog-work/western-constellation-stars/source-manifest.json',
    'catalog-work/landmark-stars/source-manifest.json', 'catalog-work/shared-enrichment/source-manifest.json']
    .map((path) => ({ path, content: json<unknown>(path) }))
  const components = effective.filter((star) => starComponentIdentity(star.id))
  return { schemaVersion: 1, reviewedOn: literature.reviewedOn,
    catalogChangesApplied: literature.systems.some((review) => review.adoptionStatus?.startsWith('adopted')),
    scope: 'All 88 charts, the Western constellation overlay, every explicitly associated component and all six effective stellar catalogs. Complete availability/consistency census; targeted live primary-literature checks, not an exhaustive literature review or validation of every adopted measurement.',
    policy: 'The census does not adopt values; completed literature adoptions are identified in sourceReview. Nulls include unreviewed/unknown/inapplicable and scope-withheld values, not proof that no measurement exists. A represented component may itself be unresolved. Counts include estimates, model results, shared quantities and derived values. No inferred companions, no blended-to-individual copying.',
    sourceReview: literature, sourceManifests: manifests,
    summary: { charts: charts.length, figureHipparcosStars: hips.size, rawOverlayNonSunRows: western.raw.length - 1,
      effectiveOverlayNonSunRows: effective.length, additionalRecordsFromCompletion: effective.length - (western.raw.length - 1),
      representedMultipleSystems: systems.length, overall: coverage(effective), representedComponents: coverage(components),
      withoutReviewedSystemIdentity: coverage(effective.filter((star) => !starComponentIdentity(star.id))),
      rawRowsWithFieldsSuppliedByCompletion: objects.filter((object) => object.fieldsSuppliedByCompletion.length).length,
      fieldsSuppliedByCompletion: objects.reduce((total, object) => total + object.fieldsSuppliedByCompletion.length, 0),
      crossCatalogSharedObjects: consistency.sharedObjects, crossCatalogConflicts: consistency.conflicts.length,
      chartFallbackDifferences: chartDifferences.length },
    catalogs: catalogs.map((catalog) => ({ catalogId: catalog.id, rawNonSunRows: catalog.raw.length - 1,
      effective: coverage(catalog.effective.filter((star) => star.id !== 'sun')) })),
    perConstellation: charts.map((chart) => ({ constellation: chart.name,
      figureStars: coverage(chart.stars.map((figure) => byId.get(canonical(figure.object.id))!)) })),
    systems, objects, chartFallbackDifferences: chartDifferences,
    inputSha256: Object.fromEntries([...inputs].sort(([a], [b]) => a.localeCompare(b, 'en'))) }
}

const args = process.argv.slice(2)
if (args.some((arg) => arg !== '--check')) throw new Error('Usage: node scripts/audit-constellation-catalog.ts [--check]')
const report = build()
const output = 'catalog-work/constellation-audit/coverage.json'
const content = JSON.stringify(report, null, 2) + '\n'
if (args.includes('--check')) {
  if (readFileSync(root + output, 'utf8') !== content) throw new Error('Constellation audit is stale; regenerate and review it.')
  if (report.chartFallbackDifferences.length) throw new Error('Embedded chart measurements differ from the effective catalog.')
} else {
  mkdirSync(root + 'catalog-work/constellation-audit', { recursive: true })
  writeFileSync(root + output, content)
}
console.log(JSON.stringify(report.summary, null, 2))
