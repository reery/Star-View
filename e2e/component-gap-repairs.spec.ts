import { expect, test } from '@playwright/test'
import { openSpecs, selectCatalog } from './support'

test('reviewed binary data remain component-specific across nearby catalogs', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  for (const catalog of ['nearest-100', 'nearest-1000']) {
    await selectCatalog(page, catalog)
    await expect(page.locator('#scene-status')).toBeHidden()
    for (const [query, selectedName, components] of [
      ['V577 Mon', 'V577 Mon B', [['10pc-0067', '0.109 M☉'], ['10pc-0066', '0.223 M☉']]],
      ['FL Vir', 'FL Vir B', [['10pc-0075', '0.113 M☉'], ['10pc-0074', '0.124 M☉']]],
      ['GJ 1245', 'GJ 1245 C', [['10pc-0088', '0.076 M☉'], ['10pc-0087', '0.111 M☉']]],
    ] as const) {
      await page.getByRole('button', { name: 'Objects', exact: true }).click()
      await page.getByLabel('Search objects').fill(query)
      await page.getByRole('button', { name: `Select ${selectedName}`, exact: true }).click()
      await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', components[0][0])
      await page.getByRole('button', { name: 'Objects', exact: true }).click()
      await openSpecs(page)
      for (const [id, mass] of components) {
        await page.locator(`#star-components [data-component-id="${id}"]`).click()
        await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', id)
        await expect(page.locator('#mass')).toHaveText(mass)
        await expect(page.locator('#absolute-mag')).toHaveText(/\d/)
        await expect(page.locator('#apparent-mag')).toHaveText(/\d/)
      }
    }
  }
  await page.screenshot({ path: testInfo.outputPath('gj-1245-repaired.png') })
  expect(errors).toEqual([])
})
