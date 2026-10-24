import { expect, test } from '@playwright/test'
import { openViewer } from './support'

test('restores the last object after clicking empty space', { tag: '@mobile' }, async ({ page }) => {
  await openViewer(page)
  const back = page.locator('#selection-back')
  const forward = page.locator('#selection-forward')
  const clearSelection = async () => {
    await page.locator('#scene canvas').click({ position: { x: 2, y: 2 } })
    await expect(page.locator('#selection-announcement')).toHaveText('No object selected.')
  }

  await clearSelection()
  await expect(back).toHaveAccessibleName('Previous selection: Sirius A')
  await expect(page.locator('#selection-back-name')).toHaveText('Sirius A')
  await back.click()
  await expect(page.locator('#star-name')).toHaveText('Sirius')
  await expect(back).toBeDisabled()

  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.getByRole('button', { name: 'Select Proxima Centauri', exact: true }).click()
  await clearSelection()
  await clearSelection()
  await expect(back).toHaveAccessibleName('Previous selection: Proxima Centauri')
  await expect(page.locator('#selection-back-name')).toHaveText('Proxima Centauri')
  await expect(forward).toBeDisabled()
  await back.click()
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'proxima-centauri')
  await back.click()
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await forward.click()
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'proxima-centauri')
})
