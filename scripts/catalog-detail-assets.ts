import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Served path for a source-note payload; the browser derives it from `catalog_detail_key`. */
export const CATALOG_DETAIL_ASSET_PATH = /^\/assets\/catalog-details\/([0-9a-f]{16})\.json$/

// Generated as `catalog-detail-<object id>-<first 16 hex digits of sha256(content)>.json`.
const DETAIL_FILE = /^catalog-detail-.+-([0-9a-f]{16})\.json$/

function contentHash(content: string): string {
  return createHash('sha256').update(content.replace(/\n$/, '')).digest('hex').slice(0, 16)
}

/** Content-addressed payloads keyed by hash; identical notes shared by several objects become one file. */
export function catalogDetailAssets(directory: string): Map<string, string> {
  const assets = new Map<string, string>()
  for (const name of readdirSync(directory).sort()) {
    const hash = DETAIL_FILE.exec(name)?.[1]
    if (!hash) continue
    const content = readFileSync(join(directory, name), 'utf8')
    if (contentHash(content) !== hash) throw new Error(`Catalog detail content does not match its key: ${name}`)
    const existing = assets.get(hash)
    if (existing !== undefined && existing !== content) throw new Error(`Catalog detail hash collision: ${hash}`)
    assets.set(hash, content)
  }
  return assets
}

/** Reads one payload by hash, for the dev server and tests. */
export function catalogDetailAsset(directory: string, hash: string): string | undefined {
  const name = readdirSync(directory).find((file) => DETAIL_FILE.exec(file)?.[1] === hash)
  if (!name) return undefined
  const content = readFileSync(join(directory, name), 'utf8')
  return contentHash(content) === hash ? content : undefined
}
