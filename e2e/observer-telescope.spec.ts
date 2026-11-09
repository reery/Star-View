import { expect, test } from '@playwright/test'
import { openViewer } from './support'

test('telescope gently animates the current observer center and reverses cleanly', async ({ page }, testInfo) => {
  await openViewer(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.locator('#observer-view').click()
  await page.locator('#observer-roll-counterclockwise').click()
  const scene = page.locator('#scene')
  const telescope = page.getByRole('button', { name: 'Telescope zoom', exact: true })
  const frame = () => scene.evaluate((node: HTMLElement) => ({
    direction: node.dataset.observerViewDirection,
    up: node.dataset.observerScreenUp,
    roll: node.dataset.observerRollDegrees,
  }))
  const before = await frame()
  const beforeImage = await page.locator('#scene canvas').screenshot()
  await telescope.evaluate((button: HTMLButtonElement) => {
    const samples: number[] = []
    Object.assign(window, { telescopeZoomSamples: samples })
    button.click()
    const started = performance.now()
    function sample() {
      samples.push(Number(document.getElementById('scene')!.dataset.observerZoom ?? 1))
      if (performance.now() - started < 500) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await expect(telescope).toHaveAttribute('aria-pressed', 'true')
  await expect(scene).toHaveAttribute('data-observer-zoom', '1.6')
  const samples = await page.evaluate(() => (window as unknown as { telescopeZoomSamples: number[] }).telescopeZoomSamples)
  expect(samples.some((zoom) => zoom > 1 && zoom < 1.6)).toBe(true)
  expect(await frame()).toEqual(before)
  expect(await page.locator('#scene canvas').screenshot()).not.toEqual(beforeImage)
  await page.locator('#observer-panel').screenshot({ path: testInfo.outputPath('observer-telescope.png') })

  // Reversing midway starts from the current zoom instead of jumping.
  await telescope.click()
  await expect.poll(async () => Number(await scene.getAttribute('data-observer-zoom'))).toBeLessThan(1.6)
  await telescope.click()
  await expect(scene).toHaveAttribute('data-observer-zoom', '1.6')
  await telescope.click()
  await expect(scene).toHaveAttribute('data-observer-zoom', '1')
  expect(await frame()).toEqual(before)

  await telescope.click()
  await page.locator('#observer-view').click()
  await expect(scene).toHaveAttribute('data-observer-zoom', '1')
  await expect(page.locator('#observer-panel')).toBeHidden()
  await page.locator('#observer-view').click()
  await expect(telescope).toHaveAttribute('aria-pressed', 'false')
  await expect(scene).toHaveAttribute('data-observer-zoom', '1')
})

test('telescope respects reduced motion and every observer control fits on screen', { tag: '@mobile' }, async ({ page }) => {
  await openViewer(page)
  await page.locator('#observer-view').click()
  const telescope = page.locator('#observer-telescope')
  const leftRoll = page.locator('#observer-roll-counterclockwise')
  for (const control of await page.locator('#observer-panel').locator('button, select').all()) {
    const bounds = (await control.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  }

  const immediateZoom = await telescope.evaluate((button: HTMLButtonElement) => {
    button.click()
    return document.getElementById('scene')!.dataset.observerZoom
  })
  expect(immediateZoom).toBe('1.6')
  await expect(page.locator('#scene')).toHaveAttribute('data-observer-zoom', '1.6')
  await expect(telescope).toHaveAttribute('aria-pressed', 'true')
  await leftRoll.click()
  await expect(page.locator('#scene')).toHaveAttribute('data-observer-roll-degrees', '15')
  await expect(page.locator('#scene')).toHaveAttribute('data-observer-zoom', '1.6')
  await page.locator('#observer-object').click()
  await expect(telescope).toHaveAttribute('aria-pressed', 'true')
  await telescope.click()
  await expect(page.locator('#scene')).toHaveAttribute('data-observer-zoom', '1')
})

test('saved observer views restore telescope zoom', async ({ page }) => {
  await openViewer(page)
  await page.locator('#observer-view').click()
  await page.locator('#observer-telescope').click()
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByRole('searchbox', { name: 'View name' }).fill('Telescope view')
  await page.getByRole('button', { name: 'Save current view', exact: true }).click()
  await expect(page.locator('#saved-views-status')).toHaveText('Saved “Telescope view”')
  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByRole('row', { name: 'Saved view Telescope view' }).click()
  await page.getByRole('menuitem', { name: "Load 'Telescope view'" }).click()
  await expect(page.locator('#saved-views-status')).toHaveText('Loaded “Telescope view”')
  await expect(page.locator('#observer-telescope')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#scene')).toHaveAttribute('data-observer-zoom', '1.6')
})

test('the observer card closes to an indicator and exits observer view', async ({ page }) => {
  await openViewer(page)
  const card = page.locator('#observer-panel')
  const indicator = page.locator('#observer-active')
  await page.locator('#observer-view').click()
  await expect(card).toBeVisible()
  await expect(indicator).toBeHidden()
  // Another card takes the observer card's place, as with every dock card.
  await page.locator('#info-toggle').click()
  await expect(card).toBeHidden()
  await page.locator('#info-toggle').click()
  // Hovering or focusing Info slides the indicators aside, so leave it before aiming at one.
  await page.locator('#info-toggle').blur()
  await page.mouse.move(700, 450)
  await expect(indicator).toBeVisible()
  await indicator.click()
  await expect(card).toBeVisible()
  await page.locator('#observer-close').click()
  await expect(card).toBeHidden()
  await expect(indicator).toBeFocused()
  await expect(page.locator('#scene')).toHaveAttribute('data-observer-view', 'true')
  await indicator.click()
  await page.locator('#observer-exit').click()
  await expect(page.locator('#scene')).toHaveAttribute('data-observer-view', 'false')
  await expect(card).toBeHidden()
  await expect(indicator).toBeHidden()
})

test('observatory zooms deeper than the telescope, and only one zoom applies', async ({ page }) => {
  await openViewer(page)
  await page.locator('#observer-view').click()
  const scene = page.locator('#scene')
  await page.locator('#observer-telescope').click()
  await expect(scene).toHaveAttribute('data-observer-zoom', '1.6')
  await page.locator('#observer-observatory').click()
  await expect(scene).toHaveAttribute('data-observer-zoom', '4')
  await expect(page.locator('#observer-telescope')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#observer-observatory')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('#observer-observatory').click()
  await expect(scene).toHaveAttribute('data-observer-zoom', '1')
})

test('standing on Earth turns the view around the zenith, so the cone rim stays level', async ({ page }) => {
  await openViewer(page)
  await page.locator('#observer-view').click()
  const latitude = page.locator('#observer-latitude')
  await expect(latitude).toBeDisabled()
  await expect(latitude).toHaveValue('40')
  const scene = page.locator('#scene')
  const vector = async (name: string) => (await scene.getAttribute(name))!.split(',').map(Number)
  const dot = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * b[index]!, 0)
  const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
  const galacticUp = await vector('data-observer-screen-up')
  await page.locator('#observer-cone').click()
  await page.locator('#observer-axial-tilt').click()
  await expect(page.locator('#observer-axial-tilt')).toHaveAttribute('aria-pressed', 'true')
  await expect(latitude).toBeEnabled()
  expect(await vector('data-observer-screen-up')).not.toEqual(galacticUp)
  expect(await page.evaluate(() => localStorage.getItem('star-view-observer-axial-tilt'))).toBe('true')

  const before = { direction: await vector('data-observer-view-direction'), up: await vector('data-observer-screen-up') }
  await page.mouse.move(700, 450)
  await page.mouse.down()
  await page.mouse.move(400, 450, { steps: 10 })
  await page.mouse.up()
  await expect.poll(async () => (await scene.getAttribute('data-observer-view-direction')) !== before.direction.join(',')).toBe(true)
  const after = { direction: await vector('data-observer-view-direction'), up: await vector('data-observer-screen-up') }
  // With no roll, the zenith lies in each view's plane of direction and screen up, so it is where the two planes meet.
  const raw = cross(cross(before.direction, before.up), cross(after.direction, after.up))
  const length = Math.hypot(...raw)
  const zenith = raw.map((value) => value / length * Math.sign(dot(raw, before.up)))
  expect(dot(after.direction, zenith)).toBeCloseTo(dot(before.direction, zenith), 2)
  // At 40° N the cone's axis, the zenith across two hours, sits about a degree poleward of 40°.
  const b = 27.12825 * Math.PI / 180, l = 122.93192 * Math.PI / 180
  const pole = [Math.cos(b) * Math.cos(l), Math.sin(b), -Math.cos(b) * Math.sin(l)]
  expect(Math.asin(dot(zenith, pole)) * 180 / Math.PI).toBeCloseTo(41, 0)

  const turned = await vector('data-observer-view-direction')
  await latitude.selectOption('50')
  expect(await page.evaluate(() => localStorage.getItem('star-view-observer-latitude'))).toBe('50')
  await expect(scene).toHaveAttribute('data-observer-roll-degrees', '0')
  expect(await vector('data-observer-view-direction')).not.toEqual(turned)
})

test('rolling tilts the axis that drags turn the sky around', async ({ page }) => {
  await openViewer(page)
  await page.locator('#observer-view').click()
  const scene = page.locator('#scene')
  const vector = async (name: string) => (await scene.getAttribute(name))!.split(',').map(Number)
  const dot = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * b[index]!, 0)
  const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
  // A horizontal drag turns around the axis where the vertical planes before and after it meet.
  const dragAxis = async () => {
    const before = cross(await vector('data-observer-view-direction'), await vector('data-observer-screen-up'))
    await page.mouse.move(700, 450)
    await page.mouse.down()
    await page.mouse.move(500, 450, { steps: 8 })
    await page.mouse.up()
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    const raw = cross(before, cross(await vector('data-observer-view-direction'), await vector('data-observer-screen-up')))
    return raw.map((value) => value / Math.hypot(...raw))
  }
  const galacticNorth = [0, 1, 0]
  expect(Math.abs(dot(await dragAxis(), galacticNorth))).toBeCloseTo(1, 3)
  const rollCounterclockwise = page.getByRole('button', { name: 'Roll view counterclockwise', exact: true })
  for (let step = 0; step < 4; step++) await rollCounterclockwise.click()
  await expect(scene).toHaveAttribute('data-observer-roll-degrees', '60')
  // Dragging now turns around the rolled axis, which no drag could reach.
  expect(Math.abs(dot(await dragAxis(), galacticNorth))).toBeLessThan(0.95)
  await page.getByRole('button', { name: 'Reset view roll', exact: true }).click()
  await expect(scene).toHaveAttribute('data-observer-roll-degrees', '0')
  expect(Math.abs(dot(await dragAxis(), galacticNorth))).toBeCloseTo(1, 3)
})

test('the observer cone follows its own toggle and time', async ({ page }) => {
  await openViewer(page)
  await page.locator('#observer-view').click()
  const cone = page.locator('#observer-cone')
  const time = page.locator('#observer-cone-time')
  await expect(cone).toHaveAttribute('aria-pressed', 'false')
  await expect(time).toBeDisabled()
  await expect(time).toHaveValue('now')
  await cone.click()
  await expect(page.locator('#scene')).toHaveAttribute('data-visibility-cone-visible', 'true')
  await time.selectOption('20-22')
  expect(await page.evaluate(() => localStorage.getItem('star-view-observer-cone-mode'))).toBe('20-22')
  expect(await page.evaluate(() => localStorage.getItem('star-view-visibility-cone-mode'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('star-view-observer-cone'))).toBe('true')
  // The preference stays off, so leaving observer view hides the cone again.
  await page.locator('#observer-exit').click()
  await expect(page.locator('#scene')).toHaveAttribute('data-visibility-cone-visible', 'false')
  // The preference neither switches the card's cone nor its time.
  await page.getByRole('button', { name: 'Preferences', exact: true }).click()
  await page.locator('#visibility-cone-mode').fill('3')
  await page.locator('#visibility-cone-mode').fill('0')
  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.locator('#observer-view').click()
  await expect(cone).toHaveAttribute('aria-pressed', 'true')
  await expect(time).toHaveValue('20-22')
  await expect(page.locator('#scene')).toHaveAttribute('data-visibility-cone-visible', 'true')
})

test('naked-eye view applies a dark-sky filter, follows the zoom and restores the previous filter', async ({ page }) => {
  await openViewer(page)
  await page.locator('#observer-view').click()
  const eye = page.getByRole('button', { name: 'Naked-eye visibility', exact: true })
  const magnitude = page.locator('#magnitude-limit')
  const distance = page.locator('#object-distance-limit-value')
  const before = { magnitude: await magnitude.inputValue(), distance: await distance.textContent() }
  await eye.click()
  await expect(eye).toHaveAttribute('aria-pressed', 'true')
  await expect(magnitude).toHaveValue('6')
  await expect(distance).toHaveText('20000 ly')
  for (const id of ['hide-fainter-objects', 'show-western-constellation-stars', 'show-naked-eye-stars']) await expect(page.locator(`#${id}`)).toBeChecked()
  await page.locator('#objects-toggle').click()
  await page.locator('#object-search').fill('Nebula')
  await expect(page.locator('#star-list button[data-star="orion-nebula"]')).toBeVisible()
  await expect(page.locator('#star-list button[data-star="pleiades-nebula"]')).toHaveCount(0)
  await page.locator('#object-search').fill('Alcyone')
  await expect(page.locator('#star-list button[data-star]').first()).toBeVisible()
  await page.locator('#object-search').fill('')
  // Objects took the observer card's place; close it and leave the toolbar before reopening the card.
  await page.locator('#objects-toggle').click()
  await page.locator('#objects-toggle').blur()
  await page.mouse.move(700, 450)
  await page.locator('#observer-active').click()

  await page.locator('#observer-telescope').click()
  await expect(magnitude).toHaveValue('13')
  await page.locator('#observer-observatory').click()
  await expect(magnitude).toHaveValue('25')
  await page.locator('#observer-observatory').click()
  await expect(magnitude).toHaveValue('6')

  await eye.click()
  await expect(eye).toHaveAttribute('aria-pressed', 'false')
  await expect(magnitude).toHaveValue(before.magnitude)
  await expect(distance).toHaveText(before.distance!)
  // Without the naked-eye view, zoom leaves the filter alone.
  await page.locator('#observer-telescope').click()
  await expect(magnitude).toHaveValue(before.magnitude)
  await page.locator('#observer-telescope').click()

  // Leaving the observer view ends the naked-eye view too.
  await eye.click()
  await expect(magnitude).toHaveValue('6')
  await page.locator('#observer-exit').click()
  await expect(magnitude).toHaveValue(before.magnitude)
  await expect(page.locator('#observer-naked-eye')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#observer-naked-eye')).toBeDisabled()
})
