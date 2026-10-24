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
  await page.locator('#observer-direction-card').screenshot({ path: testInfo.outputPath('observer-telescope.png') })

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
  await expect(page.locator('#observer-direction-card')).toBeHidden()
  await page.locator('#observer-view').click()
  await expect(telescope).toHaveAttribute('aria-pressed', 'false')
  await expect(scene).toHaveAttribute('data-observer-zoom', '1')
})

test('telescope respects reduced motion and fits beside the roll controls', { tag: '@mobile' }, async ({ page }) => {
  await openViewer(page)
  await page.locator('#observer-view').click()
  const telescope = page.locator('#observer-telescope')
  const leftRoll = page.locator('#observer-roll-counterclockwise')
  const telescopeBounds = (await telescope.boundingBox())!
  const rollBounds = (await leftRoll.boundingBox())!
  expect(telescopeBounds.x + telescopeBounds.width).toBeLessThan(rollBounds.x)
  expect(Math.abs(telescopeBounds.y - rollBounds.y)).toBeLessThan(1)
  expect(telescopeBounds.x).toBeGreaterThanOrEqual(0)
  expect(rollBounds.x + rollBounds.width).toBeLessThan(page.viewportSize()!.width)

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
  await page.getByRole('textbox', { name: 'View name' }).fill('Telescope view')
  await page.getByRole('button', { name: 'Save current view', exact: true }).click()
  await expect(page.locator('#saved-views-status')).toHaveText('Saved “Telescope view”')
  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('#scene-status')).toBeHidden()
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByRole('row', { name: 'Load saved view Telescope view' }).click()
  await expect(page.locator('#saved-views-status')).toHaveText('Loaded “Telescope view”')
  await expect(page.locator('#observer-telescope')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#scene')).toHaveAttribute('data-observer-zoom', '1.6')
})
