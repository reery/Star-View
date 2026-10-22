import { expect, test } from '@playwright/test'
import { openSpecs, selectCatalog } from './support'

test('EI Cnc A and B show reviewed mass and radius in both nearby catalogs', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await selectCatalog(page, 'nearest-100')
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('EI Cnc A')
  await page.getByRole('button', { name: 'Select EI Cnc A', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await openSpecs(page)

  for (const catalog of ['nearest-100', 'nearest-1000']) {
    await selectCatalog(page, catalog)
    await expect(page.locator('#scene-status')).toBeHidden()
    for (const [id, mass, radius] of [
      ['10pc-0113', '0.1 M☉', '0.1 R☉'],
      ['10pc-0114', '0.1 M☉', '0.1 R☉'],
    ] as const) {
      await page.locator(`#star-components [data-component-id="${id}"]`).click()
      await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', id)
      await expect(page.locator('#mass')).toHaveText(mass)
      await expect(page.locator('#radius')).toHaveText(radius)
      await expect(page.locator('#temperature')).toHaveText('2,680 K')
      await page.screenshot({ path: testInfo.outputPath(`${catalog}-${id}.png`) })
    }
  }
  expect(errors).toEqual([])
})
