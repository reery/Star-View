import { expect, test, type Page } from '@playwright/test'

async function openGlossary(page: Page) {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.locator('#glossary-toggle').click()
  await expect(page.locator('[data-glossary-id]')).toHaveCount(167)
}

const openGroup = (page: Page, name: string) => page.locator('#glossary-terms summary', { hasText: new RegExp(`^${name}`) }).click()
const term = (page: Page, id: string) => page.locator(`[data-glossary-id="${id}"]`)

test('opens on a text overview with collapsed groups and loads nothing for articles yet', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await openGlossary(page)
  await expect(page.locator('#glossary-term-heading')).toHaveText('Start here')
  await expect(page.locator('#glossary-article img')).toHaveCount(0)
  await expect(page.locator('#glossary-source')).toBeHidden()
  await expect(page.locator('#glossary-terms summary')).toHaveCount(14)
  await expect(page.locator('#glossary-terms summary').first()).toContainText('Stars')
  await expect(term(page, 'parsec')).toBeHidden()
  expect(requests.filter((url) => /glossary-articles|\.(jpg|svg)$/.test(url))).toEqual([])
})

test('typing updates the list only; Enter or a click opens the article', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await openGlossary(page)
  const search = page.locator('#glossary-search')
  for (const text of ['b', 'bl', 'black', 'black hole']) {
    await search.fill(text)
  }
  await expect(page.locator('#glossary-terms [data-glossary-id]').first()).toHaveText('Black hole')
  await expect(page.locator('#glossary-terms summary')).toHaveCount(0)
  await expect(page.locator('#glossary-term-heading')).toHaveText('Start here')
  expect(requests.filter((url) => /glossary-articles|\.(jpg|svg)$/.test(url))).toEqual([])
  await search.press('Enter')
  await expect(page.locator('#glossary-term-heading')).toHaveText('Black hole')
  await expect(page.locator('#glossary-article img').first()).toBeVisible()
  await search.fill('zzzz')
  await expect(page.locator('#glossary-empty')).toBeVisible()
  await expect(page.locator('#glossary-term-heading')).toHaveText('Black hole')
  await search.fill('')
  await expect(page.locator('#glossary-terms summary')).toHaveCount(14)
  await expect(term(page, 'black_hole')).toBeVisible()
  await expect(term(page, 'black_hole')).toHaveAttribute('aria-current', 'true')
})

test('keeps the title in place while the article scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 500 })
  await openGlossary(page)
  await openGroup(page, 'Stars')
  await term(page, 'star').click()
  await expect(page.locator('#glossary-article img').first()).toBeVisible()
  const before = (await page.locator('#glossary-term-heading').boundingBox())!
  const content = page.locator('#glossary-content')
  await content.evaluate((node) => { node.scrollTop = node.scrollHeight })
  expect(await content.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  expect(await page.locator('#glossary-term-heading').boundingBox()).toEqual(before)
  await term(page, 'sun').click()
  expect(await content.evaluate((node) => node.scrollTop)).toBe(0)
})

test('follows links between terms and returns along the same path', async ({ page }) => {
  await openGlossary(page)
  const heading = page.locator('#glossary-term-heading')
  const back = page.locator('#glossary-back')
  await page.locator('#glossary-related [data-glossary-link="parallax"]').click()
  await expect(heading).toHaveText('Parallax')
  await expect(back).toBeHidden()
  await expect(term(page, 'parallax')).toBeVisible()
  await expect(page.locator('#glossary-related')).toContainText('Gaia')
  await page.locator('#glossary-related [data-glossary-link="parsec"]').click()
  await expect(heading).toHaveText('Parsec')
  await expect(back).toHaveAccessibleName('Back to Parallax')
  await back.click()
  await expect(heading).toHaveText('Parallax')
  await expect(back).toBeHidden()
})

test('the sidebar can be collapsed, and searching brings it back', async ({ page }) => {
  await openGlossary(page)
  const terms = page.locator('#glossary-terms')
  await page.locator('#glossary-sidebar').click()
  await expect(terms).toBeHidden()
  await page.locator('#glossary-search').click()
  await expect(terms).toBeVisible()
})

test('property labels and card titles open their term, and row labels still open cards', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.locator('#object-specs-toggle').click()
  await page.locator('#temperature-row dt').click()
  await expect(page.locator('#temperature-card')).toBeVisible()
  await page.locator('#temperature-heading button').click()
  await expect(page.locator('#glossary-panel')).toBeVisible()
  await expect(page.locator('#glossary-term-heading')).toHaveText('Effective temperature')
  await expect(page.locator('#glossary-related')).toBeVisible()
  await page.locator('[data-glossary-term="age"]').click()
  await expect(page.locator('#glossary-term-heading')).toHaveText('Stellar age')
  await expect(term(page, 'age')).toBeVisible()
})

test('a failed article download offers recovery and keeps the definition', async ({ page }) => {
  await page.route(/\/glossary-articles-distance-[^/]+\.js$/, (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
  await openGlossary(page)
  await page.locator('#glossary-related [data-glossary-link="parallax"]').click()
  await expect(page.locator('#glossary-lead')).toContainText('small shift')
  const recovery = page.locator('#glossary-content .load-recovery[role="alert"]')
  await expect(recovery).toContainText('Could not load Parallax')
  await expect(recovery.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  // Another term does not inherit the failure.
  await page.locator('#glossary-search').fill('black hole')
  await page.locator('#glossary-search').press('Enter')
  await expect(page.locator('#glossary-term-heading')).toHaveText('Black hole')
  await expect(recovery).toHaveCount(0)
  await expect(page.locator('#glossary-source')).toBeVisible()
})

test('sections, the collapsed extra part and an interactive diagram all render, and the diagram loads only when needed', async ({ page }) => {
  const widgetRequests: string[] = []
  page.on('request', (request) => { if (/glossary-widget-/.test(request.url())) widgetRequests.push(request.url()) })
  await openGlossary(page)
  await openGroup(page, 'Stellar properties')
  await term(page, 'radius').click()
  await expect(page.locator('#glossary-article h4').first()).toBeVisible()
  await expect(page.locator('.glossary-widget')).toHaveCount(0)
  expect(widgetRequests).toEqual([])
  await term(page, 'temperature').click()
  const widget = page.locator('.glossary-widget')
  await expect(widget.locator('svg')).toBeVisible()
  expect(widgetRequests.some((url) => url.includes('temperature'))).toBe(true)
  await expect(widget.locator('dd').first()).toHaveText('G')
  await widget.locator('input[type="range"]').fill('0.95')
  await expect(widget.locator('dd').first()).toHaveText('O')
  const deeper = page.locator('.glossary-deeper')
  await expect(deeper.locator('p')).toBeHidden()
  await deeper.locator('summary').click()
  await expect(deeper.locator('p')).toContainText('15 million K')
})

const WIDGET_TERMS = [['parsec', 'Distance & size'], ['apparent-magnitude', 'Light & brightness'], ['eccentricity', 'Motion & orbits'], ['inclination', 'Motion & orbits'], ['subtype-eclipsing-binary', 'Double & multiple stars'], ['subtype-ellipsoidal-variable', 'Double & multiple stars'],
  ['subtype-rotating-variable', 'Variable stars'], ['subtype-pulsating-variable', 'Variable stars'], ['hr-diagram', 'Spectra'], ['stellar-evolution', 'Star lives'], ['habitable-zone', 'Planets'], ['doppler-effect', 'Spectra'], ['apparent-size', 'Distance & size'], ['right-ascension', 'Sky & coordinates']] as const

test('every interactive diagram opens and responds to its controls without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openGlossary(page)
  const search = page.locator('#glossary-search')
  for (const [id] of WIDGET_TERMS) {
    await search.fill(id.replace('subtype-', '').replace(/-/g, ' '))
    await term(page, id).click()
    const widget = page.locator('.glossary-widget')
    await expect(widget.locator('.range-filter, .glossary-widget-choices').first()).toBeVisible()
    const sliders = widget.locator('input[type="range"]')
    if (await sliders.count()) await sliders.first().fill('0.6')
    else await widget.locator('.glossary-widget-choices button').last().click()
  }
  expect(errors).toEqual([])
})

test('diagram geometry: bodies stay on the paths drawn for them', async ({ page }) => {
  await openGlossary(page)
  const search = page.locator('#glossary-search')
  const widget = page.locator('.glossary-widget')

  await search.fill('parsec')
  await term(page, 'parsec').click()
  await expect(widget.locator('input[type="range"]').first()).toBeVisible()
  for (const position of ['0', '0.13', '0.25', '0.4', '0.75', '0.9']) {
    await widget.locator('input[type="range"]').first().fill(position)
    const { fromSun, radius, offLine } = await widget.locator('svg').evaluate((svg) => {
      const at = (selector: string) => svg.querySelector(selector)!
      const earth = at('.gw-earth'), sun = at('.gw-sun'), orbit = at('.gw-orbit'), star = at('.gw-star'), sight = at('.gw-guide')
      const number = (element: Element, name: string) => Number(element.getAttribute(name))
      const dx = number(sight, 'x2') - number(sight, 'x1'), dy = number(sight, 'y2') - number(sight, 'y1')
      // The sight line must run from Earth through the nearby star.
      const offLine = Math.abs(dx * (number(star, 'cy') - number(sight, 'y1')) - dy * (number(star, 'cx') - number(sight, 'x1'))) / Math.hypot(dx, dy)
      return { fromSun: Math.hypot(number(earth, 'cx') - number(sun, 'cx'), number(earth, 'cy') - number(sun, 'cy')), radius: number(orbit, 'r'), offLine }
    })
    expect(fromSun).toBeCloseTo(radius, 3)
    expect(offLine).toBeLessThan(0.01)
  }

  // A tidally stretched star is widest and brightest with its companion off to the side.
  await search.fill('ellipsoidal')
  await term(page, 'subtype-ellipsoidal-variable').click()
  await expect(widget.locator('input[type="range"]').first()).toBeVisible()
  const stretched = async (phase: string) => {
    await widget.locator('input[type="range"]').first().fill(phase)
    return widget.locator('svg').evaluate((svg) => ({ width: Number(svg.querySelector('ellipse')!.getAttribute('rx')), curveY: Number(svg.querySelector('.gw-marker-solid')!.getAttribute('cy')) }))
  }
  const aligned = await stretched('0'), sideOn = await stretched('0.25')
  expect(sideOn.width).toBeGreaterThan(aligned.width)
  expect(sideOn.curveY).toBeLessThan(aligned.curveY)

  for (const id of ['eccentricity', 'inclination']) {
    await search.fill(id)
    await term(page, id).click()
    await expect(widget.locator('input[type="range"]').first()).toBeVisible()
    for (const position of ['0', '0.2', '0.5', '0.8']) {
      await widget.locator('input[type="range"]').first().fill(position)
      const offPath = await widget.locator('svg').evaluate((svg) => {
        const path = svg.querySelector('.gw-orbit-path')!, body = svg.querySelector('.gw-earth')!
        const number = (element: Element, name: string) => Number(element.getAttribute(name))
        return Math.abs(((number(body, 'cx') - number(path, 'cx')) / number(path, 'rx')) ** 2 + ((number(body, 'cy') - number(path, 'cy')) / number(path, 'ry')) ** 2 - 1)
      })
      expect(offPath).toBeLessThan(0.001)
    }
  }
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('a card title opens its term in view, closing the card that would cover it', { tag: '@mobile' }, async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
    await page.locator('#object-specs-toggle').tap()
    await page.locator('#temperature-toggle').tap()
    await page.locator('#temperature-heading button').tap()
    await expect(page.locator('#temperature-card')).toBeHidden()
    await expect(page.locator('#glossary-term-heading')).toHaveText('Effective temperature')
    await expect(page.locator('#glossary-term-heading')).toBeInViewport()
  })

  test('is one sliding card: the list covers most of it, the article slides in with a way back', { tag: '@mobile' }, async ({ page }) => {
    await openGlossary(page)
    const panel = (await page.locator('#glossary-panel').boundingBox())!
    const list = page.locator('#glossary-terms')
    const heading = page.locator('#glossary-term-heading')
    const back = page.locator('#glossary-back')
    const listBounds = (await list.boundingBox())!
    expect(listBounds.width / panel.width).toBeGreaterThan(0.7)
    // The article peeks past the list and runs under the card's right border.
    const peek = (await page.locator('#glossary-detail').boundingBox())!
    expect(Math.abs(peek.x - (listBounds.x + listBounds.width))).toBeLessThanOrEqual(1)
    expect(peek.x + peek.width).toBeGreaterThan(panel.x + panel.width)

    await openGroup(page, 'Distance & size')
    await term(page, 'parsec').tap()
    await expect(heading).toHaveText('Parsec')
    await expect(list).not.toBeInViewport({ ratio: 0.5 })
    const reading = (await page.locator('#glossary-detail').boundingBox())!
    // The card's 1px border stays outside the sliding panes.
    expect(Math.abs(reading.x - panel.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(reading.width - panel.width)).toBeLessThanOrEqual(2.5)
    await expect(back).toBeVisible()
    const backBounds = (await back.boundingBox())!, titleBounds = (await heading.boundingBox())!
    expect(backBounds.x + backBounds.width).toBeLessThanOrEqual(titleBounds.x)

    await page.locator('#glossary-article [data-glossary-link="parallax"]').first().tap()
    await expect(heading).toHaveText('Parallax')
    await back.tap()
    await expect(heading).toHaveText('Parsec')
    await back.tap()
    expect((await list.boundingBox())!.x).toBeCloseTo(listBounds.x, 0)
    await expect(term(page, 'parsec')).toBeVisible()
    await expect(page.locator('#glossary-detail')).toHaveJSProperty('inert', true)

    // Tapping the part of the article that peeks past the list returns to it.
    const peeking = (await page.locator('#glossary-detail').boundingBox())!
    await page.touchscreen.tap(peeking.x + 30, peeking.y + 120)
    await expect(page.locator('#glossary-detail')).toHaveJSProperty('inert', false)
    expect(Math.abs((await page.locator('#glossary-detail').boundingBox())!.x - panel.x)).toBeLessThanOrEqual(1)
    await page.locator('#glossary-search').tap()
    expect((await list.boundingBox())!.x).toBeCloseTo(listBounds.x, 0)
  })
})
