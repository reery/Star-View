import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dataShard } from '../../scripts/data-shards.ts'
import { DATA_SHARD_PATH } from '../data-shards.ts'

const generated = fileURLToPath(new URL('../data/generated', import.meta.url))
const sitemap = fileURLToPath(new URL('../../public/sitemap.xml', import.meta.url))

/** Exercise the generated HTTP payloads in Node without a preview server. */
export const generatedJsonFetch: typeof fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost')
  const shard = DATA_SHARD_PATH.exec(url.pathname)
  if (shard) {
    const content = dataShard(generated, sitemap, shard[1]!, Number(shard[2]))
    if (content === undefined) return new Response('Not found', { status: 404 })
    return new Response(content, { headers: { 'Content-Type': 'application/json' } })
  }
  if (!url.pathname.startsWith('/src/data/generated/') || !url.pathname.endsWith('.json')) {
    throw new Error(`Unexpected generated-data request: ${url.pathname}`)
  }
  const content = readFileSync(new URL(`../${url.pathname.slice('/src/'.length)}`, import.meta.url), 'utf8')
  return new Response(content, { headers: { 'Content-Type': 'application/json' } })
}
