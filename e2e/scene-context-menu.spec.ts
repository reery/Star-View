import { expect, test } from '@playwright/test'
import { openViewer, starPoint } from './support'

test.beforeEach(async ({ page }) => {
  await openViewer(page)
})

test('right-clicking an object offers comparison, origin and distance to the selection', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile')
  const point = await starPoint(page, 'sun')
  await page.mouse.click(point.x, point.y, { button: 'right' })
  const menu = page.locator('#scene-context-menu')
  await expect(menu).toBeVisible()
  await expect(page.locator('#scene-context-compare')).toHaveText('Compare Sun against Sirius A')
  // The Sun is already the origin.
  await expect(page.locator('#scene-context-origin')).toBeHidden()
  await expect(page.locator('#scene-context-distance')).toHaveText(/^\d+\.\d{2} ly from Sun to Sirius A$/)
  const bounds = (await menu.boundingBox())!
  expect(bounds.x).toBeGreaterThan(point.x)
  expect(bounds.y).toBeGreaterThan(point.y)
  await menu.screenshot({ path: testInfo.outputPath('scene-context-menu.png') })
  await page.locator('#scene-context-compare').click()
  await expect(menu).toBeHidden()
  await expect(page.locator('#star-comparison-heading')).toBeVisible()
  await expect(page.locator('#comparison-other-name')).toHaveText('Sun')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')

  const sirius = await starPoint(page, 'sirius-a')
  await page.mouse.click(sirius.x, sirius.y, { button: 'right' })
  await expect(page.locator('#scene-context-compare')).toBeHidden()
  await expect(page.locator('#scene-context-distance')).toBeHidden()
  await expect(page.locator('#scene-context-origin')).toHaveText('Make Sirius A the origin')
  await page.locator('#scene-context-origin').click()
  await expect(page.locator('#go-to-origin-name')).toHaveText('Sirius A')

  // With nothing left to offer, and over empty space, no menu opens; Escape closes an open one.
  await page.mouse.click(sirius.x, sirius.y, { button: 'right' })
  await expect(menu).toBeHidden()
  await page.mouse.click(40, 860, { button: 'right' })
  await expect(menu).toBeHidden()
  await page.mouse.click(point.x, point.y, { button: 'right' })
  await expect(page.locator('#scene-context-origin')).toHaveText('Make Sun the origin')
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
})

test('holding a finger on an object opens the menu below left and sliding onto an item chooses it @mobile', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile)
  const point = await starPoint(page, 'sun')
  const session = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', point.x, point.y)
  const menu = page.locator('#scene-context-menu')
  await expect(menu).toBeVisible()
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
  const bounds = (await menu.boundingBox())!
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(Math.max(point.x, bounds.width + 8))
  expect(bounds.y).toBeGreaterThan(point.y)
  await menu.screenshot({ path: testInfo.outputPath('scene-context-menu-touch.png') })
  const item = (await page.locator('#scene-context-compare').boundingBox())!
  await touch('touchMove', item.x + 20, item.y + item.height / 2)
  await expect(page.locator('#scene-context-compare')).toHaveAttribute('data-highlighted', '')
  await touch('touchEnd', item.x + 20, item.y + item.height / 2)
  await expect(menu).toBeHidden()
  await expect(page.locator('#comparison-other-name')).toHaveText('Sun')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
})
