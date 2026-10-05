import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { LIGHT_YEARS_PER_PARSEC } from '../src/astronomy'
import { hideMilkyWay, openFilter, openPreferences, openViewer, zoomViewer } from './support'

type NebulaRow = { type: string; nebula: { distance_pc: number; puff_count: number } }
const NEBULAE: NebulaRow[] = JSON.parse(readFileSync(new URL('../src/data/overlays/nebulae/objects.json', import.meta.url), 'utf8')).objects
const INTERSTELLAR = ['reflection_nebula', 'hii_region']
const DEFAULT_ROWS = 22

function expectedPuffs(limitLy: number, types = INTERSTELLAR, fraction = 1) {
  return String(NEBULAE
    .filter((row) => types.includes(row.type) && row.nebula.distance_pc * LIGHT_YEARS_PER_PARSEC <= limitLy)
    .reduce((sum, row) => sum + Math.max(1, Math.ceil(row.nebula.puff_count * fraction)), 0))
}

async function nextFrames(page: Page, count = 2) {
  await page.evaluate((frames) => new Promise<void>((resolve) => {
    const step = (remaining: number) => remaining === 0 ? resolve() : requestAnimationFrame(() => step(remaining - 1))
    step(frames)
  }), count)
}

async function enableNebulae(page: Page, distanceStep = '20') {
  await openFilter(page)
  await page.getByRole('switch', { name: 'Interstellar medium', exact: true }).check()
  // Keep this suite focused on the independently rendered luminous-nebula layer.
  const typeDropdown = page.locator('details.filter-dropdown')
  if (await typeDropdown.getAttribute('open') === null) await typeDropdown.locator('summary').click()
  await page.getByLabel('Molecular clouds', { exact: true }).uncheck()
  await expect(page.locator('.projected-labels')).toHaveAttribute('data-nebula-puff-count', /\d+/)
  await page.getByLabel('Object visibility distance', { exact: true }).fill(distanceStep)
}

async function focusOrionNebula(page: Page) {
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('Orion')
  await page.getByRole('button', { name: 'Select Orion Nebula', exact: true }).click()
  // The home view frames every visible nebula, so Orion starts small.
  await zoomViewer(page, 'in', 15)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await nextFrames(page)
}

function nebulaPixels(image: PNG) {
  let count = 0
  let saturation = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset]!
    const green = image.data[offset + 1]!
    const blue = image.data[offset + 2]!
    const max = Math.max(red, green, blue)
    // Pink/red emission dominates the Orion palette in both color modes.
    if (red + green + blue < 90 || red < blue) continue
    count++
    saturation += (max - Math.min(red, green, blue)) / max
  }
  return { count, saturation: count ? saturation / count : 0 }
}

test('loads nebulae on demand through the interstellar-medium category', async ({ page }) => {
  const nebulaRequests: string[] = []
  page.on('request', (request) => {
    if (/\/assets\/nebulae-[^/]+\.json$/.test(new URL(request.url()).pathname)) nebulaRequests.push(request.url())
  })
  await openViewer(page)
  expect(nebulaRequests).toHaveLength(0)
  await openFilter(page)
  await page.locator('details.filter-dropdown > summary').click()
  const hii = page.getByLabel('H II regions', { exact: true })
  const reflection = page.getByLabel('Reflection nebulae', { exact: true })
  await expect(hii).toBeDisabled()
  await enableNebulae(page, '14')
  await expect(page.locator('#catalog-count')).toHaveText(new RegExp(`/${DEFAULT_ROWS + NEBULAE.length}$`))
  expect(nebulaRequests).toHaveLength(1)
  await expect(hii).toBeEnabled()
  await expect(page.locator('#object-type-filter-summary')).toHaveText('6 of 12')
  const layer = page.locator('.projected-labels')
  // Nebulae follow the Sun-centered distance filter by their centers.
  await expect(layer).toHaveAttribute('data-nebula-puff-count', '0')
  await expect(page.locator('[data-star="orion-nebula"]')).toHaveCount(0)
  await page.getByLabel('Object visibility distance', { exact: true }).fill('18')
  await expect(layer).toHaveAttribute('data-nebula-puff-count', expectedPuffs(500))
  await page.getByLabel('Object visibility distance', { exact: true }).fill('20')
  await expect(layer).toHaveAttribute('data-nebula-puff-count', expectedPuffs(1500))
  await reflection.uncheck()
  await expect(layer).toHaveAttribute('data-nebula-puff-count', expectedPuffs(1500, ['hii_region']))
  await expect(page.locator('#object-type-filter-summary')).toHaveText('5 of 12')
  await reflection.check()
  // Planetary nebulae share the overlay but live under Stellar remnants.
  await page.getByRole('switch', { name: 'Stellar remnants', exact: true }).check()
  await expect(layer).toHaveAttribute('data-nebula-puff-count', expectedPuffs(1500, [...INTERSTELLAR, 'planetary_nebula']))
  await page.getByRole('switch', { name: 'Stellar remnants', exact: true }).uncheck()
  expect(nebulaRequests).toHaveLength(1)

  await openPreferences(page)
  await page.getByRole('switch', { name: 'Power saving mode' }).check()
  await expect(layer).toHaveAttribute('data-nebula-puff-count', expectedPuffs(1500, INTERSTELLAR, 0.5))
  await page.getByRole('switch', { name: 'Power saving mode' }).uncheck()
  await expect(layer).toHaveAttribute('data-nebula-puff-count', expectedPuffs(1500))

  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('M42')
  await page.getByRole('button', { name: 'Select Orion Nebula', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Orion Nebula')
  await expect(page.locator('#object-type')).toHaveText('H II region')
  await expect(page.locator('#constellation')).toHaveText('Orion')
  await expect(page.locator('#distance-value')).toHaveText('1265.49')
  await expect(page.locator('#object-designations')).toContainText('M42')
  await expect(page.locator('#object-designations')).toContainText('NGC 1976')
  await expect(page.locator('#object-designations')).toContainText('Sh 2-281')
  await expect(page.locator('#nebula-angular-size')).toHaveText('65\u2032 \u00d7 60\u2032')
  await expect(page.locator('#nebula-extent')).toHaveText('23.9 \u00d7 22.1 \u00d7 11.7 ly')
  await expect(page.locator('#nebula-source')).toHaveAttribute('href', 'https://doi.org/10.1086/317982')
  await expect(page.locator('.stellar-property:visible, #mass-row:visible, .compact-property:visible')).toHaveCount(0)
  await expect(page.locator('[data-star-id="orion-nebula"] .star-label')).toBeVisible()

  await openFilter(page)
  await page.getByRole('switch', { name: 'Interstellar medium', exact: true }).uncheck()
  await expect(page.locator('#catalog-count')).toHaveText(new RegExp(`/${DEFAULT_ROWS}$`))
  await expect(layer).not.toHaveAttribute('data-nebula-puff-count')
  await expect(page.locator('#star-details')).toBeHidden()
})

test('draws all nebulae in one emission call that follows the color preference and sleeps when idle', { tag: '@mobile' }, async ({ page, isMobile }, testInfo) => {
  await openViewer(page)
  await hideMilkyWay(page)
  await openFilter(page)
  await page.getByRole('switch', { name: 'Motion arrows', exact: true }).uncheck()
  await enableNebulae(page)
  const layer = page.locator('.projected-labels')
  await expect(layer).toHaveAttribute('data-nebula-puff-count', expectedPuffs(1500))
  await zoomViewer(page, 'in')
  await nextFrames(page)
  const withNebulae = Number(await layer.getAttribute('data-draw-calls'))
  await page.getByLabel('Object visibility distance', { exact: true }).fill('14')
  await expect(layer).toHaveAttribute('data-nebula-puff-count', '0')
  await expect(layer).toHaveAttribute('data-draw-calls', String(withNebulae - 1))
  await page.getByLabel('Object visibility distance', { exact: true }).fill('20')
  await expect(layer).toHaveAttribute('data-draw-calls', String(withNebulae))

  await focusOrionNebula(page)
  const canvas = page.locator('#scene canvas')
  const hideOverlays = '.projected-labels, .projected-axes { visibility: hidden !important; }'
  const vivid = PNG.sync.read(await canvas.screenshot({ scale: 'css', style: hideOverlays, path: testInfo.outputPath('orion-exaggerated.png') }))
  await openPreferences(page)
  await page.getByRole('radio', { name: 'Real', exact: true }).check()
  await page.getByRole('button', { name: 'Preferences', exact: true }).click()
  await nextFrames(page)
  const real = PNG.sync.read(await canvas.screenshot({ scale: 'css', style: hideOverlays, path: testInfo.outputPath('orion-real.png') }))
  const vividStats = nebulaPixels(vivid)
  const realStats = nebulaPixels(real)
  expect(vividStats.count).toBeGreaterThan(1500)
  expect(realStats.count).toBeGreaterThan(1500)
  expect(vividStats.saturation).toBeGreaterThan(realStats.saturation + (isMobile ? 0.05 : 0.1))

  const passes = Number(await layer.getAttribute('data-ordinary-layout-passes'))
  await page.waitForTimeout(500)
  expect(Number(await layer.getAttribute('data-ordinary-layout-passes'))).toBe(passes)
})

test('keeps the Orion Nebula visible with bright and constellation stars enabled', { tag: '@mobile' }, async ({ page }, testInfo) => {
  await openViewer(page)
  await hideMilkyWay(page)
  await openFilter(page)
  await page.getByRole('switch', { name: 'Motion arrows', exact: true }).uncheck()
  await page.getByRole('switch', { name: 'Always show bright stars', exact: true }).check()
  await page.getByRole('switch', { name: 'Western constellation stars', exact: true }).check()
  await enableNebulae(page)
  await focusOrionNebula(page)

  const image = PNG.sync.read(await page.locator('#scene canvas').screenshot({
    scale: 'css',
    style: '.projected-labels, .projected-axes { visibility: hidden !important; }',
    path: testInfo.outputPath('orion-with-landmark-stars.png'),
  }))
  const stats = nebulaPixels(image)
  expect(stats.count).toBeGreaterThan(1500)
  expect(stats.saturation).toBeGreaterThan(0.25)
})
