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
    const rail = page.locator('#control-dock .panel-button:not(#discover-options *)')
    expect(await rail.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label'))))
      .toEqual(['Filter', 'Objects', 'Glossary', 'Preferences', 'Info'])
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
    await page.getByRole('searchbox', { name: 'View name' }).fill('Test view')
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
    await page.getByRole('row', { name: 'Saved view Test view' }).click()
    await page.getByRole('menuitem', { name: "Load 'Test view'" }).click()
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

test('a copied view link opens the view for another visitor and keeps their preferences', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.addInitScript(() => localStorage.setItem('star-view-milky-way-visible', 'false'))
  await openViewer(page)
  await openFilter(page)
  await page.locator('#magnitude-limit').fill('12')
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByRole('searchbox', { name: 'View name' }).fill('Shared view')
  await page.getByRole('button', { name: 'Save current view', exact: true }).click()
  await page.getByRole('row', { name: 'Saved view Shared view' }).click()
  await expect(page.getByRole('menuitem')).toHaveText(["Load 'Shared view'", "Copy 'Shared view' as link"])
  await page.getByRole('menuitem', { name: "Copy 'Shared view' as link" }).click()
  await expect(page.locator('#view-link-notice')).toHaveText('Link to saved view “Shared view” copied to the clipboard.')
  const link: string = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/#.*&n=Shared\+view$/)
  expect(link.length).toBeLessThan(200)

  // The recipient's browser has neither the view nor the sender's layer preference; the link adds an HR diagram box.
  const recipient = await browser.newPage()
  await recipient.goto(`${link}&h=hr-diagram~4000~9000~10~1000`)
  await expect(recipient.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(recipient.locator('#saved-views-status')).toHaveText('Loaded “Shared view”')
  expect(await recipient.evaluate(() => location.hash)).toBe('')
  await expect(recipient.locator('#magnitude-limit')).toHaveValue('12')
  await expect(recipient.locator('#milky-way-visible')).not.toBeChecked()
  await expect(recipient.locator('#save-view-name')).toHaveValue('Shared view')
  expect(await recipient.evaluate(() => [localStorage.getItem('star-view-milky-way-visible'), localStorage.getItem('star-view-saved-views')])).toEqual([null, null])
  await recipient.locator('#discover-toggle').hover()
  await recipient.locator('#graphs-toggle').click()
  await recipient.locator('#graphs-panel button[data-topic="physical-properties"]').first().click()
  await expect(recipient.locator('#graphs-panel .graph-brush')).toHaveAttribute('title', '4,000 to 9,000 K, 10 to 1,000 L☉')
  await recipient.close()
})

test('the toolbar copies the current view as a link without saving it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openViewer(page)
  await page.locator('#views-toggle').hover()
  await page.locator('#copy-view-link').click()
  const notice = page.locator('#view-link-notice')
  await expect(notice).toHaveText('Link to the current view copied to the clipboard.')
  await expect(notice).toBeHidden({ timeout: 7000 })
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/#.*&n=Sirius(\+A)?$/)
  expect(await page.evaluate(() => localStorage.getItem('star-view-saved-views'))).toBeNull()

  // A refused clipboard shows in the danger color of Delete.
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('Denied')) })
  await page.locator('#views-toggle').hover()
  await page.locator('#copy-view-link').click()
  await expect(notice).toHaveText('Could not copy the link.')
  const danger = await page.locator('#saved-view-context-delete').evaluate((button) => getComputedStyle(button).color)
  await expect(notice).toHaveCSS('color', danger)
})
