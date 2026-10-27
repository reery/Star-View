import { expect, test, type Page } from '@playwright/test'
import { openSpecs } from './support'

async function select(page: Page, name: string) {
  if (await page.locator('#magnitude-card').isVisible()) await page.locator('#magnitude-close').click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill(name)
  await page.getByRole('button', { name: `Select ${name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await openSpecs(page)
}

async function checkLabels(page: Page) {
  const issues = await page.locator('.magnitude-scale').evaluateAll((scales) => scales.flatMap((scale) => {
    const bounds = scale.getBoundingClientRect()
    const labels = [...scale.querySelectorAll<HTMLElement>('.magnitude-marker > span')].map((label) => label.getBoundingClientRect())
    const problems: string[] = []
    for (const [i, label] of labels.entries()) {
      if (label.left < bounds.left - 1 || label.right > bounds.right + 1) problems.push('label outside scale')
      for (const other of labels.slice(i + 1)) {
        if (label.left < other.right && label.right > other.left && label.top < other.bottom && label.bottom > other.top) problems.push('overlapping labels')
      }
    }
    return problems
  }))
  expect(issues).toEqual([])
}

test('opens one magnitude card from either row and shows readable visual scales', { tag: '@mobile' }, async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await openSpecs(page)
  await page.locator('#apparent-mag-label').hover()
  const highlight = await page.locator('#magnitude-row').evaluate((row) => ({
    height: row.getBoundingClientRect().height,
    highlightHeight: Number.parseFloat(getComputedStyle(row.querySelector('button')!, '::before').height),
  }))
  expect(highlight.highlightHeight).toBeCloseTo(highlight.height + 2, 3)
  await page.locator('#apparent-mag-label').click()
  const card = page.locator('#magnitude-card')
  await expect(card).toBeVisible()
  await expect(page.locator('#magnitude-toggle')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#magnitude-absolute-value')).toHaveText('+1.42')
  await expect(page.locator('#magnitude-apparent-value')).toHaveText('−1.47')
  await expect(page.locator('#magnitude-visible-comparison')).toHaveText('23.1× the Sun’s visible brightness')
  await expect(page.locator('#magnitude-visible-comparison')).toBeVisible()
  await expect(page.locator('#magnitude-absolute-scale')).toHaveAttribute('aria-label', /Sun: \+4.83; Sirius A, selected: \+1.42/)
  await expect(page.locator('#magnitude-apparent-scale')).not.toHaveAttribute('aria-label', /Sun/)
  await expect(page.locator('#magnitude-apparent-scale')).toHaveAttribute('aria-label', /Nighttime scale: fainter \+16 to brighter −6/)
  await expect(page.locator('#magnitude-apparent-scale [data-object-id="sun"]')).toHaveCount(0)
  await expect(page.locator('#magnitude-apparent-scale .magnitude-scale-break')).toHaveCount(0)
  await expect(page.locator('#magnitude-apparent-scale .magnitude-visible-band')).toBeVisible()
  await expect(page.locator('#magnitude-apparent-scale [data-object-id="sirius-a"]')).toHaveCount(1)
  await expect(page.locator('#magnitude-apparent-scale [data-object-id="venus"]')).toHaveText('Venus −4.9')
  await checkLabels(page)
  const hierarchy = await card.evaluate((element) => ({
    bottom: element.getBoundingClientRect().bottom,
    viewportHeight: window.innerHeight,
    valueSize: getComputedStyle(element.querySelector('#magnitude-absolute-value')!).fontSize,
    headingSize: getComputedStyle(element.querySelector('#magnitude-absolute-heading')!).fontSize,
    headingWeight: getComputedStyle(element.querySelector('#magnitude-absolute-heading')!).fontWeight,
    trackHeight: element.querySelector('.mass-ratio-track')!.getBoundingClientRect().height,
  }))
  expect(hierarchy.bottom).toBeLessThanOrEqual(hierarchy.viewportHeight)
  expect(hierarchy.valueSize).toBe('28px')
  expect(hierarchy.headingSize).toBe('18px')
  expect(hierarchy.headingWeight).toBe('700')
  const luminosityTrackHeight = await page.locator('.luminosity-scale .mass-ratio-track').first().evaluate((track) => Number.parseFloat(getComputedStyle(track).height))
  expect(hierarchy.trackHeight).toBe(luminosityTrackHeight)
  for (const kind of ['absolute', 'apparent']) {
    await expect(page.locator(`#magnitude-${kind}-icon svg`)).toBeVisible()
    const edges = await page.locator(`#magnitude-${kind}-scale`).evaluate((scale) => {
      const track = scale.querySelector('.mass-ratio-track')!.getBoundingClientRect()
      return ['faint', 'bright'].map((suffix) => {
        const endpoint = scale.querySelector(`[id$="-${suffix}"]`)!
        const lines = [...endpoint.children].map((line) => line.getBoundingClientRect())
        const edge = endpoint.getBoundingClientRect()
        return { count: lines.length, stacked: lines.length === 2 && lines[1]!.top > lines[0]!.top,
          aboveBar: edge.bottom < track.top,
          atEdge: suffix === 'faint' ? Math.abs(edge.left - track.left) < 1 : Math.abs(edge.right - track.right) < 1,
          text: endpoint.textContent }
      })
    })
    for (const edge of edges) {
      expect(edge.count).toBe(2)
      expect(edge.stacked).toBe(true)
      expect(edge.aboveBar).toBe(true)
      expect(edge.atEdge).toBe(true)
      expect(edge.text).not.toContain('·')
    }
  }
  const band = await card.evaluate((element) => {
    const key = getComputedStyle(element.querySelector('.magnitude-visibility-button[aria-pressed="true"]')!)
    const band = element.querySelector('.magnitude-visible-band')!
    const fill = getComputedStyle(band)
    return { keyColor: key.color, gradient: fill.backgroundImage,
      fadeEnd: fill.getPropertyValue('--magnitude-visibility-fade-end'),
      height: band.getBoundingClientRect().height,
      trackHeight: band.parentElement!.getBoundingClientRect().height }
  })
  expect(band.height).toBe(hierarchy.trackHeight)
  expect(band.trackHeight).toBe(hierarchy.trackHeight)
  expect(band.gradient).toContain(band.keyColor)
  expect(band.gradient).toContain('rgba(0, 0, 0, 0)')
  expect(Number.parseFloat(band.fadeEnd)).toBeCloseTo(100 / 6, 3)
  const visibility = page.getByRole('group', { name: 'Visibility guide', exact: true })
  await expect(visibility.getByRole('button')).toHaveCount(5)
  await expect(visibility.getByRole('button').first()).toHaveAttribute('data-visibility', 'city')
  await expect(visibility.getByRole('button').nth(1)).toHaveAttribute('data-visibility', 'eye')
  const absoluteScaleBefore = await page.locator('#magnitude-absolute-scale').getAttribute('aria-label')
  const brightness = await page.locator('#magnitude-absolute-scale .mass-ratio-track').evaluate((track) => getComputedStyle(track).backgroundImage)
  const luminosityBrightness = await page.locator('.luminosity-scale .mass-ratio-track').evaluate((track) => getComputedStyle(track).backgroundImage)
  expect(brightness).toBe(luminosityBrightness)
  expect(brightness).toContain('255, 255, 255')
  const glow = await page.locator('#magnitude-absolute-scale .mass-ratio-track').evaluate((track) => {
    const style = getComputedStyle(track, '::before')
    return { content: style.content, background: style.backgroundImage, filter: style.filter }
  })
  const luminosityGlow = await page.locator('.luminosity-scale .mass-ratio-track').evaluate((track) => {
    const style = getComputedStyle(track, '::before')
    return { content: style.content, background: style.backgroundImage, filter: style.filter }
  })
  expect(glow).toEqual(luminosityGlow)
  expect(glow.filter).toBe('blur(5px)')
  for (const [id, name, limit, faint, fadeWidth] of [
    ['city', 'City sky', 4.5, 16, 0.5],
    ['binoculars', 'Binoculars', 10, 16, 2], ['telescope', 'Telescope', 13, 16, 2],
    ['observatory', 'Observatory', 27, 28, 2], ['eye', 'Naked eye', 6, 16, 2],
  ] as const) {
    const button = visibility.getByRole('button', { name: `${name} visibility (about +${limit})`, exact: true })
    await expect(button.locator('svg')).toBeVisible()
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(visibility.locator('[aria-pressed="true"]')).toHaveCount(1)
    await expect(page.locator(`#magnitude-${id}-tooltip`)).toBeVisible()
    await expect(page.locator('#magnitude-apparent-scale')).toHaveAttribute('aria-label', new RegExp(`${name} brightness band: approximately \\+${limit}`))
    await expect(page.locator('#magnitude-apparent-faint')).toHaveText(`Fainter+${faint}`)
    const start = await page.locator('.magnitude-visible-band').evaluate((element) => parseFloat((element as HTMLElement).style.left))
    expect(start).toBeCloseTo((faint - limit) / (faint + 6) * 100, 3)
    const fade = await page.locator('.magnitude-visible-band').evaluate((element) => parseFloat((element as HTMLElement).style.getPropertyValue('--magnitude-visibility-fade-end')))
    expect(fade).toBeCloseTo(fadeWidth / (limit + 6) * 100, 3)
    const tooltipBox = (await page.locator(`#magnitude-${id}-tooltip`).boundingBox())!
    const cardBox = (await card.boundingBox())!
    expect(tooltipBox.x).toBeGreaterThanOrEqual(cardBox.x)
    expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width)
    // The top layer keeps the tooltip whole below the button, even past the card's bottom edge.
    expect(tooltipBox.y).toBeGreaterThan((await button.boundingBox())!.y)
    expect(await page.locator(`#magnitude-${id}-tooltip`).evaluate((element) => element.matches(':popover-open'))).toBe(true)
    await expect(page.locator('#magnitude-absolute-scale')).toHaveAttribute('aria-label', absoluteScaleBefore!)
    await expect(page.locator('#magnitude-apparent-value')).toHaveText('−1.47')
    await checkLabels(page)
  }
  await page.locator('#magnitude-absolute-value').click()
  const lock = page.getByRole('button', { name: 'Keep Magnitude open', exact: true })
  await expect(lock).toHaveAttribute('aria-pressed', 'false')
  const lockBounds = (await lock.boundingBox())!
  const closeBounds = (await page.locator('#magnitude-close').boundingBox())!
  expect(lockBounds.x + lockBounds.width).toBeLessThanOrEqual(closeBounds.x + 1)
  await page.screenshot({ path: testInfo.outputPath('magnitude-card.png') })
  await card.screenshot({ path: testInfo.outputPath('magnitude-card-detail.png') })
  const interactWithScene = async () => {
    const viewport = page.viewportSize()!
    await page.mouse.move(viewport.width / 2, viewport.height - 110)
    await page.mouse.down()
    await page.mouse.move(viewport.width / 2 + 20, viewport.height - 100, { steps: 3 })
    await page.mouse.up()
  }
  await lock.click()
  await expect(lock).toHaveAttribute('aria-pressed', 'true')
  await interactWithScene()
  await expect(card).toBeVisible()
  await page.locator('#magnitude-close').click()
  await expect(card).toBeHidden()
  if (isMobile) {
    // Touch scene interactions collapse Specs, hiding the focus-return target.
    await expect(page.locator('#object-specs')).toBeHidden()
    await openSpecs(page)
  } else await expect(page.locator('#magnitude-toggle')).toBeFocused()
  await page.locator('#magnitude-toggle').press('Enter')
  await expect(card).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()
  await expect(page.locator('#magnitude-toggle')).toBeFocused()
  await page.locator('#magnitude-row dt span').first().click()
  await expect(card).toBeVisible()
  await lock.click()
  await expect(lock).toHaveAttribute('aria-pressed', 'false')
  await interactWithScene()
  await expect(card).toBeHidden()
  await openSpecs(page)
  await page.locator('#magnitude-row dt span').first().click()
  await expect(card).toBeVisible()
  // Detail cards cover the inspector on a narrow screen, so use its close control first.
  if (isMobile) await page.locator('#magnitude-close').click()
  await page.locator('#luminosity-toggle').click()
  await expect(card).toBeHidden()
  await expect(page.locator('#luminosity-card')).toBeVisible()
  if (isMobile) await page.locator('#luminosity-close').click()
  await page.locator('#magnitude-toggle').click()
  await expect(page.locator('#luminosity-card')).toBeHidden()
  await expect(card).toBeVisible()
  expect(errors).toEqual([])
})

test('remembers city visibility across selections and reloads, with naked eye as the default', { tag: '@mobile' }, async ({ page }, testInfo) => {
  const ready = async () => {
    await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
    await openSpecs(page)
    await page.locator('#magnitude-toggle').click()
    await expect(page.locator('#magnitude-card')).toBeVisible()
  }
  await page.goto('/')
  await ready()
  const city = page.locator('[data-visibility="city"]')
  const eye = page.locator('[data-visibility="eye"]')
  await expect(eye).toHaveAttribute('aria-pressed', 'true')
  await expect(city).toHaveAttribute('aria-pressed', 'false')
  const apparent = await page.locator('#magnitude-apparent-value').textContent()
  const absolute = await page.locator('#magnitude-absolute-scale').getAttribute('aria-label')
  await city.click()
  await expect(city).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#magnitude-apparent-scale')).toHaveAttribute('aria-label', /fading between \+4 and \+4.5/)
  await expect(page.locator('#magnitude-apparent-value')).toHaveText(apparent!)
  await expect(page.locator('#magnitude-absolute-scale')).toHaveAttribute('aria-label', absolute!)
  expect(await page.evaluate(() => localStorage.getItem('star-view-magnitude-city'))).toBe('true')
  // Move focus off the tooltip for an unobstructed visual reference.
  await page.locator('#magnitude-apparent-value').click()
  await page.locator('#magnitude-card').screenshot({ path: testInfo.outputPath('magnitude-city.png') })
  await select(page, 'Sun')
  await page.locator('#magnitude-toggle').click()
  await expect(city).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await ready()
  await expect(city).toHaveAttribute('aria-pressed', 'true')
  await eye.click()
  expect(await page.evaluate(() => localStorage.getItem('star-view-magnitude-city'))).toBe('false')
  await page.reload()
  await ready()
  await expect(eye).toHaveAttribute('aria-pressed', 'true')
})

test('compares a non-Sun origin, merges identical roles and follows selection and color settings', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await openSpecs(page)
  await page.locator('#set-origin').click()
  await page.locator('#magnitude-toggle').click()
  await expect(page.locator('#magnitude-absolute-scale [data-origin="true"]')).toHaveText('Sirius A · origin')
  await select(page, 'Proxima Centauri')
  await page.getByRole('button', { name: 'Show Alpha Centauri C (Proxima Centauri)', exact: true }).click()
  await page.locator('#magnitude-toggle').click()
  await expect(page.locator('#magnitude-absolute-scale [data-origin="true"]')).toHaveText('Sirius A · origin +1.42')
  await expect(page.locator('#magnitude-apparent-scale [data-origin="true"]')).toHaveCount(1)
  await expect(page.locator('#magnitude-apparent-value')).toHaveText('+11.1')
  await expect(page.locator('#magnitude-visible-comparison')).toHaveText('1/19,100 of the Sun’s visible brightness')
  await checkLabels(page)
  await page.screenshot({ path: testInfo.outputPath('magnitude-origin-comparison.png') })
  const selected = page.locator('#magnitude-absolute-scale .magnitude-selected')
  const exaggerated = await selected.evaluate((marker) => getComputedStyle(marker).backgroundColor)
  await page.getByRole('button', { name: 'Preferences', exact: true }).click()
  await page.locator('#star-colors-real').check()
  const real = await selected.evaluate((marker) => getComputedStyle(marker).backgroundColor)
  expect(real).not.toBe(exaggerated)
  await expect(page.locator('#magnitude-apparent-value')).toHaveText('+11.1')
  await page.getByRole('button', { name: 'Preferences', exact: true }).click()
  await page.locator('#object-info-toggle').click()
  await expect(page.locator('#magnitude-card')).toBeHidden()
})
