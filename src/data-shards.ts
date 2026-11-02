import { loadJsonData } from './json-data.ts'

// Per-object payloads ship in a fixed number of shards so that the deployment's file count
// does not grow with the catalogs. vite.config.ts builds them; the Worker reads object pages.
export const DATA_SHARD_COUNTS = {
  'catalog-detail': 256,
  'star-article': 32,
  'planetary-system': 32,
  'stellar-orbit': 16,
  'object-page': 128,
} as const

export type DataShardSet = keyof typeof DATA_SHARD_COUNTS

// Content hashes of each set's shards, defined by vite.config.ts.
declare const __DATA_SHARD_HASHES__: Record<DataShardSet, readonly string[]>

/** FNV-1a, so the build, the browser and the Worker agree on a key's shard. */
export function dataShardIndex(set: DataShardSet, key: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < key.length; index++) hash = Math.imul(hash ^ key.charCodeAt(index), 0x01000193)
  return (hash >>> 0) % DATA_SHARD_COUNTS[set]
}

/** Served path, relative to the base URL; the hash keeps `/assets/*` immutable. */
export function dataShardPath(set: DataShardSet, index: number, hash: string): string {
  return `assets/${set}-${index}-${hash}.json`
}

export const DATA_SHARD_PATH = /^\/assets\/([a-z-]+)-(\d+)-[0-9a-z]+\.json$/
// Object-page shard hashes for the Worker, which cannot read the app's define.
export const OBJECT_PAGE_SHARDS_PATH = 'object-page-shards.json'

const shards = new Map<string, Promise<Readonly<Record<string, unknown>>>>()

/** One request per shard serves every key in it; a failed request is retried on the next call. */
export async function loadDataShardEntry<T>(set: DataShardSet, key: string): Promise<T | undefined> {
  const index = dataShardIndex(set, key)
  const path = dataShardPath(set, index, __DATA_SHARD_HASHES__[set][index]!)
  let shard = shards.get(path)
  if (!shard) {
    shard = loadJsonData<Record<string, unknown>>(`${import.meta.env.BASE_URL}${path}`)
      .catch((error: unknown) => { shards.delete(path); throw error })
    shards.set(path, shard)
  }
  const entries = await shard
  return Object.hasOwn(entries, key) ? entries[key] as T : undefined
}
