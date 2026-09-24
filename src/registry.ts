import { DEFAULT_CATALOG_MANIFEST, parseCatalogManifest } from './catalog-manifest'
import { catalogLoader, type CatalogDefinition } from './catalog-runtime'

const manifests = import.meta.glob<string>('./data/catalogs/*/catalog.json', { query: '?raw', import: 'default', eager: true })
const payloads = import.meta.glob<string>('./data/generated/catalogs/*.json', { query: '?url&no-inline', import: 'default' })

function definition(manifest: typeof DEFAULT_CATALOG_MANIFEST): CatalogDefinition {
  const loadUrl = payloads[`./data/generated/catalogs/${manifest.id}.json`]
  if (!loadUrl) throw new Error(`Missing generated catalog payload: ${manifest.id}`)
  return { manifest, load: catalogLoader(manifest, loadUrl) }
}

export const catalogs: CatalogDefinition[] = [definition(DEFAULT_CATALOG_MANIFEST)]
export const catalogErrors: string[] = []

for (const [path, raw] of Object.entries(manifests).sort(([first], [second]) => first.localeCompare(second))) {
  try {
    const manifest = parseCatalogManifest(raw)
    if (catalogs.some((catalog) => catalog.manifest.id === manifest.id)) throw new Error(`Duplicate catalog id: ${manifest.id}`)
    catalogs.push(definition(manifest))
  } catch (error) {
    catalogErrors.push(`${path}: ${error instanceof Error ? error.message : 'Invalid catalog package'}`)
  }
}