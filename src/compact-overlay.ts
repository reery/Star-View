import type { Star } from './catalog-model'
import { parseCompactOverlayManifest, parseCompactOverlayPayload } from './compact-overlay-model'

const manifests = import.meta.glob<string>('./data/overlays/compact-remnants/manifest.json', { query: '?raw', import: 'default', eager: true })
const payloads = import.meta.glob<string>('./data/generated/overlays/compact-remnants.json', { query: '?url&no-inline', import: 'default' })
const manifestRaw = manifests['./data/overlays/compact-remnants/manifest.json']
if (!manifestRaw) throw new Error('Missing compact-object manifest.')
export const compactOverlayManifest = parseCompactOverlayManifest(manifestRaw)

let cached: Promise<Star[]> | undefined
export function loadCompactRemnants(fetcher: typeof fetch = fetch): Promise<Star[]> {
  return cached ??= (async () => {
    const loadUrl = payloads['./data/generated/overlays/compact-remnants.json']
    if (!loadUrl) throw new Error('Missing generated compact-object payload.')
    const response = await fetcher(await loadUrl())
    if (!response.ok) throw new Error(`Could not load ${compactOverlayManifest.label} (${response.status}).`)
    return parseCompactOverlayPayload(await response.json(), compactOverlayManifest)
  })()
}
