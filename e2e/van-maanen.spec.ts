import { expect, test } from '@playwright/test'
import { openSpecs, selectCatalog } from './support'

test('Van Maanen specs and both white dwarf articles stay consistent across nearby catalogs @mobile', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  const objects = page.getByRole('button', { name: 'Objects', exact: true })
  for (const catalog of ['nearest-100', 'nearest-1000']) {
    await selectCatalog(page, catalog)
    await expect(page.locator('#scene-status')).toBeHidden()
    if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
    await page.getByLabel('Search objects').fill('10pc-0073')
    await page.locator('[data-star="10pc-0073"]').click()
    if (await objects.getAttribute('aria-expanded') === 'true') await objects.click()
    await openSpecs(page)
    await expect(page.locator('#temperature')).toHaveText('6,215 K')
    await expect(page.locator('#mass')).toHaveText('0.68 M☉')
    await expect(page.locator('#radius')).toHaveText('0.011 R☉')
    const sourceDetails = page.locator('#object-specs .source-details')
    if (await sourceDetails.getAttribute('open') === null) await sourceDetails.locator('summary').click()
    await expect(page.locator('#radial-velocity')).toBeVisible()
    await expect(page.locator('#radial-velocity')).toHaveText('-11.74 ± 7.11 km/s')
    await expect(page.locator('#motion-data')).toHaveText('Full space motion')
    await expect(page.locator('#radial-velocity')).toHaveAttribute('title', /2021A&A/)
    await page.locator('#radial-velocity').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`${catalog}-van-maanen-specs.png`) })
    await page.locator('#object-info-toggle').click()
    await expect(page.locator('#object-info')).toContainText('2.6 times the Sun’s mass')
    await expect(page.locator('#object-info')).toContainText('900 million years')
    await expect(page.locator('#object-info')).toContainText('4.6 AU')
    await page.locator('#object-info').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`${catalog}-van-maanen-info.png`) })

    await objects.click()
    await page.getByLabel('Search objects').fill('LAWD 37')
    await page.locator('[data-star="10pc-0086"]').click()
    await objects.click()
    if (await page.locator('#object-info-toggle').getAttribute('aria-expanded') === 'false') {
      await page.locator('#object-info-toggle').click()
    }
    await expect(page.locator('#object-info')).toContainText('first solitary white dwarf')
    await expect(page.locator('#object-info')).toContainText('0.56 ± 0.08')
    await expect(page.locator('#object-info')).not.toContainText('rather than a faint hydrogen-burning red dwarf')
    await page.locator('#object-info').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`${catalog}-lawd-37-info.png`) })
    await page.locator('#object-specs-toggle').click()
  }
  expect(errors).toEqual([])
})
