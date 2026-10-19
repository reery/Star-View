import { mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brotliDecompressSync } from 'node:zlib'
import { afterEach, expect, it } from 'vitest'
import { writeBrotliSidecars } from '../scripts/brotli'

const temporaryDirectories: string[] = []

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'star-view-brotli-'))
  temporaryDirectories.push(root)
  return { root, cache: join(root, 'cache'), target: join(root, 'asset.json') }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

it('reuses compressed content after output deletion and an asset filename change', async () => {
  const { root, cache, target } = await fixture()
  const input = JSON.stringify({ rows: Array(100).fill('catalog content') })
  await writeFile(target, input)
  expect(await writeBrotliSidecars([target], cache)).toEqual({ reused: 0, compressed: 1 })
  const original = await readFile(`${target}.br`)
  expect(brotliDecompressSync(original).toString()).toBe(input)

  await rm(`${target}.br`)
  const renamed = join(root, 'different-hash.json')
  await writeFile(renamed, input)
  expect(await writeBrotliSidecars([target, renamed], cache)).toEqual({ reused: 2, compressed: 0 })
  expect(await readFile(`${target}.br`)).toEqual(original)
  expect(await readFile(`${renamed}.br`)).toEqual(original)
})

it('invalidates changed bytes even when filename, size and timestamps stay the same', async () => {
  const { cache, target } = await fixture()
  await writeFile(target, 'a'.repeat(2048))
  const before = await stat(target)
  await writeBrotliSidecars([target], cache)
  await writeFile(target, 'b'.repeat(2048))
  await utimes(target, before.atime, before.mtime)

  expect(await writeBrotliSidecars([target], cache)).toEqual({ reused: 0, compressed: 1 })
  expect(brotliDecompressSync(await readFile(`${target}.br`)).toString()).toBe('b'.repeat(2048))
})

it('keeps the compression threshold and handles an empty bundle', async () => {
  const { root, cache, target } = await fixture()
  await writeFile(target, 'a'.repeat(1023))
  expect(await writeBrotliSidecars([target], cache)).toEqual({ reused: 0, compressed: 0 })
  expect(await readdir(root)).not.toContain('asset.json.br')
  expect(await writeBrotliSidecars([], cache)).toEqual({ reused: 0, compressed: 0 })
  await writeFile(target, 'a'.repeat(1024))
  expect(await writeBrotliSidecars([target], cache)).toEqual({ reused: 0, compressed: 1 })
})
