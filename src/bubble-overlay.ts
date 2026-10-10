import { memoizedPayloadLoader } from './catalog-runtime'
import { parseBubbleOverlayManifest, parseBubbleOverlayPayload } from './bubble-overlay-model'

const manifests = import.meta.glob<string>('./data/overlays/bubbles/manifest.json', { query: '?raw', import: 'default', eager: true })
const payloads = import.meta.glob<string>('./data/generated/overlays/bubbles.json', { query: '?url&no-inline', import: 'default' })
const manifestRaw = manifests['./data/overlays/bubbles/manifest.json']
if (!manifestRaw) throw new Error('Missing bubble manifest.')
export const bubbleOverlayManifest = parseBubbleOverlayManifest(manifestRaw)

export const loadBubbles = memoizedPayloadLoader(bubbleOverlayManifest.label, async () => {
  const loadUrl = payloads['./data/generated/overlays/bubbles.json']
  if (!loadUrl) throw new Error('Missing generated bubble payload.')
  return loadUrl()
}, (value) => parseBubbleOverlayPayload(value, bubbleOverlayManifest))
