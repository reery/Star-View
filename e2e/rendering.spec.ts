import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

interface RenderingStats {
  draws: number
  drawTimes: number[]
  labelMutations: number
  labelSizeReads: number
  obstacleBoundsReads: number
  frameDrawCalls: number
  framePointVertices: number
  listReplacements: number
}

async function trackRendering(page: Page) {
  await page.addInitScript(() => {
    const stats = { draws: 0, drawTimes: [] as number[], labelMutations: 0, labelSizeReads: 0, obstacleBoundsReads: 0, frameDrawCalls: 0, framePointVertices: 0, listReplacements: 0 }
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
    const getBoundingClientRect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function () {
      if (this.matches('[data-scene-obstacle]')) stats.obstacleBoundsReads++
      return getBoundingClientRect.call(this)
    }
    const replaceChildren = Element.prototype.replaceChildren
    Element.prototype.replaceChildren = function (this: Element, ...nodes: (Node | string)[]) {
      if (this.id === 'star-list') stats.listReplacements++
      return replaceChildren.call(this, ...nodes)
    }
    const clear = WebGL2RenderingContext.prototype.clear
    WebGL2RenderingContext.prototype.clear = function (mask) {
      stats.draws++
      stats.drawTimes.push(performance.now())
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
  return page.evaluate(() => {
    const renderStats = (window as Window & { renderStats?: RenderingStats }).renderStats
    if (!renderStats) throw new Error('Rendering instrumentation is unavailable.')
    return {
      ...renderStats,
      ordinaryLayoutPasses: Number(document.querySelector<HTMLElement>('.projected-labels')!.dataset.ordinaryLayoutPasses ?? 0),
    }
  })
}

async function openPreferences(page: Page) {
  const preferences = page.locator('details.preferences')
  if (await preferences.getAttribute('open') === null) await preferences.locator('summary').click()
}

async function openFilter(page: Page) {
  const filter = page.locator('details.filter-section')
  if (await filter.getAttribute('open') === null) await filter.locator(':scope > summary').click()
}

async function canvasPixelRatio(page: Page) {
  return page.locator('#scene canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    return canvas.width / canvas.getBoundingClientRect().width
  })
}

async function expectedPointVertices(page: Page) {
  return page.locator('.projected-labels').evaluate((layer: HTMLElement) =>
    Number(layer.dataset.coreCount) + Number(layer.dataset.haloCount))
}

function percentile(values: readonly number[], percent: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((first, second) => first - second)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percent))]!
}

for (const catalog of ['nearest-neighbors', 'nearest-100', 'nearest-1000']) {
  test(`submits only visible halos and batches axes for ${catalog}`, async ({ page }) => {
    await trackRendering(page)
    await openFilter(page)
    await page.getByLabel('Catalog', { exact: true }).selectOption(catalog)
    await expectIdle(page)
    console.log(`${catalog} default GPU submissions: ${JSON.stringify(await stats(page))}`)
    for (const limit of ['0', '7', '12']) {
      await page.getByLabel('V magnitude limit', { exact: true }).fill(limit)
      await expect.poll(async () => (await stats(page)).framePointVertices).toBe(await expectedPointVertices(page))
    }
    const beforeSelection = await stats(page)
    await page.locator('[data-star="wise-0855-0714"]').evaluate((button: HTMLButtonElement) => button.click())
    await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(beforeSelection.draws)
    await expect.poll(async () => (await stats(page)).framePointVertices).toBe(await expectedPointVertices(page))
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
    await openFilter(page)
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
      obstacleBoundsReads: after.obstacleBoundsReads - before.obstacleBoundsReads,
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
    expect(measurement.obstacleBoundsReads).toBe(0)
    await expectIdle(page)
  })
}

test('records high-density nearest-1000 rotation evidence', async ({ page, context }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await trackRendering(page)
  await openFilter(page)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-1000')
  await page.getByLabel('V magnitude limit', { exact: true }).fill('25')
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
  const drawTimes = after.drawTimes.slice(before.drawTimes.length)
  const frameIntervals = drawTimes.slice(1).map((time, index) => time - drawTimes[index]!)
  const measurement = {
    draws: after.draws - before.draws,
    ordinaryLayoutPasses: after.ordinaryLayoutPasses - before.ordinaryLayoutPasses,
    frameIntervalP50: percentile(frameIntervals, 0.5),
    frameIntervalP95: percentile(frameIntervals, 0.95),
    labelSizeReads: after.labelSizeReads - before.labelSizeReads,
    obstacleBoundsReads: after.obstacleBoundsReads - before.obstacleBoundsReads,
    labelMutations: after.labelMutations - before.labelMutations,
    ...Object.fromEntries(['LayoutCount', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration'].map((name) => [name,
      finalMetrics.metrics.find((metric) => metric.name === name)!.value -
      initialMetrics.metrics.find((metric) => metric.name === name)!.value,
    ])),
  }
  console.log(`nearest-1000 V=25 rotation: ${JSON.stringify(measurement)}`)
  await testInfo.attach('nearest-1000-v25-rotation-metrics', { body: JSON.stringify(measurement, null, 2), contentType: 'application/json' })
  expect(measurement.draws).toBeGreaterThan(10)
  expect(measurement.ordinaryLayoutPasses).toBeLessThan(measurement.draws)
  expect(measurement.labelSizeReads).toBe(0)
  expect(measurement.obstacleBoundsReads).toBe(0)
  await expectIdle(page)
})

test('coalesces virtual-list scroll renders and skips unchanged ranges', async ({ page }) => {
  await trackRendering(page)
  await openFilter(page)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-1000')
  await expectIdle(page)
  const catalog = page.locator('details.catalog')
  if (await catalog.getAttribute('open') === null) await catalog.locator('summary').click()
  const list = page.locator('#star-list')
  const before = await stats(page)
  await list.evaluate(async (element) => {
    for (let scrollTop = 0; scrollTop <= 4800; scrollTop += 96) {
      element.scrollTop = scrollTop
      element.dispatchEvent(new Event('scroll'))
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  const afterBurst = await stats(page)
  expect(afterBurst.listReplacements - before.listReplacements).toBe(1)
  expect(await list.locator('.catalog-entry').first().evaluate((element) => (element as HTMLElement).style.transform)).toBe('translateY(4608px)')
  await list.evaluate(async (element) => {
    element.dispatchEvent(new Event('scroll'))
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  const afterDuplicate = await stats(page)
  expect(afterDuplicate.listReplacements - afterBurst.listReplacements).toBe(0)
})

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
  await openPreferences(page)
  await openFilter(page)
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
      () => page.getByLabel('pc', { exact: true }).check(),
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
    await page.getByLabel('ly', { exact: true }).check()
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
  await openPreferences(page)
  await expectIdle(page)
  const before = await stats(page)
  await page.locator('[data-star="barnards-star"]').evaluate((button: HTMLButtonElement) => button.click())
  await expect.poll(async () => (await stats(page)).labelSizeReads).toBeGreaterThan(before.labelSizeReads)
  await expect(page.locator('[data-star-id="barnards-star"] .star-label')).toBeVisible()
  const selected = await stats(page)
  await page.getByLabel('pc', { exact: true }).check()
  await expect(page.locator('.distance-label')).toContainText('pc')
  await expect.poll(async () => (await stats(page)).labelSizeReads).toBeGreaterThan(selected.labelSizeReads)
  await expectIdle(page)
})

test('omits filtered cores and halos from GPU point submissions', async ({ page }) => {
  await trackRendering(page)
  await openFilter(page)
  await expectIdle(page)
  await expect.poll(async () => (await stats(page)).framePointVertices).toBe(await expectedPointVertices(page))
  await page.getByLabel('Object visibility distance', { exact: true }).fill('5')
  await expect(page.locator('[data-star-id="barnards-star"]')).toHaveCount(0)
  await expect.poll(async () => (await stats(page)).framePointVertices).toBe(await expectedPointVertices(page))
  await page.getByLabel('Object visibility distance', { exact: true }).fill('100')
  await page.locator('details.filter-dropdown > summary').click()
  await page.getByLabel('Brown dwarf', { exact: true }).uncheck()
  await expect(page.locator('[data-star-id="luhman-16-a"]')).toHaveCount(0)
  await expect.poll(async () => (await stats(page)).framePointVertices).toBe(await expectedPointVertices(page))
  await expect(page.locator('.catalog-entry')).toHaveCount(22)
  await page.locator('[data-star="luhman-16-a"]').evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator('[data-star-id="luhman-16-a"]')).toHaveAttribute('data-map-visible', 'true')
  await expect(page.locator('[data-star-id="luhman-16-b"]')).toHaveCount(0)
  await expect.poll(async () => (await stats(page)).framePointVertices).toBe(await expectedPointVertices(page))
})

test('uses the selected renderer resolution cap', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The mobile project provides the DPR 2 viewport needed for this check.')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await openPreferences(page)
  const powerSaving = page.getByRole('switch', { name: 'Power saving mode' })
  await expect(powerSaving).not.toBeChecked()
  await expect.poll(() => canvasPixelRatio(page)).toBeCloseTo(1, 1)
  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const start = { x: bounds.x + bounds.width * 0.45, y: bounds.y + bounds.height * 0.55 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 60, start.y - 20, { steps: 5 })
  await expect.poll(() => canvasPixelRatio(page)).toBeCloseTo(1, 1)
  await page.mouse.up()
  await expect.poll(() => canvasPixelRatio(page)).toBeCloseTo(1, 1)

  await powerSaving.check()
  await openFilter(page)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-100')
  await expect(powerSaving).toBeChecked()
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 60, start.y - 20, { steps: 5 })
  await expect.poll(() => canvasPixelRatio(page)).toBeCloseTo(0.5, 1)
  await page.mouse.up()

  await page.locator('[data-star="sun"]').evaluate((button: HTMLButtonElement) => button.click())
  await expect.poll(() => canvasPixelRatio(page)).toBeCloseTo(0.5, 1)
  const powerFrame = PNG.sync.read(await canvas.screenshot({ scale: 'css' }))
  let visiblePixels = 0
  for (let offset = 0; offset < powerFrame.data.length; offset += 4) {
    if (powerFrame.data[offset]! + powerFrame.data[offset + 1]! + powerFrame.data[offset + 2]! > 30) visiblePixels++
  }
  expect(visiblePixels).toBeGreaterThan(100)
  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await openPreferences(page)
  await expect(page.getByRole('switch', { name: 'Power saving mode' })).not.toBeChecked()
  await expect.poll(() => canvasPixelRatio(page)).toBeCloseTo(1, 1)
})

test('caps sustained power-saving animation draws at 30 FPS', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await trackRendering(page)
  await openPreferences(page)
  await page.getByRole('switch', { name: 'Power saving mode' }).check()
  await expectIdle(page)
  const before = (await stats(page)).drawTimes.length
  await page.locator('[data-star="sun"]').evaluate((button: HTMLButtonElement) => button.click())
  await expect.poll(async () => (await stats(page)).drawTimes.length - before).toBeGreaterThanOrEqual(6)
  await expectIdle(page)
  const drawTimes = (await stats(page)).drawTimes.slice(before)
  const sustainedIntervals = drawTimes.slice(2).map((time, index) => time - drawTimes[index + 1]!)
  expect(sustainedIntervals.length).toBeGreaterThanOrEqual(4)
  for (const interval of sustainedIntervals) expect(interval).toBeGreaterThanOrEqual(28)
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
