import { expect, test } from '@playwright/test'
import { openFilter, openViewer } from './support'

test('keeps the selected name in front even at collisions and scene edges', async ({ page }) => {
  await openViewer(page)
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  const label = page.locator('[data-star-id="sun"] .star-label')
  await expect(label).toBeVisible()
  await expect(label).toHaveText('Sun')
  await expect(label).toHaveCSS('font-weight', '600')
  await expect(label).toHaveCSS('text-decoration-line', 'underline')
  await expect(label).toHaveCSS('text-decoration-color', 'rgb(255, 239, 209)')
  await expect(page.locator('[data-star-id="sun"] .selection-ring')).toHaveCSS('border-top-color', 'rgb(255, 239, 209)')
  await expect(page.locator('.identity')).toHaveCSS('border-left-color', 'rgb(255, 239, 209)')
  await expect(label.locator('..')).toHaveCSS('z-index', '1')
  await label.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const scene = document.querySelector('.scene-wrap')!
    const sceneBounds = scene.getBoundingClientRect()
    const obstacle = document.createElement('div')
    obstacle.id = 'test-label-obstacle'
    obstacle.dataset.sceneObstacle = ''
    Object.assign(obstacle.style, { position: 'absolute', left: `${bounds.left - sceneBounds.left}px`, top: `${bounds.top - sceneBounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, background: 'red' })
    scene.append(obstacle)
  })
  await page.evaluate(() => new Promise(requestAnimationFrame))
  await expect(label).toBeVisible()
  expect(await label.evaluate((element) => {
    element.style.pointerEvents = 'auto'
    const bounds = element.getBoundingClientRect()
    const foreground = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2) === element
    element.style.removeProperty('pointer-events')
    document.getElementById('test-label-obstacle')!.remove()
    return foreground
  })).toBe(true)
  const bounds = (await page.locator('#scene canvas').boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.7)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(bounds.x + bounds.width * 2, bounds.y + bounds.height * 0.7, { steps: 12 })
  await page.mouse.up({ button: 'right' })
  await expect(page.locator('[data-star-id="sun"]')).toHaveClass(/is-clipped/)
  await expect(label).toBeVisible()
  await expect(page.locator('[data-star-id="sun"] .selection-ring')).toBeHidden()
  const textBounds = (await label.boundingBox())!
  expect(textBounds.x).toBeGreaterThanOrEqual(bounds.x)
  expect(textBounds.x + textBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width)
  expect(textBounds.y).toBeGreaterThanOrEqual(bounds.y)
  expect(textBounds.y + textBounds.height).toBeLessThanOrEqual(bounds.y + bounds.height)
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(label).toBeVisible()
})

test('keeps front-camera names stable when the selected star moves behind the camera', async ({ page, isMobile }, testInfo) => {
  await openViewer(page)
  await openFilter(page)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-1000')
  await page.getByLabel('V magnitude limit', { exact: true }).fill('25')
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()

  const foregroundName = page.locator('[data-star-id="cns5-5794"] .star-label')
  for (let click = 1; click <= 24; click++) {
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    if (click < 18) continue
    await page.evaluate(() => new Promise(requestAnimationFrame))
    expect(await foregroundName.isVisible(), `front name hidden after zoom step ${click}`).toBe(true)
  }

  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * 0.6 }
  const rotationDistance = isMobile ? 12 : 55
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(start.x + rotationDistance * step / 12, start.y)
    await page.evaluate(() => new Promise(requestAnimationFrame))
    expect(await foregroundName.isVisible(), `front name hidden during rotation step ${step}`).toBe(true)
  }
  await page.mouse.up()

  const selectedAnchor = page.locator('[data-star-id="sun"]')
  const selectedName = selectedAnchor.locator('.star-label')
  await expect(selectedAnchor).toHaveClass(/is-clipped/)
  await expect(selectedName).toBeVisible()
  await expect(foregroundName).toBeVisible()
  const placement = await page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>('.scene-wrap')!.getBoundingClientRect()
    const selected = document.querySelector<HTMLElement>('[data-star-id="sun"] .star-label')!.getBoundingClientRect()
    const foreground = document.querySelector<HTMLElement>('[data-star-id="cns5-5794"] .star-label')!.getBoundingClientRect()
    const visibleClippedOrdinary = [...document.querySelectorAll<HTMLElement>('.map-anchor.is-clipped')]
      .filter((anchor) => !anchor.classList.contains('is-selected') && anchor.querySelector<HTMLElement>('.star-label')?.checkVisibility())
      .map((anchor) => anchor.dataset.starId)
    return {
      selectedInsideScene: selected.left >= scene.left && selected.right <= scene.right && selected.top >= scene.top && selected.bottom <= scene.bottom,
      labelsOverlap: selected.left < foreground.right && selected.right > foreground.left && selected.top < foreground.bottom && selected.bottom > foreground.top,
      visibleClippedOrdinary,
    }
  })
  expect(placement).toEqual({ selectedInsideScene: true, labelsOverlap: false, visibleClippedOrdinary: [] })
  await page.screenshot({ path: testInfo.outputPath('behind-camera-labels.png'), fullPage: true })
})

test('keeps the Sirius name visible behind the Sun in the nearest-1000 view', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, 'The supplied clear-space composition is a desktop viewport regression.')
  await openViewer(page)
  await openFilter(page)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-1000')
  await page.getByLabel('V magnitude limit', { exact: true }).fill('25')
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  for (let click = 0; click < 4; click++) await page.getByRole('button', { name: 'Zoom in', exact: true }).click()

  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const start = { x: bounds.x + bounds.width * 0.45, y: bounds.y + bounds.height * 0.58 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x - 100, start.y, { steps: 8 })
  await page.mouse.up()

  const siriusAnchor = page.locator('[data-star-id="sirius-a"]')
  const siriusName = siriusAnchor.locator('.star-label')
  const siriusArrow = siriusAnchor.locator('.motion-arrow')
  await expect(siriusAnchor).toBeVisible()
  await expect(siriusName).toBeVisible()
  await expect(siriusArrow).toBeVisible()

  const rotationStart = { x: start.x - 100, y: start.y }
  await page.mouse.move(rotationStart.x, rotationStart.y)
  await page.mouse.down()
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(rotationStart.x - step * 2, rotationStart.y - step)
    await page.evaluate(() => new Promise(requestAnimationFrame))
    expect(await siriusName.isVisible(), `Sirius name hidden during rotation step ${step}`).toBe(true)
    const overlap = await page.evaluate(() => {
      const name = document.querySelector<HTMLElement>('[data-star-id="sirius-a"] .star-label')!.getBoundingClientRect()
      const arrow = document.querySelector<HTMLElement>('[data-star-id="sirius-a"] .motion-arrow')!.getBoundingClientRect()
      return name.left < arrow.right && name.right > arrow.left && name.top < arrow.bottom && name.bottom > arrow.top
    })
    expect(overlap, `Sirius name overlaps its arrow during rotation step ${step}`).toBe(false)
  }
  await page.mouse.up()
  await page.screenshot({ path: testInfo.outputPath('sun-sirius-label.png'), fullPage: true })
})

test('keeps star names steady and foreground distance clear of both stars during rotation', async ({ page }) => {
  await openViewer(page)
  await expect(page.locator('.distance-label').locator('..')).toHaveCSS('z-index', '2')
  const bounds = (await page.locator('#scene canvas').boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.7)
  await page.mouse.down()
  for (let step = 0; step <= 12; step++) {
    await page.mouse.move(bounds.x + bounds.width * 0.4 + step * 8, bounds.y + bounds.height * 0.7 - step * 3)
    const labels = await page.evaluate(async () => {
      await new Promise(requestAnimationFrame)
      const endpoints = ['sun', 'sirius-a'].map((id) => document.querySelector<HTMLElement>(`[data-star-id="${id}"]`)!.getBoundingClientRect())
      return [...document.querySelectorAll<HTMLElement>('.star-label, .distance-label')]
        .filter((label) => label.checkVisibility())
        .map((label) => {
          const text = label.getBoundingClientRect()
          const anchor = label.parentElement!.getBoundingClientRect()
          const distance = label.matches('.distance-label')
          const endpointsClear = !distance || endpoints.every((point) =>
            text.right <= point.left - 30 || text.left >= point.left + 30 ||
            text.bottom <= point.top - 30 || text.top >= point.top + 30)
          const placement = Math.abs(text.left - anchor.right - 22) < 1 ? 'right'
            : Math.abs(text.right - anchor.left + 22) < 1 ? 'left'
              : Math.abs(text.top - anchor.bottom - 22) < 1 ? 'below'
                : Math.abs(text.bottom - anchor.top + 22) < 1 ? 'above'
                  : 'foreground'
          return { distance, endpointsClear, placement }
        })
    })
    expect(labels.length).toBeGreaterThan(0)
    expect(labels.some((label) => label.distance)).toBe(true)
    for (const label of labels) {
      expect(label.endpointsClear).toBe(true)
      if (!label.distance) expect(['right', 'left', 'below', 'above', 'foreground']).toContain(label.placement)
    }
  }
  await page.mouse.up()
})
