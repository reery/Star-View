import { memoizedPayloadLoader } from './catalog-runtime'
import { parseGalaxyOverlayManifest, parseGalaxyOverlayPayload } from './galaxy-overlay-model'

const manifests = import.meta.glob<string>('./data/overlays/galaxies/manifest.json', { query: '?raw', import: 'default', eager: true })
const payloads = import.meta.glob<string>('./data/generated/overlays/galaxies.json', { query: '?url&no-inline', import: 'default', eager: true })
const manifestRaw = manifests['./data/overlays/galaxies/manifest.json']
if (!manifestRaw) throw new Error('Missing galaxy manifest.')
export const galaxyOverlayManifest = parseGalaxyOverlayManifest(manifestRaw)

export const loadGalaxies = memoizedPayloadLoader(galaxyOverlayManifest.label, async () => {
  const loadUrl = payloads['./data/generated/overlays/galaxies.json']
  if (!loadUrl) throw new Error('Missing generated galaxy payload.')
  return Promise.resolve(loadUrl)
}, (value) => parseGalaxyOverlayPayload(value, galaxyOverlayManifest))
