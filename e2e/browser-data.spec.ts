import { expect, test } from '@playwright/test'
import { openPreferences } from './support'

test('browser data confirmation cancels safely and deletes only app data @mobile', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.evaluate(() => {
    localStorage.setItem('star-view-distance-unit', 'pc')
    localStorage.setItem('star-view-earth-orbit-visible', 'false')
    localStorage.setItem('star-view-custom', 'A saved 🌌')
    sessionStorage.setItem('star-view-session', 'session data')
    localStorage.setItem('other-app-data', 'keep local')
    sessionStorage.setItem('other-app-data', 'keep session')
  })
  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByRole('textbox', { name: 'View name' }).fill('Browser data test')
  await page.getByRole('button', { name: 'Save current view', exact: true }).click()
  await expect(page.locator('#saved-views-status')).toHaveText('Saved “Browser data test”')
  await openPreferences(page)

  const size = await page.evaluate(() => {
    let bytes = 0
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (key.startsWith('star-view-')) bytes += 2 * (key.length + storage.getItem(key)!.length)
      }
    }
    return `${(bytes / 1024).toFixed(2)} KB`
  })
  const remove = page.getByRole('button', { name: 'Delete all Star View browser data', exact: true })
  await expect(page.locator('#browser-data-size')).toHaveText(size)
  await expect(remove).toHaveCSS('color', 'rgb(240, 128, 128)')
  const dialog = page.getByRole('dialog')
  await remove.click()
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAccessibleName(`Do you really want to delete ${size} of Star View data stored on this browser?`)
  await expect(page.locator('#preferences-panel .display-settings')).toHaveCSS('filter', 'blur(3px)')
  await expect(dialog.getByRole('button', { name: 'Yes', exact: true })).toHaveCSS('color', 'rgb(240, 128, 128)')
  await expect(dialog.getByRole('button', { name: 'No', exact: true })).toHaveCSS('color', 'rgb(231, 160, 91)')
  await expect(dialog.getByRole('button', { name: 'No', exact: true })).toBeFocused()
  await test.info().attach('Browser data confirmation', { body: await page.screenshot(), contentType: 'image/png' })
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Yes', exact: true })).toBeFocused()
  await dialog.getByRole('button', { name: 'No', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(remove).toBeFocused()
  await expect(page.locator('#preferences-panel .display-settings')).toHaveCSS('filter', 'none')
  await expect(page.locator('#unit-pc')).toBeChecked()
  expect(await page.evaluate(() => localStorage.getItem('star-view-saved-views'))).toContain('Browser data test')

  await remove.click()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('#preferences-panel')).toBeVisible()
  await remove.click()
  await Promise.all([
    page.waitForEvent('load'),
    dialog.getByRole('button', { name: 'Yes', exact: true }).click(),
  ])
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  expect(await page.evaluate(() => [localStorage, sessionStorage].map((storage) => ({ ...storage })))).toEqual([
    { 'other-app-data': 'keep local' },
    { 'other-app-data': 'keep session' },
  ])
  await openPreferences(page)
  await expect(page.locator('#unit-ly')).toBeChecked()
  await expect(page.locator('#browser-data-size')).toHaveText('0.00 KB')
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await expect(page.locator('#saved-views-list tr')).toHaveCount(0)
})
