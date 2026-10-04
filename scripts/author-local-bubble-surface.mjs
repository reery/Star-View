import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const LONGITUDE_SEGMENTS = 128
const LATITUDE_SEGMENTS = 64
const OUTPUT = resolve('src/data/overlays/bubbles/local-bubble-surface.json')
const SOURCE_URL = 'https://theo-oneill.github.io/localbubble/plots/distance_interactive.html'
const SOURCE_COMMIT = '52aa44614f3036b90fab8fd1beed996d285a7995'

const args = process.argv.slice(2)
const check = args.includes('--check')
const sourceArg = args.find((argument) => argument !== '--check')
if (!sourceArg) {
  throw new Error('Usage: node scripts/author-local-bubble-surface.mjs <distance_interactive.html> [--check]')
}
const source = resolve(sourceArg)

const browser = await chromium.launch({ headless: true })
let sampled
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(source).href, { waitUntil: 'load', timeout: 60_000 })
  await page.waitForFunction(() => window.K3DInstance, { timeout: 60_000 })
  sampled = await page.evaluate(async ({ longitudeSegments, latitudeSegments }) => {
    const instance = await window.K3DInstance
    const object = instance.getWorld().K3DObjects.children.find((candidate) => (
      candidate.geometry?.getAttribute('position')?.count > 1_000
    ))
    if (!object) throw new Error('The published Local Bubble point cloud was not found.')
    const positions = object.geometry.getAttribute('position').array
    const count = longitudeSegments * (latitudeSegments + 1)
    const cellRadii = Array.from({ length: count }, () => [])
    const radii = new Float32Array(count)
    const sourceBounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]

    for (let offset = 0; offset < positions.length; offset += 3) {
      const x = positions[offset]
      const y = positions[offset + 1]
      const z = positions[offset + 2]
      const radius = Math.hypot(x, y, z)
      const longitude = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2)
      const latitude = Math.asin(z / radius)
      const longitudeIndex = Math.round(longitude / (Math.PI * 2) * longitudeSegments) % longitudeSegments
      const latitudeIndex = Math.max(0, Math.min(
        latitudeSegments,
        Math.round((latitude + Math.PI / 2) / Math.PI * latitudeSegments),
      ))
      const index = latitudeIndex * longitudeSegments + longitudeIndex
      cellRadii[index].push(radius)
      sourceBounds[0] = Math.min(sourceBounds[0], x)
      sourceBounds[1] = Math.min(sourceBounds[1], y)
      sourceBounds[2] = Math.min(sourceBounds[2], z)
      sourceBounds[3] = Math.max(sourceBounds[3], x)
      sourceBounds[4] = Math.max(sourceBounds[4], y)
      sourceBounds[5] = Math.max(sourceBounds[5], z)
    }

    // A single HEALPix sightline can carry parsec-scale peaks that turn into long,
    // needle-like triangles on a much coarser mesh. Use the upper representative
    // radius in each angular cell: the 95th percentile retains narrow chimney and
    // tunnel extrema without allowing one source pixel to define an entire cell.
    for (let index = 0; index < count; index++) {
      const samples = cellRadii[index]
      if (samples.length === 0) continue
      samples.sort((a, b) => a - b)
      radii[index] = samples[Math.floor((samples.length - 1) * 0.95)]
    }

    // HEALPix samples are equal-area, so the narrow longitude cells nearest the poles
    // can be empty. Fill those few cells from their nearest neighbors in the same row.
    for (let latitudeIndex = 1; latitudeIndex < latitudeSegments; latitudeIndex++) {
      for (let longitudeIndex = 0; longitudeIndex < longitudeSegments; longitudeIndex++) {
        const index = latitudeIndex * longitudeSegments + longitudeIndex
        if (radii[index] > 0) continue
        for (let distance = 1; distance < longitudeSegments; distance++) {
          const left = latitudeIndex * longitudeSegments
            + (longitudeIndex - distance + longitudeSegments) % longitudeSegments
          const right = latitudeIndex * longitudeSegments
            + (longitudeIndex + distance) % longitudeSegments
          if (radii[left] > 0 || radii[right] > 0) {
            radii[index] = radii[left] > 0 && radii[right] > 0
              ? (radii[left] + radii[right]) / 2
              : Math.max(radii[left], radii[right])
            break
          }
        }
      }
    }

    // A latitude-longitude mesh has duplicated pole vertices. Give every duplicate
    // the same radius so the published point cloud becomes a watertight surface.
    for (const latitudeIndex of [0, latitudeSegments]) {
      let total = 0
      let samples = 0
      for (let longitudeIndex = 0; longitudeIndex < longitudeSegments; longitudeIndex++) {
        const radius = radii[latitudeIndex * longitudeSegments + longitudeIndex]
        if (radius > 0) {
          total += radius
          samples++
        }
      }
      const poleRadius = total / samples
      radii.fill(poleRadius, latitudeIndex * longitudeSegments, (latitudeIndex + 1) * longitudeSegments)
    }

    const roundedRadii = Array.from(radii, (radius) => Math.round(radius * 10) / 10)
    if (roundedRadii.some((radius) => !Number.isFinite(radius) || radius <= 0)) {
      throw new Error('The sampled Local Bubble surface contains an invalid radius.')
    }
    return {
      source_point_count: positions.length / 3,
      source_bounds_pc: sourceBounds.map((coordinate) => Math.round(coordinate * 1_000) / 1_000),
      radii_pc: roundedRadii,
    }
  }, { longitudeSegments: LONGITUDE_SEGMENTS, latitudeSegments: LATITUDE_SEGMENTS })
} finally {
  await browser.close()
}

const output = `${JSON.stringify({
  schema_version: 1,
  source_url: SOURCE_URL,
  source_commit: SOURCE_COMMIT,
  sampling: '95th-percentile published sightline radius in each Galactic longitude-latitude cell; shared pole means',
  longitude_segments: LONGITUDE_SEGMENTS,
  latitude_segments: LATITUDE_SEGMENTS,
  source_point_count: sampled.source_point_count,
  source_bounds_pc: sampled.source_bounds_pc,
  radii_pc: sampled.radii_pc,
}, null, 2)}\n`

if (check) {
  if (readFileSync(OUTPUT, 'utf8') !== output) throw new Error(`${OUTPUT} is not reproducible from ${source}`)
  console.log(`Verified ${OUTPUT}`)
} else {
  writeFileSync(OUTPUT, output)
  console.log(`Wrote ${OUTPUT}`)
}
