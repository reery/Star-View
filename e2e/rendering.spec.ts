import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

interface RenderingStats {
  draws: number
  drawTimes: number[]
  labelMutations: number
  labelSizeReads: number
  labelSizeReadsByStar: Record<string, number>
  obstacleBoundsReads: number
  frameDrawCalls: number
  framePointVertices: number
  listReplacements: number
}

async function trackRendering(page: Page) {
  await page.addInitScript(() => {
    const stats = { draws: 0, drawTimes: [] as number[], labelMutations: 0, labelSizeReads: 0, labelSizeReadsByStar: {} as Record<string, number>, obstacleBoundsReads: 0, frameDrawCalls: 0, framePointVertices: 0, listReplacements: 0 }
    Object.assign(window, { renderStats: stats })
    for (const property of ['offsetWidth', 'offsetHeight']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)!
      Object.defineProperty(HTMLElement.prototype, property, {
        ...descriptor,
        get(this: HTMLElement) {
          if (this.classList.contains('map-label')) {
            stats.labelSizeReads++
            const id = this.closest<HTMLElement>('.map-anchor')?.dataset.starId
            if (id) stats.labelSizeReadsByStar[id] = (stats.labelSizeReadsByStar[id] ?? 0) + 1
          }
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

function starReadDeltas(before: RenderingStats, after: RenderingStats): Record<string, number> {
  return Object.fromEntries(Object.entries(after.labelSizeReadsByStar)
    .map(([id, reads]) => [id, reads - (before.labelSizeReadsByStar[id] ?? 0)] as const)
    .filter(([, delta]) => delta !== 0))
}

function remeasuredStars(before: RenderingStats, after: RenderingStats, allowed: readonly string[] = []): string[] {
  return Object.keys(starReadDeltas(before, after)).filter((id) => before.labelSizeReadsByStar[id] && !allowed.includes(id))
}

async function openPreferences(page: Page) {
  const button = page.getByRole('button', { name: 'Preferences', exact: true })
  if (await button.getAttribute('aria-expanded') === 'false') await button.click()
}

async function openFilter(page: Page) {
  const button = page.getByRole('button', { name: 'Filter', exact: true })
  if (await button.getAttribute('aria-expanded') === 'false') await button.click()
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

for (const catalog of ['nearest-neighbors', 'nearest-1000']) {
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
}

test('rotates nearest-neighbors without remeasuring label sizes', async ({ page, context }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await trackRendering(page)
  await openFilter(page)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-neighbors')
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
  console.log(`nearest-neighbors rotation: ${JSON.stringify(measurement)}`)
  await testInfo.attach('rotation-metrics', { body: JSON.stringify(measurement, null, 2), contentType: 'application/json' })
  expect(draws).toBeGreaterThan(10)
  expect(measurement.labelSizeReads).toBe(0)
  expect(measurement.obstacleBoundsReads).toBe(0)
  await expectIdle(page)
})

test('records high-density nearest-1000 rotation evidence', { tag: '@mobile' }, async ({ page, context }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await trackRendering(page)
  await openFilter(page)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-1000')
  await page.getByLabel('V magnitude limit', { exact: true }).fill('25')
  await page.getByLabel('Arrow length', { exact: true }).selectOption('50000')
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
  const arrows = await page.locator('.projected-labels').evaluate((layer) =>
    (layer as HTMLElement & { motionArrowSnapshot(): unknown[] }).motionArrowSnapshot().length)
  const anchors = await page.locator('.map-anchor').count()
  const measurement = {
    draws: after.draws - before.draws,
    arrows,
    anchors,
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
  expect(measurement.arrows, 'arrows are drawn in WebGL').toBeGreaterThan(100)
  await expect(page.locator('.motion-arrow')).toHaveCount(0)
  expect(measurement.ordinaryLayoutPasses).toBeLessThan(measurement.draws)
  expect(measurement.labelSizeReads).toBe(0)
  expect(measurement.obstacleBoundsReads).toBe(0)
  expect(measurement.labelMutations / measurement.draws, 'at most two label writes per anchor per frame').toBeLessThan(anchors * 2)
  await expectIdle(page)
})

test('coalesces virtual-list scroll renders and skips unchanged ranges', async ({ page }) => {
  await trackRendering(page)
  await openFilter(page)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-1000')
  await expectIdle(page)
  const catalog = page.getByRole('button', { name: 'Objects', exact: true })
  if (await catalog.getAttribute('aria-expanded') === 'false') await catalog.click()
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
  expect(await list.locator('.catalog-entry').first().evaluate((element) => (element as HTMLElement).style.transform)).toBe('translateY(4644px)')
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
  await openFilter(page)
  await expectIdle(page)
  for (const catalog of ['nearest-neighbors', 'nearest-100']) {
    await openFilter(page)
    await page.getByLabel('Catalog', { exact: true }).selectOption(catalog)
    await expectIdle(page)
    for (const action of [
      () => page.getByRole('button', { name: 'Grid', exact: true }).click(),
      () => page.getByRole('button', { name: 'Zoom in', exact: true }).click(),
      () => page.getByRole('button', { name: 'Reset view', exact: true }).click(),
      () => page.getByLabel('V magnitude limit', { exact: true }).fill('12'),
      () => page.locator('[data-star="sun"]').evaluate((button: HTMLButtonElement) => button.click()),
      async () => {
        await openPreferences(page)
        await page.getByLabel('pc', { exact: true }).check()
        await openFilter(page)
      },
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
    await openPreferences(page)
    await page.getByLabel('ly', { exact: true }).check()
    await openFilter(page)
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
  await expectIdle(page)
  const resized = await stats(page)
  expect(remeasuredStars(before, resized), 'label sizes do not depend on the viewport').toEqual([])
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
  await expectIdle(page)
  const selected = await stats(page)
  expect(starReadDeltas(before, selected)['barnards-star']).toBeGreaterThan(0)
  expect(remeasuredStars(before, selected, ['barnards-star', 'sirius-a']), 'only selection changes restyle names').toEqual([])
  await page.getByLabel('pc', { exact: true }).check()
  await expect(page.locator('.distance-label')).toContainText('pc')
  await expect.poll(async () => (await stats(page)).labelSizeReads).toBeGreaterThan(selected.labelSizeReads)
  await expectIdle(page)
  expect(starReadDeltas(selected, await stats(page)), 'unit changes only remeasure the distance label').toEqual({})
})

test('measures each star name once while rotating zoomed in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await trackRendering(page)
  await openFilter(page)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-1000')
  await page.getByLabel('V magnitude limit', { exact: true }).fill('25')
  for (let step = 0; step < 6; step++) await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expectIdle(page)
  const before = await stats(page)
  const bounds = (await page.locator('#scene canvas').boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + bounds.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.5, { steps: 60 })
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + bounds.height * 0.5, { steps: 60 })
  await page.mouse.up()
  await expectIdle(page)
  const after = await stats(page)
  const deltas = starReadDeltas(before, after)
  expect(Object.keys(deltas).length, 'rotation must bring new names into the budget').toBeGreaterThan(0)
  for (const [id, reads] of Object.entries(deltas)) expect(reads, `${id} is measured once (width and height)`).toBeLessThanOrEqual(2)
  expect(remeasuredStars(before, after), 'names measured before rotating keep their cached sizes').toEqual([])
})

test('omits filtered cores and halos from GPU point submissions', async ({ page }) => {
  await trackRendering(page)
  await openFilter(page)
  await expectIdle(page)
  await expect.poll(async () => (await stats(page)).framePointVertices).toBe(await expectedPointVertices(page))
  await page.getByLabel('Object visibility distance', { exact: true }).fill('0')
  await expect(page.locator('[data-star-id="barnards-star"]')).toHaveCount(0)
  await expect.poll(async () => (await stats(page)).framePointVertices).toBe(await expectedPointVertices(page))
  await page.getByLabel('Object visibility distance', { exact: true }).fill('14')
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

test('uses the selected renderer resolution cap', { tag: '@mobile' }, async ({ page, isMobile }) => {
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
