import { expect, test, type Page } from '@playwright/test'
import { openSpecs, openViewer } from './support'

async function openConstellations(page: Page, mobile: boolean) {
  const discover = page.getByRole('button', { name: 'Discover', exact: true })
  if (mobile) await discover.tap()
  else await discover.hover()
  await page.getByRole('button', { name: 'Constellations', exact: true }).click()
  await expect(page.locator('#discover-constellation-chart > svg')).toBeVisible()
}

test('Discover maximizes only height and magnifies the constellation overview @mobile', async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openViewer(page)
  await openConstellations(page, isMobile)
  const panel = page.locator('#constellations-panel')
  // Desktop opens maximized; restore the compact card before measuring it.
  if (!isMobile) {
    const restore = page.getByRole('button', { name: 'Minimize constellations card height', exact: true })
    await expect(restore).toHaveAttribute('aria-pressed', 'true')
    await restore.click()
  } else {
    await expect(page.getByRole('button', { name: 'Maximize constellations card height', exact: true })).toHaveAttribute('aria-pressed', 'false')
  }
  const initial = (await panel.boundingBox())!
  const chartFits = () => page.locator('#discover-constellation-chart').evaluate((chart) => {
    const detail = document.getElementById('constellations-detail')!.getBoundingClientRect()
    const frame = chart.getBoundingClientRect()
    return frame.top >= detail.top && frame.bottom <= detail.bottom + 1
      && Math.abs(frame.width - detail.width) <= 1
  })
  await expect.poll(chartFits).toBe(true)
  await panel.screenshot({ path: testInfo.outputPath('constellations-compact.png') })
  if (!isMobile) {
    expect(initial.width).toBe(560)
    await page.setViewportSize({ width: 1440, height: 640 })
    await expect.poll(chartFits).toBe(true)
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect.poll(chartFits).toBe(true)
  }
  const navigation = (await page.locator('#constellations-terms').boundingBox())!
  if (!isMobile) {
    expect(navigation.width).toBeLessThan(160)
    const wrapped = await page.locator('#constellations-terms button').evaluateAll((buttons) => buttons.filter((button) => {
      const range = document.createRange()
      range.selectNodeContents(button)
      return range.getBoundingClientRect().height > parseFloat(getComputedStyle(button).lineHeight) + 1
    }).map((button) => button.textContent))
    expect(wrapped).toEqual([])
  }
  await page.getByRole('button', { name: 'Maximize constellations card height', exact: true }).click()
  const minimize = page.getByRole('button', { name: 'Minimize constellations card height', exact: true })
  await expect(minimize).toHaveAttribute('aria-pressed', 'true')
  const expanded = (await panel.boundingBox())!
  expect(expanded.height).toBeGreaterThan(initial.height)
  expect(expanded.width).toBeCloseTo(initial.width)
  expect(expanded.x).toBeCloseTo(initial.x)
  expect(expanded.y).toBeGreaterThanOrEqual(0)
  if (!isMobile) {
    const stats = (await page.locator('#discover-constellation-visible-months-value').boundingBox())!
    expect(stats.y + stats.height).toBeLessThan(expanded.y + expanded.height)
  }
  const diagram = page.locator('#discover-constellation-chart > svg')
  const lineLength = () => diagram.locator('.constellation-line').first().evaluate((node) => {
    const line = node as SVGLineElement
    return Math.hypot(line.x2.baseVal.value - line.x1.baseVal.value, line.y2.baseVal.value - line.y1.baseVal.value)
  })
  const overviewLength = await lineLength()
  const magnifier = page.getByRole('button', { name: 'Magnify constellation', exact: true })
  await magnifier.click()
  await expect(magnifier).toHaveAttribute('aria-pressed', 'true')
  expect(await lineLength()).toBeCloseTo(overviewLength * 1.75)
  await expect(diagram.locator('.constellation-neighbor')).toHaveCount(0)
  await magnifier.click()
  await expect(magnifier).toHaveAttribute('aria-pressed', 'false')
  expect(await lineLength()).toBeCloseTo(overviewLength)
  await panel.screenshot({ path: testInfo.outputPath('constellations-maximized.png') })
  await minimize.click()
  await expect(page.getByRole('button', { name: 'Maximize constellations card height', exact: true })).toHaveAttribute('aria-pressed', 'false')
  expect((await panel.boundingBox())!.height).toBeCloseTo(initial.height)
  await expect.poll(chartFits).toBe(true)
  expect(errors).toEqual([])
})

test('Discover browses all constellations with shared charts and selection @mobile', async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const charts: string[] = []
  page.on('request', (request) => {
    if (/\/(?:canis-major|orion|ursa-major)-[^/]+\.js/.test(request.url())) charts.push(request.url())
  })
  await openViewer(page)
  expect(charts).toHaveLength(0)
  const discover = page.locator('#discover-toggle')
  await expect(discover).toBeEnabled()
  const discoverBox = (await discover.boundingBox())!
  const motionBox = (await page.locator('#motion-toggle').boundingBox())!
  expect(discoverBox.y + discoverBox.height).toBeLessThan(motionBox.y)
  if (!isMobile) {
    await discover.focus()
    await discover.press('Enter')
    await expect(page.locator('#constellations-panel')).toBeHidden()
    await discover.press('Tab')
    await expect(page.locator('#constellations-toggle')).toBeFocused()
    await page.locator('#constellations-toggle').evaluate((button) => button.blur())
    await page.mouse.move(5, 5)
  }
  await openConstellations(page, isMobile)
  await expect(page.locator('#constellations-terms button')).toHaveCount(88)
  await expect(page.locator('#discover-constellation-heading')).toHaveText('Canis Major')
  await expect(page.locator('#star-name')).toHaveText('Sirius')
  const optionBox = (await page.locator('#constellations-toggle').boundingBox())!
  expect(optionBox.x + optionBox.width).toBeLessThanOrEqual(discoverBox.x)
  const search = page.getByRole('searchbox', { name: 'Search constellations' })
  await search.fill('Orion')
  await expect(page.locator('#constellations-terms button')).toHaveCount(1)
  await expect(page.locator('#discover-constellation-chart > svg')).toHaveAttribute('aria-label', 'Orion')
  await expect(page.locator('#star-name')).toHaveText('Sirius')
  await search.fill('no matching constellation')
  await expect(page.locator('#constellations-empty')).toBeVisible()
  await expect(page.locator('#constellations-detail')).toBeHidden()
  await search.fill('Ursa')
  await expect(page.locator('#constellations-terms button')).toHaveCount(2)
  await page.locator('#constellations-terms').getByRole('button', { name: 'Ursa Minor', exact: true }).click()
  await expect(page.locator('#discover-constellation-chart > svg')).toHaveAttribute('aria-label', 'Ursa Minor')
  await page.locator('#discover-constellation-latitude').selectOption('-30')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('star-view-constellation-latitude'))).toBe('-30')
  await page.locator('#discover-constellation-heading').scrollIntoViewIfNeeded()
  await page.locator('#constellations-panel').screenshot({ path: testInfo.outputPath('constellations-browser.png') })
  const bounds = (await page.locator('#constellations-panel').boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.locator('#discover-constellation-chart .constellation-star').first().click()
  await expect(page.locator('#star-name')).not.toHaveText('Sirius')
  await expect(page.locator('#constellations-panel')).toBeVisible()
  await page.locator('#constellations-close').click()
  await expect(page.locator('#constellations-panel')).toBeHidden()
  await expect(page.locator('#discover-toggle')).toBeFocused()
  expect(errors).toEqual([])
})

test('Discover and an object constellation card keep independent charts and unique IDs', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Side by side desktop cards')
  await openViewer(page)
  await openSpecs(page)
  await page.locator('#constellation-toggle').click()
  await expect(page.locator('#constellation-chart > svg')).toBeVisible()
  await openConstellations(page, false)
  await page.getByRole('searchbox', { name: 'Search constellations' }).fill('Orion')
  await expect(page.locator('#discover-constellation-chart > svg')).toHaveAttribute('aria-label', 'Orion')
  await expect(page.locator('#constellation-heading')).toHaveText('Canis Major')
  await page.locator('#constellation-magnify').click()
  await expect(page.locator('#constellation-magnify')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#discover-constellation-chart > svg')).toHaveAttribute('aria-label', 'Orion')
  const duplicates = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id)
    return ids.filter((id, index) => ids.indexOf(id) !== index)
  })
  expect(duplicates).toEqual([])
  await page.locator('#constellations-close').click()
  await openConstellations(page, false)
  await expect(page.locator('#discover-constellation-heading')).toHaveText('Orion')
})

test('Discover recovers from a failed chart and ignores an obsolete chart request', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Network lifecycle coverage')
  await openViewer(page)
  await openConstellations(page, false)
  const search = page.getByRole('searchbox', { name: 'Search constellations' })
  await page.route(/\/orion-[^/]+\.js$/, (route) => route.abort())
  await search.fill('Orion')
  await expect(page.locator('#constellations-detail [role="alert"]')).toBeVisible()
  await search.fill('Canis Major')
  await expect(page.locator('#constellations-detail [role="alert"]')).toHaveCount(0)
  await expect(page.locator('#discover-constellation-chart > svg')).toHaveAttribute('aria-label', 'Canis Major')
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  await page.route(/\/ursa-major-[^/]+\.js$/, async (route) => { await pending; await route.continue() })
  await search.fill('Ursa Major')
  await expect(page.locator('#constellations-detail')).toHaveAttribute('aria-busy', 'true')
  await search.fill('Canis Major')
  release()
  await expect(page.locator('#constellations-detail')).not.toHaveAttribute('aria-busy')
  await expect(page.locator('#discover-constellation-chart > svg')).toHaveAttribute('aria-label', 'Canis Major')
})
