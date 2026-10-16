import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { build } from 'vite'
import { PNG } from 'pngjs'
import { parseStarCatalog, type Star } from '../src/catalog'
import { generateMolecularCloudPuffs } from '../src/molecular-cloud-layer'
import type { StarColorMode } from '../src/astronomy'
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

test('dense clouds darken the sky and gently dim overlapping catalog sources', async ({ page }) => {
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

    const foreground = await render({ samples: 0, mode, source: 'foreground' })
    expect(await render({ samples: 64, mode, source: 'foreground' })).toEqual(foreground)

    for (const source of ['background', 'halo', 'nebula'] as const) {
      for (const sourceBrightness of [1, 0.02]) {
        const options = { mode, source, sourceBrightness, blackSky: true }
        const clear = await render({ ...options, samples: 0 })
        const obscured = await render({ ...options, samples: 16 })
        const dense = await render({ ...options, samples: 64 })
        for (let channel = 0; channel < 3; channel++) {
          expect(obscured[channel]).toBeLessThan(clear[channel]! * 0.95)
          expect(dense[channel]).toBeLessThan(obscured[channel]!)
          expect(dense[channel]).toBeGreaterThan(clear[channel]! * 0.7)
        }
        expect(await render({ ...options, samples: 16, selected: true })).toEqual(obscured)
        const reduced = await render({ ...options, samples: 16, fraction: 0.4 })
        // Prefix sampling changes the filament/noise mixture. Keep its visible
        // attenuation within two percent of the full-density rendering.
        expect(Math.abs(reduced[0]! - obscured[0]!)).toBeLessThan(clear[0]! * 0.02 + 1)
        expect(await render({ ...options, samples: 64, cloudOffsetPc: 10 })).toEqual(clear)
      }
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

test('visibly dims a distant star through the actual dense Taurus cloud samples', async ({ page }, testInfo) => {
  const puffs = generateMolecularCloudPuffs(cloud, 0)
  // Choose the densest source-backed sightline, rather than stacking artificial
  // samples at one position or assuming a catalog star lies behind the cloud.
  let bestPoint = 0
  let bestDensity = 0
  for (let candidate = 0; candidate < puffs.count; candidate++) {
    const offset = candidate * 3
    const direction = Array.from(puffs.centers.slice(offset, offset + 3))
    const length = Math.hypot(...direction)
    const [dx, dy, dz] = direction.map((value) => value / length) as [number, number, number]
    let density = 0
    for (let index = 0; index < puffs.count; index++) {
      const x = puffs.centers[index * 3]!
      const y = puffs.centers[index * 3 + 1]!
      const z = puffs.centers[index * 3 + 2]!
      const depth = x * dx + y * dy + z * dz
      const r2 = Math.max(0, x * x + y * y + z * z - depth * depth) / puffs.shapes[index * 4]! ** 2
      if (r2 < 1) density += puffs.shapes[index * 4 + 1]! * (1 - r2) ** 1.65
    }
    if (density > bestDensity) { bestDensity = density; bestPoint = candidate }
  }
  const source: Star = {
    ...landmarks.find((star) => star.id === 'bright-alnilam')!,
    id: 'taurus-background-star',
    x_pc: puffs.centers[bestPoint * 3]! * 2,
    y_pc: -puffs.centers[bestPoint * 3 + 2]! * 2,
    z_pc: puffs.centers[bestPoint * 3 + 1]! * 2,
    absolute_mag: -5,
  }
  for (const mode of ['real', 'exaggerated'] as const) {
    for (const powerSaving of [false, true]) {
      const render = (showClouds: boolean) => page.evaluate((input) =>
        (window as unknown as { renderViewer(options: ViewerRenderOptions): Promise<Record<string, { x: number; y: number }>> }).renderViewer(input),
      { stars: [sun, source, cloud], targetId: source.id, observerView: true, mode, showClouds, powerSaving } satisfies ViewerRenderOptions)
      const points = await render(false)
      const capture = async (dust: string) => PNG.sync.read(await page.locator('div canvas').screenshot({
        scale: 'css', path: testInfo.outputPath(`taurus-${mode}-${powerSaving ? 'reduced' : 'full'}-${dust}.png`),
      }))
      const clear = await capture('clear')
      await render(true)
      const dusty = await capture('dusty')
      const ratio = regionLight(dusty, points[source.id]!, 12) / regionLight(clear, points[source.id]!, 12)
      expect(ratio).toBeLessThan(0.9)
      expect(ratio).toBeGreaterThan(0.7)
    }
  }
})

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
      // Dense dust may visibly attenuate emitting gas and stars, but its
      // capped absorption must preserve at least 70% of their displayed light.
      expect(nebulaLight).toBeGreaterThan(regionLight(clear, points['orion-nebula']!, 18) * 0.7)
      for (const id of ['bright-mintaka', 'bright-alnitak', 'bright-alnilam']) {
        const light = regionLight(dusty, points[id]!, 24)
        expect(light).toBeGreaterThan(1000)
        expect(light).toBeGreaterThan(regionLight(clear, points[id]!, 24) * 0.7)
      }
    }
  }
})

test('uses apparent brightness once in both views while retaining map zoom restraint', async ({ page }, testInfo) => {
  const landmark = landmarks.find((star) => star.id === 'bright-alnilam')!
  const lights: number[][] = []
  for (const [distance, magnitude] of [[20, 2], [600, 2], [600, 6]] as const) {
    const star: Star = {
      ...landmark, id: 'equal-brightness-source', x_pc: -distance, y_pc: 0, z_pc: 0,
      absolute_mag: magnitude - 5 * (Math.log10(distance) - 1),
    }
    const modeLights: number[] = []
    for (const observerView of [false, true]) {
      // Keep the camera at the Sun with the same direction and no overview
      // dimming. The map's minimum orbit radius is 0.08 pc.
      const points = await page.evaluate((input) =>
        (window as unknown as { renderViewer(options: ViewerRenderOptions): Promise<Record<string, { x: number; y: number }>> }).renderViewer(input),
      { stars: [sun, star], targetId: star.id, observerView, orbitDistancePc: 0.08, mode: 'real', showClouds: false } satisfies ViewerRenderOptions)
      const image = PNG.sync.read(await page.locator('div canvas').screenshot({
        scale: 'css', path: testInfo.outputPath(`star-${distance}pc-mag${magnitude}-${observerView ? 'observer' : 'map'}.png`),
      }))
      modeLights.push(regionLight(image, points[star.id]!, 40))
    }
    lights.push(modeLights)
  }
  const [near, distant, faint] = lights as [number[], number[], number[]]
  // Equal apparent magnitudes must render equally, even at different distances.
  expect(distant[0]! / near[0]!).toBeGreaterThan(0.98)
  expect(distant[0]! / near[0]!).toBeLessThan(1.02)
  expect(distant[1]! / near[1]!).toBeGreaterThan(0.98)
  expect(distant[1]! / near[1]!).toBeLessThan(1.02)
  expect(distant[0]! / distant[1]!).toBeGreaterThan(0.98)
  expect(distant[0]! / distant[1]!).toBeLessThan(1.02)
  expect(distant[1]!).toBeGreaterThan(3000)
  expect(faint[0]!).toBeLessThan(distant[0]! * 0.5)
  expect(faint[1]!).toBeLessThan(distant[1]! * 0.5)

  const star: Star = { ...landmark, id: 'overview-source', x_pc: -600, y_pc: 0, z_pc: 0,
    absolute_mag: 2 - 5 * (Math.log10(600) - 1) }
  const points = await page.evaluate((input) =>
    (window as unknown as { renderViewer(options: ViewerRenderOptions): Promise<Record<string, { x: number; y: number }>> }).renderViewer(input),
  { stars: [sun, star], targetId: star.id, observerView: false, targetDistancePc: 1200, hideSun: true,
    mode: 'real', showClouds: false } satisfies ViewerRenderOptions)
  const overview = PNG.sync.read(await page.locator('div canvas').screenshot({
    scale: 'css', path: testInfo.outputPath('star-map-zoomed-out.png'),
  }))
  expect(regionLight(overview, points[star.id]!, 40)).toBeLessThan(distant[0]! * 0.5)
})

test('matches Earth-chart brightness for Heka A and the Orion belt from the Sun in both views', async ({ page }, testInfo) => {
  const components: Star[] = JSON.parse(readFileSync(new URL('../src/data/stellar-companions.json', import.meta.url), 'utf8')).stars
  const ids = ['hip-26207', 'bright-alnitak', 'bright-mintaka', 'bright-alnilam']
  const stars = [sun, ...components.filter((star) => ids.includes(star.id)),
    { ...landmarks.find((star) => star.id === 'bright-alnilam')!, apparent_mag: 1.69 }]
  for (const mode of ['real', 'exaggerated'] as const) {
    for (const observerView of [false, true]) {
      const points = await page.evaluate((input) =>
        (window as unknown as { renderViewer(options: ViewerRenderOptions): Promise<Record<string, { x: number; y: number }>> }).renderViewer(input),
      { stars, targetId: 'bright-alnilam', observerView, mode, showClouds: false } satisfies ViewerRenderOptions)
      const view = PNG.sync.read(await page.locator('div canvas').screenshot({
        scale: 'css', path: testInfo.outputPath(`orion-components-${observerView ? 'observer' : 'map'}-${mode}.png`),
      }))
      await page.evaluate(({ stars, points, mode }) =>
        (window as unknown as { renderEarthChart(stars: Star[], points: Record<string, { x: number; y: number }>, mode: StarColorMode): void })
          .renderEarthChart(stars, points, mode), { stars, points, mode })
      const chart = PNG.sync.read(await page.locator('#earth-chart').screenshot({
        scale: 'css', path: testInfo.outputPath(`orion-components-earth-chart-${observerView ? 'observer' : 'map'}-${mode}.png`),
      }))
      for (const id of ids) {
        const viewLight = regionLight(view, points[id]!, 40)
        const chartLight = regionLight(chart, points[id]!, 40)
        expect(viewLight, id).toBeGreaterThan(1000)
        expect(viewLight / chartLight, id).toBeGreaterThan(0.95)
        expect(viewLight / chartLight, id).toBeLessThan(1.05)
      }
    }
  }
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
