import { expect, test } from '@playwright/test'
import { openSpecs, openViewer } from './support'

test('shows resolved Luhman 16 magnitudes and epoch-scoped radial velocities', async ({ page }, testInfo) => {
  await openViewer(page)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('Luhman 16')
  await page.getByRole('button', { name: 'Select Luhman 16 A', exact: true }).click()
  await openSpecs(page)
  await page.getByText('Coordinates & source', { exact: true }).click()
  for (const [component, apparent, absolute, rv] of [
    ['a', '23.25 ± 0.1', '26.749', '16.7 ± 0.3 km/s'],
    ['b', '24.07 ± 0.1', '27.569', '20.4 ± 0.4 km/s'],
  ]) {
    await page.locator(`#star-components [data-component-id="luhman-16-${component}"]`).click()
    await expect(page.locator('#apparent-mag')).toHaveText(apparent!)
    await expect(page.locator('#absolute-mag')).toHaveText(absolute!)
    await expect(page.locator('#apparent-mag')).toHaveAttribute('title', /2013-06-16.*Resolved Johnson V/)
    await expect(page.locator('#magnitude-toggle')).toBeEnabled()
    await page.locator('#magnitude-toggle').click()
    await expect(page.locator('#magnitude-card')).toBeVisible()
    await expect(page.locator('#magnitude-absolute-value')).toHaveText(component === 'a' ? '+26.75' : '+27.57')
    await expect(page.locator('#magnitude-apparent-value')).toHaveText(component === 'a' ? '+23.25' : '+24.07')
    await expect(page.locator('#magnitude-apparent-scale')).toHaveAttribute('aria-label', new RegExp(`Luhman 16 ${component!.toUpperCase()}, selected: \\+${apparent!.split(' ')[0]}`))
    if (component === 'b') await page.screenshot({ path: testInfo.outputPath('luhman-16-magnitudes.png'), fullPage: true })
    await page.locator('#magnitude-close').click()
    await expect(page.locator('#radial-velocity')).toHaveText(rv!)
    await expect(page.locator('#radial-velocity')).toHaveAttribute('title', /2018-04-21 to 2018-06-29.*not a formal standard error.*not the binary systemic velocity/)
    await expect(page.locator('#motion-data')).toHaveText('Transverse only')
  }
  await page.locator('#radial-velocity').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('luhman-16-observations.png'), fullPage: true })
})
