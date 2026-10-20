import { expect, test } from '@playwright/test'
import { openSpecs, openViewer } from './support'

test('equatorial grids adapt to zoom independently in both constellation cards @mobile', async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openViewer(page)
  await openSpecs(page)
  await page.locator('#constellation-toggle').click()
  const card = page.locator('#constellation-card')
  const grid = card.getByRole('button', { name: 'Show equatorial grid', exact: true })
  await expect(page.locator('#constellation-grid')).toHaveAttribute('aria-pressed', 'false')
  await expect(card.locator('.constellation-grid')).toHaveCount(0)
  const gridBox = (await grid.boundingBox())!
  const magnifyBox = (await page.locator('#constellation-magnify').boundingBox())!
  expect(gridBox.width).toBe(44)
  expect(gridBox.x + gridBox.width).toBeCloseTo(magnifyBox.x)
  const headingBox = (await card.locator('h2').boundingBox())!
  expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(gridBox.x)
  await grid.click()
  await expect(grid).toHaveAttribute('aria-pressed', 'true')
  await expect(card.locator('.constellation-grid-label').first()).toBeVisible()
  const overviewStep = Number(await card.locator('.constellation-grid').getAttribute('data-dec-step'))
  await page.locator('#constellation-magnify').click()
  expect(Number(await card.locator('.constellation-grid').getAttribute('data-dec-step'))).toBeLessThan(overviewStep)
  await card.screenshot({ path: testInfo.outputPath('object-equatorial-grid.png') })
  await grid.press('Space')
  await expect(card.locator('.constellation-grid')).toHaveCount(0)
  await expect(page.locator('#constellation-magnify')).toHaveAttribute('aria-pressed', 'true')
  if (isMobile) await page.locator('#constellation-close').click()

  const discover = page.getByRole('button', { name: 'Discover', exact: true })
  if (isMobile) await discover.tap()
  else await discover.hover()
  await page.getByRole('button', { name: 'Constellations', exact: true }).click()
  const detail = page.locator('#constellations-detail')
  const browserGrid = detail.getByRole('button', { name: 'Show equatorial grid', exact: true })
  await expect(browserGrid).toHaveAttribute('aria-pressed', 'false')
  await browserGrid.click()
  await expect(browserGrid).toHaveAttribute('aria-pressed', 'true')
  const browserStep = Number(await detail.locator('.constellation-grid').getAttribute('data-dec-step'))
  await page.locator('#discover-constellation-magnify').click()
  expect(Number(await detail.locator('.constellation-grid').getAttribute('data-dec-step'))).toBeLessThan(browserStep)
  await expect(page.locator('#constellation-grid')).toHaveAttribute('aria-pressed', 'false')
  const search = page.getByRole('searchbox', { name: 'Search constellations' })
  for (const name of ['Ursa Minor', 'Sculptor']) {
    await search.fill(name)
    await expect(page.locator('#discover-constellation-heading')).toHaveText(name)
    await expect(detail.locator('.constellation-grid-line').first()).toBeVisible()
    const paths = await detail.locator('.constellation-grid-line').evaluateAll((lines) => lines.map((line) => line.getAttribute('d')))
    expect(paths.join('')).not.toMatch(/NaN|Infinity/)
  }
  await page.locator('#constellations-panel').screenshot({ path: testInfo.outputPath('discover-equatorial-grid.png') })
  await browserGrid.click()
  await expect(detail.locator('.constellation-grid')).toHaveCount(0)
  expect(errors).toEqual([])
})
