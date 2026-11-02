import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_SHARD_COUNTS, dataShardIndex, type DataShardSet } from '../src/data-shards.ts'
import { SITEMAP_OBJECT_URL } from '../src/object-page.ts'

const sha256 = (content: string) => createHash('sha256').update(content).digest('hex')

// Generated per-object files stay individual for audits and tests; only the build groups them.
// Names with a space are Finder copies, never generated files.
const DIRECTORY_SETS: Record<Exclude<DataShardSet, 'object-page'>, { directory: string; file: RegExp }> = {
  // `catalog-detail-<object id>-<first 16 hex digits of sha256(content)>.json`; identical notes share one entry.
  'catalog-detail': { directory: 'catalog-details', file: /^catalog-detail-[^ ]+-([0-9a-f]{16})\.json$/ },
  'star-article': { directory: 'star-articles', file: /^star-article-([^ ]+)\.json$/ },
  'planetary-system': { directory: 'planetary-systems', file: /^planetary-system-([^ ]+)\.json$/ },
  'stellar-orbit': { directory: 'stellar-orbits', file: /^stellar-orbit-([^ ]+)\.json$/ },
}

function directoryEntries(generated: string, set: keyof typeof DIRECTORY_SETS, index?: number): Map<string, string> {
  const { directory, file } = DIRECTORY_SETS[set]
  const entries = new Map<string, string>()
  for (const name of readdirSync(join(generated, directory)).sort()) {
    const key = file.exec(name)?.[1]
    if (!key || (index !== undefined && dataShardIndex(set, key) !== index)) continue
    const content = readFileSync(join(generated, directory, name), 'utf8').replace(/\n$/, '')
    if (set === 'catalog-detail') {
      if (sha256(content).slice(0, 16) !== key) throw new Error(`Catalog detail content does not match its key: ${name}`)
      if (entries.has(key) && entries.get(key) !== content) throw new Error(`Catalog detail hash collision: ${key}`)
    }
    entries.set(key, content)
  }
  return entries
}

/** Object pages are marked indexable exactly when the reviewed sitemap lists them. */
function objectPageEntries(generated: string, sitemap: string, index?: number): Map<string, string> {
  const pages = JSON.parse(readFileSync(join(generated, 'object-pages.json'), 'utf8')) as Record<string, object>
  const listed = new Set([...readFileSync(sitemap, 'utf8').matchAll(SITEMAP_OBJECT_URL)].map((match) => match[1]!))
  const entries = new Map<string, string>()
  for (const [id, page] of Object.entries(pages)) {
    if (index !== undefined && dataShardIndex('object-page', id) !== index) continue
    entries.set(id, JSON.stringify(listed.has(id) ? { ...page, indexable: true } : page))
  }
  return entries
}

function shardContent(entries: ReadonlyMap<string, string>): string {
  return `{${[...entries].sort(([first], [second]) => first < second ? -1 : 1).map(([key, content]) => `${JSON.stringify(key)}:${content}`).join(',')}}\n`
}

/** One shard's JSON, for the dev server and tests; unknown sets and indexes return undefined. */
export function dataShard(generated: string, sitemap: string, set: string, index: number): string | undefined {
  if (!Object.hasOwn(DATA_SHARD_COUNTS, set) || !Number.isInteger(index) || index < 0 || index >= DATA_SHARD_COUNTS[set as DataShardSet]) return undefined
  return shardContent(set === 'object-page' ? objectPageEntries(generated, sitemap, index) : directoryEntries(generated, set as keyof typeof DIRECTORY_SETS, index))
}

/** Every shard of every set with its content hash, for the production build. */
export function dataShards(generated: string, sitemap: string): Record<DataShardSet, { hash: string; content: string }[]> {
  return Object.fromEntries(Object.entries(DATA_SHARD_COUNTS).map(([set, count]) => {
    const entries = set === 'object-page' ? objectPageEntries(generated, sitemap) : directoryEntries(generated, set as keyof typeof DIRECTORY_SETS)
    const groups = Array.from({ length: count }, () => new Map<string, string>())
    for (const [key, content] of entries) groups[dataShardIndex(set as DataShardSet, key)]!.set(key, content)
    return [set, groups.map((group) => {
      const content = shardContent(group)
      return { hash: sha256(content).slice(0, 8), content }
    })]
  })) as Record<DataShardSet, { hash: string; content: string }[]>
}
