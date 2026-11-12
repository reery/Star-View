import { expect, test, type CDPSession, type Page } from '@playwright/test'
import { openViewer } from './support'

type Point = { x: number; y: number }

async function touchSession(page: Page) {
  const session: CDPSession = await page.context().newCDPSession(page)
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: Point) =>
    session.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [point] : [] })
  return {
    down: (point: Point) => send('touchStart', point),
    // Several steps, as a real finger reports them, ending with a pause so no flick speed remains.
    async move(from: Point, to: Point) {
      for (let step = 1; step <= 6; step++) {
        await send('touchMove', { x: from.x + (to.x - from.x) * step / 6, y: from.y + (to.y - from.y) * step / 6 })
      }
      await page.waitForTimeout(120)
    },
    up: () => send('touchEnd'),
    async swipe(this: { down(p: Point): Promise<unknown>; move(a: Point, b: Point): Promise<void>; up(): Promise<unknown> }, from: Point, to: Point) {
      await this.down(from)
      await this.move(from, to)
      await this.up()
    },
  }
}

async function headerPoint(page: Page, id: string): Promise<Point> {
  const box = (await page.locator(`#${id} > .panel-heading`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function openMass(page: Page) {
  await openViewer(page)
  await page.locator('#object-specs-toggle').tap()
  await page.locator('#mass-toggle').tap()
  await expect(page.locator('#mass-card')).toBeVisible()
  await expect(page.locator('#mass-facts')).not.toBeEmpty()
}

test('sideways swipes exchange the heading in place and open the neighbouring card, and can be taken back @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await openMass(page)
  const touch = await touchSession(page)
  const start = await headerPoint(page, 'mass-card')
  const incoming = page.locator('#radius-card.is-step-peek')
  const heading = page.locator('#mass-card > .panel-heading')
  const body = page.locator('#mass-card > .card-scroll-content')
  const headingBox = await heading.boundingBox()
  const bodyBox = (await body.boundingBox())!
  const left = { x: start.x - 130, y: start.y }

  // Past the commit point the next heading is in place over the row, which has not moved, while the content has.
  await touch.down(start)
  await touch.move(start, left)
  await expect(incoming.locator('h2')).toHaveText('Radius')
  await expect(incoming.locator('h2')).toHaveCSS('opacity', '1')
  await expect(incoming).toHaveAttribute('hidden')
  await expect(incoming.locator('.card-scroll-content')).toBeHidden()
  expect((await incoming.locator('.panel-heading').boundingBox())!.y).toBe(headingBox!.y)
  expect(await heading.boundingBox()).toEqual(headingBox)
  expect((await body.boundingBox())!.x).toBeCloseTo(bodyBox.x - 130, 0)
  // The exchange leaves the text colour alone.
  const massTitle = page.locator('#mass-card > .panel-heading > h2')
  await expect(massTitle).toHaveCSS('opacity', '0')
  expect(await incoming.locator('h2').evaluate((title) => getComputedStyle(title).color)).toBe(await massTitle.evaluate((title) => getComputedStyle(title).color))

  // Moving back cancels.
  await touch.move(left, start)
  await expect(massTitle).toHaveCSS('opacity', '1')
  await touch.up()
  await expect(incoming).toHaveCount(0)
  await expect(page.locator('#radius-card')).toBeHidden()
  await expect(page.locator('#mass-card')).toBeVisible()
  await expect(page.locator('#mass-card > .panel-heading > h2')).not.toHaveAttribute('style', /.+/)
  await expect(body).not.toHaveAttribute('style', /.+/)
  expect(await body.boundingBox()).toEqual(bodyBox)

  // Letting go early springs back too.
  await touch.swipe(start, { x: start.x - 30, y: start.y })
  await expect(page.locator('#mass-card')).toBeVisible()
  await expect(page.locator('#radius-card')).toBeHidden()

  await touch.swipe(start, left)
  await expect(page.locator('#radius-card')).toBeVisible()
  await expect(page.locator('#mass-card')).toBeHidden()
  await expect(page.locator('.is-step-peek')).toHaveCount(0)
  expect((await page.locator('#radius-card > .panel-heading').boundingBox())!.y).toBe(headingBox!.y)
  await expect(page.locator('#mass-toggle')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#radius-toggle')).toHaveAttribute('aria-expanded', 'true')

  const radiusStart = await headerPoint(page, 'radius-card')
  await touch.swipe(radiusStart, { x: radiusStart.x + 130, y: radiusStart.y })
  await expect(page.locator('#mass-card')).toBeVisible()
  await expect(page.locator('#radius-card')).toBeHidden()
})

test('stepping back to an already loaded card lays it out in full, so its content still swipes @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await openViewer(page)
  await page.locator('#object-specs-toggle').tap()
  await page.locator('#luminosity-toggle').tap()
  const labels = page.locator('#luminosity-scale .luminosity-plot-label')
  await expect(labels.first()).toBeVisible()
  await page.locator('#luminosity-close').tap()
  await page.locator('#mass-toggle').tap()
  await expect(page.locator('#mass-facts')).not.toBeEmpty()
  const touch = await touchSession(page)
  const massStart = await headerPoint(page, 'mass-card')
  await touch.swipe(massStart, { x: massStart.x + 130, y: massStart.y })
  await expect(page.locator('#luminosity-card')).toBeVisible()

  const body = page.locator('#luminosity-card > .card-scroll-content')
  await expect(page.locator('#luminosity-scale')).not.toHaveCSS('--luminosity-label-max', '0px')
  expect(await body.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)

  const box = (await body.boundingBox())!
  const inside = { x: box.x + box.width / 2, y: box.y + 30 }
  await touch.swipe(inside, { x: inside.x - 130, y: inside.y })
  await expect(page.locator('#mass-card')).toBeVisible()
  await touch.swipe(massStart, { x: massStart.x + 130, y: massStart.y })
  await expect(page.locator('#luminosity-card')).toBeVisible()
  await touch.swipe(inside, { x: inside.x, y: inside.y + 150 })
  await expect(page.locator('#luminosity-card')).toBeHidden()
})

test('a step draws the new card over a blank frame that eases from the old size to the new one @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openMass(page)
  const touch = await touchSession(page)
  const start = await headerPoint(page, 'mass-card')
  const frame = page.locator('.card-swipe-frame')
  const massHeight = (await page.locator('#mass-card').boundingBox())!.height
  await touch.down(start)
  await touch.move(start, { x: start.x - 130, y: start.y })
  // Held for the length of the step, so that the first frame after the swap can be read.
  await page.evaluate(() => {
    const blank = document.querySelector<HTMLElement>('.card-swipe-frame')!
    new MutationObserver((_, observer) => {
      if (blank.hidden) return
      observer.disconnect()
      document.documentElement.dataset.blankStart = String(blank.getBoundingClientRect().height)
    }).observe(blank, { attributes: true, attributeFilter: ['hidden'] })
  })
  await touch.up()
  await expect(page.locator('html')).toHaveAttribute('data-blank-start', /.+/)
  expect(Number(await page.locator('html').getAttribute('data-blank-start'))).toBeCloseTo(massHeight, 0)
  await expect(page.locator('#radius-card')).toBeVisible()
  await expect(frame).toBeHidden()
})

test('after a step the blank frame keeps its size until the new card has its content @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openMass(page)
  const touch = await touchSession(page)
  const start = await headerPoint(page, 'mass-card')
  const massHeight = (await page.locator('#mass-card').boundingBox())!.height
  const frame = page.locator('.card-swipe-frame')
  let finishLoad = () => {}
  const held = new Promise<void>((resolve) => { finishLoad = resolve })
  await page.route('**/assets/**', async (route) => {
    await held
    await route.continue()
  })
  await touch.swipe(start, { x: start.x - 130, y: start.y })
  await expect(page.locator('#radius-card')).toBeVisible()
  await expect(frame).toBeVisible()
  await expect(frame).toHaveAttribute('aria-busy', 'true')
  await page.waitForTimeout(600)
  expect((await frame.boundingBox())!.height).toBeCloseTo(massHeight, 0)
  finishLoad()
  await expect(frame).toBeHidden()
  await expect(frame).not.toHaveAttribute('style', /.+/)
  await expect(page.locator('#radius-card')).not.toHaveAttribute('style', /clip-path/)
})

test('a touch ends the wait for a slow card @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openMass(page)
  const touch = await touchSession(page)
  const start = await headerPoint(page, 'mass-card')
  let finishLoad = () => {}
  const held = new Promise<void>((resolve) => { finishLoad = resolve })
  await page.route('**/assets/**', async (route) => {
    await held
    await route.continue()
  })
  await touch.swipe(start, { x: start.x - 130, y: start.y })
  const frame = page.locator('.card-swipe-frame')
  await expect(frame).toBeVisible()
  await touch.down(await headerPoint(page, 'radius-card'))
  await expect(frame).toBeHidden()
  await expect(page.locator('#radius-card')).not.toHaveAttribute('style', /clip-path/)
  await touch.up()
  finishLoad()
})

test('the constellation card is as wide as the cards it steps between @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await openViewer(page)
  await page.locator('#object-specs-toggle').tap()
  await page.locator('#constellation-toggle').tap()
  const constellation = (await page.locator('#constellation-card').boundingBox())!.width
  await page.locator('#constellation-close').tap()
  await page.locator('#mass-toggle').tap()
  expect(constellation).toBe((await page.locator('#mass-card').boundingBox())!.width)
})

test('a quick flick commits below the commit distance @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await openMass(page)
  const session = await page.context().newCDPSession(page)
  const start = await headerPoint(page, 'mass-card')
  // Explicit times keep the speed independent of how fast the test machine dispatches events.
  const now = Date.now() / 1000
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', step: number, dx?: number) => session.send('Input.dispatchTouchEvent', {
    type, timestamp: now + step * 0.016, touchPoints: dx === undefined ? [] : [{ x: start.x + dx, y: start.y }],
  })
  await send('touchStart', 0, 0)
  await send('touchMove', 1, -15)
  await send('touchMove', 2, -30)
  await send('touchMove', 3, -45)
  await send('touchEnd', 4)
  await expect(page.locator('#radius-card')).toBeVisible()
  await expect(page.locator('#mass-card')).toBeHidden()
})

test('a sideways swipe stops at the ends of the card sequence @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await openViewer(page)
  await page.locator('#object-specs-toggle').tap()
  await page.locator('#distance-toggle').tap()
  await expect(page.locator('#distance-card')).toBeVisible()
  const touch = await touchSession(page)
  const start = await headerPoint(page, 'distance-card')
  await touch.down(start)
  await touch.move(start, { x: start.x + 130, y: start.y })
  await expect(page.locator('.is-step-peek')).toHaveCount(0)
  await expect(page.locator('#distance-card > .panel-heading > h2')).toHaveCSS('opacity', '1')
  await touch.up()
  await expect(page.locator('#distance-card')).toBeVisible()
})

test('swiping down closes a card unless it has content to scroll back to @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await openMass(page)
  const touch = await touchSession(page)
  const start = await headerPoint(page, 'mass-card')
  const down = { x: start.x, y: start.y + 150 }

  await touch.down(start)
  await touch.move(start, down)
  await expect(page.locator('.card-swipe-frame')).toBeHidden()
  await touch.move(down, start)
  await touch.up()
  await expect(page.locator('#mass-card')).toBeVisible()

  // Lengthen the content so that it scrolls.
  await page.locator('#mass-card .mass-method').evaluate((element: HTMLDetailsElement) => { element.open = true })
  const body = page.locator('#mass-card .card-scroll-content')
  const box = (await body.boundingBox())!
  await body.evaluate((element) => { element.scrollTop = 40 })
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  const inside = { x: box.x + box.width / 2, y: box.y + 30 }
  await touch.swipe(inside, { x: inside.x, y: inside.y + 150 })
  await expect(page.locator('#mass-card')).toBeVisible()
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(0)

  await touch.swipe(start, down)
  await expect(page.locator('#mass-card')).toBeHidden()
  await expect(page.locator('#mass-toggle')).toHaveAttribute('aria-expanded', 'false')
})

test('swiping up retracts the selected object card, and can be taken back @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await openViewer(page)
  await page.locator('#object-specs-toggle').tap()
  const details = page.locator('#object-card-details')
  await expect(details).toHaveAttribute('open')
  const box = (await page.locator('.identity').boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const touch = await touchSession(page)

  await touch.down(start)
  await touch.move(start, { x: start.x, y: start.y - 40 })
  await touch.move({ x: start.x, y: start.y - 40 }, start)
  await touch.up()
  await expect(details).toHaveAttribute('open')
  await expect(page.locator('#selected-object-card')).not.toHaveAttribute('style', /clip-path/)

  await touch.swipe(start, { x: start.x, y: start.y - 150 })
  await expect(details).not.toHaveAttribute('open')
  await expect(page.locator('.object-card-footer')).toBeVisible()
  await expect(page.locator('#selected-object-card')).not.toHaveAttribute('style', /clip-path/)
})

test('swiping up scrolls the selected object card before it retracts it @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await page.setViewportSize({ width: 390, height: 500 })
  await openViewer(page)
  await page.locator('#object-specs-toggle').tap()
  const details = page.locator('#object-card-details')
  const body = page.locator('.object-card-body')
  const box = (await body.boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + box.height - 40 }
  const end = { x: start.x, y: start.y - 150 }
  const touch = await touchSession(page)
  await touch.swipe(start, end)
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect(details).toHaveAttribute('open')
  await body.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await touch.swipe(start, end)
  await expect(details).not.toHaveAttribute('open')
})

test('sliders inside a card keep their own touch handling @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await openViewer(page)
  await page.locator('#object-specs-toggle').tap()
  await page.locator('#distance-toggle').tap()
  const slider = page.locator('#distance-time-slider')
  await expect(slider).toBeVisible()
  const box = (await slider.boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const touch = await touchSession(page)
  await touch.down(start)
  await touch.move(start, { x: start.x - 110, y: start.y })
  await expect(page.locator('.is-step-peek')).toHaveCount(0)
  await touch.up()
  await expect(page.locator('#distance-card')).toBeVisible()
})

test('sideways swipes step through the selected object card sections, past greyed-out ones and never onto Compare @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await openViewer(page)
  await page.locator('#object-specs-toggle').tap()
  const expanded = page.locator('.object-section-button[aria-expanded="true"]')
  await expect(expanded).toHaveId('object-specs-toggle')
  await expect(page.locator('#object-system-toggle')).toBeEnabled()
  const box = (await page.locator('.object-card-body').boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + 60 }
  const left = { x: start.x - 130, y: start.y }
  const right = { x: start.x + 130, y: start.y }
  const touch = await touchSession(page)

  // A swipe taken back stays on its section.
  await touch.down(start)
  await touch.move(start, left)
  await touch.move(left, start)
  await touch.up()
  await expect(expanded).toHaveId('object-specs-toggle')

  await page.locator('#object-info-toggle').evaluate((button: HTMLButtonElement) => { button.disabled = true })
  await touch.swipe(start, left)
  await expect(expanded).toHaveId('object-system-toggle')
  await expect(page.locator('#object-system')).toBeVisible()
  await expect(page.locator('.object-card-body')).not.toHaveAttribute('style', /transform/)

  // The last section ends the sequence: Compare is not a section.
  await touch.swipe(start, left)
  await expect(expanded).toHaveId('object-system-toggle')
  await expect(page.locator('#object-compare-toggle')).toHaveAttribute('aria-pressed', 'false')

  await touch.swipe(start, right)
  await expect(expanded).toHaveId('object-specs-toggle')
  await expect(page.locator('#object-card-details')).toHaveAttribute('open')
})

test.describe('on a first touch visit', () => {
  const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 4173}`
  test.use({ storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'star-view-welcome-answered', value: 'true' }] }] } })

  test('the selected object card and then a detail card each show their swipes once, until OK or a swipe down @mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Real touch input')
    await openViewer(page)
    const card = page.locator('#selected-object-card')
    await page.locator('#object-specs-toggle').tap()
    const objectHint = card.locator('.swipe-hint')
    await expect(objectHint).toBeVisible()
    await expect(objectHint.locator('.swipe-hint-arrow')).toHaveCount(3)
    await expect(objectHint.locator('[data-direction="up"]')).toBeVisible()
    await expect(objectHint.locator('p[data-gesture="sideways"]')).toHaveText('Swipe left or right to switch tabs')
    // The up arrow and its line sit above OK.
    const upBottom = (await objectHint.locator('p[data-gesture="up"]').boundingBox())!
    expect(upBottom.y + upBottom.height).toBeLessThanOrEqual((await objectHint.getByRole('button', { name: 'OK' }).boundingBox())!.y)
    await expect(page.locator('.selected-object-content')).toHaveCSS('filter', 'blur(3px)')
    await expect(page.locator('.object-card-body')).toHaveCSS('visibility', 'hidden')
    await test.info().attach('Selected object swipe hint', { body: await page.screenshot(), contentType: 'image/png' })

    // The hint holds the card still until it is acknowledged.
    const box = (await objectHint.boundingBox())!
    const touch = await touchSession(page)
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await touch.swipe(start, { x: start.x - 130, y: start.y })
    await expect(page.locator('#object-specs-toggle')).toHaveAttribute('aria-expanded', 'true')
    await objectHint.getByRole('button', { name: 'OK' }).tap()
    await expect(objectHint).toHaveCount(0)
    await expect(page.locator('.selected-object-content')).toHaveCSS('filter', 'none')
    await expect(page.locator('.object-card-body')).toHaveCSS('visibility', 'visible')
    expect(await page.evaluate(() => localStorage.getItem('star-view-swipe-hint-object-card'))).toBe('seen')

    await page.locator('#mass-toggle').tap()
    const detailHint = page.locator('#mass-card .swipe-hint')
    await expect(detailHint).toBeVisible()
    await expect(detailHint.locator('[data-direction="down"]')).toBeVisible()
    await expect(detailHint.locator('[data-direction="up"]')).toHaveCount(0)
    await test.info().attach('Detail card swipe hint', { body: await page.screenshot(), contentType: 'image/png' })
    await expect(page.locator('#mass-card > .card-scroll-content')).toHaveCSS('visibility', 'hidden')
    // A swipe down acknowledges the hint instead of closing the card.
    const hintBox = (await detailHint.boundingBox())!
    const top = { x: hintBox.x + hintBox.width / 2, y: hintBox.y + 40 }
    await touch.swipe(top, { x: top.x, y: top.y + 150 })
    await expect(page.locator('.swipe-hint')).toHaveCount(0)
    await expect(page.locator('#mass-card')).toBeVisible()
    await expect(page.locator('#mass-card > .card-scroll-content')).toHaveCSS('visibility', 'visible')
    expect(await page.evaluate(() => localStorage.getItem('star-view-swipe-hint-detail-card'))).toBe('seen')

    await page.reload()
    await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
    await expect(page.locator('#star-name')).toHaveText('Sirius')
    await page.locator('#object-specs-toggle').tap()
    await page.locator('#mass-toggle').tap()
    await expect(page.locator('#mass-card')).toBeVisible()
    await expect(page.locator('.swipe-hint')).toHaveCount(0)
  })
})
