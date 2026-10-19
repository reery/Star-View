import { expect, test } from '@playwright/test'
import { openFilter, openSpecs } from './support'

test('constellation components expose adopted data and shared system radial velocity', async ({ page }) => {
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
  for (const [id, companionId, companionMass, velocity] of [
    ['hip-75695', 'orb6-15278+2906-a-b-b', '1.635 M☉', '-19.856'],
    ['hip-43109', 'msc-08468+0625-b', '1.661 M☉', '35.526'],
    ['hip-30883', 'msc-06290+2013-aa2', '3.28 M☉', '29.8 ± 0.1'],
    ['hip-61941', 'orb6-12417-0127-a-b-b', null, '-19.8'],
  ] as const) {
    if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
    await page.getByLabel('Search objects').fill(id)
    await page.locator(`button[data-star="${id}"]`).click()
    if (await objects.getAttribute('aria-expanded') === 'true') await objects.click()
    await openSpecs(page)
    if (!await page.locator('#radial-velocity').isVisible()) await page.getByText('Coordinates & source', { exact: true }).click()
    for (const target of [null, companionId]) {
      if (target) await page.locator(`#star-components button[data-component-id="${target}"]`).click()
      if (target && companionMass) await expect(page.locator('#mass')).toHaveText(companionMass)
      await expect(page.locator('#radial-velocity')).toContainText(velocity)
      await expect(page.locator('#radial-velocity')).toHaveAttribute('title', /shared systemic velocity approximation/)
      await expect(page.locator('#motion-data')).toHaveText('System bulk motion')
    }
  }
  expect(errors).toEqual([])
})
