import { memoizedPayloadLoader } from './catalog-runtime'
import type { Star } from './catalog-model'
import { parseBubbleOverlayManifest, parseBubbleOverlayPayload } from './bubble-overlay-model'
import { parseCompactOverlayManifest, parseCompactOverlayPayload } from './compact-overlay-model'
import { parseGalaxyOverlayManifest, parseGalaxyOverlayPayload } from './galaxy-overlay-model'
import { parseMolecularCloudOverlayManifest, parseMolecularCloudOverlayPayload } from './molecular-cloud-overlay-model'
import { parseNebulaOverlayManifest, parseNebulaOverlayPayload } from './nebula-overlay-model'

const manifests = import.meta.glob<string>('./data/overlays/*/manifest.json', { query: '?raw', import: 'default', eager: true })
const payloads = import.meta.glob<string>([
  './data/generated/overlays/*.json',
  '!./data/generated/overlays/* [0-9]*.json',
], { query: '?url&no-inline', import: 'default', eager: true })

function overlay<Manifest extends { label: string }>(
  id: string, parseManifest: (raw: string) => Manifest, parsePayload: (value: unknown, manifest: Manifest) => Star[],
): { manifest: Manifest; load: () => Promise<Star[]> } {
  const raw = manifests[`./data/overlays/${id}/manifest.json`]
  if (!raw) throw new Error(`Missing overlay manifest: ${id}`)
  const manifest = parseManifest(raw)
  return {
    manifest,
    load: memoizedPayloadLoader(manifest.label, async () => {
      const url = payloads[`./data/generated/overlays/${id}.json`]
      if (!url) throw new Error(`Missing generated overlay payload: ${id}`)
      return url
    }, (value) => parsePayload(value, manifest)),
  }
}

export const { manifest: compactOverlayManifest, load: loadCompactRemnants } = overlay('compact-remnants', parseCompactOverlayManifest, parseCompactOverlayPayload)
export const { manifest: nebulaOverlayManifest, load: loadNebulae } = overlay('nebulae', parseNebulaOverlayManifest, parseNebulaOverlayPayload)
export const { manifest: molecularCloudOverlayManifest, load: loadMolecularClouds } = overlay('molecular-clouds', parseMolecularCloudOverlayManifest, parseMolecularCloudOverlayPayload)
export const { manifest: bubbleOverlayManifest, load: loadBubbles } = overlay('bubbles', parseBubbleOverlayManifest, parseBubbleOverlayPayload)
export const { load: loadGalaxies } = overlay('galaxies', parseGalaxyOverlayManifest, parseGalaxyOverlayPayload)
