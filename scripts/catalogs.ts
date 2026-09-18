import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCatalog, catalogCoverage, DEFAULT_CATALOG_MANIFEST, loadCatalog, parseCatalogManifest } from '../src/catalogs.ts'
import { containedInput, safeOutputDirectory, writeManagedFiles } from './filesystem.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const [command, ...args] = process.argv.slice(2)

function validate(directory?: string): void {
  const packages = directory ? [resolve(directory)] : [
    join(root, 'src/data'),
    ...readdirSync(join(root, 'src/data/catalogs'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(root, 'src/data/catalogs', entry.name)),
  ]
  const ids = new Set<string>()
  for (const path of packages) {
    const manifest = path === join(root, 'src/data') ? DEFAULT_CATALOG_MANIFEST : parseCatalogManifest(readFileSync(join(path, 'catalog.json'), 'utf8'))
    if (ids.has(manifest.id) || (path !== join(root, 'src/data') && manifest.id === DEFAULT_CATALOG_MANIFEST.id)) throw new Error(`Duplicate or reserved catalog id: ${manifest.id}`)
    ids.add(manifest.id)
    const stars = loadCatalog({ manifest, csv: readFileSync(join(path, 'stars.csv'), 'utf8') })
    const coverage = catalogCoverage(stars)
    if (['nearest-neighbors', 'nearest-100'].includes(manifest.id) && coverage.constellations !== coverage.objects) throw new Error(`${path}: incomplete bundled constellation coverage`)
    console.log(`${manifest.id}: ${stars.length} rows; non-Sun coverage ${JSON.stringify(coverage)}`)
  }
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
  const files = Object.fromEntries(packages.map((definition) => {
    const stars = loadCatalog(definition)
    return [`${definition.manifest.id}.json`, JSON.stringify({ schemaVersion: 1, catalogId: definition.manifest.id, stars }) + '\n']
  }))
  const output = safeOutputDirectory(join(root, 'src/data/generated/catalogs'))
  writeManagedFiles(output, files, true)
  for (const entry of readdirSync(output, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.json') && !Object.hasOwn(files, entry.name)) rmSync(join(output, entry.name))
  }
  console.log(`Generated ${Object.keys(files).length} browser catalog payloads.`)
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