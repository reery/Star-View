import index from './data/generated/startup-index.json'
import { starComponentIdentity } from './star-systems'

const ids = new Set(index.starInfoIds)

export function starInfoArticleId(starId: string): string | undefined {
  const identity = starComponentIdentity(starId)
  return [identity?.systemId ?? starId, identity?.canonicalStarId ?? starId].find((id) => ids.has(id))
}

export function starInfoAvailable(starId: string): boolean {
  return starInfoArticleId(starId) !== undefined
}
