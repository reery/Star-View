import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parseStarCatalog } from '../src/catalog'
import { selectCatalog } from './support'

const stars = parseStarCatalog(readFileSync(new URL('../src/data/stars.csv', import.meta.url), 'utf8'))

test('nearest-neighbor Info covers every component and loads credited local images', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene-status')).toBeHidden()
  const objects = page.getByRole('button', { name: 'Objects', exact: true })
  const info = page.locator('#object-info')
  const systemArticles = new Map<string, string>()
  let images = 0
  for (const star of stars) {
    if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
    await page.locator(`button[data-star="${star.id}"]`).click()
    const component = page.locator(`#star-components button[data-component-id="${star.id}"]`)
    if (await component.count()) await component.click()
    await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', star.id)
    const toggle = page.locator('#object-info-toggle')
    await expect(toggle).toBeEnabled()
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
    await expect(info).toBeVisible()
    await expect(info.locator(':scope > section')).toHaveCount(3)
    const article = await info.locator(':scope > p strong a').getAttribute('href')
    const content = await info.innerText()
    const previous = systemArticles.get(article!)
    if (previous) expect(content).toBe(previous)
    else {
      systemArticles.set(article!, content)
      const image = info.locator('img')
      if (await image.count()) {
        await image.scrollIntoViewIfNeeded()
        await expect(image).toHaveJSProperty('complete', true)
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
        expect(await image.evaluate((element: HTMLImageElement) => new URL(element.src).origin)).toBe(new URL(page.url()).origin)
        images++
      }
      if (['sun', 'proxima-centauri', 'wise-0855-0714', 'sirius-a'].includes(star.id)) {
        if (await objects.getAttribute('aria-expanded') === 'true') await objects.click()
        await page.locator('.selected-object').evaluate((element) => { element.scrollTop = 0 })
        await page.mouse.move(800, 600)
        await page.locator('.selected-object').screenshot({ path: testInfo.outputPath(`${star.id}-info.png`) })
      }
    }
  }
  expect(systemArticles.size).toBe(15)
  expect(images).toBe(9)
  // A text-only article still has the same layout and an enabled Info control.
  if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
  await page.locator('button[data-star="ez-aquarii-c"]').click()
  if (await objects.getAttribute('aria-expanded') === 'true') await objects.click()
  await page.mouse.move(800, 600)
  await page.locator('.selected-object').evaluate((element) => { element.scrollTop = 0 })
  await page.locator('.selected-object').screenshot({ path: testInfo.outputPath('ez-aquarii-info.png') })
  await page.getByRole('button', { name: 'Show EZ Aquarii A', exact: true }).click()
  await expect(info).toContainText('A and C form a close pair')
  // Changing to an object without editorial data clears the previous article.
  await selectCatalog(page, 'nearest-100')
  if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
  await page.getByLabel('Search objects').fill('Tau Ceti')
  await page.locator('button[data-star="10pc-0044"]').click()
  await expect(page.locator('#object-info-toggle')).toBeDisabled()
  await expect(info).toBeEmpty()
  await expect(info).toBeHidden()
  expect(errors).toEqual([])
})
