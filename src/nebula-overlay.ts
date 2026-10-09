import { memoizedPayloadLoader } from './catalog-runtime'
import { parseNebulaOverlayManifest, parseNebulaOverlayPayload } from './nebula-overlay-model'

const manifests = import.meta.glob<string>('./data/overlays/nebulae/manifest.json', { query: '?raw', import: 'default', eager: true })
const payloads = import.meta.glob<string>('./data/generated/overlays/nebulae.json', { query: '?url&no-inline', import: 'default' })
const manifestRaw = manifests['./data/overlays/nebulae/manifest.json']
if (!manifestRaw) throw new Error('Missing nebula manifest.')
export const nebulaOverlayManifest = parseNebulaOverlayManifest(manifestRaw)

export const loadNebulae = memoizedPayloadLoader(nebulaOverlayManifest.label, async () => {
  const loadUrl = payloads['./data/generated/overlays/nebulae.json']
  if (!loadUrl) throw new Error('Missing generated nebula payload.')
  return loadUrl()
}, (value) => parseNebulaOverlayPayload(value, nebulaOverlayManifest))
