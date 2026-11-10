import { readFileSync } from 'node:fs'
import { expect, test, type Locator } from '@playwright/test'
import { PNG } from 'pngjs'
import { openFilter, openPreferences, openSpecs, openViewer, selectObject, zoomViewer } from './support'

test('persists constellation latitude across reloads and ignores unsupported stored values', async ({ page }) => {
  await openViewer(page)
  await page.evaluate(() => localStorage.setItem('star-view-constellation-latitude', '999'))
  await openSpecs(page)
  await page.locator('#constellation-toggle').click()
  const latitude = page.locator('#constellation-latitude')
  await expect(latitude).toHaveValue('40')
  await latitude.selectOption('-30')
  const months = await page.locator('#constellation-visibility-months').getAttribute('aria-label')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('star-view-constellation-latitude'))).toBe('-30')
  await openViewer(page)
  await openSpecs(page)
  await page.locator('#constellation-toggle').click()
  await expect(latitude).toHaveValue('-30')
  await expect(page.locator('#constellation-visibility-months')).toHaveAttribute('aria-label', months!)
})

test('resets planet and moon rotation when reopened while preserving comparison toggles', async ({ page }) => {
  await openViewer(page)
  await selectObject(page, 'Sun')
  await page.locator('#object-system-toggle').click()
  const planet = page.locator('.planet-row[data-planet-id="jupiter"] button')
  await planet.click()
  const globe = page.locator('#planet-globe')
  await expect(globe).toHaveAttribute('data-texture-ready', 'true')
  const snapshot = async (canvas: Locator) => {
    await canvas.evaluate((element) => (element as HTMLElement).blur())
    return canvas.screenshot({ style: '.tooltip { visibility: hidden !important; }' })
  }
  const initial = await snapshot(globe)
  await globe.focus()
  await page.keyboard.press('ArrowRight')
  const rotated = await snapshot(globe)
  expect(rotated.equals(initial)).toBe(false)
  await page.locator('#planet-add-earth').click()
  await expect(globe).toHaveAttribute('data-earth-texture-ready', 'true')
  await page.locator('#planet-add-earth').click()
  await expect.poll(async () => (await snapshot(globe)).equals(rotated)).toBe(true)
  await page.locator('#planet-info-toggle').click()
  await page.locator('#planet-specs-toggle').click()
  await expect.poll(async () => (await snapshot(globe)).equals(initial)).toBe(true)
  await globe.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await snapshot(globe)).equals(initial)).toBe(false)
  await page.keyboard.press('Escape')
  await planet.click()
  // A reopened globe is a fresh renderer, so a few edge pixels may differ; a rotation changes nearly all of them.
  const nearly = (first: Buffer, second: Buffer) => {
    const [a, b] = [PNG.sync.read(first).data, PNG.sync.read(second).data]
    return a.reduce((changed, value, index) => changed + Number(value !== b[index]), 0) / a.length < 0.02
  }
  await expect.poll(async () => nearly(await snapshot(globe), initial)).toBe(true)

  await page.locator('#planet-moons-toggle').click()
  // Lists start at the innermost moon, which may have no globe map.
  await page.locator('.moon-row[data-moon-id="io"] button').click()
  const moon = page.locator('#planet-moon-globe')
  await expect(moon).toHaveAttribute('data-planet-id', 'io')
  await expect(moon).toHaveAttribute('data-texture-ready', 'true')
  const initialMoon = await snapshot(moon)
  await moon.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await snapshot(moon)).equals(initialMoon)).toBe(false)
  await page.locator('#planet-specs-toggle').click()
  await page.locator('#planet-moons-toggle').click()
  await expect.poll(async () => (await snapshot(moon)).equals(initialMoon)).toBe(true)
  await moon.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await snapshot(moon)).equals(initialMoon)).toBe(false)
  await page.locator('.moon-row[data-moon-id="io"] button').click()
  await expect.poll(async () => (await snapshot(moon)).equals(initialMoon)).toBe(true)
})

test('spends a small label budget on stars before nebulae and molecular clouds', async ({ page }) => {
  const nebulaIds = new Set<string>(JSON.parse(readFileSync(new URL('../src/data/overlays/nebulae/objects.json', import.meta.url), 'utf8')).objects.map(({ id }: { id: string }) => id))
  await openViewer(page)
  await openPreferences(page)
  await page.locator('#label-limit').fill('20')
  await openFilter(page)
  await page.getByRole('switch', { name: 'Western constellation stars', exact: true }).check()
  await page.getByRole('switch', { name: 'Interstellar medium', exact: true }).check()
  await page.getByLabel('Object visibility distance', { exact: true }).fill('20')
  await expect(page.locator('.projected-labels')).toHaveAttribute('data-molecular-cloud-puff-count', /[1-9]\d*/)
  await expect(page.locator('.projected-labels')).toHaveAttribute('data-nebula-puff-count', /[1-9]\d*/)
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await zoomViewer(page, 'out', 12)
  const labels = page.locator('.projected-labels [data-star-id]')
  await expect(labels).toHaveCount(20)
  await expect(page.locator('.projected-labels [data-star-id^="cahlon-cloud-"]')).toHaveCount(0)
  const labelledIds = await labels.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('data-star-id')))
  expect(labelledIds.filter((id) => nebulaIds.has(id!))).toEqual([])
  await selectObject(page, 'Taurus Molecular Cloud')
  await expect(page.locator('[data-star-id="cahlon-cloud-22"] .star-label')).toBeVisible()
})

test('shows the visibility cone only when asked and remembers the chosen hours', async ({ page }) => {
  await openViewer(page)
  const scene = page.locator('#scene')
  await expect(scene).toHaveAttribute('data-visibility-cone-visible', 'false')
  await openPreferences(page)
  const slider = page.locator('#visibility-cone-mode')
  await expect(slider).toHaveValue('0')
  await expect(page.locator('#visibility-cone-mode-value')).toHaveText('Off')
  await slider.fill('7')
  await expect(page.locator('#visibility-cone-mode-value')).toHaveText('4–6')
  await expect(slider).toHaveAttribute('aria-valuetext', '4–6')
  await expect(scene).toHaveAttribute('data-visibility-cone-visible', 'true')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('star-view-visibility-cone-mode'))).toBe('4-6')
  await openViewer(page)
  await expect(scene).toHaveAttribute('data-visibility-cone-visible', 'true')
  await expect(slider).toHaveValue('7')
})

test('explains settings in tooltips while their labels keep working', async ({ page }) => {
  await openViewer(page)
  await openPreferences(page)
  const tooltip = page.locator('#oort-cloud-visible-tooltip')
  const open = (locator: Locator) => locator.evaluate((element) => element.matches(':popover-open'))
  const label = page.locator('label[for="oort-cloud-visible"] .mass-metric-help')
  await label.hover()
  expect(await open(tooltip)).toBe(true)
  await expect(tooltip).toContainText('200,000 au')
  const toggle = page.locator('#oort-cloud-visible')
  await label.click()
  await expect(toggle).not.toBeChecked()
  await page.mouse.move(0, 0)
  expect(await open(tooltip)).toBe(false)
  // The keyboard reaches the switch, not its label text; only keyboard focus opens the tooltip.
  await page.locator('#milky-way-visible').focus()
  await page.keyboard.press('Tab')
  await expect(toggle).toBeFocused()
  expect(await open(tooltip)).toBe(true)
  await page.keyboard.press('Shift+Tab')
  expect(await open(tooltip)).toBe(false)
  // Labels without a control of their own use a focusable help button.
  await page.locator('#star-colors-label').focus()
  expect(await open(page.locator('#star-colors-tooltip'))).toBe(true)
  await expect(page.getByRole('group', { name: 'Colors', exact: true })).toBeVisible()
  await expect(page.getByLabel('Earth’s orbit', { exact: true })).toBeVisible()
})

test('explains filter settings in tooltips while their labels keep working', async ({ page }) => {
  await openViewer(page)
  await openFilter(page)
  const open = (locator: Locator) => locator.evaluate((element) => element.matches(':popover-open'))
  const tips = [
    ['catalog-range', 'closest to the Sun'],
    ['show-western-constellation-stars', 'constellation figures'],
    ['show-naked-eye-stars', 'magnitude 6.5'],
    ['show-notable-distant-stars', 'companions of pulsars'],
    ['category-compact_objects', 'black holes'],
    ['category-interstellar_medium', 'H II regions'],
    ['category-stellar_remnants', 'planetary nebulae'],
    ['category-large_scale_structures', 'dust sheets'],
    ['object-distance-limit', 'from the origin'],
    ['magnitude-limit', 'Visibility from'],
    ['hide-fainter-objects', 'instead of dimming'],
  ]
  await expect(page.locator('#filter-panel .mass-metric-tooltip')).toHaveCount(tips.length)
  for (const [id, text] of tips) {
    const tooltip = page.locator(`#${id}-tooltip`)
    await page.locator(`label[for="${id}"] .mass-metric-help`).hover()
    expect(await open(tooltip), id).toBe(true)
    await expect(tooltip).toContainText(text!)
    const box = (await tooltip.boundingBox())!, card = (await page.locator('#filter-panel').boundingBox())!
    expect(box.x, id).toBeGreaterThanOrEqual(card.x)
    expect(box.x + box.width, id).toBeLessThanOrEqual(card.x + card.width)
    await expect(page.locator(`#${id}`)).toHaveAccessibleDescription(new RegExp(text!))
  }
  await page.mouse.move(0, 0)
  const toggle = page.locator('#category-stellar_remnants')
  await expect(toggle).not.toBeChecked()
  await page.locator('label[for="category-stellar_remnants"] .mass-metric-help').click()
  await expect(toggle).toBeChecked()
  await page.mouse.move(0, 0)
  // Generated category labels open their tooltip from the keyboard like the static ones.
  await page.locator('#category-interstellar_medium').focus()
  await page.keyboard.press('Tab')
  await expect(toggle).toBeFocused()
  expect(await open(page.locator('#category-stellar_remnants-tooltip'))).toBe(true)
  await expect(page.getByLabel('Nearest objects', { exact: true })).toBeVisible()
})

test.describe('on touch', () => {
  test.use({ hasTouch: true })

  test('explains a filter category on the first tap and toggles it on the second', async ({ page }) => {
    await openViewer(page)
    await openFilter(page)
    const tooltip = page.locator('#category-stellar_remnants-tooltip')
    const toggle = page.locator('#category-stellar_remnants')
    const label = page.locator('label[for="category-stellar_remnants"] .mass-metric-help')
    await label.tap()
    expect(await tooltip.evaluate((element) => element.matches(':popover-open'))).toBe(true)
    await expect(toggle).not.toBeChecked()
    await label.tap()
    await expect(toggle).toBeChecked()
  })

  test('explains a setting on the first tap and toggles it on the second', async ({ page }) => {
    await openViewer(page)
    await openPreferences(page)
    const tooltip = page.locator('#oort-cloud-visible-tooltip')
    const toggle = page.locator('#oort-cloud-visible')
    const label = page.locator('label[for="oort-cloud-visible"] .mass-metric-help')
    await label.tap()
    expect(await tooltip.evaluate((element) => element.matches(':popover-open'))).toBe(true)
    await expect(toggle).toBeChecked()
    await label.tap()
    await expect(toggle).not.toBeChecked()
    await page.locator('label[for="milky-way-visible"] .switch-control').tap()
    await expect(page.locator('#milky-way-visible')).not.toBeChecked()
    expect(await page.locator('#milky-way-visible-tooltip').evaluate((element) => element.matches(':popover-open'))).toBe(false)
  })
})

test('remembers color-blind mode and redraws its legends', async ({ page }) => {
  await openViewer(page)
  await openPreferences(page)
  const toggle = page.locator('#color-blind-palette')
  await expect(toggle).not.toBeChecked()
  const legend = () => page.locator('[data-paint-setting="distance"] .paint-legend').evaluate((bar) => (bar as HTMLElement).style.getPropertyValue('--paint-legend'))
  const standard = await legend()
  await page.locator('label[for="color-blind-palette"]').click()
  await expect(toggle).toBeChecked()
  expect(await page.evaluate(() => localStorage.getItem('star-view-color-blind-palette'))).toBe('true')
  const friendly = await legend()
  expect(friendly).not.toBe(standard)
  await openViewer(page)
  await openPreferences(page)
  await expect(toggle).toBeChecked()
  expect(await legend()).toBe(friendly)
})

test('runs with browser storage blocked and asks the welcome question on every visit @mobile', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, { get() { throw new DOMException('Access denied', 'SecurityError') } })
    }
  })
  const welcome = page.locator('#welcome-tile')
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('#scene-status')).toBeHidden()
  await expect(welcome).toBeVisible()
  await page.locator('#welcome-no').click()
  await expect(welcome).toBeHidden()
  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(welcome).toBeVisible()
  await page.locator('#welcome-yes').click()
  const tour = page.locator('.tutorial-tile')
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Quit tutorial' }).click()
  await expect(tour).toHaveCount(0)

  await openPreferences(page)
  await expect(page.locator('#delete-browser-data')).toBeDisabled()
  await expect(page.locator('#delete-browser-data')).toContainText('size unavailable')
  await page.locator('#export-browser-data').click()
  await expect(page.locator('#browser-data-transfer-error')).toHaveText('Could not export browser data.')
  expect(errors).toEqual([])
})

test('restores browser data from its export file', async ({ page }) => {
  await openViewer(page)
  await page.evaluate(() => {
    localStorage.setItem('star-view-distance-unit', 'pc')
    sessionStorage.setItem('star-view-graph-sections-collapsed', '["types"]')
  })
  await openPreferences(page)
  const download = page.waitForEvent('download')
  await page.locator('#export-browser-data').click()
  const file = await (await download).path()
  await page.evaluate(() => {
    localStorage.setItem('star-view-distance-unit', 'ly')
    sessionStorage.removeItem('star-view-graph-sections-collapsed')
  })
  const reload = page.waitForEvent('load')
  await page.locator('#import-browser-data-file').setInputFiles(file)
  await reload
  expect(await page.evaluate(() => [localStorage.getItem('star-view-distance-unit'), sessionStorage.getItem('star-view-graph-sections-collapsed')]))
    .toEqual(['pc', '["types"]'])
})
