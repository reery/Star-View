import { expect, test, type Page } from '@playwright/test'
import { openFilter, openSpecs } from './support'

async function ready(page: Page) {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.evaluate(() => document.fonts.ready)
  await openSpecs(page)
}

async function select(page: Page, name: string) {
  const objects = page.getByRole('button', { name: 'Objects', exact: true })
  if (await objects.getAttribute('aria-expanded') !== 'true') await objects.click()
  await page.getByLabel('Search objects').fill(name)
  await page.getByRole('button', { name: `Select ${name}`, exact: true }).click()
  await objects.click()
  await openSpecs(page)
}

test('resets visibility on selection changes and avoids origin self comparisons', async ({ page }, testInfo) => {
  await ready(page)
  await page.locator('#magnitude-toggle').click()
  await page.locator('[data-visibility="observatory"]').click()
  // Re-rendering the same object preserves the guide.
  await page.setViewportSize({ width: 1400, height: 900 })
  await expect(page.locator('[data-visibility="observatory"]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('#magnitude-close').click()
  await select(page, 'Sun')
  await page.locator('#magnitude-toggle').click()
  await expect(page.locator('[data-visibility="eye"]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-visibility="telescope"]').click()
  // Selection while the card is open resets it too.
  await select(page, 'Sirius A')
  await expect(page.locator('#magnitude-card')).toBeVisible()
  await expect(page.locator('[data-visibility="eye"]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('#magnitude-close').click()
  await page.locator('#set-origin').click()
  await page.locator('#radius-toggle').click()
  await expect(page.locator('#radius-reference-origin')).toHaveText('Sun')
  await expect(page.locator('#radius-reference-heading')).toHaveText('Radius vs Sun')
  await expect(page.locator('#radius-reference-column')).toHaveText('Sun')
  const jupiterMap = page.waitForResponse(/\/jupiter-map-[^/]+\.webp$/)
  await page.locator('#radius-reference-jupiter').click()
  const mapResponse = await jupiterMap
  expect(mapResponse.ok()).toBe(true)
  expect(mapResponse.headers()['content-type']).toContain('image/webp')
  await mapResponse.finished()
  await expect(page.locator('#radius-reference-column')).toHaveText('Jupiter')
  await page.locator('#radius-card').screenshot({ path: testInfo.outputPath('jupiter-radius-webp.png') })
  await page.locator('#radius-reference-earth').click()
  await expect(page.locator('#radius-reference-column')).toHaveText('Earth')
  await page.locator('#radius-close').click()
  await page.locator('#luminosity-toggle').click()
  await expect(page.locator('#luminosity-flux-origin')).toBeVisible()
  await expect(page.locator('#luminosity-flux-selected')).toBeHidden()
  await expect(page.locator('#luminosity-flux-sun')).toBeVisible()
  await page.locator('#luminosity-card').screenshot({ path: testInfo.outputPath('origin-flux.png') })
  await page.locator('#luminosity-close').click()
  await select(page, 'Sun')
  await page.locator('#luminosity-toggle').click()
  await expect(page.locator('#luminosity-flux-selected')).toBeVisible()
  await expect(page.locator('#luminosity-flux-sun')).toBeHidden()
})

test('centers temperature icons', { tag: '@mobile' }, async ({ page }, testInfo) => {
  await ready(page)
  await page.locator('#temperature-toggle').click()
  const centers = await page.locator('.temperature-facts .planet-fact-tile').evaluateAll((tiles) => tiles.map((tile) => {
    const bounds = tile.getBoundingClientRect()
    const icon = tile.querySelector('.planet-fact-icon')!.getBoundingClientRect()
    return Math.abs((icon.top + icon.bottom) / 2 - (bounds.top + bounds.bottom) / 2)
  }))
  expect(centers).toHaveLength(2)
  for (const distance of centers) expect(distance).toBeLessThan(1)
  await page.locator('#temperature-card').screenshot({ path: testInfo.outputPath('temperature-icons.png') })
})

test('keeps Mass limit tooltips inside the card with their triangles on the limit labels', { tag: '@mobile' }, async ({ page }, testInfo) => {
  await ready(page)
  for (const name of ['Sun', 'Sirius B']) {
    await select(page, name)
    await page.locator('#mass-toggle').click()
    const card = (await page.locator('#mass-card').boundingBox())!
    const labels = page.locator('#mass-spectrum-axis .mass-scale-help')
    await expect(labels).toHaveCount(2)
    const bounds = await labels.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()))
    expect(bounds[0].right).toBeLessThanOrEqual(bounds[1].left)
    for (const index of [0, 1]) {
      const button = labels.nth(index).locator('button')
      await button.focus()
      const tooltip = labels.nth(index).locator('.tooltip')
      await expect(tooltip).toBeVisible()
      const anchor = (await button.boundingBox())!
      const popup = (await tooltip.boundingBox())!
      const arrowCenter = await tooltip.evaluate((element) => {
        const arrow = getComputedStyle(element, '::before')
        return element.getBoundingClientRect().left + parseFloat(getComputedStyle(element).borderLeftWidth)
          + parseFloat(arrow.left) + parseFloat(arrow.width) / 2
      })
      expect(popup.x).toBeGreaterThanOrEqual(card.x)
      expect(popup.x + popup.width).toBeLessThanOrEqual(card.x + card.width)
      expect(popup.y).toBeGreaterThanOrEqual(anchor.y + anchor.height)
      expect(Math.abs(arrowCenter - (anchor.x + anchor.width / 2))).toBeLessThanOrEqual(1)
    }
    await page.locator('#mass-card').screenshot({ path: testInfo.outputPath(`mass-limits-${name}.png`) })
    await page.locator('#mass-close').click()
  }
})

test('shows sourced orbit inclinations and axial tilts for all eight planets', async ({ page }, testInfo) => {
  await ready(page)
  await select(page, 'Sun')
  await page.locator('#object-system-toggle').click()
  const planets = [
    ['mercury', '7.004°', '0.034°'], ['venus', '3.395°', '177.36°'],
    ['earth', '0°', '23.44°'], ['mars', '1.848°', '25.19°'],
    ['jupiter', '1.304°', '3.13°'], ['saturn', '2.486°', '26.73°'],
    ['uranus', '0.77°', '97.77°'], ['neptune', '1.77°', '28.32°'],
  ]
  for (const [id, orbit, axial] of planets) {
    await page.locator(`.planet-row[data-planet-id="${id}"] button`).click()
    await page.locator('#planet-stats-toggle').click()
    await expect(page.locator('[data-planet-spec="orbit-inclination"] .planet-fact-value')).toHaveText(orbit!)
    await expect(page.locator('[data-planet-spec="axial-inclination"] .planet-fact-value')).toHaveText(axial!)
    await expect(page.locator('[data-planet-spec="axial-inclination"] dt button')).toHaveText('Axial tilt')
    await page.locator('[data-planet-spec="orbit-inclination"] button').focus()
    await expect(page.locator('#planet-orbit-inclination-detail-tooltip')).toContainText('tilted compared with Earth’s orbit')
    await expect(page.locator('#planet-orbit-inclination-detail-tooltip')).toBeVisible()
    if (id === 'uranus') await page.locator('#planet-card').screenshot({ path: testInfo.outputPath('planet-inclinations.png') })
    await page.locator('#planet-close').click()
  }
})

test('dims retained system measurements and opens their scoped metallicity scale', async ({ page }, testInfo) => {
  await ready(page)
  await openFilter(page)
  await page.locator('#show-western-constellation-stars').check()
  await page.locator('#object-distance-limit').fill('24')
  await page.locator('#filter-toggle').click()
  await select(page, 'Antinous Aa')
  for (const id of ['temperature', 'luminosity', 'radius', 'metallicity']) {
    await expect(page.locator(`#${id}`)).toHaveClass(/unresolved-measurement/)
    const color = await page.locator(`#${id}`).evaluate((element) => getComputedStyle(element).color)
    const muted = await page.locator(`#${id}`).evaluate((element) => getComputedStyle(element.closest('div')!.querySelector('dt')!).color)
    expect(color).toBe(muted)
  }
  await expect(page.locator('#mass')).not.toHaveClass(/unresolved-measurement/)
  await expect(page.locator('#temperature-toggle')).toBeDisabled()
  await expect(page.locator('#luminosity-toggle')).toBeDisabled()
  await expect(page.locator('#radius-toggle')).toBeDisabled()
  await expect(page.locator('#metallicity-toggle')).toBeEnabled()
  await page.locator('#metallicity-toggle').click()
  await expect(page.locator('#metallicity-heading')).toHaveText('Metallicity [M/H] · system')
  await expect(page.locator('#metallicity-scale')).toHaveAttribute('aria-label', /unresolved system measurement/)
  await expect(page.locator('#metallicity-description')).toContainText('individual metallicity is unavailable')
  await page.screenshot({ path: testInfo.outputPath('antinous-system-values.png') })
  await page.locator('#metallicity-close').click()
  await select(page, 'Sun')
  for (const id of ['temperature', 'luminosity', 'radius', 'metallicity']) {
    await expect(page.locator(`#${id}`)).not.toHaveClass(/unresolved-measurement/)
  }
  await page.locator('#metallicity-toggle').click()
  await expect(page.locator('#metallicity-heading')).toHaveText('Metallicity [M/H]')
})
