import index from './data/generated/startup-index.json'
import { starComponentIdentity } from './star-systems'

const ids = new Set(index.starInfoIds)

export function starInfoAvailable(starId: string): boolean {
  const identity = starComponentIdentity(starId)
  return ids.has(identity?.systemId ?? starId) || ids.has(identity?.canonicalStarId ?? starId)
}
