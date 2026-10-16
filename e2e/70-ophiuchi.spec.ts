import { expect, test } from '@playwright/test'
import { openSpecs, selectCatalog } from './support'

test('70 Ophiuchi components retain separate physical specs across nearby catalogs', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await selectCatalog(page, 'nearest-100')
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('70 Oph')
  await page.getByRole('button', { name: 'Select 70 Oph B', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await openSpecs(page)

  for (const catalog of ['nearest-100', 'nearest-1000']) {
    await selectCatalog(page, catalog)
    await expect(page.locator('#scene-status')).toBeHidden()
    for (const [id, spectrum, temperature, mass, radius, luminosity, age] of [
      ['10pc-0116', 'K4V', '4,465 K', '0.732 M☉', '0.67 R☉', '0.15 L☉', '2.99 Gyr'],
      ['10pc-0115', 'K0V', '5,301 K', '0.883 M☉', '0.831 R☉', '0.53 L☉', '2.81 Gyr'],
    ] as const) {
      await page.locator(`#star-components [data-component-id="${id}"]`).click()
      await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', id)
      for (const [selector, value] of [
        ['spectral-type', spectrum], ['temperature', temperature], ['mass', mass],
        ['radius', radius], ['luminosity', luminosity], ['age', age],
      ] as const) await expect(page.locator(`#${selector}`)).toHaveText(value)
    }
  }
  await page.screenshot({ path: testInfo.outputPath('70-ophiuchi-a.png') })
  expect(errors).toEqual([])
})
