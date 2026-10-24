import { expect, test } from '@playwright/test'
import { openFilter, openViewer } from './support'

test('loads a saved cluster-only view through the combined constellation catalog @mobile', async ({ page }) => {
  await openViewer(page)
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByRole('textbox', { name: 'View name' }).fill('Cluster legacy view')
  await page.getByRole('button', { name: 'Save current view', exact: true }).click()
  await expect(page.locator('#saved-views-status')).toHaveText('Saved “Cluster legacy view”')
  await page.evaluate(() => {
    const views = JSON.parse(localStorage.getItem('star-view-saved-views')!)
    Object.assign(views[0].settings, {
      showWesternConstellationStars: false, showFamousClusterStars: true,
      selectedId: 'hip-17702', objectDistanceLimitLy: 10000,
    })
    localStorage.setItem('star-view-saved-views', JSON.stringify(views))
  })
  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByRole('row', { name: 'Load saved view Cluster legacy view' }).click()
  await expect(page.locator('#saved-views-status')).toHaveText('Loaded “Cluster legacy view”')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'hip-17702')
  await expect(page.locator('#star-name')).toHaveText('Alcyone')
  await openFilter(page)
  await expect(page.getByRole('switch', { name: 'Western constellation stars' })).toBeChecked()
  await expect(page.getByRole('switch', { name: 'Famous cluster stars' })).toHaveCount(0)
})
