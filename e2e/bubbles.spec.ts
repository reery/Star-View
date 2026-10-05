import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import { hideEarthOrbit, hideMilkyWay, openFilter, openViewer } from './support'

function faintBluePixels(image: PNG) {
  let count = 0
  let strongCount = 0
  let excess = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset]!
    const green = image.data[offset + 1]!
    const blue = image.data[offset + 2]!
    if (red + green + blue < 12 || blue - red < 3 || green - red < 2) continue
    count++
    excess += blue - red
    if (blue >= 12 && blue - red >= 8 && green - red >= 5) strongCount++
  }
  return { count, strongCount, excess }
}

test('loads the Local Bubble on demand as one visible sourced shell under Bubbles', async ({ page }, testInfo) => {
  const bubbleRequests: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (/\/assets\/bubbles-[^/]+\.json$/.test(path)) bubbleRequests.push(path)
  })

  await openViewer(page)
  expect(bubbleRequests).toHaveLength(0)
  await hideMilkyWay(page)
  await hideEarthOrbit(page)
  await openFilter(page)
  await page.locator('details.filter-dropdown > summary').click()
  await expect(page.getByLabel('Local Bubble', { exact: true })).toHaveCount(0)
  const bubbles = page.getByLabel('Bubbles', { exact: true })
  await expect(bubbles).toBeChecked()
  await expect(bubbles).toBeDisabled()
  const largeScale = page.getByRole('switch', { name: 'Large-scale structures', exact: true })
  await expect(largeScale).toBeEnabled()
  await largeScale.check()
  await expect(bubbles).toBeEnabled()

  await expect(page.locator('#catalog-count')).toHaveText(/\/23$/)
  await expect.poll(() => bubbleRequests.length).toBe(1)
  await expect(page.locator('.projected-labels')).toHaveAttribute('data-bubble-triangle-count', '16128')
  await expect(page.locator('.projected-labels')).toHaveAttribute('data-bubble-visible-count', '1')
  await expect(page.locator('#object-type-filter-summary')).toHaveText('5 of 12')
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  const outsideImage = PNG.sync.read(await page.locator('#scene canvas').screenshot({ path: testInfo.outputPath('local-bubble-outside.png') }))
  const outsideBlue = faintBluePixels(outsideImage)
  expect(outsideBlue.count).toBeGreaterThan(50_000)
  expect(outsideBlue.strongCount).toBeGreaterThan(20_000)
  expect(outsideBlue.excess).toBeGreaterThan(600_000)

  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('Local Chimney')
  await page.getByRole('button', { name: 'Select Local Bubble', exact: true }).click()
  await expect(page.locator('#object-type')).toHaveText('Bubble')
  await expect(page.locator('#object-designations')).toContainText('Local Chimney')
  await expect(page.locator('#bubble-average-radius')).toHaveText('554 ly')
  await expect(page.locator('#bubble-surface-range')).toHaveText('228–1,957+ ly')
  await expect(page.locator('#bubble-shell-thickness')).toHaveText('114 ly')
  await expect(page.locator('#bubble-source')).toHaveAttribute('href', 'https://doi.org/10.3847/1538-4357/ad61de')
  await expect(page.locator('#star-notes')).toContainText('compact directional sampling')

  await page.getByLabel('Search objects').fill('Sun')
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  const insideImage = PNG.sync.read(await page.locator('#scene canvas').screenshot({ path: testInfo.outputPath('local-bubble-inside.png') }))
  const insideBlue = faintBluePixels(insideImage)
  expect(insideBlue.count).toBeGreaterThan(1_000_000)
  expect(insideBlue.strongCount).toBeGreaterThan(450_000)
  expect(insideBlue.excess).toBeGreaterThan(5_000_000)

  await openFilter(page)
  await largeScale.uncheck()
  await expect(page.locator('#catalog-count')).toHaveText(/\/22$/)
  await expect(page.locator('.projected-labels')).not.toHaveAttribute('data-bubble-triangle-count')
  expect(bubbleRequests).toHaveLength(1)
})
