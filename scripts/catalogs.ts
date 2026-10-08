import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCatalog, catalogCoverage, DEFAULT_CATALOG_MANIFEST, loadCatalog, parseCatalogManifest } from '../src/catalogs.ts'
import { parseCompactOverlayManifest, parseCompactOverlayPayload } from '../src/compact-overlay-model.ts'
import { parseNebulaOverlayManifest, parseNebulaOverlayPayload } from '../src/nebula-overlay-model.ts'
import { parseMolecularCloudOverlayManifest, parseMolecularCloudOverlayPayload } from '../src/molecular-cloud-overlay-model.ts'
import { hydrateBubbleSurfaceGridFiles, parseBubbleOverlayManifest, parseBubbleOverlayPayload } from '../src/bubble-overlay-model.ts'
import { containedInput, safeOutputDirectory, writeManagedFiles } from './filesystem.ts'
import { parseObjectIdentities, supplementObjectIdentities } from '../src/designations.ts'
import { buildCatalogClassReferences } from '../src/catalog-class-references.ts'
import { parseObjectStats, supplementObjectStats } from '../src/object-stats.ts'
import { auditCatalogConsistency } from '../src/catalog-consistency.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const identities = parseObjectIdentities(JSON.parse(readFileSync(join(root, 'src/data/object-designations.json'), 'utf8')))
const objectStats = parseObjectStats(JSON.parse(readFileSync(join(root, 'src/data/object-stats.json'), 'utf8')))
const supplement = (stars: Parameters<typeof supplementObjectIdentities>[0]) => supplementObjectStats(supplementObjectIdentities(stars, identities), objectStats)
const systems = JSON.parse(readFileSync(join(root, 'src/data/star-systems.json'), 'utf8')) as {
  systems: { components: { starId: string; alternateStarIds?: string[] }[] }[]
}
const components = new Map(systems.systems.flatMap((system) => system.components.flatMap((component) =>
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

function validate(directory?: string): void {
  const packages = directory ? [resolve(directory)] : [
    join(root, 'src/data'),
    ...readdirSync(join(root, 'src/data/catalogs'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(root, 'src/data/catalogs', entry.name)),
  ]
  const ids = new Set<string>()
  const catalogs: { id: string; stars: ReturnType<typeof loadCatalog> }[] = []
  for (const path of packages) {
    const manifest = path === join(root, 'src/data') ? DEFAULT_CATALOG_MANIFEST : parseCatalogManifest(readFileSync(join(path, 'catalog.json'), 'utf8'))
    if (ids.has(manifest.id) || (path !== join(root, 'src/data') && manifest.id === DEFAULT_CATALOG_MANIFEST.id)) throw new Error(`Duplicate or reserved catalog id: ${manifest.id}`)
    ids.add(manifest.id)
    const stars = loadCatalog({ manifest, csv: readFileSync(join(path, 'stars.csv'), 'utf8') })
    catalogs.push({ id: manifest.id, stars: supplement(stars) })
    const coverage = catalogCoverage(stars)
    if (['nearest-neighbors', 'bright-stars', 'nearest-100', 'western-constellation-stars', 'famous-cluster-stars'].includes(manifest.id) && coverage.constellations !== coverage.objects) throw new Error(`${path}: incomplete bundled constellation coverage`)
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
  const audit = auditCatalogConsistency(catalogs, identities, (id) => components.get(id))
  if (audit.conflicts.length) throw new Error(`Inconsistent adopted catalog details:\n${JSON.stringify(audit.conflicts, null, 2)}`)
  console.log(`Shared details: ${audit.sharedObjects} objects checked across ${catalogs.length} catalogs; no inconsistencies.`)
}

function generate(): void {
  const packages = [
    { manifest: DEFAULT_CATALOG_MANIFEST, csv: readFileSync(join(root, 'src/data/stars.csv'), 'utf8') },
    ...readdirSync(join(root, 'src/data/catalogs'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
      const directory = join(root, 'src/data/catalogs', entry.name)
      return {
        manifest: parseCatalogManifest(readFileSync(join(directory, 'catalog.json'), 'utf8')),
        csv: readFileSync(join(directory, 'stars.csv'), 'utf8'),
      }
    }),
  ]
  const catalogs = packages.map((definition) => ({
    id: definition.manifest.id,
    stars: supplement(loadCatalog(definition)),
  }))
  requireConsistentCatalogs(catalogs)
  const files = Object.fromEntries(catalogs.map(({ id, stars }) =>
    [`${id}.json`, JSON.stringify({ schemaVersion: 1, catalogId: id, stars }) + '\n']))
  const references = buildCatalogClassReferences(catalogs, (id) => components.get(id))
  writeManagedFiles(safeOutputDirectory(join(root, 'src/data')), {
    'catalog-class-references.json': JSON.stringify(references, null, 2) + '\n',
  }, true)
  console.log(`Generated ${references.classes.length} class samples from ${references.uniqueObjects} distinct objects across ${catalogs.length} catalogs.`)
  const output = safeOutputDirectory(join(root, 'src/data/generated/catalogs'))
  writeManagedFiles(output, files, true)
  for (const entry of readdirSync(output, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.json') && !Object.hasOwn(files, entry.name)) rmSync(join(output, entry.name))
  }
  console.log(`Generated ${Object.keys(files).length} browser catalog payloads.`)
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
  } else throw new Error('Usage: catalogs.ts validate [catalog-directory] | generate | build <adopted-input.json> <output-directory> [--force]')
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
