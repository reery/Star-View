import { memoizedPayloadLoader } from './catalog-runtime'
import { parseCompactOverlayManifest, parseCompactOverlayPayload } from './compact-overlay-model'

const manifests = import.meta.glob<string>('./data/overlays/compact-remnants/manifest.json', { query: '?raw', import: 'default', eager: true })
const payloads = import.meta.glob<string>('./data/generated/overlays/compact-remnants.json', { query: '?url&no-inline', import: 'default' })
const manifestRaw = manifests['./data/overlays/compact-remnants/manifest.json']
if (!manifestRaw) throw new Error('Missing compact-object manifest.')
export const compactOverlayManifest = parseCompactOverlayManifest(manifestRaw)

export const loadCompactRemnants = memoizedPayloadLoader(compactOverlayManifest.label, async () => {
  const loadUrl = payloads['./data/generated/overlays/compact-remnants.json']
  if (!loadUrl) throw new Error('Missing generated compact-object payload.')
  return loadUrl()
}, (value) => parseCompactOverlayPayload(value, compactOverlayManifest))
