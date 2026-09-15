import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCatalog, catalogCoverage, DEFAULT_CATALOG_MANIFEST, loadCatalog, parseCatalogManifest } from '../src/catalogs.ts'

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

try {
  if (command === 'validate' && args.length <= 1) validate(args[0])
  else if (command === 'build' && (args.length === 2 || (args.length === 3 && args[2] === '--force'))) {
    const inputPath = resolve(args[0]!)
    const output = resolve(args[1]!)
    const force = args[2] === '--force'
    const value: unknown = JSON.parse(readFileSync(inputPath, 'utf8'))
    if (!value || typeof value !== 'object') throw new Error('Adopted input must be a JSON object.')
    const input = value as Record<string, unknown>
    if (typeof input.candidatesCsv !== 'string' || !input.candidatesCsv.trim()) throw new Error('Adopted input requires candidatesCsv, relative to this JSON file.')
    const manifest = parseCatalogManifest(JSON.stringify(input.manifest))
    const candidates = readFileSync(resolve(dirname(inputPath), input.candidatesCsv), 'utf8')
    const built = buildCatalog(manifest, candidates, input.provenance)
    if (existsSync(output) && !force) throw new Error('Output already exists; choose a new directory or explicitly pass --force.')
    mkdirSync(output, { recursive: true })
    const files = { 'catalog.json': JSON.stringify(built.manifest, null, 2) + '\n', 'stars.csv': built.csv, 'provenance.json': JSON.stringify(built.provenance, null, 2) + '\n' }
    for (const [name, content] of Object.entries(files)) writeFileSync(join(output, name), content, { flag: force ? 'w' : 'wx' })
    validate(output)
  } else throw new Error('Usage: catalogs.ts validate [catalog-directory] | build <adopted-input.json> <output-directory> [--force]')
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}