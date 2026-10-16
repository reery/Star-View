import { expect, test } from '@playwright/test'
import { openSpecs, selectCatalog } from './support'

test('Kruger 60 A and B show their reviewed individual specs in both nearby catalogs', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await selectCatalog(page, 'nearest-100')
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('DO Cep')
  await page.getByRole('button', { name: 'Select DO Cep', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await openSpecs(page)

  for (const catalog of ['nearest-100', 'nearest-1000']) {
    await selectCatalog(page, catalog)
    await expect(page.locator('#scene-status')).toBeHidden()
    for (const [id, spectrum, temperature, mass, radius, luminosity] of [
      ['10pc-0062', 'M4V', '3,097 K', '0.172 M☉', '0.209 R☉', '0.00393 L☉'],
      ['10pc-0061', 'M3V', '3,342 K', '0.268 M☉', '0.309 R☉', '0.00983 L☉'],
    ] as const) {
      await page.locator(`#star-components [data-component-id="${id}"]`).click()
      await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', id)
      for (const [selector, value] of [
        ['spectral-type', spectrum], ['temperature', temperature], ['mass', mass],
        ['radius', radius], ['luminosity', luminosity],
      ] as const) await expect(page.locator(`#${selector}`)).toHaveText(value)
      await expect(page.locator('#absolute-mag')).not.toHaveText('Not available')
      await page.screenshot({ path: testInfo.outputPath(`${catalog}-${id}.png`) })
    }
  }
  expect(errors).toEqual([])
})
