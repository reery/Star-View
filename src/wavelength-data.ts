import { loadJsonData } from './json-data'
import { hasWavelengthBandData, registerWavelengthBandData, type WavelengthBandData, type WavelengthBandId } from './wavelength-vision'

// Kept apart from the band rules, which also run outside Vite (Node tests), where import.meta.glob does not exist.
const urls = import.meta.glob<string>('./data/wavelength/*.json', { query: '?url&no-inline', import: 'default', eager: true })
const pending = new Map<WavelengthBandId, Promise<void>>()

/** Loads a band's measured values once; bands without any resolve at once, and a failed request is retried on the next call. */
export function loadWavelengthBandData(band: WavelengthBandId): Promise<void> {
  const url = urls[`./data/wavelength/${band}.json`]
  if (!url || hasWavelengthBandData(band)) return Promise.resolve()
  let request = pending.get(band)
  if (!request) {
    request = loadJsonData<WavelengthBandData>(url).then((data) => registerWavelengthBandData(band, data))
      .finally(() => pending.delete(band))
    pending.set(band, request)
  }
  return request
}
