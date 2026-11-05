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

test('sideways swipes preview and open the neighbouring card, and can be taken back @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real touch input')
  await openMass(page)
  const touch = await touchSession(page)
  const start = await headerPoint(page, 'mass-card')
  const peek = page.locator('.card-swipe-title')
  const left = { x: start.x - 130, y: start.y }

  // Past the commit point the next title is in place, and moving back cancels.
  await touch.down(start)
  await touch.move(start, left)
  await expect(peek).toHaveText('Radius')
  await expect(peek).toHaveAttribute('data-armed')
  await touch.move(left, start)
  await expect(peek).not.toHaveAttribute('data-armed')
  await touch.up()
  await expect(peek).toBeHidden()
  await expect(page.locator('#mass-card')).toBeVisible()
  await expect(page.locator('#mass-card')).not.toHaveAttribute('style', /transform/)

  // Letting go early springs back too.
  await touch.swipe(start, { x: start.x - 30, y: start.y })
  await expect(page.locator('#mass-card')).toBeVisible()
  await expect(page.locator('#radius-card')).toBeHidden()

  await touch.swipe(start, left)
  await expect(page.locator('#radius-card')).toBeVisible()
  await expect(page.locator('#mass-card')).toBeHidden()
  await expect(peek).toBeHidden()
  await expect(page.locator('#mass-toggle')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#radius-toggle')).toHaveAttribute('aria-expanded', 'true')

  const radiusStart = await headerPoint(page, 'radius-card')
  await touch.swipe(radiusStart, { x: radiusStart.x + 130, y: radiusStart.y })
  await expect(page.locator('#mass-card')).toBeVisible()
  await expect(page.locator('#radius-card')).toBeHidden()
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
  await expect(page.locator('.card-swipe-title')).toBeHidden()
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
  await expect(page.locator('.card-swipe-title')).toHaveText('Close')
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
  await expect(page.locator('.card-swipe-title')).toBeHidden()
  await touch.up()
  await expect(page.locator('#distance-card')).toBeVisible()
})
