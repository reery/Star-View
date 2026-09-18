import { expect, type Page } from '@playwright/test'

export async function starPoint(page: Page, id: string) {
  const anchor = page.locator(`.map-anchor[data-star-id="${id}"]`)
  await expect(anchor).toBeVisible()
  // Camera changes render on the next frame; sample the updated anchor before
  // using its coordinates for screenshots or pointer input.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  return anchor.evaluate((element) => {
    const rectangle = element.getBoundingClientRect()
    return { x: rectangle.left, y: rectangle.top }
  })
}

export async function openViewer(page: Page) {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('#scene-status')).toBeHidden()
  await expect(page.locator('#star-name')).toHaveText('Sirius A')
  await page.evaluate(() => document.fonts.ready)
  await starPoint(page, 'sirius-a')
}

export async function openPreferences(page: Page) {
  const preferences = page.locator('details.preferences')
  if (await preferences.getAttribute('open') === null) await preferences.locator('summary').click()
}

export async function openFilter(page: Page) {
  const filter = page.locator('details.filter-section')
  if (await filter.getAttribute('open') === null) await filter.locator(':scope > summary').click()
}
