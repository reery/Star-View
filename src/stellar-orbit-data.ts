import type { StellarOrbit } from './stellar-orbits'
import { loadJsonData } from './json-data'

const payloads = import.meta.glob<string>([
  './data/generated/stellar-orbits/*.json',
  '!./data/generated/stellar-orbits/* [0-9]*.json',
], { query: '?url&no-inline', import: 'default', eager: true })

export function loadStellarOrbitData(systemId: string): Promise<StellarOrbit[]> {
  const url = payloads[`./data/generated/stellar-orbits/stellar-orbit-${systemId}.json`]
  // Payloads exist only for systems with reviewed orbit entries; absence means no orbit solutions.
  if (!url) return Promise.resolve([])
  return loadJsonData<StellarOrbit[]>(url)
}
