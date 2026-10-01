import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { hideMilkyWay, openFilter, openPreferences, openViewer } from './support'

const ORION_PUFFS = 320
const PLEIADES_PUFFS = 200

async function nextFrames(page: Page, count = 2) {
  await page.evaluate((frames) => new Promise<void>((resolve) => {
    const step = (remaining: number) => remaining === 0 ? resolve() : requestAnimationFrame(() => step(remaining - 1))
    step(frames)
  }), count)
}

async function enableNebulae(page: Page, distanceStep = '20') {
  await openFilter(page)
  await page.getByRole('switch', { name: 'Interstellar medium', exact: true }).check()
  await expect(page.locator('.projected-labels')).toHaveAttribute('data-nebula-puff-count', /\d+/)
  await page.getByLabel('Object visibility distance', { exact: true }).fill(distanceStep)
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
  await expect(page.locator('#catalog-count')).toHaveText(/\/24$/)
  expect(nebulaRequests).toHaveLength(1)
  await expect(hii).toBeEnabled()
  await expect(page.locator('#object-type-filter-summary')).toHaveText('6 of 9')
  const layer = page.locator('.projected-labels')
  // Nebulae follow the Sun-centered distance filter by their centers.
  await expect(layer).toHaveAttribute('data-nebula-puff-count', '0')
  await expect(page.locator('[data-star="orion-nebula"]')).toHaveCount(0)
  await page.getByLabel('Object visibility distance', { exact: true }).fill('18')
  await expect(layer).toHaveAttribute('data-nebula-puff-count', String(PLEIADES_PUFFS))
  await page.getByLabel('Object visibility distance', { exact: true }).fill('20')
  await expect(layer).toHaveAttribute('data-nebula-puff-count', String(PLEIADES_PUFFS + ORION_PUFFS))
  await reflection.uncheck()
  await expect(layer).toHaveAttribute('data-nebula-puff-count', String(ORION_PUFFS))
  await expect(page.locator('#object-type-filter-summary')).toHaveText('5 of 9')
  await reflection.check()
  expect(nebulaRequests).toHaveLength(1)

  await openPreferences(page)
  await page.getByRole('switch', { name: 'Power saving mode' }).check()
  await expect(layer).toHaveAttribute('data-nebula-puff-count', String(PLEIADES_PUFFS / 2 + ORION_PUFFS / 2))
  await page.getByRole('switch', { name: 'Power saving mode' }).uncheck()
  await expect(layer).toHaveAttribute('data-nebula-puff-count', String(PLEIADES_PUFFS + ORION_PUFFS))

  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('M42')
  await page.getByRole('button', { name: 'Select Orion Nebula', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Orion Nebula')
  await expect(page.locator('#object-type')).toHaveText('H II region')
  await expect(page.locator('#constellation')).toHaveText('Orion')
  await expect(page.locator('#distance-value')).toHaveText('1265.49')
  await expect(page.locator('#nebula-designations')).toHaveText('M42, NGC 1976, Sh 2-281')
  await expect(page.locator('#nebula-angular-size')).toHaveText('65\u2032 \u00d7 60\u2032')
  await expect(page.locator('#nebula-extent')).toHaveText('23.9 \u00d7 22.1 \u00d7 11.7 ly')
  await expect(page.locator('#nebula-source')).toHaveAttribute('href', 'https://doi.org/10.1086/317982')
  await expect(page.locator('.stellar-property:visible, #mass-row:visible, .compact-property:visible')).toHaveCount(0)
  await expect(page.locator('[data-star-id="orion-nebula"] .star-label')).toBeVisible()

  await openFilter(page)
  await page.getByRole('switch', { name: 'Interstellar medium', exact: true }).uncheck()
  await expect(page.locator('#catalog-count')).toHaveText(/\/22$/)
  await expect(layer).not.toHaveAttribute('data-nebula-puff-count')
  await expect(page.locator('#star-details')).toBeHidden()
})

test('draws all nebulae in one additive call that follows the color preference and sleeps when idle', { tag: '@mobile' }, async ({ page }, testInfo) => {
  await openViewer(page)
  await hideMilkyWay(page)
  await openFilter(page)
  await page.getByRole('switch', { name: 'Motion arrows', exact: true }).uncheck()
  await enableNebulae(page)
  const layer = page.locator('.projected-labels')
  await expect(layer).toHaveAttribute('data-nebula-puff-count', String(PLEIADES_PUFFS + ORION_PUFFS))
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await nextFrames(page)
  const withNebulae = Number(await layer.getAttribute('data-draw-calls'))
  await page.getByLabel('Object visibility distance', { exact: true }).fill('17')
  await expect(layer).toHaveAttribute('data-nebula-puff-count', '0')
  await expect(layer).toHaveAttribute('data-draw-calls', String(withNebulae - 1))
  await page.getByLabel('Object visibility distance', { exact: true }).fill('20')
  await expect(layer).toHaveAttribute('data-draw-calls', String(withNebulae))

  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('Orion')
  await page.getByRole('button', { name: 'Select Orion Nebula', exact: true }).click()
  for (let step = 0; step < 14; step++) await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await nextFrames(page)
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
  expect(vividStats.saturation).toBeGreaterThan(realStats.saturation + 0.1)

  const passes = Number(await layer.getAttribute('data-ordinary-layout-passes'))
  await page.waitForTimeout(500)
  expect(Number(await layer.getAttribute('data-ordinary-layout-passes'))).toBe(passes)
})
