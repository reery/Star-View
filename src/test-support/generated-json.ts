import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CATALOG_DETAIL_ASSET_PATH, catalogDetailAsset } from '../../scripts/catalog-detail-assets.ts'

const catalogDetails = fileURLToPath(new URL('../data/generated/catalog-details', import.meta.url))

/** Exercise the generated HTTP payloads in Node without a preview server. */
export const generatedJsonFetch: typeof fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost')
  const detailHash = CATALOG_DETAIL_ASSET_PATH.exec(url.pathname)?.[1]
  if (detailHash) {
    const content = catalogDetailAsset(catalogDetails, detailHash)
    if (content === undefined) return new Response('Not found', { status: 404 })
    return new Response(content, { headers: { 'Content-Type': 'application/json' } })
  }
  if (!url.pathname.startsWith('/src/data/generated/') || !url.pathname.endsWith('.json')) {
    throw new Error(`Unexpected generated-data request: ${url.pathname}`)
  }
  const content = readFileSync(new URL(`../${url.pathname.slice('/src/'.length)}`, import.meta.url), 'utf8')
  return new Response(content, { headers: { 'Content-Type': 'application/json' } })
}
