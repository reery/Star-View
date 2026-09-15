import csv from './data/stars.csv?raw'
import { DEFAULT_CATALOG_MANIFEST, loadCatalog, parseCatalogManifest, type CatalogDefinition } from './catalogs'

const manifests = import.meta.glob<string>('./data/catalogs/*/catalog.json', { query: '?raw', import: 'default', eager: true })
const data = import.meta.glob<string>('./data/catalogs/*/stars.csv', { query: '?raw', import: 'default', eager: true })

export const catalogs: CatalogDefinition[] = [{ manifest: DEFAULT_CATALOG_MANIFEST, csv }]
export const catalogErrors: string[] = []

for (const [path, raw] of Object.entries(manifests).sort(([first], [second]) => first.localeCompare(second))) {
  try {
    const manifest = parseCatalogManifest(raw)
    if (catalogs.some((catalog) => catalog.manifest.id === manifest.id)) throw new Error(`Duplicate catalog id: ${manifest.id}`)
    const csv = data[path.replace(/catalog\.json$/, 'stars.csv')]
    if (csv === undefined) throw new Error('Missing sibling stars.csv')
    const definition = { manifest, csv }
    loadCatalog(definition)
    catalogs.push(definition)
  } catch (error) {
    catalogErrors.push(`${path}: ${error instanceof Error ? error.message : 'Invalid catalog package'}`)
  }
}