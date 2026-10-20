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
  expect(requests.filter((url) => /\/(nearby-planets|stellar-orbit|planetary-system|catalog-detail|star-article|glossary|star-info|system-card|planet-card|planet-globe|moon-card|distance-comparison|radius-comparison|temperature-card|hr-diagram|mk-diagram|magnitude-card|object-type-info)[\w-]*-/.test(url))).toEqual([])
  await expect(page.locator('#glossary-terms > *')).toHaveCount(0)
  await expect(page.locator('#object-info > *')).toHaveCount(0)
  await expect(page.locator('#object-system > *')).toHaveCount(0)
  expect(requests.filter((url) => /nearest-neighbors.*\.js$/.test(url))).toEqual([])
  expect(requests.filter((url) => /nearest-neighbors.*\.json$/.test(url))).toHaveLength(1)

  await page.locator('#glossary-toggle').click()
  await expect(page.locator('[data-glossary-id]')).toHaveCount(115)
  await expect(page.locator('#glossary-image')).toHaveJSProperty('naturalWidth', 1080)
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

test('Info and constellation data wait for activation after a catalog change and are reused', async ({ page }) => {
  const requests = trackRequests(page)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openWithoutBackground(page)

  await page.locator('#filter-toggle').click()
  const catalogLoaded = page.waitForResponse(/nearest-100-.*\.json$/)
  await page.locator('#catalog-range').fill('1')
  await catalogLoaded
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.locator('#filter-toggle').click()
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
  await page.locator('#object-specs-toggle').click()
  await page.waitForLoadState('networkidle')

  expect(requests.filter((url) => /\/(star-info|constellation-card|canis-major|Canis%20Major|stellar-orbits|nearby-planets)-/.test(url))).toEqual([])
  await expect(page.locator('#object-info > *')).toHaveCount(0)
  await expect(page.locator('#constellation-chart > *')).toHaveCount(0)

  await page.locator('#constellation-toggle').click()
  await expect(page.locator('#constellation-chart > svg')).toBeVisible()
  await page.waitForLoadState('networkidle')
  const chartRequests = () => requests.filter((url) => /\/(constellation-card|canis-major|Canis%20Major)-/.test(url))
  expect(chartRequests()).toHaveLength(3)
  expect(requests.some((url) => /\/(star-info|stellar-orbits|nearby-planets)-/.test(url))).toBe(false)
  await page.locator('#constellation-close').click()

  await page.locator('#object-info-toggle').click()
  await expect(page.locator('#object-info > section')).toHaveCount(3)
  await expect(page.locator('#object-info img')).toHaveJSProperty('naturalWidth', 1080)
  expect(requests.filter((url) => /\/star-info-/.test(url))).toHaveLength(1)
  expect(requests.filter((url) => /\/star-article-/.test(url))).toHaveLength(1)
  expect(requests.some((url) => /\/star-article-sirius-/.test(url))).toBe(true)
  expect(requests.some((url) => /\/(stellar-orbits|nearby-planets)-/.test(url))).toBe(false)

  await page.locator('#object-specs-toggle').click()
  await page.locator('#constellation-toggle').click()
  await expect(page.locator('#constellation-chart > svg')).toBeVisible()
  await page.locator('#constellation-close').click()
  await page.locator('#object-info-toggle').click()
  await expect(page.locator('#object-info > section')).toHaveCount(3)
  await page.waitForLoadState('networkidle')
  expect(chartRequests()).toHaveLength(3)
  expect(requests.filter((url) => /\/star-info-/.test(url))).toHaveLength(1)
  expect(requests.filter((url) => /\/star-article-/.test(url))).toHaveLength(1)
  expect(errors).toEqual([])
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
  expect(requests.filter((url) => /\/planetary-system-sun-/.test(url))).toHaveLength(1)
  expect(requests.some((url) => /\/(nearby-planets|stellar-orbit-)/.test(url))).toBe(false)
  expect(requests.filter((url) => /sun-.*\.jpg$/.test(url))).toEqual([])

  await page.locator('#object-system .planet-row[data-planet-id="mars"] button').click()
  await expect(page.locator('#planet-globe')).toHaveAttribute('data-texture-ready', 'true')
  await expect(page.locator('#planet-moons > *')).toHaveCount(0)
  await expect(page.locator('#planet-info > *')).toHaveCount(0)
  expect(requests.filter((url) => /phobos|deimos|moon-card|planet-moons|planet-info|GLTFLoader/.test(url))).toEqual([])

  await page.locator('#planet-info-toggle').click()
  await expect(page.locator('#planet-info > section')).toHaveCount(6)
  await expect(page.locator('#planet-info img').first()).toHaveJSProperty('naturalWidth', 1080)
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

test('map payloads omit source records and Specs fetches only the selected star notes', async ({ page }) => {
  const requests = trackRequests(page)
  const response = page.waitForResponse(/\/nearest-neighbors-.*\.json$/)
  await openWithoutBackground(page)
  const payload = await (await response).json()
  expect(payload.schemaVersion).toBe(3)
  expect(payload.stars.every((star: Record<string, unknown>) => !('notes' in star) && !('catalog_sources' in star))).toBe(true)
  expect(requests.some((url) => /\/catalog-detail/.test(url))).toBe(false)

  await page.locator('#object-specs-toggle').click()
  await expect(page.locator('#object-specs')).not.toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('#star-notes')).not.toHaveText('Loading source notes…')
  const details = () => requests.filter((url) => /\/catalog-detail-/.test(url))
  expect(details()).toHaveLength(1)
  expect(details()[0]).toContain('/catalog-detail-sirius-a-')
  await page.locator('#object-specs-toggle').click()
  await page.locator('#object-specs-toggle').click()
  await expect(page.locator('#star-notes')).not.toHaveText('Loading source notes…')
  expect(details()).toHaveLength(1)

  await selectSun(page)
  await expect(page.locator('#star-notes')).toContainText('IAU 2015 nominal effective temperature')
  expect(details()).toHaveLength(2)
  expect(details()[1]).toContain('/catalog-detail-sun-')
  expect(requests.some((url) => /\/(star-article|stellar-orbit-|planetary-system-)/.test(url))).toBe(false)
})

test('System loads individual stellar and planet hosts and reuses them on return', async ({ page }) => {
  const requests = trackRequests(page)
  await openWithoutBackground(page)
  await page.locator('#object-system-toggle').click()
  await expect(page.locator('#object-system .stellar-orbit-diagram')).toBeVisible()
  expect(requests.filter((url) => /\/stellar-orbit-(?!data-)/.test(url))).toHaveLength(1)
  expect(requests.some((url) => /\/stellar-orbit-sirius-/.test(url))).toBe(true)
  expect(requests.filter((url) => /\/planetary-system-(?!data-)/.test(url))).toHaveLength(0)
  await selectSun(page)
  await expect(page.locator('#object-system .planet-row[data-planet-id="mars"]')).toBeVisible()
  expect(requests.filter((url) => /\/planetary-system-(?!data-)/.test(url))).toHaveLength(1)
  expect(requests.some((url) => /\/planetary-system-sun-/.test(url))).toBe(true)
  await page.locator('#object-search').fill('Sirius')
  await page.locator('#star-list button[data-star="sirius-a"]').click()
  await expect(page.locator('#object-system .stellar-orbit-diagram')).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(requests.filter((url) => /\/stellar-orbit-(?!data-)/.test(url))).toHaveLength(1)
  expect(requests.filter((url) => /\/planetary-system-(?!data-)/.test(url))).toHaveLength(1)
  expect(requests.some((url) => /\/(catalog-detail|star-article|nearby-planets|stellar-orbits)-/.test(url))).toBe(false)
  await page.locator('#object-search').fill('Proxima')
  await page.locator('#star-list button[data-star="proxima-centauri"]').click()
  await expect(page.locator('#object-system .planet-row')).toHaveCount(2)
  expect(requests.filter((url) => /\/planetary-system-(?!data-)/.test(url))).toHaveLength(2)
  await page.locator('#object-system .planet-row[data-planet-id="exo-proxima-cen-b"] button').click()
  await expect(page.locator('#planet-card [data-planet-spec="mass"]')).toContainText('Minimum mass (m sin i)')
  await expect(page.locator('#planet-card [data-planet-spec="radius"]')).toContainText('estimated')
  expect(requests.some((url) => /\/nearby-planets-/.test(url))).toBe(false)
})

test('a delayed article cannot overwrite the newly selected star Info', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  await page.route(/\/star-article-sirius-.*\.json$/, async (route) => { await held; await route.continue() })
  await openWithoutBackground(page)
  const started = page.waitForRequest(/\/star-article-sirius-.*\.json$/)
  await page.locator('#object-info-toggle').click()
  await started
  await selectSun(page)
  await expect(page.locator('#object-info > p strong')).toHaveText('The Sun')
  release()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#object-info > p strong')).toHaveText('The Sun')
})

test('source-note loading can be retried after a temporary network failure', async ({ page }) => {
  let attempts = 0
  await page.route(/\/catalog-detail-sirius-a-.*\.json$/, async (route) => {
    attempts++
    if (attempts === 1) await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
    else await route.continue()
  })
  await openWithoutBackground(page)
  await page.locator('#object-specs-toggle').click()
  await expect(page.locator('#star-notes')).toContainText('Could not load source notes.')
  await page.locator('#object-specs .source-details summary').click()
  await page.locator('#star-notes').getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('#object-specs')).not.toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('#star-notes')).not.toHaveText('Loading source notes…')
  await expect(page.locator('#star-notes button')).toHaveCount(0)
  expect(attempts).toBe(2)
})

test('delayed source notes cannot replace the newly selected star details', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  await page.route(/\/catalog-detail-sirius-a-.*\.json$/, async (route) => { await held; await route.continue() })
  await openWithoutBackground(page)
  const started = page.waitForRequest(/\/catalog-detail-sirius-a-.*\.json$/)
  await page.locator('#object-specs-toggle').click()
  await started
  await selectSun(page)
  await expect(page.locator('#star-notes')).toContainText('IAU 2015 nominal effective temperature')
  release()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#star-notes')).toContainText('IAU 2015 nominal effective temperature')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sun')
})

test('closing System during its first load leaves the closed section unrendered', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  await page.route(/\/stellar-orbit-sirius-.*\.json$/, async (route) => { await held; await route.continue() })
  await openWithoutBackground(page)
  const started = page.waitForRequest(/\/stellar-orbit-sirius-.*\.json$/)
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
  const backgroundResponse = page.waitForResponse(/\/milky-way-[^/]+\.jpg$/)
  await page.goto('/')
  expect((await backgroundResponse).headers()['cache-control']).toBe('public, max-age=31536000, immutable')
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

test('closed diagram and magnitude cards ignore their delayed first module load', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openWithoutBackground(page)
  await page.locator('#object-specs-toggle').click()

  for (const [chunk, card, toggle, content] of [
    ['hr-diagram', 'spectral', 'spectral', '#hr-diagram > svg'],
    ['magnitude-card', 'magnitude', 'magnitude', '#magnitude-visibility-controls > button'],
  ]) {
    let release!: () => void
    let requested!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const started = new Promise<void>((resolve) => { requested = resolve })
    const pattern = new RegExp(`/${chunk}-[^/]+\\.js$`)
    await page.route(pattern, async (route) => { requested(); await gate; await route.continue() })
    await page.locator(`#${toggle}-toggle`).click()
    await started
    await page.locator(`#${card}-close`).click()
    release()
    await page.waitForLoadState('networkidle')
    await expect(page.locator(`#${card}-card`)).toBeHidden()
    await expect(page.locator(content!)).toHaveCount(0)
    await expect(page.locator(`#${toggle}-toggle`)).toBeFocused()
    await page.unroute(pattern)
    await page.locator(`#${toggle}-toggle`).click()
    await expect(page.locator(content!).first()).toBeVisible()
    await page.locator(`#${card}-close`).click()
  }
  expect(errors).toEqual([])
})

test('switching diagrams during first load keeps the latest choice and reuses both modules', async ({ page }) => {
  const requests = trackRequests(page)
  await openWithoutBackground(page)
  await page.locator('#object-specs-toggle').click()
  let release!: () => void
  let requested!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const started = new Promise<void>((resolve) => { requested = resolve })
  await page.route(/\/hr-diagram-[^/]+\.js$/, async (route) => { requested(); await gate; await route.continue() })
  await page.locator('#spectral-toggle').click()
  await started
  await page.locator('#spectral-mk').click()
  await expect(page.locator('#mk-diagram > svg')).toBeVisible()
  release()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#spectral-mk')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#spectral-hr-content')).toBeHidden()
  await page.locator('#spectral-hr').click()
  await expect(page.locator('#hr-diagram > svg')).toBeVisible()
  await page.locator('#spectral-mk').click()
  await expect(page.locator('#mk-diagram > svg')).toBeVisible()
  expect(requests.filter((url) => /\/hr-diagram-[^/]+\.js$/.test(url))).toHaveLength(1)
  expect(requests.filter((url) => /\/mk-diagram-[^/]+\.js$/.test(url))).toHaveLength(1)
})
