import { readFileSync } from 'node:fs'

/** Exercise the generated HTTP payloads in Node without a preview server. */
export const generatedJsonFetch: typeof fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost')
  if (!url.pathname.startsWith('/src/data/generated/') || !url.pathname.endsWith('.json')) {
    throw new Error(`Unexpected generated-data request: ${url.pathname}`)
  }
  const content = readFileSync(new URL(`../${url.pathname.slice('/src/'.length)}`, import.meta.url), 'utf8')
  return new Response(content, { headers: { 'Content-Type': 'application/json' } })
}
