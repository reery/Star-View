import { expect, test, type Page } from '@playwright/test'

async function trackRendering(page: Page) {
  await page.addInitScript(() => {
    const stats = { draws: 0, labelMutations: 0, labelSizeReads: 0, frameDrawCalls: 0, framePointVertices: 0 }
    Object.assign(window, { renderStats: stats })
    for (const property of ['offsetWidth', 'offsetHeight']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)!
      Object.defineProperty(HTMLElement.prototype, property, {
        ...descriptor,
        get(this: HTMLElement) {
          if (this.classList.contains('map-label')) stats.labelSizeReads++
          return descriptor.get!.call(this)
        },
      })
    }
    const clear = WebGL2RenderingContext.prototype.clear
    WebGL2RenderingContext.prototype.clear = function (mask) {
      stats.draws++
      stats.frameDrawCalls = 0
      stats.framePointVertices = 0
      return clear.call(this, mask)
    }
    const drawArrays = WebGL2RenderingContext.prototype.drawArrays
    WebGL2RenderingContext.prototype.drawArrays = function (mode, first, count) {
      stats.frameDrawCalls++
      if (mode === this.POINTS) stats.framePointVertices += count
      return drawArrays.call(this, mode, first, count)
    }
    const drawElements = WebGL2RenderingContext.prototype.drawElements
    WebGL2RenderingContext.prototype.drawElements = function (mode, count, type, offset) {
      stats.frameDrawCalls++
      if (mode === this.POINTS) stats.framePointVertices += count
      return drawElements.call(this, mode, count, type, offset)
    }
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver((records) => {
        stats.labelMutations += records.filter((record) =>
          record.target instanceof Element && record.target.closest('.projected-labels, .projected-axes')).length
      }).observe(document.querySelector('#scene')!, { subtree: true, attributes: true })
    })
  })
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.evaluate(() => document.fonts.ready)
}

async function stats(page: Page) {
  return page.evaluate(() => (window as Window & {
    renderStats?: { draws: number; labelMutations: number; labelSizeReads: number; frameDrawCalls: number; framePointVertices: number }
  }).renderStats!)
}

for (const catalog of ['nearest-neighbors', 'nearest-100']) {
  test(`submits only visible halos and batches axes for ${catalog}`, async ({ page }) => {
    await trackRendering(page)
    await page.getByLabel('Catalog', { exact: true }).selectOption(catalog)
    await expectIdle(page)
    console.log(`${catalog} default GPU submissions: ${JSON.stringify(await stats(page))}`)
    const cores = await page.locator('.map-anchor[data-star-id]').count()
    for (const limit of ['0', '7', '12']) {
      await page.getByLabel('V magnitude limit', { exact: true }).fill(limit)
      const halos = await page.locator('.map-anchor[data-star-id]:not([data-visibility="background"])').count()
      await expect.poll(async () => (await stats(page)).framePointVertices).toBe(cores + halos)
    }
    const beforeSelection = await stats(page)
    await page.locator('[data-star="wise-0855-0714"]').evaluate((button: HTMLButtonElement) => button.click())
    await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(beforeSelection.draws)
    const selectedHalos = await page.locator('.map-anchor[data-star-id]:not([data-visibility="background"])').count()
    await expect.poll(async () => (await stats(page)).framePointVertices).toBe(cores + selectedHalos)
    const withGrid = await stats(page)
    await page.getByRole('button', { name: 'Grid', exact: true }).click()
    await expect.poll(async () => (await stats(page)).frameDrawCalls).toBe(withGrid.frameDrawCalls - 2)
    await page.getByRole('button', { name: 'Grid', exact: true }).click()
    await expect.poll(async () => (await stats(page)).frameDrawCalls).toBe(withGrid.frameDrawCalls)
    console.log(`${catalog} GPU submissions: ${JSON.stringify(await stats(page))}`)
  })

  test(`rotates ${catalog} without remeasuring label sizes`, async ({ page, context }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await trackRendering(page)
    await page.getByLabel('Catalog', { exact: true }).selectOption(catalog)
    await page.getByLabel('V magnitude limit', { exact: true }).fill('12')
    await expectIdle(page)
    const session = await context.newCDPSession(page)
    await session.send('Performance.enable')
    const bounds = (await page.locator('#scene canvas').boundingBox())!
    await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height * 0.6)
    await page.mouse.down()
    const before = await stats(page)
    const initialMetrics = await session.send('Performance.getMetrics')
    await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.4, { steps: 90 })
    await page.mouse.up()
    await page.evaluate(() => new Promise(requestAnimationFrame))
    const after = await stats(page)
    const finalMetrics = await session.send('Performance.getMetrics')
    const draws = after.draws - before.draws
    const measurement = {
      draws,
      labelSizeReads: after.labelSizeReads - before.labelSizeReads,
      labelMutations: after.labelMutations - before.labelMutations,
      ...Object.fromEntries(['LayoutCount', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration'].map((name) => [name,
        finalMetrics.metrics.find((metric) => metric.name === name)!.value -
        initialMetrics.metrics.find((metric) => metric.name === name)!.value,
      ])),
    }
    console.log(`${catalog} rotation: ${JSON.stringify(measurement)}`)
    await testInfo.attach('rotation-metrics', { body: JSON.stringify(measurement, null, 2), contentType: 'application/json' })
    expect(draws).toBeGreaterThan(10)
    expect(measurement.labelSizeReads).toBe(0)
    await expectIdle(page)
  })
}

async function expectIdle(page: Page) {
  // Allow the finite focus animation and orbit damping to finish first.
  await page.waitForTimeout(1200)
  const before = await stats(page)
  await page.waitForTimeout(500)
  expect(await stats(page)).toEqual(before)
}

test('sleeps when idle and redraws after interactions in both catalogs', async ({ page }) => {
  test.setTimeout(45_000)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await trackRendering(page)
  await expectIdle(page)
  for (const catalog of ['nearest-neighbors', 'nearest-100']) {
    await page.getByLabel('Catalog', { exact: true }).selectOption(catalog)
    await expectIdle(page)
    for (const action of [
      () => page.getByRole('button', { name: 'Grid', exact: true }).click(),
      () => page.getByRole('button', { name: 'Zoom in', exact: true }).click(),
      () => page.getByRole('button', { name: 'Reset view', exact: true }).click(),
      () => page.getByLabel('V magnitude limit', { exact: true }).fill('12'),
      () => page.locator('[data-star="sun"]').evaluate((button: HTMLButtonElement) => button.click()),
      () => page.getByLabel('ly', { exact: true }).check(),
      async () => {
        const bounds = (await page.locator('#scene canvas').boundingBox())!
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
        await page.mouse.down()
        await page.mouse.move(bounds.x + bounds.width / 2 + 45, bounds.y + bounds.height / 2 + 20, { steps: 5 })
        await page.mouse.up()
      },
    ]) {
      const before = await stats(page)
      await action()
      await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(before.draws)
      await expectIdle(page)
    }
    await page.getByLabel('pc', { exact: true }).check()
    await page.getByLabel('V magnitude limit', { exact: true }).fill('7')
  }
})

test('redraws after viewport and font changes, then settles again', async ({ page }) => {
  await trackRendering(page)
  await expectIdle(page)
  const before = await stats(page)
  const viewport = page.viewportSize()!
  await page.setViewportSize({ width: viewport.width - 30, height: viewport.height - 30 })
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(before.draws)
  await expect.poll(async () => (await stats(page)).labelSizeReads).toBeGreaterThan(before.labelSizeReads)
  await expectIdle(page)
  const resized = await stats(page)
  await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')))
  await expect.poll(async () => (await stats(page)).labelMutations).toBeGreaterThan(resized.labelMutations)
  await expect.poll(async () => (await stats(page)).labelSizeReads).toBeGreaterThan(resized.labelSizeReads)
  await expectIdle(page)
})

test('refreshes label sizes after selection and unit changes', async ({ page }) => {
  await trackRendering(page)
  await expectIdle(page)
  const before = await stats(page)
  await page.locator('[data-star="barnards-star"]').evaluate((button: HTMLButtonElement) => button.click())
  await expect.poll(async () => (await stats(page)).labelSizeReads).toBeGreaterThan(before.labelSizeReads)
  await expect(page.locator('[data-star-id="barnards-star"] .star-label')).toBeVisible()
  const selected = await stats(page)
  await page.getByLabel('ly', { exact: true }).check()
  await expect(page.locator('.distance-label')).toContainText('ly')
  await expect.poll(async () => (await stats(page)).labelSizeReads).toBeGreaterThan(selected.labelSizeReads)
  await expectIdle(page)
})

test('resumes rendering after graphics context restoration', async ({ page }) => {
  await trackRendering(page)
  await expectIdle(page)
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#scene canvas')!
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!
    canvas.addEventListener('webglcontextlost', () => {
      setTimeout(() => extension.restoreContext(), 200)
    }, { once: true })
    extension.loseContext()
  })
  await expect(page.locator('#scene-status')).toBeVisible()
  const before = await stats(page)
  await expect(page.locator('#scene-status')).toBeHidden()
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(before.draws)
  await expectIdle(page)
})
