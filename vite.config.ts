import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'
import { defineConfig, type Plugin } from 'vite'

const COMPRESSIBLE = new Set(['.css', '.html', '.js', '.json', '.svg', '.txt', '.xml'])
const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

function acceptsBrotli(header: string | undefined): boolean {
  if (!header) return false
  const encodings = header.split(',').map((part) => {
    const [name, ...parameters] = part.trim().split(';')
    const quality = parameters.find((parameter) => parameter.trim().startsWith('q='))?.split('=')[1]
    return { name: name?.trim().toLowerCase(), quality: quality === undefined ? 1 : Number(quality) }
  })
  const explicit = encodings.find((encoding) => encoding.name === 'br')
  if (explicit) return Number.isFinite(explicit.quality) && explicit.quality > 0
  const wildcard = encodings.find((encoding) => encoding.name === '*')
  return Boolean(wildcard && Number.isFinite(wildcard.quality) && wildcard.quality > 0)
}

function brotliAssets(): Plugin {
  let buildRoot = ''
  return {
    name: 'star-view-brotli-assets',
    enforce: 'post',
    configResolved(config) {
      buildRoot = resolve(config.root, config.build.outDir)
    },
    writeBundle(_, bundle) {
      for (const output of Object.values(bundle)) {
        const extension = extname(output.fileName)
        if (!COMPRESSIBLE.has(extension)) continue
        const target = resolve(buildRoot, output.fileName)
        const input = readFileSync(target)
        if (input.byteLength < 1024) continue
        writeFileSync(`${target}.br`, brotliCompressSync(input, {
            params: {
              [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
              [constants.BROTLI_PARAM_QUALITY]: 11,
            },
          }))
      }
    },
    configurePreviewServer(server) {
      const outputRoot = realpathSync(resolve(server.config.root, server.config.build.outDir))
      server.middlewares.use((request, response, next) => {
        if (!request.url) return next()
        let pathname: string
        try {
          pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
        } catch {
          response.statusCode = 400
          response.end('Bad request')
          return
        }
        if (pathname === '/' || pathname.endsWith('/index.html')) {
          response.setHeader('Cache-Control', 'no-cache')
        } else if (/\/assets\/.+-[A-Za-z0-9_-]{8,}\./.test(pathname)) {
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
        const requested = resolve(outputRoot, `.${pathname}`)
        if (requested !== outputRoot && !requested.startsWith(`${outputRoot}${sep}`)) {
          response.statusCode = 403
          response.end('Forbidden')
          return
        }
        const sidecar = `${requested}.br`
        if (!existsSync(sidecar)) return next()
        const resolvedSidecar = realpathSync(sidecar)
        if (!resolvedSidecar.startsWith(`${outputRoot}${sep}`)) {
          response.statusCode = 403
          response.end('Forbidden')
          return
        }
        response.setHeader('Vary', 'Accept-Encoding')
        if (!acceptsBrotli(request.headers['accept-encoding'])) return next()
        response.setHeader('Content-Type', CONTENT_TYPES[extname(requested)] ?? 'application/octet-stream')
        response.setHeader('Content-Encoding', 'br')
        response.end(readFileSync(resolvedSidecar))
      })
    },
  }
}

export default defineConfig({
  plugins: [brotliAssets()],
})