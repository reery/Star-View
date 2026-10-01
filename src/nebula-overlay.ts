import type { Star } from './catalog-model'
import { parseNebulaOverlayManifest, parseNebulaOverlayPayload } from './nebula-overlay-model'

const manifests = import.meta.glob<string>('./data/overlays/nebulae/manifest.json', { query: '?raw', import: 'default', eager: true })
const payloads = import.meta.glob<string>('./data/generated/overlays/nebulae.json', { query: '?url&no-inline', import: 'default' })
const manifestRaw = manifests['./data/overlays/nebulae/manifest.json']
if (!manifestRaw) throw new Error('Missing nebula manifest.')
export const nebulaOverlayManifest = parseNebulaOverlayManifest(manifestRaw)

let cached: Promise<Star[]> | undefined
export function loadNebulae(fetcher: typeof fetch = fetch): Promise<Star[]> {
  return cached ??= (async () => {
    const loadUrl = payloads['./data/generated/overlays/nebulae.json']
    if (!loadUrl) throw new Error('Missing generated nebula payload.')
    const response = await fetcher(await loadUrl())
    if (!response.ok) throw new Error(`Could not load ${nebulaOverlayManifest.label} (${response.status}).`)
    return parseNebulaOverlayPayload(await response.json(), nebulaOverlayManifest)
  })()
}
