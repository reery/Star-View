import { expect, test } from '@playwright/test'

test('short landscape controls scroll without overlap and keep flyouts usable @mobile', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, 'Touch landscape layout')
  await page.setViewportSize({ width: 844, height: 300 })
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-left', '59px')
    document.documentElement.style.setProperty('--safe-right', '59px')
    document.documentElement.style.setProperty('--safe-bottom', '21px')
  })
  const toolbar = page.locator('.scene-toolbar')
  const rail = page.locator('.dock-rail')
  const top = (await toolbar.boundingBox())!
  await expect(toolbar.locator('> .dock-rail')).toHaveCount(1)
  expect(top.height).toBe(255)
  expect(await toolbar.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await expect(toolbar).toHaveAttribute('tabindex', '0')
  await expect(rail).not.toHaveAttribute('tabindex')
  await expect(rail).toHaveCSS('overflow-y', 'visible')
  // Buttons retain their full touch targets rather than shrinking to fit.
  await expect(page.locator('#reset-view')).toHaveCSS('height', '44px')
  await expect(page.locator('#info-toggle')).toHaveCSS('height', '44px')
  await page.locator('#info-toggle').tap()
  await expect(page.locator('#info-panel')).toBeVisible()
  await page.locator('#info-toggle').tap()
  expect(await toolbar.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  // Discover's flyout also escapes the shared scrolling viewport.
  await page.locator('#discover-toggle').tap()
  await expect(page.locator('#constellations-toggle')).toBeVisible()
  const discover = (await page.locator('#constellations-toggle').boundingBox())!
  expect(discover.x + discover.width).toBeLessThanOrEqual(top.x)
  await page.keyboard.press('Escape')
  await page.locator('#reset-view').tap()
  await expect(page.locator('#top-view')).toBeVisible()
  // The flyout lies outside the toolbar's scroll clipping rectangle.
  const flyout = (await page.locator('#top-view').boundingBox())!
  expect(flyout.x + flyout.width).toBeLessThanOrEqual(top.x)
  await page.locator('#top-view').tap()
  await toolbar.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(page.locator('#top-view')).toBeHidden()
  await page.locator('#reset-view').focus()
  await expect(page.locator('#reset-view')).toBeFocused()
  await page.locator('#observer-view').focus()
  await expect(page.locator('#observer-view')).toBeFocused()
  await page.screenshot({ path: testInfo.outputPath('landscape-controls.png') })

  // Rotation back to portrait restores the established non-scrolling toolbar.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(toolbar).not.toHaveAttribute('tabindex')
  await expect(toolbar).toHaveCSS('overflow-y', 'visible')
  await expect(page.locator('#control-dock > .dock-rail')).toHaveCount(1)
  await expect(rail).toHaveCSS('overflow-y', 'visible')
  // Rotating again reunites the controls without duplicating or losing buttons.
  await page.setViewportSize({ width: 844, height: 300 })
  await expect(toolbar.locator('> .dock-rail')).toHaveCount(1)
  await expect(page.locator('#info-toggle')).toHaveCount(1)
})

test('landscape search and detail cards leave room for scrollable content @mobile', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, 'Touch landscape layout')
  await page.setViewportSize({ width: 667, height: 300 })
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  const objects = page.locator('#objects-toggle')
  if (await objects.getAttribute('aria-expanded') === 'false') await objects.tap()
  await expect(page.locator('#object-search')).toHaveCSS('font-size', '16px')
  await page.locator('#object-search').fill('Sun')
  await page.getByRole('button', { name: 'Select Sun', exact: true }).tap()
  await page.locator('#object-system-toggle').tap()
  await page.locator('.planet-row[data-planet-id="mars"] button').tap()
  const card = page.locator('#planet-card')
  await expect(card).toBeVisible()
  const selected = (await page.locator('#selected-object-card').boundingBox())!
  const detail = (await card.boundingBox())!
  expect(detail.x).toBeGreaterThan(selected.x + selected.width)
  expect(detail.y).toBe(12)
  expect(detail.y + detail.height).toBeLessThanOrEqual(288)
  expect((await card.locator('> .panel-heading').boundingBox())!.height).toBeLessThanOrEqual(47)
  const content = card.locator('> .card-scroll-content')
  expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight })
  expect(await content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath('landscape-planet.png') })
})
