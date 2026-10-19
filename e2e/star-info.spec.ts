import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parseStarCatalog } from '../src/catalog'
import { openFilter, selectCatalog } from './support'

const stars = parseStarCatalog(readFileSync(new URL('../src/data/stars.csv', import.meta.url), 'utf8'))
const nearest100 = parseStarCatalog(readFileSync(new URL('../src/data/catalogs/nearest-100/stars.csv', import.meta.url), 'utf8'))
const brightStars = parseStarCatalog(readFileSync(new URL('../src/data/catalogs/bright-stars/stars.csv', import.meta.url), 'utf8'))

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
  // Switching catalogs now preserves an enabled Info tab for Tau Ceti.
  await selectCatalog(page, 'nearest-100')
  if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
  await page.getByLabel('Search objects').fill('Tau Ceti')
  await page.locator('button[data-star="10pc-0044"]').click()
  await expect(page.locator('#object-info-toggle')).toBeEnabled()
  await expect(info).toContainText('Tau Ceti')
  await expect(info.locator('img')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('nearest-100 Info covers every catalog object and shares complete system articles', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene-status')).toBeHidden()
  await selectCatalog(page, 'nearest-100')
  const objects = page.getByRole('button', { name: 'Objects', exact: true })
  const info = page.locator('#object-info')
  const systemArticles = new Map<string, string>()
  const originalIds = new Set(stars.map(({ id }) => id))
  for (const star of nearest100) {
    if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
    await page.getByLabel('Search objects').fill(star.id)
    await page.locator(`button[data-star="${star.id}"]`).click()
    await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', star.id)
    const toggle = page.locator('#object-info-toggle')
    await expect(toggle).toBeEnabled()
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
    await expect(info).toBeVisible()
    await expect.poll(() => info.locator(':scope > section').count(), { message: star.id }).toBeGreaterThan(0)
    const source = await info.locator(':scope > p strong a').getAttribute('href')
    expect(source).toMatch(/^https:\/\//)
    const content = await info.innerText()
    const previous = systemArticles.get(source!)
    if (previous) expect(content).toBe(previous)
    else systemArticles.set(source!, content)
    if (!originalIds.has(star.id)) await expect(info.locator('img')).toHaveCount(0)
  }
  expect(systemArticles.size).toBe(76)

  // Both brown dwarfs are below the nearest-100 cutoff but share the primary's article.
  await page.getByLabel('Search objects').fill('10pc-0138')
  await page.locator('button[data-star="10pc-0138"]').click()
  const primaryContent = await info.innerText()
  for (const id of ['cns5-1529', 'gj-229-bb']) {
    await page.locator(`#star-components button[data-component-id="${id}"]`).click()
    await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', id)
    await expect(page.locator('#object-info-toggle')).toBeEnabled()
    expect(await info.innerText()).toBe(primaryContent)
  }
  await expect(info).toContainText('about every 12 days')
  if (await objects.getAttribute('aria-expanded') === 'true') await objects.click()
  await page.locator('.selected-object').evaluate((element) => { element.scrollTop = 0 })
  await page.mouse.move(800, 600)
  await page.locator('.selected-object').screenshot({ path: testInfo.outputPath('gliese-229-text-info.png') })
  expect(await info.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)

  // Changing to an unsupported object clears the previously displayed article.
  await selectCatalog(page, 'nearest-1000')
  if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
  await page.getByLabel('Search objects').fill('cns5-4846')
  await page.locator('button[data-star="cns5-4846"]').click()
  await expect(page.locator('#object-info-toggle')).toBeDisabled()
  await expect(info).toBeEmpty()
  await expect(info).toBeHidden()
  expect(errors).toEqual([])
})

test('bright-star Info covers every entry and shares articles with faint companions', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene-status')).toBeHidden()
  await openFilter(page)
  await page.getByRole('switch', { name: 'Always show bright stars', exact: true }).check()
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.getByLabel('Object visibility distance', { exact: true }).fill('22')
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  const objects = page.getByRole('button', { name: 'Objects', exact: true })
  const info = page.locator('#object-info')
  const articles = new Set<string>()
  for (const star of brightStars) {
    if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
    await page.getByLabel('Search objects').fill(star.id)
    await page.locator(`button[data-star="${star.id}"]`).click()
    await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', star.id)
    const toggle = page.locator('#object-info-toggle')
    await expect(toggle).toBeEnabled()
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
    await expect(info).toBeVisible()
    await expect.poll(() => info.locator(':scope > section').count(), { message: star.id }).toBeGreaterThanOrEqual(2)
    expect(await info.locator(':scope > p strong a').getAttribute('href')).toMatch(/^https:\/\//)
    articles.add(await info.innerText())
  }
  expect(articles.size).toBe(114)

  await page.getByLabel('Search objects').fill('bright-castor')
  await page.locator('button[data-star="bright-castor"]').click()
  const content = await info.innerText()
  await expect(info).toContainText('six-star system')
  for (const id of ['msc-07346+3153-ab', 'msc-07346+3153-ba', 'msc-07346+3153-bb', 'msc-07346+3153-c']) {
    await page.locator(`#star-components button[data-component-id="${id}"]`).click()
    await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', id)
    await expect(page.locator('#object-info-toggle')).toBeEnabled()
    expect(await info.innerText()).toBe(content)
  }
  expect(errors).toEqual([])
})

test('bright-star articles fit the existing Info card and update between systems @mobile', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.locator('#scene-status')).toBeHidden()
  await openFilter(page)
  await page.getByRole('switch', { name: 'Always show bright stars', exact: true }).check()
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.getByLabel('Object visibility distance', { exact: true }).fill('22')
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  const objects = page.getByRole('button', { name: 'Objects', exact: true })
  const info = page.locator('#object-info')
  for (const [id, text] of [['cns5-5665', 'collision debris'], ['bright-betelgeuse', 'July 2026'], ['rigel-bb', 'hierarchical four-star family']]) {
    if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
    await page.getByLabel('Search objects').fill(id!)
    await page.locator(`button[data-star="${id}"]`).click()
    const toggle = page.locator('#object-info-toggle')
    await expect(toggle).toBeEnabled()
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
    await expect(info).toContainText(text!)
    await expect(info.locator(':scope > section')).toHaveCount(2)
    if (await objects.getAttribute('aria-expanded') === 'true') await objects.click()
    await page.locator('.selected-object').evaluate((element) => { element.scrollTop = 0 })
    expect(await info.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.locator('.selected-object').screenshot({ path: testInfo.outputPath(`${id}-info.png`) })
  }
})
