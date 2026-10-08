import { expect, test, type Page } from '@playwright/test'
import { openFilter, openPreferences } from './support'

async function openViewer(page: Page) {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('#scene-status')).toBeHidden()
}

for (const legacy of [false, true]) {
  test(`loading ${legacy ? 'an older' : 'a new'} saved view preserves current preferences @mobile`, async ({ page }) => {
    await openViewer(page)
    const rail = page.locator('#control-dock .panel-button')
    expect(await rail.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label'))))
      .toEqual(['Stellar motion', 'Filter', 'Objects', 'Glossary', 'Preferences', 'Info'])
    const glossary = await page.locator('#glossary-toggle').boundingBox()
    const preferences = await page.locator('#preferences-toggle').boundingBox()
    expect(preferences!.y).toBeGreaterThan(glossary!.y + glossary!.height)

    await openPreferences(page)
    await page.locator('#unit-pc').check()
    await page.locator('#star-colors-real').check()
    await page.locator('#label-limit').fill('80')
    await page.locator('#power-saving-mode').check()
    await openFilter(page)
    await page.locator('#magnitude-limit').fill('12')
    await page.getByRole('button', { name: 'Saved views', exact: true }).click()
    await page.getByRole('textbox', { name: 'View name' }).fill('Test view')
    await page.getByRole('button', { name: 'Save current view', exact: true }).click()
    await expect(page.locator('#saved-views-status')).toHaveText('Saved “Test view”')
    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('star-view-saved-views')!)[0].settings)
    for (const preference of ['distanceUnit', 'starColorMode', 'labelLimit', 'powerSavingMode']) {
      expect(settings).not.toHaveProperty(preference)
    }
    // Saving also leaves the active preferences untouched.
    await expect(page.locator('#unit-pc')).toBeChecked()
    await expect(page.locator('#star-colors-real')).toBeChecked()
    await expect(page.locator('#label-limit')).toHaveValue('80')
    await expect(page.locator('#power-saving-mode')).toBeChecked()

    if (legacy) {
      await page.evaluate(() => {
        const views = JSON.parse(localStorage.getItem('star-view-saved-views')!)
        Object.assign(views[0].settings, { distanceUnit: 'pc', starColorMode: 'real', labelLimit: 80, powerSavingMode: true })
        localStorage.setItem('star-view-saved-views', JSON.stringify(views))
      })
    }
    // Reload exercises storage validation for both formats.
    await openViewer(page)
    await openPreferences(page)
    await page.locator('#unit-ly').check()
    await page.locator('#star-colors-exaggerated').check()
    await page.locator('#label-limit').fill('20')
    await page.locator('#power-saving-mode').uncheck()
    await openFilter(page)
    await page.locator('#magnitude-limit').fill('3')
    await page.getByRole('button', { name: 'Saved views', exact: true }).click()
    await page.getByRole('row', { name: 'Load saved view Test view' }).click()
    await expect(page.locator('#saved-views-status')).toHaveText('Loaded “Test view”')
    await expect(page.locator('#magnitude-limit')).toHaveValue('12')
    await openPreferences(page)
    await expect(page.locator('#unit-ly')).toBeChecked()
    await expect(page.locator('#star-colors-exaggerated')).toBeChecked()
    await expect(page.locator('#label-limit')).toHaveValue('20')
    await expect(page.locator('#power-saving-mode')).not.toBeChecked()
    expect(await page.evaluate(() => [
      localStorage.getItem('star-view-distance-unit'),
      localStorage.getItem('star-view-color-mode'),
      localStorage.getItem('star-view-label-limit'),
    ])).toEqual(['ly', 'exaggerated', '20'])
  })
}
