import { dataShardIndex, dataShardPath, OBJECT_PAGE_SHARDS_PATH } from '../src/data-shards.ts'
import { objectIdFromPath, objectPath, renderObjectPage, type ObjectPage, type ObjectPageAlias } from '../src/object-page.ts'
import { HTTPS_ONLY_HEADERS, SECURITY_HEADERS } from './security-headers.ts'

interface Env {
  ASSETS: { fetch(input: Request | string): Promise<Response> }
}

// wrangler.jsonc routes only /objects/* here; every other request is a static asset.
// A deployment's assets never change, so each isolate keeps the shard list it first reads.
let pageShards: Promise<readonly string[]> | undefined

async function asset(env: Env, origin: string, path: string): Promise<Response> {
  const response = await env.ASSETS.fetch(new URL(path, origin).href)
  if (!response.ok) throw new Error(`Asset ${path} returned ${response.status}.`)
  return response
}

async function objectPage(env: Env, origin: string, id: string): Promise<ObjectPage | ObjectPageAlias | undefined> {
  pageShards ??= asset(env, origin, OBJECT_PAGE_SHARDS_PATH).then((response) => response.json() as Promise<string[]>)
    .catch((error: unknown) => { pageShards = undefined; throw error })
  const index = dataShardIndex('object-page', id)
  const shard = await (await asset(env, origin, dataShardPath('object-page', index, (await pageShards)[index]!))).json() as Record<string, ObjectPage | ObjectPageAlias>
  return Object.hasOwn(shard, id) ? shard[id] : undefined
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
    const url = new URL(request.url)
    const id = objectIdFromPath(url.pathname)
    const page = id === null ? undefined : await objectPage(env, url.origin, id)
    if (page && 'canonical' in page) return Response.redirect(new URL(objectPath(page.canonical), url.origin).href, 301)
    // `/` serves index.html; `/index.html` would redirect.
    const html = await (await asset(env, url.origin, '/')).text()
    const headers = new Headers({ ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
    if (url.protocol === 'https:') for (const [name, value] of Object.entries(HTTPS_ONLY_HEADERS)) headers.set(name, value)
    // Unknown objects still open the app; preview hosts and unlisted pages stay out of search results.
    if (!page?.indexable || url.hostname.endsWith('.workers.dev')) headers.set('X-Robots-Tag', 'noindex')
    return new Response(request.method === 'HEAD' ? null : page ? renderObjectPage(html, id!, page) : html, { status: page ? 200 : 404, headers })
  },
}
