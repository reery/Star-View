import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import { LIGHT_YEARS_PER_PARSEC } from '../src/astronomy'
import { openFilter, openPreferences, openViewer, zoomViewer } from './support'

type CloudRow = { id: string; name: string; molecular_cloud: { distance_pc: number; sample_points_pc: number[] } }
const CLOUDS: CloudRow[] = JSON.parse(readFileSync(new URL('../src/data/overlays/molecular-clouds/objects.json', import.meta.url), 'utf8')).objects
const DEFAULT_ROWS = 22

function expectedPuffs(limitLy: number, fraction = 1) {
  return String(CLOUDS
    .filter((row) => row.molecular_cloud.distance_pc * LIGHT_YEARS_PER_PARSEC <= limitLy)
    .reduce((sum, row) => sum + Math.max(1, Math.ceil(row.molecular_cloud.sample_points_pc.length / 3 * fraction)), 0))
}

function darkenedCloudPixels(cloudy: PNG, clear: PNG) {
  expect(cloudy.width).toBe(clear.width)
  expect(cloudy.height).toBe(clear.height)
  let count = 0
  for (let offset = 0; offset < cloudy.data.length; offset += 4) {
    const clearLight = clear.data[offset]! + clear.data[offset + 1]! + clear.data[offset + 2]!
    const cloudyLight = cloudy.data[offset]! + cloudy.data[offset + 1]! + cloudy.data[offset + 2]!
    if (clearLight - cloudyLight > 12) count++
  }
  return count
}

test('loads all 65 Cahlon clouds on demand and exposes sourced cloud properties', { tag: '@mobile' }, async ({ page }, testInfo) => {
  test.setTimeout(45_000)
  const cloudRequests: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (/\/assets\/molecular-clouds-[^/]+\.json$/.test(path)) cloudRequests.push(path)
  })
  await openViewer(page)
  expect(cloudRequests).toHaveLength(0)
  await openFilter(page)
  await page.locator('details.filter-dropdown > summary').click()
  const molecularClouds = page.getByLabel('Molecular clouds', { exact: true })
  await expect(molecularClouds).toBeChecked()
  await expect(molecularClouds).toBeDisabled()
  await page.getByRole('switch', { name: 'Interstellar medium', exact: true }).check()
  await expect(molecularClouds).toBeEnabled()
  await expect.poll(() => cloudRequests.length).toBe(1)
  await page.getByLabel('Reflection nebulae', { exact: true }).uncheck()
  await page.getByLabel('H II regions', { exact: true }).uncheck()

  const layer = page.locator('.projected-labels')
  await expect(layer).toHaveAttribute('data-molecular-cloud-puff-count', expectedPuffs(100))
  await page.getByLabel('Object visibility distance', { exact: true }).fill('20')
  await expect(layer).toHaveAttribute('data-molecular-cloud-puff-count', expectedPuffs(1500))
  await expect(page.locator('#catalog-count')).toHaveText(new RegExp(`/${DEFAULT_ROWS + CLOUDS.length}$`))

  await openPreferences(page)
  await page.getByRole('switch', { name: 'Power saving mode' }).check()
  await expect(layer).toHaveAttribute('data-molecular-cloud-puff-count', expectedPuffs(1500, 0.4))
  await page.getByRole('switch', { name: 'Power saving mode' }).uncheck()
  await expect(layer).toHaveAttribute('data-molecular-cloud-puff-count', expectedPuffs(1500))

  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('Taurus Molecular')
  await page.getByRole('button', { name: 'Select Taurus Molecular Cloud', exact: true }).click()
  await expect(page.locator('#object-type')).toHaveText('Molecular cloud')
  await expect(page.locator('#molecular-cloud-complex')).toHaveText('Taurus')
  await expect(page.locator('#mass')).toHaveText('6,352 M☉')
  await expect(page.locator('#molecular-cloud-radius')).toHaveText('32.9 ly')
  await expect(page.locator('#molecular-cloud-density')).toHaveText('47 H nuclei/cm³')
  await expect(page.locator('#molecular-cloud-peak-density')).toHaveText('562 H nuclei/cm³')
  await expect(page.locator('#molecular-cloud-source')).toHaveAttribute('href', 'https://doi.org/10.3847/1538-4357/ad0cf8')
  await expect(page.locator('.stellar-property:visible, .nebula-property:visible, .bubble-property:visible')).toHaveCount(0)
  await expect(page.locator('[data-star-id="cahlon-cloud-22"] .star-label')).toBeVisible()

  await zoomViewer(page, 'in', 8)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  // Catalog reloads can change grid geometry. Compare extinction against the
  // same sky background without those unrelated guide lines.
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await expect(page.locator('#scene')).toHaveAttribute('data-milky-way-ready', 'true')
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const screenshotStyle = '.projected-labels, .projected-axes, [data-scene-obstacle] { visibility: hidden !important; }'
  const image = PNG.sync.read(await page.locator('#scene canvas').screenshot({
    scale: 'css',
    style: screenshotStyle,
    path: testInfo.outputPath('taurus-molecular-cloud.png'),
  }))

  await openFilter(page)
  await page.getByRole('switch', { name: 'Interstellar medium', exact: true }).uncheck()
  await expect(page.locator('#catalog-count')).toHaveText(new RegExp(`/${DEFAULT_ROWS}$`))
  await expect(layer).not.toHaveAttribute('data-molecular-cloud-puff-count')
  expect(cloudRequests).toHaveLength(1)
  await expect(page.locator('#scene')).toHaveAttribute('data-milky-way-ready', 'true')
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const clear = PNG.sync.read(await page.locator('#scene canvas').screenshot({
    scale: 'css', style: screenshotStyle, path: testInfo.outputPath('taurus-without-clouds.png'),
  }))
  // Scale the required silhouette area with the desktop/mobile viewport.
  expect(darkenedCloudPixels(image, clear) / (image.width * image.height)).toBeGreaterThan(0.002)
})
