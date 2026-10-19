import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { brotliCompress, constants } from 'node:zlib'

const compress = promisify(brotliCompress)
// Changing the encoder or compression settings must invalidate cached bytes.
const CACHE_VERSION = `v1-brotli-${process.versions.brotli}-text-q11`

export async function writeBrotliSidecars(files: readonly string[], cacheRoot: string) {
  const cache = join(cacheRoot, CACHE_VERSION)
  await mkdir(cache, { recursive: true })
  let next = 0
  let reused = 0
  let compressed = 0

  // Bound simultaneous encoders: large assets can require substantial memory.
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, async () => {
    while (next < files.length) {
      const target = files[next++]!
      const input = await readFile(target)
      if (input.byteLength < 1024) continue
      const digest = createHash('sha256').update(input).digest('hex')
      const cached = join(cache, `${digest}.br`)
      let output: Buffer
      try {
        output = await readFile(cached)
        reused++
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        output = await compress(input, {
          params: {
            [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
            [constants.BROTLI_PARAM_QUALITY]: 11,
          },
        })
        // Publish atomically so interrupted or concurrent builds cannot leave
        // a partially written entry for a later build to reuse.
        const temporary = `${cached}.${randomUUID()}.tmp`
        try {
          await writeFile(temporary, output)
          await rename(temporary, cached)
        } finally {
          await rm(temporary, { force: true })
        }
        compressed++
      }
      await writeFile(`${target}.br`, output)
    }
  }))
  return { reused, compressed }
}
