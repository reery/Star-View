import type { Star } from './catalog-model'
import { parseMolecularCloudOverlayManifest, parseMolecularCloudOverlayPayload } from './molecular-cloud-overlay-model'

const manifests = import.meta.glob<string>('./data/overlays/molecular-clouds/manifest.json', { query: '?raw', import: 'default', eager: true })
const payloads = import.meta.glob<string>('./data/generated/overlays/molecular-clouds.json', { query: '?url&no-inline', import: 'default' })
const manifestRaw = manifests['./data/overlays/molecular-clouds/manifest.json']
if (!manifestRaw) throw new Error('Missing molecular-cloud manifest.')
export const molecularCloudOverlayManifest = parseMolecularCloudOverlayManifest(manifestRaw)

let cached: Promise<Star[]> | undefined

export function loadMolecularClouds(fetcher: typeof fetch = fetch): Promise<Star[]> {
  cached ??= (async () => {
    const loadUrl = payloads['./data/generated/overlays/molecular-clouds.json']
    if (!loadUrl) throw new Error('Missing generated molecular-cloud payload.')
    const response = await fetcher(await loadUrl())
    if (!response.ok) throw new Error(`Could not load ${molecularCloudOverlayManifest.label} (${response.status}).`)
    return parseMolecularCloudOverlayPayload(await response.json(), molecularCloudOverlayManifest)
  })()
  return cached
}
