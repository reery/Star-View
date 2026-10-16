import { expect, test } from '@playwright/test'
import { motionArrows, openFilter, openSpecs, openViewer } from './support'

test('shows EZ Aquarii systemic radial velocity and system bulk motion for each component', async ({ page }, testInfo) => {
  await openViewer(page)
  await openFilter(page)
  await page.getByLabel('V magnitude limit', { exact: true }).fill('16')
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('EZ Aquarii')
  await page.getByRole('button', { name: 'Select EZ Aquarii A', exact: true }).click()
  await page.getByRole('button', { name: 'Stellar motion', exact: true }).click()
  await openSpecs(page)
  await page.getByText('Coordinates & source', { exact: true }).click()
  for (const id of ['ez-aquarii-a', 'ez-aquarii-b', 'ez-aquarii-c']) {
    await page.locator(`[data-component-id="${id}"]`).click()
    await expect(page.locator('#radial-velocity')).toBeVisible()
    await expect(page.locator('#radial-velocity')).toHaveText('-50.08 ± 0.01 km/s')
    await expect(page.locator('#radial-velocity')).toHaveAttribute('title', /shared systemic velocity approximation; EZ Aquarii ABC/)
    await expect(page.locator('#motion-data')).toHaveText('System bulk motion')
    await expect(page.locator('#motion-data')).toHaveAttribute('title', /individual orbital velocities are not modeled/)
  }
  // Coincident components share the scene point and arrow of the brightest member, B.
  await expect.poll(async () => (await motionArrows(page)).find((arrow) => arrow.id === 'ez-aquarii-b')?.mode).toBe('full')
  await page.locator('#radial-velocity').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('ez-aquarii-systemic-motion.png'), fullPage: true })
})
