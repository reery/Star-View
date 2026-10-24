import { expect, test } from '@playwright/test'
import { openFilter, openSpecs } from './support'

test('reviewed constellation components expose updated masses and primary-source Info', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await openFilter(page)
  await page.getByRole('switch', { name: 'Western constellation stars', exact: true }).check()
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.getByLabel('Object visibility distance', { exact: true }).fill('22')
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  const objects = page.getByRole('button', { name: 'Objects', exact: true })
  for (const [id, mass, companionId, companionMass, source, text] of [
    ['hip-36850', '2.4 M☉', 'msc-07346+3153-cb', '0.6 M☉', '2210.16322', '0.814 days'],
    ['hip-65474', '11.4 M☉', 'msc-13252-1110-ab', '7.2 M☉', '1601.08069', '11.4 and 7.2'],
    ['hip-92855', '6.5 M☉', 'msc-18553-2618-ab', '6.3 M☉', '2603.17011', '134.779'],
    ['hip-28360', '2.4 M☉', 'orb6-05595+4457-aa-ab-ab', '2.3 M☉', '2609.03886', '2026 analysis'],
  ] as const) {
    if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
    await page.getByLabel('Search objects').fill(id)
    await page.locator(`button[data-star="${id}"]`).click()
    if (await objects.getAttribute('aria-expanded') === 'true') await objects.click()
    await openSpecs(page)
    await expect(page.locator('#mass')).toHaveText(mass)
    await page.locator(`#star-components button[data-component-id="${companionId}"]`).click()
    await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', companionId)
    await expect(page.locator('#mass')).toHaveText(companionMass)
    await page.locator('#object-info-toggle').click()
    await expect(page.locator('#object-info')).toContainText(text)
    await expect(page.locator('#object-info > p strong a')).toHaveAttribute('href', new RegExp(source))
  }
  expect(errors).toEqual([])
})
