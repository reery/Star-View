import { expect, test, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'

function trackRequests(page: Page): string[] {
  const requests: string[] = []
  page.on('request', (request) => requests.push(new URL(request.url()).pathname))
  return requests
}

async function openWithoutBackground(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('star-view-milky-way-visible', 'false'))
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.waitForLoadState('networkidle')
}

async function selectSun(page: Page): Promise<void> {
  await page.locator('#objects-toggle').click()
  await page.locator('#object-search').fill('Sun')
  await page.locator('#star-list button[data-star="sun"]').click()
}

test('startup defers closed features and fetches catalog JSON directly', async ({ page }) => {
  const requests = trackRequests(page)
  await openWithoutBackground(page)
  expect(requests.filter((url) => /\.(jpg|png|gif|glb)$/.test(url))).toEqual([])
  expect(requests.filter((url) => /\/(nearby-planets|stellar-orbits|glossary|star-info|system-card|planet-card|planet-globe|moon-card|distance-comparison|radius-comparison|temperature-card)-/.test(url))).toEqual([])
  await expect(page.locator('#glossary-terms > *')).toHaveCount(0)
  await expect(page.locator('#object-info > *')).toHaveCount(0)
  await expect(page.locator('#object-system > *')).toHaveCount(0)
  expect(requests.filter((url) => /nearest-neighbors.*\.js$/.test(url))).toEqual([])
  expect(requests.filter((url) => /nearest-neighbors.*\.json$/.test(url))).toHaveLength(1)

  await page.locator('#glossary-toggle').click()
  await expect(page.locator('[data-glossary-id]')).toHaveCount(115)
  await expect(page.locator('#glossary-image')).toHaveJSProperty('naturalWidth', 1200)
  await page.locator('#glossary-toggle').click()

  await page.locator('#object-specs-toggle').click()
  for (const name of ['distance', 'radius', 'temperature']) {
    await page.locator(`#${name}-toggle`).click()
    await expect(page.locator(`#${name}-card`)).toBeVisible()
    await expect.poll(() => requests.some((url) => url.includes(`/${name === 'temperature' ? 'temperature-card' : `${name}-comparison`}-`))).toBe(true)
    await page.locator(`#${name}-close`).click()
  }
  await page.locator('#filter-toggle').click()
  await page.locator('#catalog-range').fill('1')
  await expect(page.locator('#scene-status')).toBeHidden()
  await expect.poll(() => requests.filter((url) => /nearest-100-.*\.json$/.test(url)).length).toBe(1)
  expect(requests.filter((url) => /nearest-100-.*\.js$/.test(url))).toEqual([])
  await expect(page.locator('#object-system > *')).toHaveCount(0)
})

test('System, planet Info, and moon assets follow their own activation', async ({ page }, testInfo) => {
  const requests = trackRequests(page)
  await openWithoutBackground(page)
  await selectSun(page)
  await page.locator('#object-specs-toggle').click()
  await expect(page.locator('#known-planets')).toHaveText('8')
  expect(requests.some((url) => /nearby-planets|stellar-orbits/.test(url))).toBe(false)
  await page.locator('#object-system-toggle').click()
  await expect(page.locator('#object-system .planet-row[data-planet-id="mars"]')).toBeVisible()
  expect(requests.some((url) => url.includes('/nearby-planets-'))).toBe(true)
  expect(requests.some((url) => url.includes('/stellar-orbits-'))).toBe(true)
  expect(requests.filter((url) => /sun-.*\.jpg$/.test(url))).toEqual([])

  await page.locator('#object-system .planet-row[data-planet-id="mars"] button').click()
  await expect(page.locator('#planet-globe')).toHaveAttribute('data-texture-ready', 'true')
  await expect(page.locator('#planet-moons > *')).toHaveCount(0)
  await expect(page.locator('#planet-info > *')).toHaveCount(0)
  expect(requests.filter((url) => /phobos|deimos|moon-card|planet-moons|planet-info|GLTFLoader/.test(url))).toEqual([])

  await page.locator('#planet-info-toggle').click()
  await expect(page.locator('#planet-info > section')).toHaveCount(6)
  await expect(page.locator('#planet-info img').first()).toHaveJSProperty('naturalWidth', 1920)
  expect(requests.some((url) => url.includes('phobos'))).toBe(false)
  await page.locator('#planet-moons-toggle').click()
  await expect(page.locator('#planet-moons')).toHaveAttribute('data-selected-moon-id', 'phobos')
  await expect(page.locator('#planet-moon-globe')).toHaveAttribute('data-texture-ready', 'true')
  expect(requests.some((url) => url.includes('/phobos-atlas-'))).toBe(true)
  expect(requests.some((url) => url.includes('/deimos-'))).toBe(false)
  await page.locator('#planet-moons button[data-moon-id="deimos"]').click()
  await expect(page.locator('#planet-moon-globe')).toHaveAttribute('data-model-ready', 'true')
  await expect(page.locator('#planet-moon-globe')).toHaveAttribute('data-texture-ready', 'true')
  expect(requests.some((url) => url.includes('/deimos-shape-'))).toBe(true)
  await page.locator('#planet-card').screenshot({ path: testInfo.outputPath('lazy-moons.png') })
})

test('closing System during its first load leaves the closed section unrendered', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  await page.route(/\/nearby-planets-.*\.js$/, async (route) => { await held; await route.continue() })
  await openWithoutBackground(page)
  const started = page.waitForRequest(/\/nearby-planets-.*\.js$/)
  await page.locator('#object-system-toggle').click()
  await started
  await page.locator('#object-specs-toggle').click()
  release()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#object-system')).toBeHidden()
  await expect(page.locator('#object-system > *')).toHaveCount(0)
  await page.locator('#object-system-toggle').click()
  await expect(page.locator('#object-system .stellar-orbit-diagram')).toBeVisible()
})

test('Milky Way keeps its full-resolution background and reuses it after catalog changes', async ({ page }, testInfo) => {
  const requests = trackRequests(page)
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('#scene')).toHaveAttribute('data-milky-way-ready', 'true')
  await page.waitForLoadState('networkidle')
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.toJSON()))
  writeFileSync(testInfo.outputPath('startup-resources.json'), JSON.stringify(resources, null, 2))
  await page.locator('#scene canvas').screenshot({ path: testInfo.outputPath('full-background.png') })
  expect(requests.filter((url) => /milky-way.*\.jpg$/.test(url))).toHaveLength(1)
  expect(requests.some((url) => url.includes('milky-way-preview'))).toBe(false)
  await page.locator('#filter-toggle').click()
  const catalogLoaded = page.waitForResponse(/nearest-100-.*\.json$/)
  await page.locator('#catalog-range').fill('1')
  await catalogLoaded
  await expect(page.locator('#scene-status')).toBeHidden()
  await expect(page.locator('#scene')).toHaveAttribute('data-milky-way-ready', 'true')
  expect(requests.filter((url) => /milky-way.*\.jpg$/.test(url))).toHaveLength(1)
})
