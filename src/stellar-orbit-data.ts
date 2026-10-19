import type { StellarOrbit } from './stellar-orbits'
import { loadJsonData } from './json-data'

const payloads = import.meta.glob<string>([
  './data/generated/stellar-orbits/*.json',
  '!./data/generated/stellar-orbits/* [0-9]*.json',
], { query: '?url&no-inline', import: 'default', eager: true })

export function loadStellarOrbitData(systemId: string): Promise<StellarOrbit[]> {
  const url = payloads[`./data/generated/stellar-orbits/stellar-orbit-${systemId}.json`]
  if (!url) return Promise.reject(new Error(`Missing stellar orbit data: ${systemId}`))
  return loadJsonData<StellarOrbit[]>(url)
}
