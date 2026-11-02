import type { StellarOrbit } from './stellar-orbits'
import { loadDataShardEntry } from './data-shards'
import systemIds from './data/generated/stellar-orbit-ids.json'

// Payloads exist only for systems with reviewed orbit entries; absence means no orbit solutions.
const systems = new Set(systemIds)

export async function loadStellarOrbitData(systemId: string): Promise<StellarOrbit[]> {
  if (!systems.has(systemId)) return []
  const orbits = await loadDataShardEntry<StellarOrbit[]>('stellar-orbit', systemId)
  if (!orbits) throw new Error(`Missing stellar orbits: ${systemId}`)
  return orbits
}
