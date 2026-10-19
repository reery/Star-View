import { expect, test } from '@playwright/test'
import { motionArrows, openFilter, openSpecs, openViewer, selectCatalog } from './support'

test('shows reviewed bulk motion for all nine compact-system components', async ({ page }, testInfo) => {
  await openViewer(page)
  await selectCatalog(page, 'nearest-100')
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.getByLabel('V magnitude limit', { exact: true }).fill('20')
  await page.getByRole('button', { name: 'Stellar motion', exact: true }).click()
  for (const [query, name, ids, velocity] of [
    ['Luyten 726-8', 'Luyten 726-8 A', ['luyten-726-8-a', 'luyten-726-8-b'], '39.04'],
    ['V577 Mon', 'V577 Mon A', ['10pc-0066', '10pc-0067'], '16.18'],
    ['FL Vir', 'FL Vir A', ['10pc-0074', '10pc-0075'], '1 ± 4'],
    ['GJ 1245', 'GJ 1245 A', ['10pc-0087', '10pc-0088', '10pc-0089'], '5.43'],
  ] as const) {
    await page.getByRole('button', { name: 'Objects', exact: true }).click()
    await page.getByLabel('Search objects').fill(query)
    await page.getByRole('button', { name: `Select ${name}`, exact: true }).click()
    await page.getByRole('button', { name: 'Objects', exact: true }).click()
    await openSpecs(page)
    if (!await page.locator('#radial-velocity').isVisible()) await page.getByText('Coordinates & source', { exact: true }).click()
    for (const id of ids) {
      await page.locator(`#star-components [data-component-id="${id}"]`).click()
      await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', id)
      await expect(page.locator('#radial-velocity')).toContainText(velocity)
      await expect(page.locator('#radial-velocity')).toHaveAttribute('title', /shared systemic velocity approximation/)
      await expect(page.locator('#motion-data')).toHaveText('System bulk motion')
    }
  }
  await page.screenshot({ path: testInfo.outputPath('compact-system-bulk-motion.png'), fullPage: true })
})

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
  for (const [id, magnitude, mass] of [
    ['ez-aquarii-a', '15.39', '0.119'],
    ['ez-aquarii-b', '15.64', '0.115'],
    ['ez-aquarii-c', '17.43', '0.093'],
  ] as const) {
    await page.locator(`[data-component-id="${id}"]`).click()
    await expect(page.locator('#absolute-mag')).toHaveText(magnitude)
    await expect(page.locator('#mass')).toContainText(mass)
    await expect(page.locator('#temperature-toggle')).toBeDisabled()
    await expect(page.locator('#radius-toggle')).toBeDisabled()
    if (id === 'ez-aquarii-b') await expect(page.locator('#luminosity-toggle')).toBeDisabled()
    else await expect(page.locator('#luminosity-toggle')).toBeEnabled()
    await expect(page.locator('#radial-velocity')).toBeVisible()
    await expect(page.locator('#radial-velocity')).toHaveText('-50.08 ± 0.01 km/s')
    await expect(page.locator('#radial-velocity')).toHaveAttribute('title', /shared systemic velocity approximation; EZ Aquarii ABC/)
    await expect(page.locator('#motion-data')).toHaveText('System bulk motion')
    await expect(page.locator('#motion-data')).toHaveAttribute('title', /individual orbital velocities are not modeled/)
  }
  // Reviewed component V photometry makes A the brightest coincident member.
  await expect.poll(async () => (await motionArrows(page)).find((arrow) => arrow.id === 'ez-aquarii-a')?.mode).toBe('full')
  await page.locator('#radial-velocity').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('ez-aquarii-systemic-motion.png'), fullPage: true })
})
