import { expect, test, type Page } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import type { ConstellationChart } from '../src/constellations'
import { openFilter, openSpecs, openViewer } from './support'

async function selectObject(page: Page, name: string, showSpecs = true): Promise<void> {
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill(name)
  await page.getByRole('button', { name: `Select ${name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  if (showSpecs) await openSpecs(page)
}

test('keeps Furud components and scoped cards identical from a clean chart and the loaded catalog', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const checkFurud = async () => {
    await openSpecs(page)
    await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'hip-30122')
    await expect(page.locator('#star-components button')).toHaveText(['Aa', 'Ab'])
    await expect(page.getByRole('button', { name: 'Show Furud Aa', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#luminosity')).toHaveText('1,609.359 L☉')
    await expect(page.locator('#radius')).toHaveText('5.764 R☉')
    for (const metric of ['luminosity', 'radius']) {
      await expect(page.locator(`#${metric}-toggle`)).toBeDisabled()
      await page.locator(`#${metric}-row`).focus()
      await expect(page.locator(`#${metric}-source-tooltip`)).toBeVisible()
      await expect(page.locator(`#${metric}-source-tooltip`)).toContainText(`Furud Aa’s individual ${metric} is unavailable`)
      await page.locator(`#${metric}-row dt`).click()
      await expect(page.locator(`#${metric}-card`)).toBeHidden()
    }
    await page.getByRole('button', { name: 'Show Furud Ab', exact: true }).click()
    await expect(page.locator('#luminosity')).toHaveText('—')
    await expect(page.locator('#radius')).toHaveText('—')
    await expect(page.locator('#luminosity-source-tooltip')).toBeHidden()
    await expect(page.locator('#radius-source-tooltip')).toBeHidden()
    await page.getByRole('button', { name: 'Show Furud Aa', exact: true }).click()
  }

  await openViewer(page)
  await openSpecs(page)
  await page.locator('#constellation-toggle').click()
  await page.locator('#constellation-card [data-hip="30122"]').click()
  await page.locator('#constellation-close').click()
  await checkFurud()
  await page.locator('#radius-row').focus()
  await page.locator('#selected-object-card').screenshot({ path: testInfo.outputPath('furud-radius-source.png') })
  // A catalog refresh must retain the explicitly added companion too.
  await openFilter(page)
  await page.getByLabel('Object visibility distance', { exact: true }).fill('24')
  await page.getByRole('switch', { name: 'Always show bright stars', exact: true }).check()
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await checkFurud()

  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await openFilter(page)
  for (const name of ['Always show bright stars', 'Western constellation stars', 'Famous cluster stars']) {
    await page.getByRole('switch', { name, exact: true }).check()
  }
  for (const category of await page.locator('#object-categories input:enabled').all()) await category.check()
  await page.locator('details.filter-dropdown > summary').click()
  for (const subtype of await page.locator('input[data-filter-key]:enabled').all()) await subtype.check()
  await expect(page.locator('#object-type-filter-summary')).toHaveText('All')
  await page.getByLabel('Object visibility distance', { exact: true }).fill('24')
  await expect(page.locator('#object-distance-limit-value')).toHaveText('10000 ly')
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await selectObject(page, 'Furud Aa')
  await checkFurud()
  expect(errors).toEqual([])
})

test('opens all 88 charts with finite outlines and readable labels', { tag: '@mobile' }, async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const directory = new URL('../src/data/constellations/', import.meta.url)
  const charts = readdirSync(directory).filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(new URL(name, directory), 'utf8')) as ConstellationChart)
  expect(charts).toHaveLength(88)
  await openViewer(page)
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.getByLabel('Western constellation stars', { exact: true }).check()
  await page.locator('#object-distance-limit').fill('24')
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await openSpecs(page)
  await page.locator('#constellation-toggle').click()
  await page.locator('#constellation-lock').click()
  const card = page.locator('#constellation-card')
  const problems: { constellation: string; fits: boolean; overlaps: boolean; finite: boolean }[] = []
  for (const chart of charts) {
    const star = chart.stars.filter((star) => star.object.constellation === chart.name)
      .sort((a, b) => a.magnitude_v - b.magnitude_v)[0]!
    await page.getByRole('button', { name: 'Objects', exact: true }).click()
    await page.getByLabel('Search objects').fill(`HIP ${star.hip}`)
    await page.locator('#star-list button[data-star]').first().click()
    await page.getByRole('button', { name: 'Objects', exact: true }).click()
    await expect(card.locator('#constellation-heading')).toHaveText(chart.name)
    await expect(card.locator('.constellation-line')).toHaveCount(chart.lines.length)
    await expect(card.locator('.constellation-boundary')).toHaveCount(chart.boundaries.length)
    await expect(card.locator('.constellation-selected-ring')).toHaveCount(1)
    await expect(card.locator('.constellation-star-name')).toHaveCount(1)
    const layout = await card.locator('#constellation-chart > svg').evaluate((diagram) => {
      const bounds = diagram.getBoundingClientRect()
      const labels = [...diagram.querySelectorAll('.constellation-star-name, .constellation-bayer, .constellation-neighbor')]
        .map((label) => label.getBoundingClientRect())
      return {
        fits: labels.every((label) => label.left >= bounds.left && label.right <= bounds.right && label.top >= bounds.top && label.bottom <= bounds.bottom),
        overlaps: labels.some((a, i) => labels.slice(i + 1).some((b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)),
        finite: [...diagram.querySelectorAll('.constellation-boundary, .constellation-line')]
          .every((line) => [...line.attributes].every((attribute) => !/NaN|Infinity/.test(attribute.value))),
      }
    })
    if (!layout.fits || layout.overlaps || !layout.finite) problems.push({ constellation: chart.name, ...layout })
    if (['Orion', 'Serpens', 'Andromeda', 'Ursa Minor', 'Octans', 'Hydra', 'Draco', 'Tucana'].includes(chart.name)) {
      await card.screenshot({ path: testInfo.outputPath(`${chart.abbreviation}-coverage.png`) })
    }
  }
  expect(problems).toEqual([])
  expect(errors).toEqual([])
})

test('loads Centaurus on demand and follows exact components across locked charts', { tag: '@mobile' }, async ({ page }, testInfo) => {
  const chartRequests: string[] = []
  page.on('request', (request) => {
    if (/\/(canis-major|centaurus)-[^/]+\.js(?:\?|$)/.test(request.url())) chartRequests.push(request.url())
  })
  await openViewer(page)
  expect(chartRequests).toHaveLength(0)
  await selectObject(page, 'Alpha Centauri A')
  await page.locator('#constellation-toggle').click()
  const card = page.locator('#constellation-card')
  await expect(card.locator('#constellation-heading')).toHaveText('Centaurus')
  await expect(card.locator('.constellation-star')).toHaveCount(17)
  await expect(card.locator('.constellation-bayer')).toHaveCount(15)
  await expect(card.locator('.constellation-line')).toHaveCount(16)
  await expect(card.locator('.constellation-boundary')).toHaveCount(20)
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText('Alpha Centauri A')
  expect((await card.locator('.constellation-neighbor').allTextContents()).sort())
    .toEqual(['Antlia', 'Carina', 'Circinus', 'Crux', 'Hydra', 'Lupus', 'Musca', 'Vela'])
  expect(chartRequests.filter((url) => url.includes('/centaurus-'))).toHaveLength(1)
  expect(chartRequests.some((url) => url.includes('/canis-major-'))).toBe(false)
  const layout = await card.locator('#constellation-chart > svg').evaluate((diagram) => {
    const bounds = diagram.getBoundingClientRect()
    const labels = [...diagram.querySelectorAll('.constellation-star-name, .constellation-bayer, .constellation-neighbor')]
      .map((label) => label.getBoundingClientRect())
    return {
      fits: labels.every((label) => label.left >= bounds.left && label.right <= bounds.right && label.top >= bounds.top && label.bottom <= bounds.bottom),
      overlaps: labels.some((a, i) => labels.slice(i + 1).some((b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)),
    }
  })
  expect(layout).toEqual({ fits: true, overlaps: false })
  await card.screenshot({ path: testInfo.outputPath('centaurus-card.png') })
  await page.locator('#constellation-lock').click()
  await page.getByRole('button', { name: 'Show Alpha Centauri B', exact: true }).click()
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText('Alpha Centauri B')
  await expect(card.locator('[data-hip="71683"] .constellation-star-name')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show Alpha Centauri C (Proxima Centauri)', exact: true }).click()
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText('Proxima Centauri')
  await expect(card.locator('[data-hip="71683"] .constellation-bayer')).toHaveText('α')
  const beta = card.locator('[data-hip="68702"]')
  const betaName = (await beta.getAttribute('aria-label'))!.replace(/^Select /, '')
  await beta.click()
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText(betaName)
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'bright-hadar')
  await expect(card.locator('#constellation-visibility')).toBeVisible()
  await selectObject(page, 'Sirius A', false)
  await expect(card.locator('#constellation-heading')).toHaveText('Canis Major')
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText('Sirius A')
  await selectObject(page, 'Alpha Centauri A', false)
  await expect(card.locator('#constellation-heading')).toHaveText('Centaurus')
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText('Alpha Centauri A')
  expect(chartRequests.filter((url) => url.includes('/centaurus-'))).toHaveLength(1)
})

test('maps visible latitudes and updates the evening month bar for the selected latitude', { tag: '@mobile' }, async ({ page }, testInfo) => {
  await openViewer(page)
  await openSpecs(page)
  await page.locator('#constellation-toggle').click()
  const card = page.locator('#constellation-card')
  const visibility = card.locator('#constellation-visibility')
  await expect(visibility).toBeVisible()
  await expect(card.locator('#constellation-visible-latitudes-value')).toHaveText('90° S–73.3° N')
  await expect(card.locator('#constellation-visible-months-value')).toHaveText('Dec–Apr')
  await expect(card.locator('.constellation-map-latitude')).toHaveCount(9)
  await expect(card.locator('.constellation-visibility-month')).toHaveCount(12)
  expect(await card.locator('.constellation-visibility-month.is-visible').evaluateAll((months) => months.map((month) => (month as HTMLElement).dataset.month))).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'Dec'])
  await expect.poll(() => card.locator('.constellation-map-visible-land').evaluate((land) => getComputedStyle(land).fill)).toBe('rgb(0, 0, 0)')
  const layout = await visibility.evaluate((section) => {
    const map = section.querySelector('#constellation-visibility-map')!.getBoundingClientRect()
    const bar = section.querySelector('#constellation-visibility-months')!.getBoundingClientRect()
    const tracks = [...section.querySelectorAll('.constellation-visibility-month i')].map((track) => track.getBoundingClientRect().height)
    return { mapLeft: map.left, mapRight: map.right, barLeft: bar.left, fits: section.scrollWidth <= section.clientWidth, tracks }
  })
  expect(layout.barLeft).toBeGreaterThan(layout.mapRight)
  expect(layout.fits).toBe(true)
  expect(layout.tracks.every((height) => height === 16)).toBe(true)
  await card.screenshot({ path: testInfo.outputPath('constellation-visibility.png') })
  await page.getByLabel('Latitude', { exact: true }).selectOption('80')
  await expect(card.locator('#constellation-visible-months-value')).toHaveText('None at 10 pm')
  await expect(card.locator('.constellation-visibility-month.is-visible')).toHaveCount(0)
  await page.getByLabel('Latitude', { exact: true }).selectOption('0')
  await expect(card.locator('#constellation-visible-months-value')).toHaveText('Nov–Apr')
  await card.getByRole('button', { name: 'Select Adhara A', exact: true }).click()
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue('0')
  await expect(card.locator('#constellation-visible-latitudes-value')).toHaveText('90° S–61.0° N')
  await expect(card.locator('#constellation-visibility-months')).toHaveAttribute('aria-label', /^Adhara A at 0°/)
})

test('shows a labelled Canis Major chart with orange selection, lock, and close controls', { tag: '@mobile' }, async ({ page }, testInfo) => {
  await openViewer(page)
  await openSpecs(page)
  await page.locator('#constellation-row dt').click()
  const card = page.locator('#constellation-card')
  await expect(card).toBeVisible()
  await expect(page.locator('#constellation-heading')).toHaveText('Canis Major')
  await expect(card.locator('#constellation-chart title')).toHaveCount(0)
  await expect(card.locator('.constellation-star-name')).toHaveCount(1)
  await expect(card.locator('.constellation-bayer')).toHaveCount(15)
  await expect(card.locator('.constellation-selected-ring')).toHaveCount(1)
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText('Sirius A')
  await expect.poll(() => card.locator('.is-selected .constellation-star-name').evaluate((label) => getComputedStyle(label).fill)).toBe('rgb(255, 138, 42)')
  await expect(card.locator('[data-hip="33579"] .constellation-bayer')).toHaveText('ε')
  const labels = await card.locator('.constellation-star-name, .constellation-bayer').evaluateAll((labels) => labels.map((label) => {
    const bounds = label.getBoundingClientRect(), chart = label.closest('svg')!.getBoundingClientRect()
    return { fits: bounds.left >= chart.left && bounds.right <= chart.right && bounds.top >= chart.top && bounds.bottom <= chart.bottom,
      selected: label.parentElement!.classList.contains('is-selected'), fontSize: getComputedStyle(label).fontSize }
  }))
  expect(labels.every((label) => label.fits)).toBe(true)
  expect(labels.every((label) => label.fontSize === (label.selected ? '14px' : '12px'))).toBe(true)
  const labelBounds = await card.locator('.constellation-star-name, .constellation-bayer').evaluateAll((labels) => labels.map((label) => {
    const box = label.getBoundingClientRect()
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom }
  }))
  for (let first = 0; first < labelBounds.length; first++) {
    for (let second = first + 1; second < labelBounds.length; second++) {
      const a = labelBounds[first]!, b = labelBounds[second]!
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true)
    }
  }
  await expect(card.locator('.constellation-boundary')).toHaveCount(6)
  expect((await card.locator('.constellation-neighbor').allTextContents()).sort()).toEqual(['Columba', 'Lepus', 'Monoceros', 'Puppis'])
  const framing = await card.locator('#constellation-chart > svg').evaluate((diagram) => {
    const chart = diagram.getBoundingClientRect()
    const ys = [...diagram.querySelectorAll<SVGGElement>('.constellation-star')].map((star) => Number(star.dataset.y))
    const viewHeight = (diagram as SVGSVGElement).viewBox.baseVal.height
    const neighbors = [...diagram.querySelectorAll('.constellation-neighbor')].map((label) => label.getBoundingClientRect())
    const borders = [...diagram.querySelectorAll('.constellation-boundary')].map((border) => border.getBoundingClientRect())
    return { figureFraction: (Math.max(...ys) - Math.min(...ys)) / viewHeight,
      bordersVisible: borders.every((border) => border.left >= chart.left && border.right <= chart.right && border.top >= chart.top && border.bottom <= chart.bottom),
      neighborsAtCorners: neighbors.every((label) => (label.left < chart.left + chart.width / 4 || label.right > chart.right - chart.width / 4)
        && (label.top < chart.top + chart.height / 8 || label.bottom > chart.bottom - chart.height / 8)) }
  })
  expect(framing.figureFraction).toBeGreaterThan(0.7)
  expect(framing.bordersVisible).toBe(true)
  expect(framing.neighborsAtCorners).toBe(true)
  await expect(card.locator('[data-hip="32349"] .constellation-bayer')).toHaveText('α')
  await expect.poll(() => card.locator('.constellation-sources').evaluate((section) => getComputedStyle(section).borderTopStyle)).toBe('solid')
  await card.screenshot({ path: testInfo.outputPath('canis-major.png') })
  await page.getByRole('button', { name: 'Keep Constellation open', exact: true }).click()
  const viewport = page.viewportSize()!
  await page.mouse.move(viewport.width / 2, viewport.height - 110)
  await page.mouse.down()
  await page.mouse.move(viewport.width / 2 + 20, viewport.height - 100, { steps: 3 })
  await page.mouse.up()
  await expect(card).toBeVisible()
  await expect(page.locator('#constellation-lock')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Close constellation card', exact: true }).click()
  await expect(card).toBeHidden()
  await expect(page.locator('#constellation-toggle')).toBeFocused()
  await page.locator('#constellation-toggle').press('Enter')
  await expect(card).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()
  await expect(page.locator('#constellation-toggle')).toBeFocused()
  await page.locator('#constellation-toggle').click()
  await page.locator('#constellation-lock').click()
  await page.mouse.move(viewport.width / 2, viewport.height - 110)
  await page.mouse.down()
  await page.mouse.move(viewport.width / 2 + 20, viewport.height - 100, { steps: 3 })
  await page.mouse.up()
  await expect(card).toBeHidden()
})

test('keeps Sirius B separate from the figure star and follows newly available charts', async ({ page }, testInfo) => {
  await openViewer(page)
  await openSpecs(page)
  await page.locator('#constellation-toggle').click()
  await page.locator('#constellation-lock').click()
  await page.getByRole('button', { name: 'Show Sirius B', exact: true }).click()
  const card = page.locator('#constellation-card')
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText('Sirius B')
  await expect(card.locator('.constellation-star-name')).toHaveCount(1)
  await expect(card.locator('[data-hip="32349"] .constellation-star-name')).toHaveCount(0)
  await expect(card.locator('[data-hip="32349"] .constellation-bayer')).toHaveText('α')
  await card.screenshot({ path: testInfo.outputPath('canis-major-sirius-b.png') })
  await card.getByText('Sources', { exact: true }).click()
  await expect(page.locator('#constellation-source-links a')).toHaveCount(4)
  await selectObject(page, 'Ross 154')
  await expect(card).toBeVisible()
  await expect(card.locator('#constellation-heading')).toHaveText('Sagittarius')
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText('Ross 154')
  await expect(page.locator('#constellation-toggle')).toBeEnabled()
})

test('selects figure stars with tooltips while the constellation overlay is off', { tag: '@mobile' }, async ({ page }, testInfo) => {
  await openViewer(page)
  await openSpecs(page)
  await page.locator('#constellation-toggle').click()
  const card = page.locator('#constellation-card')
  const mirzam = card.getByRole('button', { name: 'Select Mirzam', exact: true })
  await mirzam.focus()
  const tooltip = page.locator('#constellation-tooltip-30324')
  await expect(tooltip).toBeVisible()
  await expect(tooltip.locator('.constellation-tooltip-object')).toHaveText('Mirzam')
  await expect(tooltip.locator('.star-swatch')).toBeVisible()
  await expect(tooltip.locator('.constellation-tooltip-metric > span')).toHaveText(['Distance from Sun', 'Apparent magnitude'])
  await expect(tooltip.locator('.constellation-tooltip-metric strong').nth(0)).toHaveText(/^[\d,]+ ly$/)
  await expect(tooltip.locator('.constellation-tooltip-metric strong').nth(1)).toHaveText('2.0')
  const box = await tooltip.boundingBox(), chartBox = await page.locator('#constellation-chart').boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(chartBox!.x)
  expect(box!.x + box!.width).toBeLessThanOrEqual(chartBox!.x + chartBox!.width)
  const rows = await tooltip.locator(':scope > span').evaluateAll((rows) => rows.map((row) => {
    const box = row.getBoundingClientRect(), parent = row.parentElement!.getBoundingClientRect()
    return { top: box.top, bottom: box.bottom, parentTop: parent.top, parentBottom: parent.bottom }
  }))
  expect(rows.every((row) => row.top >= row.parentTop && row.bottom <= row.parentBottom)).toBe(true)
  await card.screenshot({ path: testInfo.outputPath('mirzam-tooltip.png') })
  await mirzam.press('Enter')
  await expect(page.locator('#star-name')).toHaveText('Mirzam')
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText('Mirzam')
  await expect(card.locator('.constellation-star-name')).toHaveCount(1)
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Select Adhara A', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Adhara')
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText('Adhara A')
  await expect(page.locator('#show-western-constellation-stars')).not.toBeChecked()
})

test('plots a non-star at its own sky coordinates in Canis Major', async ({ page }, testInfo) => {
  await openViewer(page)
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.getByRole('switch', { name: 'Stellar remnants', exact: true }).check()
  await page.locator('details.filter-dropdown > summary').click()
  await page.getByLabel('Pulsars', { exact: true }).check()
  await page.locator('#object-distance-limit').fill('24')
  await selectObject(page, 'PSR J0630-2834')
  await page.locator('#constellation-toggle').click()
  const card = page.locator('#constellation-card')
  await expect(card.locator('.is-selected')).toHaveAttribute('data-object-type', 'pulsar')
  await expect(card.locator('.is-selected .constellation-star-name')).toHaveText('PSR J0630-2834')
  await expect(card.locator('.constellation-selected-ring')).toHaveCount(1)
  await expect(card.locator('.constellation-star-name')).toHaveCount(1)
  await card.screenshot({ path: testInfo.outputPath('canis-major-pulsar.png') })
})
