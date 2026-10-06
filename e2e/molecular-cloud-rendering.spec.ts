import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { build } from 'vite'
import { PNG } from 'pngjs'
import { parseStarCatalog, type Star } from '../src/catalog'
import type { CloudRenderOptions, ViewerRenderOptions } from './fixtures/molecular-cloud-rendering'

const cloud = JSON.parse(readFileSync(new URL('../src/data/overlays/molecular-clouds/objects.json', import.meta.url), 'utf8')).objects
  .find((row: { id: string }) => row.id === 'cahlon-cloud-22')
let fixtureScript: string
const sun = parseStarCatalog(readFileSync(new URL('../src/data/stars.csv', import.meta.url), 'utf8')).find((star) => star.id === 'sun')!
const landmarks = parseStarCatalog(readFileSync(new URL('../src/data/catalogs/bright-stars/stars.csv', import.meta.url), 'utf8'))
const nebulae: Star[] = JSON.parse(readFileSync(new URL('../src/data/overlays/nebulae/objects.json', import.meta.url), 'utf8')).objects
const clouds: Star[] = JSON.parse(readFileSync(new URL('../src/data/overlays/molecular-clouds/objects.json', import.meta.url), 'utf8')).objects

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/__cloud-rendering', (route) => route.fulfill({
    contentType: 'text/html', body: '<meta name="viewport" content="width=device-width, initial-scale=1"><script type="module" src="/__cloud-rendering.js"></script>',
  }))
  await page.route('**/__cloud-rendering.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fixtureScript }))
  await page.goto('/__cloud-rendering')
  await page.waitForFunction(() => 'renderCloud' in window)
})

test.beforeAll(async () => {
  const result = await build({
    configFile: false, logLevel: 'error',
    build: {
      write: false, minify: false,
      lib: { entry: fileURLToPath(new URL('./fixtures/molecular-cloud-rendering.ts', import.meta.url)), formats: ['es'] },
    },
  })
  const output = Array.isArray(result) ? result[0] : result
  if (!output || !('output' in output)) throw new Error('Expected a cloud-rendering fixture bundle.')
  const bundle = output.output.find((output) => output.type === 'chunk')
  if (!bundle || bundle.type !== 'chunk') throw new Error('Missing cloud-rendering fixture bundle.')
  fixtureScript = bundle.code
})

test('dense clouds darken the sky without adding extinction to catalog sources', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const render = (options: Omit<CloudRenderOptions, 'cloud'>) => page.evaluate((input) =>
    (window as unknown as { renderCloud(options: CloudRenderOptions): number[] }).renderCloud(input), { ...options, cloud })

  for (const mode of ['real', 'exaggerated'] as const) {
    const empty = await render({ samples: 0, mode })
    const diffuse = await render({ samples: 1, mode })
    const dense = await render({ samples: 16, mode })
    const densest = await render({ samples: 64, mode })
    expect(diffuse[0]).toBeLessThan(empty[0]!)
    expect(dense[0]).toBeLessThan(diffuse[0]! - 50)
    expect(densest[0]).toBeLessThan(dense[0]!)
    expect(await render({ samples: 16, mode, selected: true })).toEqual(dense)
    const reduced = await render({ samples: 16, mode, fraction: 0.4 })
    expect(Math.abs(reduced[0]! - dense[0]!)).toBeLessThan(15)

    const black = await render({ samples: 64, mode, blackSky: true })
    expect(black.slice(0, 3)).toEqual([0, 0, 0])
    expect(black[3]).toBeGreaterThan(240)

    for (const source of ['foreground', 'background', 'halo', 'nebula'] as const) {
      const clear = await render({ samples: 0, mode, source })
      const obscured = await render({ samples: 16, mode, source })
      expect(obscured.slice(0, 3)).toEqual(clear.slice(0, 3))
    }
  }
  expect(errors).toEqual([])
})

function regionLight(image: PNG, point: { x: number; y: number }, radius: number) {
  let light = 0
  for (let y = Math.max(0, Math.floor(point.y - radius)); y < Math.min(image.height, point.y + radius); y++) {
    for (let x = Math.max(0, Math.floor(point.x - radius)); x < Math.min(image.width, point.x + radius); x++) {
      if (Math.hypot(x - point.x, y - point.y) > radius) continue
      const offset = (y * image.width + x) * 4
      light += image.data[offset]! + image.data[offset + 1]! + image.data[offset + 2]!
    }
  }
  return light
}

test('keeps Orion emission and belt stars visible with its molecular clouds', { tag: '@mobile' }, async ({ page }, testInfo) => {
  const stars = [sun, ...landmarks.filter((star) => star.constellation === 'Orion'), ...nebulae, ...clouds]
  const render = (options: Omit<ViewerRenderOptions, 'stars' | 'targetId'>) => page.evaluate((input) =>
    (window as unknown as { renderViewer(options: ViewerRenderOptions): Promise<Record<string, { x: number; y: number }>> }).renderViewer(input),
  { ...options, stars, targetId: 'orion-nebula' })
  const screenshot = (name: string) => page.locator('div canvas').screenshot({
    scale: 'css', style: '.projected-labels, .projected-axes { visibility: hidden !important; }', path: testInfo.outputPath(name),
  }).then((buffer) => PNG.sync.read(buffer))
  for (const observerView of [false, true]) {
    for (const mode of ['real', 'exaggerated'] as const) {
      const points = await render({ mode, observerView, showClouds: false })
      const clear = await screenshot(`orion-${observerView ? 'sky' : 'map'}-${mode}-clear.png`)
      await render({ mode, observerView, showClouds: true })
      const dusty = await screenshot(`orion-${observerView ? 'sky' : 'map'}-${mode}.png`)
      const nebulaLight = regionLight(dusty, points['orion-nebula']!, 18)
      expect(nebulaLight).toBeGreaterThan(2500)
      expect(nebulaLight).toBeGreaterThan(regionLight(clear, points['orion-nebula']!, 18) * 0.95)
      for (const id of ['bright-mintaka', 'bright-alnitak', 'bright-alnilam']) {
        const light = regionLight(dusty, points[id]!, 24)
        expect(light).toBeGreaterThan(1000)
        expect(light).toBeGreaterThan(regionLight(clear, points[id]!, 24) * 0.95)
      }
    }
  }
})

test('retains restrained star glow when switching to Observer view', async ({ page }, testInfo) => {
  const landmark = landmarks.find((star) => star.id === 'bright-alnilam')!
  const lights: number[] = []
  for (const distance of [20, 600]) {
    const star: Star = {
      ...landmark, id: 'equal-brightness-source', x_pc: -distance, y_pc: 0, z_pc: 0,
      absolute_mag: 2 - 5 * (Math.log10(distance) - 1),
    }
    const modeLights: number[] = []
    for (const observerView of [false, true]) {
      // Keep the camera at the Sun with the same direction and no overview
      // dimming. The map's minimum orbit radius is 0.08 pc.
      const points = await page.evaluate((input) =>
        (window as unknown as { renderViewer(options: ViewerRenderOptions): Promise<Record<string, { x: number; y: number }>> }).renderViewer(input),
      { stars: [sun, star], targetId: star.id, observerView, orbitDistancePc: 0.08, mode: 'real', showClouds: false } satisfies ViewerRenderOptions)
      const image = PNG.sync.read(await page.locator('div canvas').screenshot({
        scale: 'css', path: testInfo.outputPath(`star-${distance}pc-${observerView ? 'observer' : 'map'}.png`),
      }))
      modeLights.push(regionLight(image, points[star.id]!, 40))
    }
    expect(modeLights[1]! / modeLights[0]!).toBeGreaterThan(0.98)
    expect(modeLights[1]! / modeLights[0]!).toBeLessThan(1.02)
    lights.push(modeLights[1]!)
  }
  expect(lights[0]).toBeGreaterThan(5000)
  expect(lights[1]).toBeGreaterThan(500)
  expect(lights[1]!).toBeLessThan(lights[0]! * 0.5)
})

test('renders a continuous long-exposure nebula with a bright core and faint wings', { tag: '@mobile' }, async ({ page }, testInfo) => {
  const orion = nebulae.find((star) => star.id === 'orion-nebula')!
  const render = (powerSaving: boolean) => page.evaluate((input) =>
    (window as unknown as { renderViewer(options: ViewerRenderOptions): Promise<Record<string, { x: number; y: number }>> }).renderViewer(input),
  { stars: [sun, orion], targetId: orion.id, observerView: false, mode: 'real', showClouds: false, targetDistancePc: 20, powerSaving } satisfies ViewerRenderOptions)
  const points = await render(false)
  const canvas = page.locator('div canvas')
  const image = PNG.sync.read(await canvas.screenshot({
    scale: 'css', style: '.projected-labels, .projected-axes { visibility: hidden !important; }', path: testInfo.outputPath('orion-long-exposure.png'),
  }))
  const center = points[orion.id]!
  const scale = image.height / 900
  const innerRadius = 25 * scale
  const outerRadius = 180 * scale
  const core = regionLight(image, center, innerRadius) / (Math.PI * innerRadius ** 2)
  const wings = (regionLight(image, center, outerRadius) - regionLight(image, center, 130 * scale))
    / (Math.PI * (outerRadius ** 2 - (130 * scale) ** 2))
  expect(core).toBeGreaterThan(wings * 2)
  expect(wings).toBeGreaterThan(15)

  // Adjacent-pixel variation catches the isolated bright flecks that made
  // the old emitting volume look granular, without relying on a pixel golden.
  let variation = 0
  let light = 0
  let litCore = 0
  let corePixels = 0
  let clippedPixels = 0
  const radius = 120 * scale
  for (let y = Math.floor(center.y - radius); y < center.y + radius; y++) {
    for (let x = Math.floor(center.x - radius); x < center.x + radius; x++) {
      const distance = Math.hypot(x - center.x, y - center.y)
      if (distance > radius) continue
      const offset = (y * image.width + x) * 4
      const value = image.data[offset]! + image.data[offset + 1]! + image.data[offset + 2]!
      const next = image.data[offset + 4]! + image.data[offset + 5]! + image.data[offset + 6]!
      variation += Math.abs(next - value)
      light += value
      if (image.data[offset]! >= 250 && image.data[offset + 1]! >= 250 && image.data[offset + 2]! >= 250) clippedPixels++
      if (distance < 35 * scale) {
        corePixels++
        if (value > 45) litCore++
      }
    }
  }
  expect(variation / light).toBeLessThan(0.08)
  expect(litCore / corePixels).toBeGreaterThan(0.95)
  expect(clippedPixels / (Math.PI * radius ** 2)).toBeLessThan(0.01)

  await render(true)
  const reduced = PNG.sync.read(await canvas.screenshot({ scale: 'css' }))
  const ratio = regionLight(reduced, center, radius) / regionLight(image, center, radius)
  expect(ratio).toBeGreaterThan(0.7)
  expect(ratio).toBeLessThan(1.3)
})
