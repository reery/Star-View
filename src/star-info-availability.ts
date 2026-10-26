import index from './data/generated/startup-index.json'
import { starComponentIdentity } from './star-systems'

const ids = new Set(index.starInfoIds)
// Reviewed exact catalog IDs of single stars whose article lives under another catalog's ID.
const aliases: Readonly<Record<string, string>> = index.starInfoAliases

export function starInfoArticleId(starId: string): string | undefined {
  const identity = starComponentIdentity(starId)
  return [identity?.systemId ?? starId, identity?.canonicalStarId ?? starId, aliases[starId]].find((id) => id !== undefined && ids.has(id))
}

export function starInfoAvailable(starId: string): boolean {
  return starInfoArticleId(starId) !== undefined
}
