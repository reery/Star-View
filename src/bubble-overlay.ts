import type { Star } from './catalog-model'
import { parseBubbleOverlayManifest, parseBubbleOverlayPayload } from './bubble-overlay-model'

const manifests = import.meta.glob<string>('./data/overlays/bubbles/manifest.json', { query: '?raw', import: 'default', eager: true })
const payloads = import.meta.glob<string>('./data/generated/overlays/bubbles.json', { query: '?url&no-inline', import: 'default' })
const manifestRaw = manifests['./data/overlays/bubbles/manifest.json']
if (!manifestRaw) throw new Error('Missing bubble manifest.')
export const bubbleOverlayManifest = parseBubbleOverlayManifest(manifestRaw)

let cached: Promise<Star[]> | undefined
export function loadBubbles(fetcher: typeof fetch = fetch): Promise<Star[]> {
  return cached ??= (async () => {
    const loadUrl = payloads['./data/generated/overlays/bubbles.json']
    if (!loadUrl) throw new Error('Missing generated bubble payload.')
    const response = await fetcher(await loadUrl())
    if (!response.ok) throw new Error(`Could not load ${bubbleOverlayManifest.label} (${response.status}).`)
    return parseBubbleOverlayPayload(await response.json(), bubbleOverlayManifest)
  })()
}
