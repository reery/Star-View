import { expect, test } from '@playwright/test'
import { openFilter, openSpecs, openViewer, selectCatalog } from './support'

test('keeps preferred nearby star names across Objects, Specs and Mass @mobile', async ({ page }) => {
  await openViewer(page)
  for (const catalog of ['nearest-100', 'nearest-1000']) {
    await selectCatalog(page, catalog)
    const objects = page.getByRole('button', { name: 'Objects', exact: true })
    if (await objects.getAttribute('aria-expanded') !== 'true') await objects.click()
    for (const query of ['GJ 412 A', 'BD+44 2051A']) {
      await page.getByLabel('Search objects').fill(query)
      await page.getByRole('button', { name: 'Select GJ 412 A', exact: true }).click()
      await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', '10pc-0100')
    }
    await objects.click()
    await openSpecs(page)
    await expect(page.locator('#star-name')).toHaveText('GJ 412')
    await expect(page.locator('#mass-toggle')).toHaveAttribute('aria-label', 'Explore mass of GJ 412 A')
    await page.locator('#mass-toggle').click()
    await expect(page.locator('#mass-scale-selected')).toHaveText('GJ 412 A')
    await expect(page.locator('#mass-scale')).toHaveAttribute('aria-label', /GJ 412 A/)
    await page.locator('#mass-close').click()
  }
})

test('searches stellar aliases and displays a bounded designation list after magnitudes @mobile', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('HD48915')
  await expect(page.getByRole('button', { name: 'Select Sirius A', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Select Sirius A', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Specs', exact: true }).click()
  const aliases = page.locator('#object-designations')
  await expect(aliases).toBeHidden()
  await page.locator('#designations-row > summary').click()
  await expect(aliases.locator('li', { hasText: /^HD 48915$/ })).toBeVisible()
  const labels = await page.locator('.properties-section dt:visible, #object-subtypes-row > summary > span:first-child, #designations-row > summary:visible').allTextContents()
  expect(labels[labels.indexOf('Apparent mag. (V)') + 1]).toBe('Designations')
  expect(await aliases.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  expect(await aliases.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(156)
  await page.screenshot({ path: testInfo.outputPath('stellar-designations.png') })
  await page.locator('#designations-row > summary').focus()
  await page.keyboard.press('Enter')
  await expect(aliases).toBeHidden()
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
  await openSpecs(page)
  await page.screenshot({ path: testInfo.outputPath('pulsar-designations.png') })
})
