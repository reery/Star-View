import { expect, test } from '@playwright/test'
import { openFilter, openViewer } from './support'

test('searches stellar aliases and displays a bounded designation list after absolute magnitude @mobile', async ({ page }, testInfo) => {
  await openViewer(page)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('HD48915')
  await expect(page.getByRole('button', { name: 'Select Sirius A', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Select Sirius A', exact: true }).click()
  await page.locator('#object-card-details > summary').click()
  const aliases = page.locator('#object-designations')
  await expect(aliases.locator('li', { hasText: /^HD 48915$/ })).toBeVisible()
  expect(await page.locator('#absolute-mag').evaluate((element) => element.parentElement!.nextElementSibling!.querySelector('dt')!.textContent)).toBe('Designations')
  expect(await aliases.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  expect(await aliases.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(156)
  await page.screenshot({ path: testInfo.outputPath('stellar-designations.png') })
})

test('finds named pulsars by both common and formal names', async ({ page }, testInfo) => {
  await openViewer(page)
  await openFilter(page)
  await page.locator('details.filter-dropdown > summary').click()
  await page.getByLabel('Pulsars', { exact: true }).check()
  await page.getByLabel('Object visibility distance', { exact: true }).fill('22')
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  for (const [common, formal] of [
    ['Geminga', 'PSRJ0633+1746'], ['Vela Pulsar', 'B0833-45'], ['Monogem Pulsar', 'B0656+14'],
    ['Morla', 'J0357+3205'], ['Lich', 'PSRB1257+12'], ['Guitar Pulsar', 'B2224+65'],
  ]) {
    for (const query of [common!, formal!]) {
      await page.getByLabel('Search objects').fill(query)
      await page.getByRole('button', { name: `Select ${common}`, exact: true }).click()
      await expect(page.locator('#star-name')).toHaveText(common!)
      await expect(page.locator('#object-designations')).toContainText(/PSR [JB]/)
    }
  }
  await page.getByLabel('Search objects').fill('Geminga')
  await page.getByRole('button', { name: 'Select Geminga', exact: true }).click()
  await page.locator('#object-card-details > summary').click()
  await page.screenshot({ path: testInfo.outputPath('pulsar-designations.png') })
})
