import { expect, test, type Page } from '@playwright/test'
import { openFilter, openPreferences } from './support'

async function ready(page: Page) {
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('#scene-status')).toBeHidden()
  await expect(page.locator('#filter-save')).toBeEnabled()
}

test('saved filter survives reset, restores on reload, and is cleared with browser data @mobile', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await openPreferences(page)
  await page.locator('#power-saving-mode').check()
  await openFilter(page)
  const save = page.getByRole('button', { name: 'Save filter as default', exact: true })
  const plainIcon = await page.locator('#filter-save-icon').innerHTML()
  const reset = page.getByRole('button', { name: 'Reset all filters', exact: true })
  const saveBox = await save.boundingBox()
  const resetBox = await reset.boundingBox()
  expect(saveBox!.x + saveBox!.width).toBeLessThanOrEqual(resetBox!.x)
  await page.locator('#catalog-range').fill('1')
  await ready(page)
  await page.locator('#show-always-bright').check()
  await ready(page)
  await page.locator('#show-western-constellation-stars').check()
  await ready(page)
  await page.locator('#category-interstellar_medium').check()
  await ready(page)
  await page.locator('#object-distance-limit').fill('16')
  await page.locator('#magnitude-limit').fill('4.5')
  await page.locator('.filter-dropdown summary').click()
  await page.locator('input[data-filter-key="sun"]').uncheck()
  await save.click()
  await expect(save).toHaveAttribute('title', 'Current filter saved as default')
  await expect(page.locator('#filter-save-status')).toHaveCount(0)
  expect(await page.locator('#filter-save-icon').innerHTML()).not.toBe(plainIcon)
  const savedIcon = await page.locator('#filter-save-icon').innerHTML()
  const stored = await page.evaluate(() => localStorage.getItem('star-view-saved-filter'))
  const filter = JSON.parse(stored!)
  expect(filter).toEqual({
    version: 1,
    catalogId: 'nearest-100',
    showAlwaysBright: true,
    showWesternConstellationStars: true,
    filterCategories: ['compact_objects', 'interstellar_medium'],
    filterSubtypes: ['star', 'brown_dwarf', 'white_dwarf', 'molecular_cloud', 'reflection_nebula', 'hii_region', 'planetary_nebula', 'bubble'],
    magnitudeLimit: 4.5,
    objectDistanceLimitLy: 200,
  })
  await test.info().attach('Saved filter controls', { body: await page.screenshot(), contentType: 'image/png' })

  await reset.click()
  await ready(page)
  // The check is a temporary confirmation, not a toggle or a live comparison.
  expect(await page.locator('#filter-save-icon').innerHTML()).toBe(savedIcon)
  await expect(save).toHaveAttribute('title', 'Current filter saved as default')
  await expect(page.locator('#catalog-range')).toHaveValue('0')
  await expect(page.locator('#magnitude-limit')).toHaveValue('7')
  await expect(page.locator('#object-distance-limit')).toHaveValue('14')
  await expect(page.locator('#show-always-bright')).not.toBeChecked()
  await expect(page.locator('#show-western-constellation-stars')).not.toBeChecked()
  await expect(page.locator('#category-interstellar_medium')).not.toBeChecked()
  await expect(page.locator('input[data-filter-key="sun"]')).toBeChecked()
  expect(await page.evaluate(() => localStorage.getItem('star-view-saved-filter'))).toBe(stored)

  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await openFilter(page)
  expect(await page.locator('#filter-save-icon').innerHTML()).toBe(plainIcon)
  await expect(save).toHaveAttribute('title', 'Save filter as default')

  await page.reload()
  await ready(page)
  await openFilter(page)
  await expect(page.locator('#catalog-range')).toHaveValue('1')
  await expect(page.locator('#magnitude-limit')).toHaveValue('4.5')
  await expect(page.locator('#object-distance-limit')).toHaveValue('16')
  await expect(page.locator('#show-always-bright')).toBeChecked()
  await expect(page.locator('#show-western-constellation-stars')).toBeChecked()
  await expect(page.locator('#category-interstellar_medium')).toBeChecked()
  await page.locator('.filter-dropdown summary').click()
  await expect(page.locator('input[data-filter-key="sun"]')).not.toBeChecked()
  // Unsaved edits do not replace the default; another save explicitly overwrites it.
  await page.locator('#magnitude-limit').fill('6')
  expect(await page.evaluate(() => localStorage.getItem('star-view-saved-filter'))).toBe(stored)
  await save.click()
  await openPreferences(page)
  expect(await page.locator('#filter-save-icon').innerHTML()).toBe(plainIcon)
  await page.reload()
  await ready(page)
  await openFilter(page)
  await expect(page.locator('#magnitude-limit')).toHaveValue('6')
  await openPreferences(page)
  await expect(page.locator('#power-saving-mode')).not.toBeChecked()
  await page.getByRole('button', { name: 'Delete all Star View browser data', exact: true }).click()
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('dialog').getByRole('button', { name: 'Yes', exact: true }).click(),
  ])
  await ready(page)
  expect(await page.evaluate(() => localStorage.getItem('star-view-saved-filter'))).toBeNull()
  await openFilter(page)
  await expect(page.locator('#catalog-range')).toHaveValue('0')
  await expect(page.locator('#magnitude-limit')).toHaveValue('7')
  await expect(page.locator('#object-distance-limit')).toHaveValue('14')
})

test('invalid saved filter falls back to built-in defaults @mobile', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('star-view-saved-filter', JSON.stringify({
    version: 1, catalogId: 'removed-catalog', magnitudeLimit: 99,
  })))
  await page.goto('/')
  await ready(page)
  await openFilter(page)
  await expect(page.locator('#catalog-range')).toHaveValue('0')
  await expect(page.locator('#magnitude-limit')).toHaveValue('7')
  await expect(page.locator('#object-distance-limit')).toHaveValue('14')
})
