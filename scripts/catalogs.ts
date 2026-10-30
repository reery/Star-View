import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { buildCatalog, catalogCoverage, composeCatalog, DEFAULT_CATALOG_MANIFEST, loadCatalog, parseCatalogManifest } from '../src/catalogs.ts'
import { parseCompactOverlayManifest, parseCompactOverlayPayload } from '../src/compact-overlay-model.ts'
import { parseNebulaOverlayManifest, parseNebulaOverlayPayload } from '../src/nebula-overlay-model.ts'
import { parseMolecularCloudOverlayManifest, parseMolecularCloudOverlayPayload } from '../src/molecular-cloud-overlay-model.ts'
import { hydrateBubbleSurfaceGridFiles, parseBubbleOverlayManifest, parseBubbleOverlayPayload } from '../src/bubble-overlay-model.ts'
import { containedInput, safeOutputDirectory, writeManagedFiles } from './filesystem.ts'
import { parseObjectIdentities, supplementObjectIdentities } from '../src/designations.ts'
import { buildCatalogClassReferences } from '../src/catalog-class-references.ts'
import { buildWhiteDwarfClassReferences } from '../src/white-dwarf-models.ts'
import { requiredWhiteDwarfReferences } from '../src/white-dwarf-class.ts'
import { parseObjectStats, supplementObjectStats } from '../src/object-stats.ts'
import { auditCatalogConsistency } from '../src/catalog-consistency.ts'
import { completeCatalogCompanions } from '../src/stellar-companions.ts'
import { missingCatalogMeasurements, withoutRetiredValues, type ReviewedRetirement } from '../src/catalog-source.ts'
import { reviewedStarSystems } from '../src/star-systems.ts'
import { supplementStellarObservations, supplementSurfaceGravity } from '../src/stellar-observations.ts'
import companionData from '../src/data/stellar-companions.json' with { type: 'json' }
import planetarySystems from '../src/data/planetary-systems.json' with { type: 'json' }
import nearbyPlanets from '../src/data/nearby-planets.json' with { type: 'json' }
import planetDetails from '../src/data/planet-details.json' with { type: 'json' }
import smallBodies from '../src/data/solar-small-bodies.json' with { type: 'json' }
import starInfo from '../src/data/star-info.json' with { type: 'json' }
import nearest100Info from '../src/data/nearest-100-info.json' with { type: 'json' }
import constellationStarInfo from '../src/data/constellation-star-info.json' with { type: 'json' }
import compactObjectInfo from '../src/data/compact-object-info.json' with { type: 'json' }
import legacyStarIds from '../src/data/legacy-star-ids.json' with { type: 'json' }
import { starComponentIdentity } from '../src/star-systems.ts'
import type { ConstellationChart } from '../src/constellations.ts'
import type { Star } from '../src/catalog-model.ts'
import { splitCatalogDetails } from '../src/catalog-detail-model.ts'
import stellarOrbits from '../src/data/stellar-orbits.json' with { type: 'json' }
import compactOrbits from '../src/data/compact-system-orbits.json' with { type: 'json' }

const root = fileURLToPath(new URL('../', import.meta.url))
const identities = parseObjectIdentities(JSON.parse(readFileSync(join(root, 'src/data/object-designations.json'), 'utf8')))
const objectStats = parseObjectStats(JSON.parse(readFileSync(join(root, 'src/data/object-stats.json'), 'utf8')))
const supplement = (stars: Parameters<typeof supplementObjectIdentities>[0]) => supplementStellarObservations(supplementObjectStats(supplementObjectIdentities(stars, identities), objectStats))
const components = new Map(reviewedStarSystems.flatMap((system) => system.components.flatMap((component) =>
  [component.starId, ...component.alternateStarIds ?? []].map((id) => [id, { canonicalStarId: component.starId }] as const))))
const [command, ...args] = process.argv.slice(2)
const compactOverlayDirectory = join(root, 'src/data/overlays/compact-remnants')
const nebulaOverlayDirectory = join(root, 'src/data/overlays/nebulae')
const molecularCloudOverlayDirectory = join(root, 'src/data/overlays/molecular-clouds')
const bubbleOverlayDirectory = join(root, 'src/data/overlays/bubbles')

function loadCompactOverlay() {
  const manifest = parseCompactOverlayManifest(readFileSync(join(compactOverlayDirectory, 'manifest.json'), 'utf8'))
  const payload: unknown = JSON.parse(readFileSync(join(compactOverlayDirectory, 'objects.json'), 'utf8'))
  const objects = supplement(parseCompactOverlayPayload(payload, manifest))
  return { manifest, objects }
}

function loadNebulaOverlay() {
  const manifest = parseNebulaOverlayManifest(readFileSync(join(nebulaOverlayDirectory, 'manifest.json'), 'utf8'))
  const payload: unknown = JSON.parse(readFileSync(join(nebulaOverlayDirectory, 'objects.json'), 'utf8'))
  const objects = supplement(parseNebulaOverlayPayload(payload, manifest))
  return { manifest, objects }
}

function loadMolecularCloudOverlay() {
  const manifest = parseMolecularCloudOverlayManifest(readFileSync(join(molecularCloudOverlayDirectory, 'manifest.json'), 'utf8'))
  const payload: unknown = JSON.parse(readFileSync(join(molecularCloudOverlayDirectory, 'objects.json'), 'utf8'))
  const objects = supplement(parseMolecularCloudOverlayPayload(payload, manifest))
  return { manifest, objects }
}

function loadBubbleOverlay() {
  const manifest = parseBubbleOverlayManifest(readFileSync(join(bubbleOverlayDirectory, 'manifest.json'), 'utf8'))
  const payload = hydrateBubbleSurfaceGridFiles(
    JSON.parse(readFileSync(join(bubbleOverlayDirectory, 'objects.json'), 'utf8')),
    (filename) => JSON.parse(readFileSync(join(bubbleOverlayDirectory, filename), 'utf8')),
  )
  const objects = supplement(parseBubbleOverlayPayload(payload, manifest))
  return { manifest, objects }
}

function packageDefinitions(extra?: string) {
  const paths = [
    join(root, 'src/data'),
    ...readdirSync(join(root, 'src/data/catalogs'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(root, 'src/data/catalogs', entry.name)),
  ]
  if (extra && !paths.includes(extra)) paths.push(extra)
  const ids = new Set<string>()
  return paths.map((path) => {
    const manifest = path === join(root, 'src/data') ? DEFAULT_CATALOG_MANIFEST : parseCatalogManifest(readFileSync(join(path, 'catalog.json'), 'utf8'))
    if (ids.has(manifest.id) || (path !== join(root, 'src/data') && manifest.id === DEFAULT_CATALOG_MANIFEST.id)) throw new Error(`Duplicate or reserved catalog id: ${manifest.id}`)
    ids.add(manifest.id)
    return { path, manifest, csv: readFileSync(join(path, 'stars.csv'), 'utf8') }
  })
}

/** Load source rows, composing each extending catalog onto its base. */
function loadPackageStars(definitions: ReturnType<typeof packageDefinitions>) {
  const loaded = new Map<string, Star[]>()
  const load = (definition: (typeof definitions)[number], pending = new Set<string>()): Star[] => {
    const cached = loaded.get(definition.manifest.id)
    if (cached) return cached
    const baseId = definition.manifest.extends
    const base = baseId ? definitions.find((candidate) => candidate.manifest.id === baseId) : undefined
    if (baseId && (!base || pending.has(baseId))) throw new Error(`${definition.manifest.id}: missing or cyclic extended catalog ${baseId}`)
    const stars = loadCatalog(definition, base && load(base, new Set([...pending, definition.manifest.id])))
    loaded.set(definition.manifest.id, stars)
    return stars
  }
  return definitions.map((definition) => ({ ...definition, stars: load(definition) }))
}

function validate(directory?: string): void {
  const target = directory && resolve(directory)
  const catalogs: { id: string; stars: ReturnType<typeof loadCatalog> }[] = []
  for (const { path, manifest, stars } of loadPackageStars(packageDefinitions(target))) {
    if (target && path !== target) continue
    catalogs.push({ id: manifest.id, stars: supplement(stars) })
    const coverage = catalogCoverage(stars)
    if (['nearest-neighbors', 'bright-stars', 'nearest-100', 'nearest-1000', 'nearest-5000', 'western-constellation-stars', 'famous-cluster-stars'].includes(manifest.id) && coverage.constellations !== coverage.objects) throw new Error(`${path}: incomplete bundled constellation coverage`)
    console.log(`${manifest.id}: ${stars.length} rows; non-Sun coverage ${JSON.stringify(coverage)}`)
  }
  if (!directory) {
    requireConsistentCatalogs(catalogs)
    const { manifest, objects } = loadCompactOverlay()
    console.log(`${manifest.id}: ${objects.length} overlay rows; type counts ${JSON.stringify(manifest.counts)}`)
    const nebulae = loadNebulaOverlay()
    console.log(`${nebulae.manifest.id}: ${nebulae.objects.length} overlay rows; type counts ${JSON.stringify(nebulae.manifest.counts)}`)
    const molecularClouds = loadMolecularCloudOverlay()
    console.log(`${molecularClouds.manifest.id}: ${molecularClouds.objects.length} overlay rows; ${molecularClouds.manifest.displaySampleCount} display samples`)
    const bubbles = loadBubbleOverlay()
    console.log(`${bubbles.manifest.id}: ${bubbles.objects.length} overlay rows; type counts ${JSON.stringify(bubbles.manifest.counts)}`)
  }
}

function requireConsistentCatalogs(catalogs: Parameters<typeof auditCatalogConsistency>[0]) {
  for (const catalog of catalogs) {
    const adopted = new Map(completeCatalogCompanions(catalog.stars).map((star) => [star.id, star]))
    for (const source of catalog.stars) {
      const component = adopted.get(source.id)
      if (!component) throw new Error(`Lost catalog record: ${catalog.id}/${source.id}`)
      const missing = missingCatalogMeasurements(source, component)
      if (missing.length) throw new Error(`Lost catalog measurements: ${catalog.id}/${source.id}: ${missing.join(', ')}`)
    }
  }
  const audit = auditCatalogConsistency(catalogs.map((catalog) => ({
    ...catalog, stars: completeCatalogCompanions(catalog.stars),
  })), identities, (id) => components.get(id))
  if (audit.conflicts.length) throw new Error(`Inconsistent adopted catalog details:\n${JSON.stringify(audit.conflicts, null, 2)}`)
  console.log(`Shared details: ${audit.sharedObjects} objects checked across ${catalogs.length} catalogs; no inconsistencies.`)
}

/** These directories contain only derived payloads; discard obsolete versions. */
function writeGeneratedData(directory: string, files: Record<string, string>): void {
  const output = safeOutputDirectory(join(root, 'src/data/generated', directory))
  writeManagedFiles(output, files, true)
  for (const entry of readdirSync(output, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.json') && !Object.hasOwn(files, entry.name)) rmSync(join(output, entry.name))
  }
}

const WHITE_DWARF_REFERENCES = join(root, 'src/data/white-dwarf-class-references.json')

// Values retired as wrong by a reviewed correction stay in the ledger only.
const retirements = (JSON.parse(readFileSync(join(root, 'catalog-work/reviewed-data-retirements.json'), 'utf8')) as { retirements: ReviewedRetirement[] }).retirements
// Measured log g is attached after completion so that companion records receive it too.
const shipped = (stars: Parameters<typeof completeCatalogCompanions>[0]) => withoutRetiredValues(supplementSurfaceGravity(completeCatalogCompanions(stars)), retirements)

function shippedStars(catalogs: { stars: Parameters<typeof completeCatalogCompanions>[0] }[]) {
  return catalogs.flatMap((catalog) => shipped(catalog.stars))
}

/** The committed table must hold exactly the references bundled white dwarfs request; the grid is not needed here. */
function requireWhiteDwarfReferences(catalogs: { stars: Parameters<typeof completeCatalogCompanions>[0] }[]): void {
  const required = [...requiredWhiteDwarfReferences(shippedStars(catalogs)).keys()]
  const committed = Object.keys((JSON.parse(readFileSync(WHITE_DWARF_REFERENCES, 'utf8')) as { references: Record<string, unknown> }).references)
  if (JSON.stringify(required) !== JSON.stringify(committed)) {
    const missing = required.filter((key) => !committed.includes(key))
    const unused = committed.filter((key) => !required.includes(key))
    throw new Error(`White dwarf class references are stale (missing: ${missing.join(', ') || 'none'}; unused: ${unused.join(', ') || 'none'}). Run \`npm run catalog:white-dwarf-references\`.`)
  }
}

function writeWhiteDwarfReferences(): void {
  const catalogs = loadCatalogPackages()
  writeManagedFiles(safeOutputDirectory(join(root, 'src/data')), {
    'white-dwarf-class-references.json': JSON.stringify(buildWhiteDwarfClassReferences(shippedStars(catalogs)), null, 2) + '\n',
  }, true)
  console.log(`Wrote ${requiredWhiteDwarfReferences(shippedStars(catalogs)).size} white dwarf class references.`)
}

function loadCatalogPackages() {
  return loadPackageStars(packageDefinitions()).map(({ manifest, stars }) => ({
    id: manifest.id,
    extends: manifest.extends,
    stars: supplement(stars),
  }))
}

function generate(): void {
  const catalogs = loadCatalogPackages()
  requireConsistentCatalogs(catalogs)
  const detailFiles: Record<string, string> = {}
  const mapRecords = (stars: Parameters<typeof splitCatalogDetails>[0][]) => stars.map((star) => {
    const content = JSON.stringify({ notes: star.notes, ...(star.catalog_sources ? { catalog_sources: star.catalog_sources } : {}) })
    const key = `${star.id}-${createHash('sha256').update(content).digest('hex').slice(0, 16)}`
    const { mapStar, details } = splitCatalogDetails(star, key)
    const { catalog_detail_key: _key, catalog_flags: _flags, ...record } = mapStar
    if (!isDeepStrictEqual({ ...record, ...details }, star)) throw new Error(`Catalog detail split lost data: ${star.id}`)
    const file = `catalog-detail-${key}.json`
    if (detailFiles[file] && detailFiles[file] !== content + '\n') throw new Error(`Catalog detail key collision: ${key}`)
    detailFiles[file] = content + '\n'
    return mapStar
  })
  const effective = new Map(catalogs.map(({ id, stars }) =>
    [id, mapRecords(supplementObjectIdentities(shipped(stars), identities, { preserveAuthoredNames: true }))]))
  // An extending payload ships only records that its base payload lacks or differs in.
  const extensionRecords = (id: string, base: ReturnType<typeof mapRecords>, records: ReturnType<typeof mapRecords>) => {
    const baseById = new Map(base.map((record) => [record.id, record]))
    const delta = records.filter((record) => !isDeepStrictEqual(baseById.get(record.id), record))
    const composed = new Map(composeCatalog(base, delta).map((record) => [record.id, record]))
    if (composed.size !== records.length || records.some((record) => !isDeepStrictEqual(composed.get(record.id), record))) {
      throw new Error(`Extending catalog payload does not reproduce its records: ${id}`)
    }
    return delta
  }
  const files = Object.fromEntries(catalogs.map(({ id, extends: baseId, stars }) =>
    [`${id}.json`, JSON.stringify({ schemaVersion: 3, catalogId: id, ...(baseId ? { extends: baseId } : {}), sourceObjectCount: stars.length,
      stars: baseId ? extensionRecords(id, effective.get(baseId)!, effective.get(id)!) : effective.get(id)! }) + '\n']))
  writeGeneratedData('catalog-details', detailFiles)
  const references = buildCatalogClassReferences(catalogs.map((catalog) => ({ ...catalog, stars: shipped(catalog.stars) })), (id) => components.get(id))
  requireWhiteDwarfReferences(catalogs)
  writeManagedFiles(safeOutputDirectory(join(root, 'src/data')), {
    // Display summaries: six significant digits exceed the cards' precision and halve the bundled file.
    'catalog-class-references.json': JSON.stringify(references, (_key, value: unknown) =>
      typeof value === 'number' && !Number.isInteger(value) ? Number(value.toPrecision(6)) : value, 2) + '\n',
  }, true)
  console.log(`Generated ${references.classes.length} class samples from ${references.uniqueObjects} distinct objects across ${catalogs.length} catalogs.`)
  const output = safeOutputDirectory(join(root, 'src/data/generated/catalogs'))
  writeManagedFiles(output, files, true)
  for (const entry of readdirSync(output, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.json') && !Object.hasOwn(files, entry.name)) rmSync(join(output, entry.name))
  }
  console.log(`Generated ${Object.keys(files).length} browser catalog payloads.`)
  const chartCompanions: Record<string, string> = {}
  for (const file of readdirSync(join(root, 'src/data/constellations')).filter((file) => file.endsWith('.json'))) {
    const chart = JSON.parse(readFileSync(join(root, 'src/data/constellations', file), 'utf8')) as ConstellationChart
    const needed = new Set(completeCatalogCompanions(chart.stars.map((figure) => figure.object))
      .map((star) => starComponentIdentity(star.id)?.canonicalStarId ?? star.id))
    chartCompanions[`${chart.name}.json`] = JSON.stringify(supplementObjectIdentities(withoutRetiredValues(supplementSurfaceGravity((companionData.stars as Star[]).filter((star) => needed.has(star.id))), retirements), identities, { preserveAuthoredNames: true })) + '\n'
  }
  writeManagedFiles(safeOutputDirectory(join(root, 'src/data/generated/constellation-companions')), chartCompanions, true)
  // Retired IDs serve their article from the surviving record; component IDs already resolve by identity.
  const legacyIds: Record<string, string> = legacyStarIds.ids
  const articleId = (id: string) => starComponentIdentity(id) ? id : legacyIds[id] ?? id
  // Exact catalog IDs of the same single star in another catalog; resolved only through the startup index.
  const articleEntries = [starInfo, nearest100Info, constellationStarInfo, compactObjectInfo].flatMap((dataset) =>
    Object.entries(dataset.articles).map(([id, definition]) => {
      const { aliases = [], ...article } = definition as typeof definition & { aliases?: string[] }
      return { id: articleId(id), reviewedAt: dataset.reviewedAt, article, aliases }
    }))
  const articleFiles = Object.fromEntries(articleEntries.map(({ id, reviewedAt, article }) =>
    [`star-article-${id}.json`, JSON.stringify({ reviewedAt, article }) + '\n']))
  const starInfoAliases = Object.fromEntries(articleEntries.flatMap(({ id, aliases }) => aliases.map((alias) => [alias, id])))
  writeGeneratedData('star-articles', articleFiles)
  const orbitFiles = Object.fromEntries([...stellarOrbits.systems, ...compactOrbits.systems].map((system) =>
    [`stellar-orbit-${system.systemId}.json`, JSON.stringify(system.orbits) + '\n']))
  writeGeneratedData('stellar-orbits', orbitFiles)
  const systemFiles = Object.fromEntries([...planetarySystems.systems, ...nearbyPlanets.systems].map((system) =>
    [`planetary-system-${system.hostStarId}.json`, JSON.stringify({ system, planets: nearbyPlanets.planets.filter((planet) => planet.hostStarId === system.hostStarId) }) + '\n']))
  writeGeneratedData('planetary-systems', systemFiles)
  const planetCounts = Object.fromEntries([...planetarySystems.systems, ...nearbyPlanets.systems].map((system) => [system.hostStarId, system.planets.length]))
  writeManagedFiles(safeOutputDirectory(join(root, 'src/data/generated')), {
    'startup-index.json': JSON.stringify({ planetCounts, planetHostAliases: nearbyPlanets.aliases, starInfoIds: [...new Set(articleEntries.map(({ id }) => id))], starInfoAliases, planetInfoIds: [...planetDetails.planets, ...smallBodies.objects].map((planet) => planet.id) }) + '\n',
    'planet-details.json': JSON.stringify({ earth: planetDetails.earth, planets: planetDetails.planets }) + '\n',
    'planet-moons.json': JSON.stringify({ ...planetDetails.moons, ...smallBodies.moons }) + '\n',
    'small-body-details.json': JSON.stringify({ objects: smallBodies.objects }) + '\n',
    'exoplanet-source.json': JSON.stringify({ retrieved: nearbyPlanets.retrieved }) + '\n',
  }, true)
  const { manifest: overlayManifest, objects } = loadCompactOverlay()
  const nebulae = loadNebulaOverlay()
  const molecularClouds = loadMolecularCloudOverlay()
  const bubbles = loadBubbleOverlay()
  const overlayOutput = safeOutputDirectory(join(root, 'src/data/generated/overlays'))
  writeManagedFiles(overlayOutput, {
    [`${overlayManifest.id}.json`]: JSON.stringify({ schemaVersion: 1, overlayId: overlayManifest.id, objects }) + '\n',
    [`${nebulae.manifest.id}.json`]: JSON.stringify({ schemaVersion: 1, overlayId: nebulae.manifest.id, objects: nebulae.objects }) + '\n',
    [`${molecularClouds.manifest.id}.json`]: JSON.stringify({ schemaVersion: 1, overlayId: molecularClouds.manifest.id, objects: molecularClouds.objects }) + '\n',
    [`${bubbles.manifest.id}.json`]: JSON.stringify({ schemaVersion: 1, overlayId: bubbles.manifest.id, objects: bubbles.objects }) + '\n',
  }, true)
  console.log(`Generated ${objects.length} compact-object, ${nebulae.objects.length} nebula, ${molecularClouds.objects.length} molecular-cloud and ${bubbles.objects.length} bubble overlay rows.`)
}

try {
  if (command === 'validate' && args.length <= 1) validate(args[0])
  else if (command === 'generate' && args.length === 0) generate()
  else if (command === 'white-dwarf-references' && args.length === 0) writeWhiteDwarfReferences()
  else if (command === 'build' && (args.length === 2 || (args.length === 3 && args[2] === '--force'))) {
    const inputPath = resolve(args[0]!)
    const output = resolve(args[1]!)
    const force = args[2] === '--force'
    const value: unknown = JSON.parse(readFileSync(inputPath, 'utf8'))
    if (!value || typeof value !== 'object') throw new Error('Adopted input must be a JSON object.')
    const input = value as Record<string, unknown>
    if (typeof input.candidatesCsv !== 'string' || !input.candidatesCsv.trim()) throw new Error('Adopted input requires candidatesCsv, relative to this JSON file.')
    const manifest = parseCatalogManifest(JSON.stringify(input.manifest))
    const candidates = readFileSync(containedInput(inputPath, input.candidatesCsv), 'utf8')
    const built = buildCatalog(manifest, candidates, input.provenance)
    const files = { 'catalog.json': JSON.stringify(built.manifest, null, 2) + '\n', 'stars.csv': built.csv, 'provenance.json': JSON.stringify(built.provenance, null, 2) + '\n' }
    writeManagedFiles(output, files, force)
    validate(output)
  } else throw new Error('Usage: catalogs.ts validate [catalog-directory] | generate | white-dwarf-references | build <adopted-input.json> <output-directory> [--force]')
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
