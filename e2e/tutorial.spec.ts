import { expect, test, type Page } from '@playwright/test'
import { openViewer } from './support'

const tutorialRequests = (page: Page) => {
  const requests: string[] = []
  page.on('request', (request) => { if (/\/tutorial[^/]*\.(js|css)/.test(request.url())) requests.push(request.url()) })
  return requests
}

async function openWelcome(page: Page, isMobile: boolean) {
  const info = page.locator('#info-toggle')
  if (isMobile) await info.tap()
  else await info.hover()
  await expect(page.locator('#tutorial-toggle')).toBeVisible()
  await page.locator('#tutorial-toggle').click()
  await expect(page.locator('#welcome-tile')).toBeVisible()
}

test.describe('on a first visit', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('welcomes once, loads the tour only on acceptance and remembers the answer @mobile', async ({ page, isMobile }) => {
    const requests = tutorialRequests(page)
    await page.goto('/')
    await expect(page.locator('#welcome-tile')).toBeVisible()
    await expect(page.locator('#welcome-heading')).toHaveText('Welcome to Star View')
    await expect(page.locator('#welcome-tile')).toContainText('Explore · Ask · Investigate · Understand')
    await expect(page.locator('#welcome-tile')).toContainText('Do you want to be shown around here?')
    expect(await page.evaluate(() => localStorage.getItem('star-view-welcome-answered'))).toBeNull()

    await page.locator('#welcome-no').click()
    await expect(page.locator('#welcome-tile')).toBeHidden()
    expect(await page.evaluate(() => localStorage.getItem('star-view-welcome-answered'))).toBe('true')
    expect(requests).toEqual([])
    await page.reload()
    await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
    await expect(page.locator('#welcome-tile')).toBeHidden()

    await openWelcome(page, isMobile)
    await page.locator('#welcome-yes').click()
    await expect(page.locator('.tutorial-tile')).toBeVisible()
    expect(requests.length).toBeGreaterThan(0)
    await expect(page.locator('#welcome-tile')).toBeHidden()
    await expect(page.locator('#tutorial-title')).toHaveText('The origin')
    await expect(page.locator('.tutorial-arrow')).toBeVisible()
    await expect(page.locator('.tutorial-tile')).toHaveCSS('font-size', '14px')
  })

  test('quitting the tour also keeps the tile away', async ({ page }) => {
    await page.goto('/')
    await page.locator('#welcome-yes').click()
    await page.locator('.tutorial-tile').getByRole('button', { name: 'Quit tutorial' }).click()
    await expect(page.locator('.tutorial-tile')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
    await expect(page.locator('#welcome-tile')).toBeHidden()
  })
})

test('Info carries the same motto and makes room beside its Tutorial button', async ({ page }) => {
  await openViewer(page)
  // Active-view buttons sit left of Info; hovering Info moves them clear of Tutorial.
  await page.locator('#paint-active').evaluate((button: HTMLElement) => { button.hidden = false })
  await page.locator('#info-toggle').hover()
  await expect(page.locator('#tutorial-toggle')).toBeVisible()
  await expect(async () => {
    const tutorial = (await page.locator('#tutorial-toggle').boundingBox())!
    const paint = (await page.locator('#paint-active').boundingBox())!
    expect(tutorial.x - (paint.x + paint.width)).toBeGreaterThanOrEqual(16)
  }).toPass()
  await page.locator('#info-toggle').click()
  await expect(page.locator('#info-panel .info-brand p')).toHaveText('Explore · Ask · Investigate · Understand')
})

test('walks through every tile and leaves the map as it found it @mobile', async ({ page, isMobile }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openViewer(page)
  await openWelcome(page, isMobile)
  await page.locator('#welcome-yes').click()

  const titles = ['The origin', 'Move the origin', 'Where you stand', 'The object menu', 'The selected object', 'Automatic rotation', 'Grids', 'Saved views', 'Filters', 'Western constellations', 'Visibility distance', 'Observe from', 'Explore', 'Objects', 'The full table', 'Glossary']
  const next = page.locator('.tutorial-next')
  for (const [index, title] of titles.entries()) {
    await expect(page.locator('#tutorial-title')).toHaveText(title)
    await expect(page.locator('.tutorial-progress')).toHaveText(`${index + 1} / ${titles.length}`)
    const quit = page.locator('.tutorial-tile').getByRole('button', { name: 'Quit tutorial' })
    if (index === titles.length - 1) await expect(quit).toBeHidden()
    else await expect(quit).toBeVisible()
    if (index === 0) await expect(page.locator('.tutorial-tile').getByRole('button', { name: 'Previous' })).toBeHidden()
    else await expect(page.locator('.tutorial-tile').getByRole('button', { name: 'Previous' })).toBeVisible()
    await expect(next).toHaveText(index === titles.length - 1 ? 'Finish' : 'Next')
    // Every tile fits the screen and points at something on it.
    const tile = (await page.locator('.tutorial-tile').boundingBox())!
    const viewport = page.viewportSize()!
    expect(tile.x).toBeGreaterThanOrEqual(0)
    expect(tile.y).toBeGreaterThanOrEqual(0)
    expect(tile.x + tile.width).toBeLessThanOrEqual(viewport.width)
    expect(tile.y + tile.height).toBeLessThanOrEqual(viewport.height)
    await expect(page.locator('.tutorial-ring:not(.tutorial-pressed)')).toBeVisible()
    if (title === 'The object menu') {
      await expect(page.locator('#scene-context-compare')).toBeVisible()
      await expect(page.locator('#scene-context-origin')).toBeVisible()
    }
    if (title === 'Automatic rotation') await expect(page.locator('#rotation-right')).toHaveAttribute('aria-pressed', 'true')
    if (title === 'Grids') await expect(page.locator('#toggle-galactic-grid')).toBeVisible()
    if (title === 'Western constellations') await expect(page.locator('#show-western-constellation-stars')).toBeChecked()
    if (title === 'Visibility distance') await expect(page.locator('#object-distance-limit-value')).toHaveText('1000 ly')
    if (title === 'Explore') await expect(page.locator('#spaceship-toggle')).toBeVisible()
    if (title === 'The full table') await expect(page.locator('#objects-panel')).toHaveClass(/is-expanded/)
    if (title === 'Glossary') await expect(page.locator('#glossary-panel')).toBeVisible()
    await next.click()
  }

  await expect(page.locator('.tutorial-tile, .tutorial-ring, .tutorial-arrow')).toHaveCount(0)
  await expect(page.locator('#show-western-constellation-stars')).not.toBeChecked()
  await expect(page.locator('#object-distance-limit-value')).toHaveText('100 ly')
  await expect(page.locator('#objects-panel')).toBeHidden()
  await expect(page.locator('#objects-panel')).not.toHaveClass(/is-expanded/)
  await expect(page.locator('#glossary-panel')).toBeHidden()
  await expect(page.locator('#rotation-right')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-touch-open]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('short landscape screens keep the menu and scrolled toolbar targets in view @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch landscape layout')
  await page.setViewportSize({ width: 844, height: 390 })
  await openViewer(page)
  await page.locator('#info-toggle').scrollIntoViewIfNeeded()
  await openWelcome(page, true)
  await page.locator('#welcome-yes').click()
  const next = page.locator('.tutorial-next')
  for (const title of ['The origin', 'Move the origin', 'Where you stand']) {
    await expect(page.locator('#tutorial-title')).toHaveText(title)
    await next.click()
  }
  await expect(page.locator('#tutorial-title')).toHaveText('The object menu')
  await expect(page.locator('#scene-context-menu')).toBeVisible()
  await next.click()
  await next.click()
  await expect(page.locator('#tutorial-title')).toHaveText('Automatic rotation')
  await expect(page.locator('#rotation-toggle')).toBeInViewport({ ratio: 1 })
  await expect(page.locator('.tutorial-arrow')).toBeInViewport({ ratio: 1 })
})

test('frames the icon of each card it opens, and Previous undoes the step', async ({ page }) => {
  await openViewer(page)
  await openWelcome(page, false)
  await page.locator('#welcome-yes').click()
  await expect(page.locator('#tutorial-title')).toHaveText('The origin')
  const tile = page.locator('.tutorial-tile')
  const next = page.locator('.tutorial-next')
  const previous = tile.getByRole('button', { name: 'Previous' })
  const pressed = page.locator('.tutorial-pressed')
  const framesToggle = async (name: string) => {
    await expect(pressed).toBeVisible()
    const icon = (await page.locator(`#${name}-toggle`).boundingBox())!
    const ring = (await pressed.boundingBox())!
    expect(ring.x).toBeLessThanOrEqual(icon.x)
    expect(ring.y).toBeLessThanOrEqual(icon.y)
    expect(ring.x + ring.width).toBeGreaterThanOrEqual(icon.x + icon.width)
    expect(ring.y + ring.height).toBeGreaterThanOrEqual(icon.y + icon.height)
  }
  const goTo = async (title: string) => {
    // The tile hides while a pressed icon flashes, and its title changes only afterwards.
    await expect(tile).toBeVisible()
    while (await page.locator('#tutorial-title').textContent() !== title) {
      await next.click()
      await expect(tile).toBeVisible()
    }
  }
  await goTo('Grids')
  await expect(pressed).toBeHidden()

  // The icon flashes before its card opens, while the tile waits out of the way.
  await next.click()
  await expect(pressed).toHaveClass(/is-flashing/)
  await expect(tile).toBeHidden()
  await expect(page.locator('#views-panel')).toBeHidden()
  await framesToggle('views')
  await expect(page.locator('#tutorial-title')).toHaveText('Saved views')
  await expect(tile).toBeVisible()
  await expect(pressed).not.toHaveClass(/is-flashing/)
  await expect(page.locator('#views-panel')).toBeVisible()
  await framesToggle('views')

  // The frame moves with the card and stays through its steps.
  await next.click()
  await expect(page.locator('#tutorial-title')).toHaveText('Filters')
  await expect(page.locator('#views-panel')).toBeHidden()
  await framesToggle('filter')
  await next.click()
  await expect(page.locator('#show-western-constellation-stars')).toBeChecked()
  await framesToggle('filter')
  await expect(next).toBeEnabled()
  await next.click()
  await expect(page.locator('#object-distance-limit-value')).toHaveText('1000 ly')
  await expect(next).toBeEnabled()

  // Going back undoes each step's change in turn, and forward applies it again.
  await previous.click()
  await expect(page.locator('#tutorial-title')).toHaveText('Western constellations')
  await expect(page.locator('#object-distance-limit-value')).toHaveText('100 ly')
  await expect(page.locator('#show-western-constellation-stars')).toBeChecked()
  await expect(previous).toBeEnabled()
  await previous.click()
  await expect(page.locator('#tutorial-title')).toHaveText('Filters')
  await expect(page.locator('#show-western-constellation-stars')).not.toBeChecked()
  await expect(previous).toBeEnabled()
  await previous.click()
  await expect(page.locator('#tutorial-title')).toHaveText('Saved views')
  await expect(page.locator('#filter-panel')).toBeHidden()
  await expect(page.locator('#views-panel')).toBeVisible()
  await framesToggle('views')

  await goTo('The full table')
  await expect(page.locator('#objects-panel')).toHaveClass(/is-expanded/)
  await previous.click()
  await expect(page.locator('#tutorial-title')).toHaveText('Objects')
  await expect(page.locator('#objects-panel')).not.toHaveClass(/is-expanded/)
  await goTo('Glossary')
  await previous.click()
  await expect(page.locator('#tutorial-title')).toHaveText('The full table')
  await expect(page.locator('#objects-panel')).toBeVisible()
  await expect(page.locator('#objects-panel')).toHaveClass(/is-expanded/)
  await goTo('Glossary')
  await next.click()
  await expect(tile).toHaveCount(0)
  await expect(page.locator('#objects-panel')).not.toHaveClass(/is-expanded/)
  await expect(page.locator('#show-western-constellation-stars')).not.toBeChecked()
  await expect(page.locator('#object-distance-limit-value')).toHaveText('100 ly')
})

test('quits from any tile and undoes what the tour changed', async ({ page }) => {
  await openViewer(page)
  await openWelcome(page, false)
  await page.locator('#welcome-yes').click()
  const next = page.locator('.tutorial-next')
  await expect(page.locator('#tutorial-title')).toHaveText('The origin')
  for (let tile = 1; tile < 11; tile++) await next.click()
  await expect(page.locator('#tutorial-title')).toHaveText('Visibility distance')
  await expect(page.locator('#object-distance-limit-value')).toHaveText('1000 ly')
  await page.locator('.tutorial-tile').getByRole('button', { name: 'Quit tutorial' }).click()
  await expect(page.locator('.tutorial-tile')).toHaveCount(0)
  await expect(page.locator('#object-distance-limit-value')).toHaveText('100 ly')
  await expect(page.locator('#show-western-constellation-stars')).not.toBeChecked()
  await expect(page.locator('#filter-panel')).toBeHidden()

  // Escape quits too, closing the menu the tile was showing.
  await openWelcome(page, false)
  await page.locator('#welcome-yes').click()
  await expect(page.locator('#tutorial-title')).toHaveText('The origin')
  for (let tile = 1; tile < 4; tile++) await next.click()
  await expect(page.locator('#scene-context-menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.tutorial-tile')).toHaveCount(0)
  await expect(page.locator('#scene-context-menu')).toBeHidden()
  await expect(page.locator('#app')).not.toHaveJSProperty('inert', true)
})
