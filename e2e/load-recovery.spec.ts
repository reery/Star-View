import { expect, test, type Page } from '@playwright/test'

async function ready(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('star-view-milky-way-visible', 'false'))
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
}

const cards = [
  ['spectral', 'hr-diagram'], ['magnitude', 'magnitude-card'], ['object-type', 'object-type-info'],
  ['temperature', 'temperature-card'], ['luminosity', 'luminosity-card'], ['mass', 'mass-card'],
  ['distance', 'distance-comparison'], ['radius', 'radius-card'], ['constellation', 'constellation-card'],
  ['glossary', 'glossary'],
] as const

for (const [name, chunk] of cards) {
  test(`${name} offers recovery after a failed first download without reloading`, async ({ page }, testInfo) => {
    const errors: string[] = []
    let navigations = 0
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations++ })
    await page.route(new RegExp(`/${chunk}-[^/]+\\.js$`), (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
    await ready(page)
    if (name !== 'glossary') await page.locator('#object-specs-toggle').click()
    await page.locator(`#${name}-toggle`).click()
    const card = page.locator(`#${name}-${name === 'glossary' ? 'panel' : 'card'}`)
    const recovery = card.locator('.load-recovery[role="alert"]')
    await expect(recovery).toContainText('Could not load')
    await expect(recovery.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
    await expect(recovery.getByRole('button', { name: 'Reload app', exact: true })).toBeVisible()
    if (name === 'spectral') await card.screenshot({ path: testInfo.outputPath('spectral-recovery.png') })
    await page.locator(`#${name}-close`).click()
    await expect(card).toBeHidden()
    await expect(page.locator(`#${name}-toggle`)).toBeFocused()
    expect(navigations).toBe(1)
    expect(errors).toEqual([])
  })
}

test('a failed module can be retried and explicitly reloaded once to recover', { tag: '@mobile' }, async ({ page }) => {
  const errors: string[] = []
  let blocked = true
  let navigations = 0
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations++ })
  await page.route(/\/hr-diagram-[^/]+\.js$/, (route) => blocked
    ? route.fulfill({ status: 404, body: 'Old deployment asset no longer exists' }) : route.continue())
  await ready(page)
  await page.locator('#object-specs-toggle').click()
  await page.locator('#spectral-toggle').click()
  const recovery = page.locator('#spectral-card .load-recovery[role="alert"]')
  await expect(recovery).toBeVisible()
  await recovery.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(recovery).toBeVisible()
  expect(navigations).toBe(1)
  blocked = false
  await Promise.all([
    page.waitForEvent('load'),
    recovery.getByRole('button', { name: 'Reload app', exact: true }).click(),
  ])
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.locator('#object-specs-toggle').click()
  await page.locator('#spectral-toggle').click()
  await expect(page.locator('#hr-diagram > svg')).toBeVisible()
  await expect(recovery).toHaveCount(0)
  expect(navigations).toBe(2)
  expect(errors).toEqual([])
})

for (const [name, chunk] of [['spectral', 'hr-diagram'], ['constellation', 'constellation-card'], ['mass', 'mass-card']] as const) {
  test(`closing ${name} during a failed download suppresses the stale error`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    let release!: () => void
    let requested!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const started = new Promise<void>((resolve) => { requested = resolve })
    await page.route(new RegExp(`/${chunk}-[^/]+\\.js$`), async (route) => {
      requested(); await gate; await route.fulfill({ status: 503, body: 'Unavailable' })
    })
    await ready(page)
    await page.locator('#object-specs-toggle').click()
    await page.locator(`#${name}-toggle`).click()
    await started
    await page.locator(`#${name}-close`).click()
    release()
    await page.waitForLoadState('networkidle')
    await expect(page.locator(`#${name}-card`)).toBeHidden()
    await expect(page.locator(`#${name}-card [role="alert"]`)).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test('a failed older diagram cannot replace the newly opened diagram', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let release!: () => void
  let requested!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const started = new Promise<void>((resolve) => { requested = resolve })
  await page.route(/\/hr-diagram-[^/]+\.js$/, async (route) => {
    requested(); await gate; await route.fulfill({ status: 503, body: 'Unavailable' })
  })
  await ready(page)
  await page.locator('#object-specs-toggle').click()
  await page.locator('#spectral-toggle').click()
  await started
  await page.locator('#spectral-mk').click()
  await expect(page.locator('#mk-diagram > svg')).toBeVisible()
  await page.locator('#spectral-hr').click()
  await expect(page.locator('#spectral-card .load-recovery[role="status"]')).toBeVisible()
  await page.locator('#spectral-mk').click()
  await expect(page.locator('#mk-diagram > svg')).toBeVisible()
  release()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#spectral-mk')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#mk-diagram > svg')).toBeVisible()
  await expect(page.locator('#spectral-card [role="alert"]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('planet bootstrap failure keeps the System list usable and offers reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/planet-card-[^/]+\.js$/, (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
  await ready(page)
  await page.locator('#objects-toggle').click()
  await page.locator('#object-search').fill('Sun')
  await page.locator('#star-list button[data-star="sun"]').click()
  await page.locator('#object-system-toggle').click()
  await page.locator('.planet-row[data-planet-id="mars"] button').click()
  const system = page.locator('#object-system')
  await expect(system.locator('[role="alert"]')).toContainText('Could not load planet details.')
  await expect(system.getByRole('button', { name: 'Reload app', exact: true })).toBeVisible()
  await expect(system.locator('.planet-row[data-planet-id="earth"]')).toBeVisible()
  await expect(page.locator('#planet-card')).toBeHidden()
  expect(errors).toEqual([])
})

test('Info module failure uses the same recovery actions', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/star-info-[^/]+\.js$/, (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
  await ready(page)
  await page.locator('#object-info-toggle').click()
  const info = page.locator('#object-info')
  await expect(info.locator('[role="alert"]')).toContainText('Could not load Info.')
  await expect(info.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  await expect(info.getByRole('button', { name: 'Reload app', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
