import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { readFileSync } from 'node:fs'
import { Box3, PerspectiveCamera, Sphere, Spherical, Vector3 } from 'three'
import { parseStarCatalog, type Star } from '../src/catalog'
import { galacticToWorld } from '../src/astronomy'
import { openFilter, openPreferences, openViewer, starPoint } from './support'

function homeCamera(stars: readonly Star[], bounds: { width: number; height: number }) {
  const sphere = new Box3().setFromPoints(stars.map(galacticToWorld)).getBoundingSphere(new Sphere())
  sphere.radius = Math.max(sphere.radius, 0.75)
  const camera = new PerspectiveCamera(44, bounds.width / bounds.height, 0.01, 1000)
  const verticalAngle = camera.fov * Math.PI / 360
  const fitAngle = Math.min(verticalAngle, Math.atan(Math.tan(verticalAngle) * camera.aspect))
  const distance = Math.min(Math.max(30, sphere.radius * 24), sphere.radius / Math.sin(fitAngle) * 1.6)
  camera.position.copy(sphere.center).addScaledVector(new Vector3(-4.8, 3.8, -6.2).normalize(), distance)
  camera.lookAt(sphere.center)
  camera.updateMatrixWorld()
  return camera
}

test('loads each generated catalog payload only when first selected', async ({ page }) => {
  const catalogRequests: string[] = []
  page.on('request', (request) => {
    const match = new URL(request.url()).pathname.match(/\/assets\/(nearest-(?:neighbors|100|1000)-[^/]+\.json)$/)
    if (match) catalogRequests.push(match[1]!)
  })
  await openViewer(page)
  expect(catalogRequests.filter((name) => name.startsWith('nearest-neighbors-'))).toHaveLength(1)
  expect(catalogRequests.some((name) => name.startsWith('nearest-100-'))).toBe(false)
  expect(catalogRequests.some((name) => name.startsWith('nearest-1000-'))).toBe(false)
  await openFilter(page)
  const selector = page.getByLabel('Catalog', { exact: true })
  await selector.selectOption('nearest-1000')
  await expect(page.locator('#catalog-count')).toHaveText('1001')
  expect(catalogRequests.filter((name) => name.startsWith('nearest-1000-'))).toHaveLength(1)
  await selector.selectOption('nearest-neighbors')
  await expect(page.locator('#catalog-count')).toHaveText('22')
  await selector.selectOption('nearest-1000')
  await expect(page.locator('#catalog-count')).toHaveText('1001')
  expect(catalogRequests.filter((name) => name.startsWith('nearest-1000-'))).toHaveLength(1)
})

function changedPixels(before: Buffer, after: Buffer): number {
  const first = PNG.sync.read(before)
  const second = PNG.sync.read(after)
  expect(first.width).toBe(second.width)
  expect(first.height).toBe(second.height)
  let changed = 0
  for (let offset = 0; offset < first.data.length; offset += 4) {
    const difference = Math.abs(first.data[offset]! - second.data[offset]!) +
      Math.abs(first.data[offset + 1]! - second.data[offset + 1]!) +
      Math.abs(first.data[offset + 2]! - second.data[offset + 2]!)
    if (difference > 30) changed++
  }
  return changed
}

async function sceneFits(page: Page) {
  const problems = await page.evaluate(() => {
    const failures: string[] = []
    const scene = document.querySelector('#scene')!.getBoundingClientRect()
    const inspector = document.querySelector('#inspector')!.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth > viewportWidth) failures.push('page horizontal overflow')
    if (scene.width < 200 || scene.height < 200) failures.push('scene too small')
    if (scene.right > inspector.left + 1 && scene.bottom > inspector.top + 1) failures.push('scene under inspector')
    const labels = [...document.querySelectorAll<HTMLElement>('.map-label')].filter((label) => label.checkVisibility())
    for (const label of labels) {
      const bounds = label.getBoundingClientRect()
      if (bounds.left < scene.left || bounds.right > scene.right || bounds.top < scene.top || bounds.bottom > scene.bottom) failures.push(`clipped label ${label.textContent}`)
      for (const obstacle of label.matches('.distance-label') ? [] : document.querySelectorAll<HTMLElement>('[data-scene-obstacle]')) {
        if (!obstacle.checkVisibility()) continue
        const other = obstacle.getBoundingClientRect()
        if (bounds.left < other.right && bounds.right > other.left && bounds.top < other.bottom && bounds.bottom > other.top) failures.push(`label overlaps ${obstacle.className}`)
      }
    }
    for (const control of document.querySelectorAll<HTMLElement>('button, summary')) {
      if (!control.checkVisibility()) continue
      const bounds = control.getBoundingClientRect()
      if (bounds.width < 44 || bounds.height < 44) failures.push(`small control ${control.getAttribute('aria-label')}`)
      if (bounds.left < 0 || bounds.right > viewportWidth + 1) failures.push('control overflow')
    }
    return failures
  })
  expect(problems).toEqual([])
}

test('switches project catalogs while preserving settings and compatible selection', async ({ page }, testInfo) => {
  await openViewer(page)
  await openPreferences(page)
  await openFilter(page)
  const selector = page.getByLabel('Catalog', { exact: true })
  await expect(selector).toHaveValue('nearest-neighbors')
  await expect(page.locator('#object-type')).toHaveText('White star')
  await expect(page.locator('#constellation')).toHaveText('Canis Major')
  await expect(page.locator('#absolute-mag')).toHaveText('1.42')
  await expect(page.getByLabel('ly', { exact: true })).toBeChecked()
  await page.getByLabel('V magnitude limit', { exact: true }).fill('9')
  await page.getByLabel('Object visibility distance', { exact: true }).fill('20')
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await page.locator('.catalog summary').click()
  for (const id of ['nearest-100', 'nearest-neighbors', 'nearest-100']) {
    await selector.selectOption(id)
    await expect(page.locator('#scene canvas')).toHaveCount(1)
    await expect(page.locator('.projected-labels')).toHaveCount(1)
    await expect(page.locator('.catalog-entry')).toHaveCount(id === 'nearest-100' ? 101 : 22)
    await expect(page.locator('#star-name')).toHaveText('Sirius A')
    await expect(page.locator('#visibility-base')).toHaveText('Sirius A')
    await expect(page.locator('#distance-unit')).toHaveText(' ly')
    await expect(page.locator('#magnitude-limit')).toHaveValue('9')
    await expect(page.locator('#object-distance-limit')).toHaveValue('20')
    await expect(page.locator('#toggle-grid')).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.catalog')).toHaveAttribute('open')
  }
  await page.getByRole('button', { name: 'Select GJ 229 A', exact: true }).click()
  await expect(page.locator('#constellation')).toHaveText('Lepus')
  await expect(page.locator('#luminosity-row')).toBeHidden()
  const transverseArrow = page.locator('.motion-arrow[data-motion-mode="transverse"]').first()
  await expect(transverseArrow).toBeVisible()
  await expect(transverseArrow.locator('.motion-arrow-shaft')).toHaveCSS('stroke-dasharray', '3px, 2px')
  await page.screenshot({ path: testInfo.outputPath('nearest-100.png'), fullPage: true })
  await selector.selectOption('nearest-neighbors')
  await expect(page.locator('#star-details')).toBeHidden()
  await expect(page.locator('#visibility-base')).toHaveText('Sun')
  await expect(page.locator('[data-star-id="sun"]')).toHaveAttribute('data-visibility', 'base')
  await selector.selectOption('nearest-100')
  await expect(page.locator('#star-details')).toBeHidden()
  await expect(page.locator('#visibility-base')).toHaveText('Sun')
  await sceneFits(page)
})

test('searches the virtualized nearest-1000 list within bounded name budgets', async ({ page, isMobile }) => {
  await openViewer(page)
  await openFilter(page)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-1000')
  await expect(page.locator('#catalog-count')).toHaveText('1001')
  const nameBudget = isMobile ? 60 : 120
  const activeAnchors = await page.locator('.map-anchor[data-star-id]').count()
  const activeArrows = await page.locator('.motion-arrow').count()
  expect(activeAnchors).toBeLessThanOrEqual(nameBudget + activeArrows + 2)
  expect(await page.locator('.star-label:visible').count()).toBeLessThanOrEqual(nameBudget)
  const catalog = page.locator('details.catalog')
  if (await catalog.getAttribute('open') === null) await catalog.locator('summary').click()
  const renderedRows = page.locator('.catalog-entry')
  expect(await renderedRows.count()).toBeLessThan(30)
  await page.getByLabel('Search objects').fill('cns5 4902')
  await expect(renderedRows).toHaveCount(1)
  await page.getByRole('button', { name: 'Select HD 331161B', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('HD 331161B')
  await expect(page.locator('[data-star-id="cns5-4902"]')).toHaveClass(/is-selected/)
  await sceneFits(page)
  const selectedNameOverlapsDistance = await page.evaluate(() => {
    const selectedName = document.querySelector<HTMLElement>('[data-star-id="cns5-4902"] .star-label')!.getBoundingClientRect()
    const distance = document.querySelector<HTMLElement>('.distance-label')!.getBoundingClientRect()
    return selectedName.left < distance.right && selectedName.right > distance.left &&
      selectedName.top < distance.bottom && selectedName.bottom > distance.top
  })
  expect(selectedNameOverlapsDistance).toBe(false)
})

test('defaults to light-years, converts every distance without moving the camera, and remembers units', async ({ page }) => {
  await openViewer(page)
  await openPreferences(page)
  const before = await starPoint(page, 'sun')
  await expect(page.getByLabel('ly', { exact: true })).toBeChecked()
  await expect(page.locator('#distance-value')).toHaveText('8.61')
  await expect(page.locator('#grid-spacing')).toHaveText('1.63 ly grid')
  await expect(page.locator('.distance-label')).toHaveText('8.61 ly')
  await expect(page.locator('.height-label')).toHaveCount(0)
  await expect(page.locator('#coordinate-x')).toHaveText(/ ly$/)
  await expect(page.locator('#plane-distance')).toHaveText(/ ly$/)
  await expect(page.locator('#selection-announcement')).toContainText('8.61 ly from the Sun')
  expect(await starPoint(page, 'sun')).toEqual(before)
  expect(await page.locator('.catalog-distance').allTextContents()).toEqual(expect.arrayContaining(['0.00 ly', '8.61 ly']))
  await expect(page.locator('#velocity-x')).toContainText('km/s')
  await page.getByLabel('pc', { exact: true }).check()
  await expect(page.locator('#distance-value')).toHaveText('2.64')
  await expect(page.locator('#grid-spacing')).toHaveText('0.5 pc grid')
  expect(await starPoint(page, 'sun')).toEqual(before)
  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await openPreferences(page)
  await expect(page.getByLabel('pc', { exact: true })).toBeChecked()
  await page.getByLabel('ly', { exact: true }).check()
  await expect(page.locator('#distance-value')).toHaveText('8.61')
})

test('keeps faint dots pickable and retains the last visibility base', async ({ page }) => {
  await openViewer(page)
  await openPreferences(page)
  await openFilter(page)
  const faint = page.locator('[data-star-id="barnards-star"]')
  await expect(faint).toHaveCount(0)
  const before = await starPoint(page, 'sun')
  await page.getByLabel('V magnitude limit', { exact: true }).fill('12')
  await expect(faint).toHaveAttribute('data-visibility', 'eligible')
  expect(await starPoint(page, 'sun')).toEqual(before)
  const point = await starPoint(page, 'barnards-star')
  await page.getByLabel('V magnitude limit', { exact: true }).fill('7')
  await expect(faint).toHaveCount(0)
  await page.mouse.click(point.x, point.y)
  await expect(page.locator('#star-name')).toHaveText("Barnard's Star")
  await expect(faint).toHaveAttribute('data-visibility', 'base')
  await expect(faint.locator('.motion-arrow')).toBeVisible()
  await expect(page.locator('#constellation')).toHaveText('Ophiuchus')
  const canvas = (await page.locator('#scene canvas').boundingBox())!
  const position = await starPoint(page, 'barnards-star')
  await page.mouse.click(canvas.x + canvas.width * 0.1, canvas.y + canvas.height * 0.8)
  await expect(page.locator('#star-details')).toBeHidden()
  await expect(page.locator('#visibility-base')).toHaveText("Barnard's Star")
  await expect(faint).toHaveAttribute('data-visibility', 'base')
  expect(await starPoint(page, 'barnards-star')).toEqual(position)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-100')
  await expect(page.locator('#star-details')).toBeHidden()
  await expect(page.locator('#visibility-base')).toHaveText("Barnard's Star")
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await expect(page.locator('#constellation')).toHaveText('Not applicable')
  await expect(page.locator('#absolute-mag')).toHaveText('4.83')
})

test('renders faint objects as small colored cores without halos at either pixel density', async ({ page }, testInfo) => {
  await openViewer(page)
  await openFilter(page)
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await page.getByLabel('V magnitude limit', { exact: true }).fill('12')
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const point = await starPoint(page, 'barnards-star')
  await page.getByLabel('V magnitude limit', { exact: true }).fill('7')
  await expect(page.locator('[data-star-id="barnards-star"]')).toHaveCount(0)
  const options = { style: '.projected-labels, .scene-toolbar, .scene-brand, .scene-legend, .plane-key, .visibility-observer { visibility: hidden !important; }' }
  const sample = (buffer: Buffer) => {
    const image = PNG.sync.read(buffer)
    const ratio = image.width / bounds.width
    const centerX = (point.x - bounds.x) * ratio
    const centerY = (point.y - bounds.y) * ratio
    let corePixels = 0
    let haloBrightness = 0
    let haloPixels = 0
    for (let pixelY = Math.floor(centerY - 10 * ratio); pixelY <= Math.ceil(centerY + 10 * ratio); pixelY++) {
      for (let pixelX = Math.floor(centerX - 10 * ratio); pixelX <= Math.ceil(centerX + 10 * ratio); pixelX++) {
        const radius = Math.hypot(pixelX + 0.5 - centerX, pixelY + 0.5 - centerY) / ratio
        const offset = (pixelY * image.width + pixelX) * 4
        const red = image.data[offset]!
        const green = image.data[offset + 1]!
        const blue = image.data[offset + 2]!
        if (radius < 5 && red > 180 && red > green + 30 && red > blue + 30) corePixels++
        if (radius > 6 && radius < 10) {
          haloBrightness += red + green + blue
          haloPixels++
        }
      }
    }
    return { coreArea: corePixels / ratio ** 2, halo: haloBrightness / haloPixels }
  }
  const faint = sample(await canvas.screenshot({ ...options, path: testInfo.outputPath('background-dot.png') }))
  expect(faint.coreArea).toBeGreaterThan(2)
  expect(faint.coreArea).toBeLessThan(10)
  expect(faint.halo).toBeLessThan(1)
  await page.getByLabel('V magnitude limit', { exact: true }).fill('12')
  await expect(page.locator('[data-star-id="barnards-star"]')).toHaveAttribute('data-visibility', 'eligible')
  expect(await starPoint(page, 'barnards-star')).toEqual(point)
  const eligible = sample(await canvas.screenshot({ ...options, path: testInfo.outputPath('eligible-dot.png') }))
  expect(eligible.coreArea).toBeGreaterThan(45)
  expect(eligible.coreArea).toBeLessThan(85)
  expect(eligible.halo).toBeGreaterThan(5)
})

test('catalog starts closed and opens independently with the keyboard', async ({ page }) => {
  await openViewer(page)
  const catalog = page.locator('details.catalog')
  const summary = catalog.locator('summary')
  await expect(catalog).not.toHaveAttribute('open')
  await expect(page.locator('#catalog-count')).toHaveText('22')
  await expect(page.locator('#star-list')).toBeHidden()
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#star-list')).toBeVisible()
  await sceneFits(page)
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await summary.click()
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await page.getByText('Coordinates & source', { exact: true }).click()
  await expect(catalog).not.toHaveAttribute('open')
  await summary.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Select Sun', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.source-details')).toHaveAttribute('open')
})

test('puts scene context on the map and orders the inspector around selection', async ({ page }, testInfo) => {
  await openViewer(page)
  await expect(page.locator('.app-header, .scene-heading, .catalog-footer')).toHaveCount(0)
  await expect(page.locator('.scene-wrap > .scene-brand')).toContainText('Star View')
  await expect(page.locator('.scene-brand #brand-icon svg')).toBeVisible()
  await expect(page.locator('.scene-wrap > .visibility-observer')).toContainText('Visibility from Sirius A')

  const sections = page.locator('#inspector > details.inspector-section')
  await expect(sections).toHaveCount(4)
  expect(await sections.evaluateAll((elements) => elements.map((section) => section.className))).toEqual([
    'inspector-section selected-object',
    'inspector-section filter-section',
    'inspector-section preferences',
    'inspector-section catalog',
  ])
  expect(await sections.evaluateAll((elements) => elements.map((section) => section.hasAttribute('open')))).toEqual([true, false, false, false])
  const primaryProperties = page.locator('.properties-section .properties')
  await expect(primaryProperties.locator('#distance-value')).toHaveText('8.61')
  await expect(primaryProperties.locator('#absolute-mag')).toHaveText('1.42')
  await expect(page.locator('#star-details > .selection-summary')).toHaveCSS('border-bottom-width', '0px')
  await expect(page.locator('.properties-section')).toHaveCSS('border-bottom-width', '0px')
  expect(await page.locator('.source-details').evaluate((details) => details.closest('.selected-object') !== null)).toBe(true)
  expect(await page.locator('#catalog-select').evaluate((select) => select.closest('.filter-section') !== null)).toBe(true)
  expect(await page.locator('#catalog-select').evaluate((select) => select.closest('.preferences') !== null)).toBe(false)
  const titleSizes = await sections.locator(':scope > summary').evaluateAll((summaries) => summaries.map((summary) => parseFloat(getComputedStyle(summary).fontSize)))
  expect(titleSizes.every((size) => size >= 17)).toBe(true)
  expect(titleSizes[0]).toBeGreaterThan(titleSizes[1]!)

  await openPreferences(page)
  await openFilter(page)
  const distance = page.getByLabel('Object visibility distance', { exact: true })
  const magnitude = page.getByLabel('V magnitude limit', { exact: true })
  await expect(distance).toHaveAttribute('min', '5')
  await expect(distance).toHaveAttribute('max', '100')
  await expect(distance).toHaveValue('100')
  await expect(page.locator('#object-distance-limit-value')).toHaveText('100 ly')
  await expect(magnitude).toHaveAttribute('type', 'range')
  await expect(magnitude).toHaveAttribute('max', '25')
  await expect(page.getByRole('switch', { name: 'Power saving mode' })).not.toBeChecked()
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-100')
  await magnitude.fill('25')
  await expect(page.locator('[data-star-id="10pc-0098"]')).toHaveAttribute('data-visibility', 'eligible')

  const typeChoices = ['Star', 'White dwarf', 'Brown dwarf', 'Sub-brown dwarf']
  const typeDropdown = page.locator('details.filter-dropdown')
  await expect(typeDropdown).not.toHaveAttribute('open')
  await expect(page.locator('#object-type-options')).toBeHidden()
  await typeDropdown.locator('summary').click()
  await expect(page.locator('#object-type-options')).toBeVisible()
  await expect(page.locator('#object-type-filter-summary')).toHaveText('All')
  for (const name of typeChoices) await expect(page.getByLabel(name, { exact: true })).toBeChecked()
  await sceneFits(page)
  await page.screenshot({ path: testInfo.outputPath('interface-hierarchy.png'), fullPage: true })
})

test('filters only the map and reveals an excluded selected object', async ({ page }) => {
  await openViewer(page)
  await openFilter(page)
  const distance = page.getByLabel('Object visibility distance', { exact: true })
  const barnard = page.locator('[data-star-id="barnards-star"]')
  await distance.fill('5')
  await expect(page.locator('#object-distance-limit-value')).toHaveText('5 ly')
  await expect(barnard).toHaveCount(0)
  await expect(page.locator('[data-star-id="sirius-a"]')).toHaveAttribute('data-map-visible', 'true')
  await expect(page.locator('.catalog-entry')).toHaveCount(22)
  await distance.fill('100')
  await expect(barnard).toHaveCount(0)

  const typeDropdown = page.locator('details.filter-dropdown')
  await expect(typeDropdown).not.toHaveAttribute('open')
  await typeDropdown.locator('summary').click()
  const luhmanA = page.locator('[data-star-id="luhman-16-a"]')
  const luhmanB = page.locator('[data-star-id="luhman-16-b"]')
  const brownDwarfs = page.getByLabel('Brown dwarf', { exact: true })
  await brownDwarfs.uncheck()
  await expect(page.locator('#object-type-filter-summary')).toHaveText('3 of 4')
  await expect(luhmanA).toHaveCount(0)
  await expect(luhmanB).toHaveCount(0)
  await expect(page.locator('.catalog-entry')).toHaveCount(22)

  const canvas = (await page.locator('#scene canvas').boundingBox())!
  await page.mouse.click(canvas.x + canvas.width * 0.1, canvas.y + canvas.height * 0.8)
  await expect(page.locator('#star-details')).toBeHidden()
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Select Luhman 16 A', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Luhman 16 A')
  await expect(page.locator('#visibility-base')).toHaveText('Luhman 16 A')
  await expect(luhmanA).toHaveAttribute('data-map-visible', 'true')
  await expect(luhmanA).toBeVisible()
  await expect(luhmanB).toHaveCount(0)
  await expect(brownDwarfs).not.toBeChecked()

  await openFilter(page)
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-100')
  await expect(brownDwarfs).not.toBeChecked()
  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByLabel('Brown dwarf', { exact: true })).toBeChecked()
  await openPreferences(page)
  await expect(page.getByRole('switch', { name: 'Power saving mode' })).not.toBeChecked()
})

test('renders temperature-colored objects, measurements, and a responsive interface', async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('requestfailed', (request) => errors.push(request.url()))
  await openViewer(page)
  await expect(page.locator('#distance-value')).toHaveText('8.61')
  await expect(page.locator('#inspector').getByText('Galactic height', { exact: true })).toHaveCount(0)
  await expect(page.locator('#height-pc, #height-side, #height-signed')).toHaveCount(0)
  await expect(page.locator('.properties-section dt', { hasText: 'Distance from Sun' })).toHaveCount(1)
  await expect(page.locator('#object-count')).toHaveCount(0)
  await expect(page.locator('#catalog-count')).toHaveText('22')
  await expect(page.locator('.catalog-entry')).toHaveCount(22)
  expect(await page.locator('.map-anchor[data-star-id]').count()).toBeLessThan(22)
  expect(await page.locator('.map-anchor[data-star-id]').count()).toBeGreaterThan(0)
  await expect(page.locator('.dimension-label')).toHaveCount(1)
  await expect(page.locator('.height-label')).toHaveCount(0)
  if (!isMobile) {
    await expect(page.locator('.distance-label')).toBeVisible()
  }
  await expect(page.locator('#brand-icon svg')).toBeVisible()
  expect(await page.evaluate(() => document.fonts.check('16px "IBM Plex Sans"'))).toBe(true)
  await sceneFits(page)

  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const screenshot = await canvas.screenshot({
    scale: 'css', path: testInfo.outputPath('canvas.png'),
    // Foreground labels may intentionally overlap dots. Sample the WebGL cores
    // without text overlays, then capture the complete interface below.
    style: '.projected-labels, .projected-axes { visibility: hidden !important; }',
  })
  const image = PNG.sync.read(screenshot)
  let blackPixels = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset] === 0 && image.data[offset + 1] === 0 && image.data[offset + 2] === 0) blackPixels++
  }
  expect(blackPixels / (image.width * image.height)).toBeGreaterThan(0.75)
  const coloredCounts: number[] = []
  for (const id of ['sun', 'sirius-a']) {
    const position = await starPoint(page, id)
    const centerX = Math.round(position.x - bounds.x)
    const centerY = Math.round(position.y - bounds.y)
    let coloredPixels = 0
    for (let pixelY = centerY - 6; pixelY <= centerY + 6; pixelY++) {
      for (let pixelX = centerX - 6; pixelX <= centerX + 6; pixelX++) {
        if (Math.hypot(pixelX + 0.5 - (position.x - bounds.x), pixelY + 0.5 - (position.y - bounds.y)) > 4) continue
        const offset = (pixelY * image.width + pixelX) * 4
        const red = image.data[offset] ?? 0
        const green = image.data[offset + 1] ?? 0
        const blue = image.data[offset + 2] ?? 0
        if (red > 140 && green > 170 && blue > 150 && (id === 'sun' ? red > blue + 8 : blue > red + 8)) coloredPixels++
      }
    }
    expect(coloredPixels, `${id} must contain actual colored WebGL star pixels`).toBeGreaterThan(12)
    coloredCounts.push(coloredPixels)
  }
  expect(Math.abs(coloredCounts[0]! - coloredCounts[1]!)).toBeLessThan(22)
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('renders soft halos beyond crisp cores and boosts only the selected halo', async ({ page }, testInfo) => {
  await openViewer(page)
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const empty = { x: bounds.x + bounds.width * 0.25, y: bounds.y + bounds.height * 0.85 }
  await page.mouse.click(empty.x, empty.y)
  const options = { scale: 'css' as const, style: '.projected-labels, .scene-toolbar, .scene-brand, .scene-legend, .plane-key, .visibility-observer { visibility: hidden !important; }' }
  const sun = await starPoint(page, 'sun')
  const centerX = sun.x - bounds.x
  const centerY = sun.y - bounds.y
  const sample = (image: PNG, inner: number, outer: number) => {
    const values: number[] = []
    for (let pixelY = Math.floor(centerY - outer); pixelY <= Math.ceil(centerY + outer); pixelY++) {
      for (let pixelX = Math.floor(centerX - outer); pixelX <= Math.ceil(centerX + outer); pixelX++) {
        const distance = Math.hypot(pixelX + 0.5 - centerX, pixelY + 0.5 - centerY)
        if (pixelY + 0.5 - centerY < Math.abs(pixelX + 0.5 - centerX) || distance < inner || distance > outer) continue
        const offset = (pixelY * image.width + pixelX) * 4
        values.push(image.data[offset]! + image.data[offset + 1]! + image.data[offset + 2]!)
      }
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }
  const base = PNG.sync.read(await canvas.screenshot({ ...options, path: testInfo.outputPath('halo.png') }))
  const edgeProfile = [3, 4, 5, 6, 7].map((radius) => sample(base, radius, radius + 1))
  for (let index = 1; index < edgeProfile.length; index++) {
    expect(edgeProfile[index - 1]!, 'the core-to-halo edge must fade without a dark ring').toBeGreaterThanOrEqual(edgeProfile[index]! * 0.95)
  }
  const innerGlow = sample(base, 6, 8)
  const outerGlow = sample(base, 16, 18)
  expect(innerGlow).toBeGreaterThan(30)
  expect(outerGlow).toBeGreaterThan(0)
  expect(innerGlow).toBeGreaterThan(outerGlow * 2)
  expect(sample(base, 24, 26)).toBe(0)
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect.poll(() => starPoint(page, 'sun')).toEqual(sun)
  const selected = PNG.sync.read(await canvas.screenshot(options))
  expect(sample(selected, 6, 8)).toBeGreaterThan(innerGlow * 1.1)
  expect(sample(selected, 0, 3)).toBe(sample(base, 0, 3))
  await page.mouse.click(empty.x, empty.y)
  expect(changedPixels(PNG.sync.write(base), await canvas.screenshot(options))).toBe(0)
})

test('makes Sirius glow larger and brighter than Barnard with zoom-stable magnitude sizes', async ({ page }, testInfo) => {
  await openViewer(page)
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await page.locator('.catalog summary').click()
  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const glow: number[] = []
  for (const [id, name] of [['sirius-a', 'Sirius A'], ['barnards-star', "Barnard's Star"]]) {
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    await page.getByRole('button', { name: `Select ${name}`, exact: true }).click()
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await page.mouse.click(bounds.x + bounds.width * 0.15, bounds.y + bounds.height * 0.85)
    await expect(page.locator('.map-anchor.is-selected')).toHaveCount(0)
    const point = await starPoint(page, id!)
    const options = {
      scale: 'css' as const,
      style: '.projected-labels, .scene-toolbar, .scene-brand, .scene-legend, .plane-key, .visibility-observer { visibility: hidden !important; }',
    }
    const image = PNG.sync.read(await canvas.screenshot({ ...options, path: testInfo.outputPath(`${id}-glow.png`) }))
    const centerX = point.x - bounds.x
    const centerY = point.y - bounds.y
    const pixels: number[] = []
    for (let pixelY = Math.floor(centerY - 11); pixelY <= Math.ceil(centerY + 11); pixelY++) {
      for (let pixelX = Math.floor(centerX - 11); pixelX <= Math.ceil(centerX + 11); pixelX++) {
        const distance = Math.hypot(pixelX + 0.5 - centerX, pixelY + 0.5 - centerY)
        if (distance < 6 || distance > 11) continue
        const offset = (pixelY * image.width + pixelX) * 4
        pixels.push(0.2126 * image.data[offset]! + 0.7152 * image.data[offset + 1]! + 0.0722 * image.data[offset + 2]!)
      }
    }
    glow.push(pixels.reduce((sum, value) => sum + value, 0) / pixels.length)
    const extent = (image: PNG) => {
      let radius = 0
      let outerPixels = 0
      for (let pixelY = Math.floor(centerY - 25); pixelY <= Math.ceil(centerY + 25); pixelY++) {
        for (let pixelX = Math.floor(centerX - 25); pixelX <= Math.ceil(centerX + 25); pixelX++) {
          const distance = Math.hypot(pixelX + 0.5 - centerX, pixelY + 0.5 - centerY)
          if (distance > 25) continue
          const offset = (pixelY * image.width + pixelX) * 4
          const brightness = image.data[offset]! + image.data[offset + 1]! + image.data[offset + 2]!
          if (brightness <= 6) continue
          radius = Math.max(radius, distance)
          if (distance >= 17 && distance <= 22) outerPixels++
        }
      }
      return { radius, outerPixels }
    }
    const beforeZoom = extent(image)
    if (id === 'sirius-a') {
      expect(beforeZoom.radius).toBeGreaterThan(22)
      expect(beforeZoom.outerPixels).toBeGreaterThan(300)
    } else {
      expect(beforeZoom.radius).toBeLessThan(11)
      expect(beforeZoom.outerPixels).toBe(0)
    }
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await expect.poll(() => starPoint(page, id!)).toEqual(point)
    const afterZoom = extent(PNG.sync.read(await canvas.screenshot(options)))
    expect(Math.abs(afterZoom.radius - beforeZoom.radius)).toBeLessThan(1)
    expect(Math.abs(afterZoom.outerPixels - beforeZoom.outerPixels)).toBeLessThan(10)
  }
  expect(glow[1]!).toBeGreaterThan(1)
  expect(glow[0]!).toBeGreaterThan(glow[1]! * 3)
})

test('keeps bright and selected halos subtly temperature-tinted without whitening', async ({ page }, testInfo) => {
  await openViewer(page)
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await page.locator('.catalog summary').click()
  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  for (const [id, name] of [['sirius-a', 'Sirius A'], ['epsilon-eridani', 'Epsilon Eridani']]) {
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    const select = page.getByRole('button', { name: `Select ${name}`, exact: true })
    await select.click()
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await page.mouse.click(bounds.x + bounds.width * 0.15, bounds.y + bounds.height * 0.85)
    await expect(page.locator('.map-anchor.is-selected')).toHaveCount(0)
    const colors: { red: number; green: number; blue: number }[] = []
    for (const selected of [false, true]) {
      if (selected) await select.click()
      const point = await starPoint(page, id!)
      const centerX = point.x - bounds.x
      const centerY = point.y - bounds.y
      const image = PNG.sync.read(await canvas.screenshot({
        scale: 'css', path: testInfo.outputPath(`${id}-${selected ? 'selected' : 'base'}-tint.png`),
        style: '.projected-labels, .scene-toolbar, .scene-brand, .scene-legend, .plane-key, .visibility-observer { visibility: hidden !important; }',
      }))
      const color = { red: 0, green: 0, blue: 0 }
      let count = 0
      for (let pixelY = Math.floor(centerY - 9); pixelY <= Math.ceil(centerY + 9); pixelY++) {
        for (let pixelX = Math.floor(centerX - 9); pixelX <= Math.ceil(centerX + 9); pixelX++) {
          const distance = Math.hypot(pixelX + 0.5 - centerX, pixelY + 0.5 - centerY)
          if (distance < 6 || distance > 9) continue
          const offset = (pixelY * image.width + pixelX) * 4
          color.red += image.data[offset]!
          color.green += image.data[offset + 1]!
          color.blue += image.data[offset + 2]!
          count++
        }
      }
      color.red /= count
      color.green /= count
      color.blue /= count
      expect(Math.max(color.red, color.green, color.blue)).toBeLessThan(245)
      if (id === 'sirius-a') {
        expect(color.blue - color.red).toBeGreaterThan(15)
        expect(color.blue).toBeGreaterThan(color.green)
        expect(color.green).toBeGreaterThan(color.red)
        expect(color.red / color.blue).toBeGreaterThan(0.7)
        expect(color.green / color.blue).toBeGreaterThan(0.82)
      } else {
        expect(color.red - color.blue).toBeGreaterThan(10)
        expect(color.red).toBeGreaterThan(color.green)
        expect(color.green).toBeGreaterThan(color.blue)
        expect(color.blue / color.red).toBeGreaterThan(0.5)
      }
      colors.push(color)
    }
    expect(colors[1]!.red + colors[1]!.green + colors[1]!.blue).toBeGreaterThan(colors[0]!.red + colors[0]!.green + colors[0]!.blue)
    expect(Math.abs(colors[1]!.red / colors[1]!.blue - colors[0]!.red / colors[0]!.blue)).toBeLessThan(0.04)
  }
})

test('toggles the grid below reset without moving stars or changing selection', async ({ page, isMobile }, testInfo) => {
  await openViewer(page)
  const grid = page.getByRole('button', { name: 'Grid', exact: true })
  await expect(grid).toBeEnabled()
  await expect(grid).toHaveAttribute('aria-pressed', 'true')
  await expect(grid.locator('svg')).toBeVisible()
  expect(await page.locator('#reset-view').evaluate((element) => element.nextElementSibling?.id)).toBe('toggle-grid')
  await sceneFits(page)
  const sunBefore = await starPoint(page, 'sun')
  await expect(page.locator('.axis-label:visible')).toHaveCount(3)
  const axisTips = await page.locator('.axis-label').evaluateAll((labels) => labels.map((label) => {
    const bounds = label.parentElement!.getBoundingClientRect()
    return { x: bounds.left, y: bounds.top }
  }))
  const canvas = page.locator('#scene canvas')
  const screenshotOptions = { scale: 'css' as const, style: '.projected-labels, .scene-toolbar, .scene-brand, .scene-legend, .plane-key, .visibility-observer { visibility: hidden !important; }' }
  const visibleArrowsBefore = await page.locator('.motion-arrow:visible').count()
  const gridOn = await canvas.screenshot(screenshotOptions)
  if (isMobile) await grid.tap()
  else await grid.click()
  await expect(grid).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#grid-tooltip')).toHaveText('Show grid')
  await expect(page.locator('#grid-legend')).toBeHidden()
  await expect(page.locator('#plane-key')).toBeHidden()
  await expect(page.locator('.axis-label:visible')).toHaveCount(0)
  await expect(page.locator('#scene-epoch')).toBeVisible()
  await expect(page.locator('#star-name')).toHaveText('Sirius A')
  await expect(page.locator('.dimension-label')).toHaveCount(1)
  await expect(page.locator('.motion-arrow:visible')).toHaveCount(visibleArrowsBefore)
  expect(await starPoint(page, 'sun')).toEqual(sunBefore)
  const gridOff = await canvas.screenshot(screenshotOptions)
  expect(changedPixels(gridOn, gridOff)).toBeGreaterThan(200)
  const canvasBounds = (await canvas.boundingBox())!
  const beforeImage = PNG.sync.read(gridOn)
  const afterImage = PNG.sync.read(gridOff)
  for (const tip of axisTips) {
    const centerX = Math.round(sunBefore.x + (tip.x - sunBefore.x) * 0.85 - canvasBounds.x)
    const centerY = Math.round(sunBefore.y + (tip.y - sunBefore.y) * 0.85 - canvasBounds.y)
    let axisPixels = 0
    for (let pixelY = centerY - 2; pixelY <= centerY + 2; pixelY++) {
      for (let pixelX = centerX - 2; pixelX <= centerX + 2; pixelX++) {
        const offset = (pixelY * afterImage.width + pixelX) * 4
        if (beforeImage.data[offset]! + beforeImage.data[offset + 1]! + beforeImage.data[offset + 2]! > 20) axisPixels++
        expect([...afterImage.data.subarray(offset, offset + 3)], 'axis segment must disappear with the grid').toEqual([0, 0, 0])
      }
    }
    expect(axisPixels, 'sample must contain the original axis').toBeGreaterThan(0)
  }
  await sceneFits(page)
  await page.screenshot({ path: testInfo.outputPath('grid-off.png'), fullPage: true })
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(grid).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.axis-label:visible')).toHaveCount(0)
  expect(changedPixels(gridOff, await canvas.screenshot(screenshotOptions))).toBeLessThan(5)
  await grid.focus()
  await page.keyboard.press('Enter')
  await expect(grid).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.axis-label:visible')).toHaveCount(3)
  await expect(page.locator('#grid-legend')).toBeVisible()
  await expect(page.locator('#grid-tooltip')).toHaveText('Hide grid')
  expect(changedPixels(gridOn, await canvas.screenshot(screenshotOptions))).toBeLessThan(5)
  await grid.focus()
  await page.keyboard.press('Space')
  await expect(grid).toHaveAttribute('aria-pressed', 'false')
})

test('keeps axis captions anchored behind the canvas throughout rotation', async ({ page }, testInfo) => {
  await openViewer(page)
  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  await expect(page.locator('.projected-axes .axis-label')).toHaveCount(3)
  await expect(page.locator('.projected-axes')).toHaveCSS('z-index', '0')
  await expect(canvas).toHaveCSS('z-index', '1')
  let visible = 0
  for (let step = 0; step < 12; step++) {
    const captions = await page.locator('.axis-label').evaluateAll((labels) => labels
      .filter((label) => label.checkVisibility())
      .map((label) => {
        const text = label.getBoundingClientRect()
        const anchor = label.parentElement!.getBoundingClientRect()
        return { horizontal: text.left - anchor.left, vertical: text.top + text.height / 2 - anchor.top }
      }))
    visible += captions.length
    for (const caption of captions) {
      expect(caption.horizontal).toBeCloseTo(18, 1)
      expect(caption.vertical).toBeCloseTo(0, 1)
    }
    const start = { x: bounds.x + bounds.width * 0.45, y: bounds.y + bounds.height * 0.6 }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + bounds.width * 0.15, start.y + (step < 6 ? 8 : -8), { steps: 5 })
    await page.mouse.up()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }
  expect(visible).toBeGreaterThan(20)
  await sceneFits(page)
  await page.screenshot({ path: testInfo.outputPath('anchored-axes.png') })
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const sun = await starPoint(page, 'sun')
  const centerX = sun.x - bounds.x
  const centerY = sun.y - bounds.y
  const screenshotOptions = { scale: 'css' as const, style: '.projected-labels, .scene-toolbar, .scene-brand, .scene-legend, .plane-key, .visibility-observer { visibility: hidden !important; }' }
  const before = await canvas.screenshot(screenshotOptions)
  await page.addStyleTag({ content: `
    .projected-axes .map-anchor:first-child { transform: translate(${centerX}px, ${centerY}px) !important; }
    .projected-axes .map-anchor:first-child .axis-label { display: block !important; width: 40px; height: 20px; background: #ff0000; transform: translate(-20px, -10px) !important; }
  ` })
  const after = await canvas.screenshot(screenshotOptions)
  expect(changedPixels(before, after)).toBeGreaterThan(200)
  const baseline = PNG.sync.read(before)
  const captionBehindStar = PNG.sync.read(after)
  for (let pixelY = Math.round(centerY) - 1; pixelY <= Math.round(centerY) + 1; pixelY++) {
    for (let pixelX = Math.round(centerX) - 1; pixelX <= Math.round(centerX) + 1; pixelX++) {
      const offset = (pixelY * baseline.width + pixelX) * 4
      expect([...captionBehindStar.data.subarray(offset, offset + 3)]).toEqual([...baseline.data.subarray(offset, offset + 3)])
    }
  }
})

test('fades grid pixels toward the edge without fading the scene', async ({ page, isMobile }) => {
  await openViewer(page)
  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const options = { scale: 'css' as const, style: '.projected-axes, .projected-labels, .scene-toolbar, .scene-brand, .scene-legend, .plane-key, .visibility-observer { visibility: hidden !important; }' }
  const on = PNG.sync.read(await canvas.screenshot(options))
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  const off = PNG.sync.read(await canvas.screenshot(options))
  const stars = parseStarCatalog(readFileSync(new URL('../src/data/stars.csv', import.meta.url), 'utf8'))
  const camera = homeCamera(stars, bounds)
  const radius = Math.max(3, Math.ceil(Math.max(...stars.map((star) => galacticToWorld(star).length())) + 1))
  const brightness = [0.25, 0.75, 0.95, 1.1].map((fraction) => {
    const point = new Vector3(radius * fraction, 0, 0.5).project(camera)
    const centerX = Math.round((point.x + 1) * bounds.width / 2)
    const centerY = Math.round((1 - point.y) * bounds.height / 2)
    let brightest = 0
    for (let pixelY = centerY - 1; pixelY <= centerY + 1; pixelY++) {
      for (let pixelX = centerX - 1; pixelX <= centerX + 1; pixelX++) {
        const offset = (pixelY * on.width + pixelX) * 4
        const difference = [0, 1, 2].reduce((sum, channel) => sum + Math.abs(on.data[offset + channel]! - off.data[offset + channel]!), 0)
        brightest = Math.max(brightest, difference)
      }
    }
    return brightest
  })
  expect(brightness[0]).toBeGreaterThan(isMobile ? 30 : 15)
  expect(brightness[1]).toBeGreaterThan(0)
  expect(brightness[0]!).toBeGreaterThan(brightness[1]!)
  expect(brightness[1]!).toBeGreaterThan(brightness[2]!)
  expect(brightness[3]).toBe(0)
})

test('overlapping stars follow camera depth and keep their motion arrows', async ({ page }, testInfo) => {
  await openViewer(page)
  await openFilter(page)
  await page.getByLabel('V magnitude limit', { exact: true }).fill('25')
  const stars = parseStarCatalog(readFileSync(new URL('../src/data/stars.csv', import.meta.url), 'utf8'))
  const positions = stars.map(galacticToWorld)
  const sphere = new Box3().setFromPoints(positions).getBoundingSphere(new Sphere())
  sphere.radius = Math.max(sphere.radius, 0.75)
  const sunPosition = galacticToWorld(stars.find((star) => star.id === 'sun')!)
  const siriusPosition = galacticToWorld(stars.find((star) => star.id === 'sirius-a')!)
  const canvas = page.locator('#scene canvas')
  await page.locator('.catalog summary').click()

  for (const side of [-1, 1]) {
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
    const bounds = (await canvas.boundingBox())!
    const verticalAngle = 44 * Math.PI / 360
    const fitAngle = Math.min(verticalAngle, Math.atan(Math.tan(verticalAngle) * bounds.width / bounds.height))
    const distance = Math.min(Math.max(30, sphere.radius * 24), sphere.radius / Math.sin(fitAngle) * 1.6)
    const homeCamera = sphere.center.clone().addScaledVector(new Vector3(-4.8, 3.8, -6.2).normalize(), distance)
    const initial = new Spherical().setFromVector3(homeCamera.sub(sunPosition))
    const target = new Spherical().setFromVector3(siriusPosition.clone().sub(sunPosition).multiplyScalar(side))
    const thetaDelta = Math.atan2(Math.sin(initial.theta - target.theta), Math.cos(initial.theta - target.theta))
    const deltaX = thetaDelta * bounds.height / (2 * Math.PI * 0.65)
    const deltaY = (initial.phi - target.phi) * bounds.height / (2 * Math.PI * 0.65)
    const drags = Math.ceil(Math.max(Math.abs(deltaX) / (bounds.width * 0.3), Math.abs(deltaY) / (bounds.height * 0.3)))
    for (let drag = 0; drag < drags; drag++) {
      const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * 0.6 }
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()
      await page.mouse.move(start.x + deltaX / drags, start.y + deltaY / drags, { steps: 10 })
      await page.mouse.up()
    }
    await expect.poll(async () => {
      const sun = await starPoint(page, 'sun')
      const sirius = await starPoint(page, 'sirius-a')
      return Math.hypot(sun.x - sirius.x, sun.y - sirius.y)
    }).toBeLessThan(2)
    await expect(page.locator('#star-name')).toHaveText('Sun')
    for (const id of ['sun', 'sirius-a', 'sirius-b']) {
      await expect(page.locator(`[data-star-id="${id}"] .motion-arrow`)).toBeVisible()
    }
    const sun = await starPoint(page, 'sun')
    const nearest = side === -1 ? 'sun' : 'sirius'
    const image = PNG.sync.read(await canvas.screenshot({ scale: 'css', path: testInfo.outputPath(`${nearest}-in-front.png`) }))
    const centerX = Math.round(sun.x - bounds.x)
    const centerY = Math.round(sun.y - bounds.y)
    let matchingPixels = 0
    for (let pixelY = centerY - 1; pixelY <= centerY + 1; pixelY++) {
      for (let pixelX = centerX - 1; pixelX <= centerX + 1; pixelX++) {
        const offset = (pixelY * image.width + pixelX) * 4
        const red = image.data[offset]!
        const blue = image.data[offset + 2]!
        if (side === -1 ? red > 200 && red > blue + 8 : blue > 200 && blue > red + 8) matchingPixels++
      }
    }
    expect(matchingPixels, `${nearest} must occlude the farther star even while Sun stays selected`).toBeGreaterThanOrEqual(7)
    await page.mouse.click(bounds.x + bounds.width * 0.15, bounds.y + bounds.height * 0.85)
    await expect(page.locator('.map-anchor.is-selected')).toHaveCount(0)
    const nearId = side === -1 ? 'sun' : 'sirius-a'
    const farId = side === -1 ? 'sirius-a' : 'sun'
    const nearLabel = page.locator(`[data-star-id="${nearId}"] .star-label`)
    const farLabel = page.locator(`[data-star-id="${farId}"] .star-label`)
    if (side === 1) await expect(nearLabel).toBeVisible()
    if (await farLabel.isVisible() && await nearLabel.isVisible()) {
      const [nearBounds, farBounds] = await Promise.all([nearLabel.boundingBox(), farLabel.boundingBox()])
      expect(nearBounds!.x + nearBounds!.width <= farBounds!.x || farBounds!.x + farBounds!.width <= nearBounds!.x ||
        nearBounds!.y + nearBounds!.height <= farBounds!.y || farBounds!.y + farBounds!.height <= nearBounds!.y).toBe(true)
    }
    const nearOrder = await nearLabel.locator('..').evaluate((element) => Number(getComputedStyle(element).zIndex))
    const farOrder = await farLabel.locator('..').evaluate((element) => Number(getComputedStyle(element).zIndex))
    expect(nearOrder).toBeGreaterThan(farOrder)
    await page.screenshot({ path: testInfo.outputPath(`${nearest}-name-in-front.png`) })
  }
})

test('targets ordinary selections, zooms around them, and resets to the catalog view', async ({ page, isMobile }) => {
  await openViewer(page)
  await page.locator('.catalog summary').click()
  const canvasBounds = (await page.locator('#scene canvas').boundingBox())!
  const stars = parseStarCatalog(readFileSync(new URL('../src/data/stars.csv', import.meta.url), 'utf8'))
  const proximaProjection = galacticToWorld(stars.find((star) => star.id === 'proxima-centauri')!).project(homeCamera(stars, canvasBounds))
  const proximaHome = {
    x: canvasBounds.x + (proximaProjection.x + 1) * canvasBounds.width / 2,
    y: canvasBounds.y + (1 - proximaProjection.y) * canvasBounds.height / 2,
  }
  await page.getByRole('button', { name: 'Select Proxima Centauri', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Proxima Centauri')
  const center = { x: canvasBounds.x + canvasBounds.width / 2, y: canvasBounds.y + canvasBounds.height / 2 }
  await expect.poll(async () => {
    const selected = await starPoint(page, 'proxima-centauri')
    return Math.hypot(selected.x - center.x, selected.y - center.y)
  }).toBeLessThan(2)

  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect.poll(async () => {
    const reset = await starPoint(page, 'proxima-centauri')
    return Math.hypot(reset.x - proximaHome.x, reset.y - proximaHome.y)
  }).toBeLessThan(2)

  const sun = await starPoint(page, 'sun')
  if (isMobile) await page.touchscreen.tap(sun.x, sun.y)
  else await page.mouse.click(sun.x, sun.y)
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await expect(page.locator('#distance-value')).toHaveText('0.00')
  await expect(page.locator('#selection-announcement')).toHaveText('Sun, 0.00 ly from the Sun.')
  await expect(page.locator('.dimension-label')).toHaveCount(0)

  const focusedSun = await starPoint(page, 'sun')
  const beforeZoom = await starPoint(page, 'sirius-a')
  const separationBefore = Math.hypot(beforeZoom.x - focusedSun.x, beforeZoom.y - focusedSun.y)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(async () => {
    const first = await starPoint(page, 'sun')
    const second = await starPoint(page, 'sirius-a')
    return Math.hypot(first.x - second.x, first.y - second.y)
  }).toBeGreaterThan(separationBefore)

  const sirius = await starPoint(page, 'sirius-a')
  if (isMobile) await page.touchscreen.tap(sirius.x + 15, sirius.y)
  else await page.mouse.click(sirius.x, sirius.y)
  await expect(page.locator('#star-name')).toHaveText('Sirius A')
  await expect(page.locator('#selection-announcement')).toHaveText('Sirius A, 8.61 ly from the Sun.')
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Sirius A')

  const sunButton = page.getByRole('button', { name: 'Select Sun', exact: true })
  await sunButton.focus()
  await page.keyboard.press('Enter')
  await expect(sunButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await page.getByRole('button', { name: 'Select Sirius A', exact: true }).click()
  await page.getByText('Coordinates & source', { exact: true }).click()
  await expect(page.locator('#velocity-x')).toHaveText('14.96 km/s')
  await expect(page.locator('#temperature')).toHaveText('9,845 K')
  await page.getByRole('button', { name: 'Select WISE 0855-0714', exact: true }).click()
  await expect(page.locator('#velocity-x')).toHaveText('Not available')
})

test('eases focus through intermediate frames while preserving camera position', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openViewer(page)
  await openFilter(page)
  await page.getByLabel('V magnitude limit', { exact: true }).fill('25')
  await page.locator('.catalog summary').click()
  const bounds = (await page.locator('#scene canvas').boundingBox())!
  const samples = await page.evaluate(async () => {
    const scene = document.querySelector('#scene')!.getBoundingClientRect()
    const distance = () => {
      const anchor = document.querySelector('[data-star-id="sun"]')!.getBoundingClientRect()
      return Math.hypot(anchor.x - scene.x - scene.width / 2, anchor.y - scene.y - scene.height / 2)
    }
    const before = distance()
    document.querySelector<HTMLButtonElement>('[data-star="sun"]')!.click()
    const immediate = distance()
    const started = performance.now()
    const frames: { elapsed: number; distance: number }[] = []
    await new Promise<void>((resolve) => {
      function sample(time: number) {
        frames.push({ elapsed: time - started, distance: distance() })
        if (time - started >= 450) resolve()
        else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    return { before, immediate, frames }
  })
  expect(samples.before).toBeGreaterThan(5)
  expect(samples.immediate).toBeCloseTo(samples.before, 3)
  expect(samples.frames.some((frame) => frame.distance > 2 && frame.distance < samples.before - 2)).toBe(true)
  expect(samples.frames.at(-1)!.distance).toBeLessThan(1)
  const stars = parseStarCatalog(readFileSync(new URL('../src/data/stars.csv', import.meta.url), 'utf8'))
  const camera = homeCamera(stars, bounds)
  camera.lookAt(galacticToWorld(stars.find((star) => star.id === 'sun')!))
  camera.updateMatrixWorld()
  for (const id of ['sirius-a', 'ross-154', 'wolf-359']) {
    const expected = galacticToWorld(stars.find((star) => star.id === id)!).project(camera)
    const actual = await starPoint(page, id)
    expect(actual.x).toBeCloseTo(bounds.x + (expected.x + 1) * bounds.width / 2, 0)
    expect(actual.y).toBeCloseTo(bounds.y + (1 - expected.y) * bounds.height / 2, 0)
  }
})

test('interrupts focus for reset, zoom and rapid reselection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openViewer(page)
  await page.locator('.catalog summary').click()
  for (const action of ['reset-view', 'zoom-in', 'zoom-out', 'reselect']) {
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    const result = await page.evaluate(async (action) => {
      const point = () => {
        const bounds = document.querySelector('[data-star-id="sun"]')!.getBoundingClientRect()
        return { x: bounds.x, y: bounds.y }
      }
      const before = point()
      document.querySelector<HTMLButtonElement>('[data-star="sun"]')!.click()
      const started = performance.now()
      let interrupted = false
      const frames: { x: number; y: number }[] = []
      await new Promise<void>((resolve) => {
        function sample(time: number) {
          if (!interrupted && time - started >= 70) {
            const selector = action === 'reselect' ? '[data-star="sirius-a"]' : `#${action}`
            document.querySelector<HTMLButtonElement>(selector)!.click()
            interrupted = true
          } else if (interrupted) frames.push(point())
          if (time - started >= 550) resolve()
          else requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      })
      return { before, frames }
    }, action)
    const first = result.frames[0]!
    const last = result.frames.at(-1)!
    if (action === 'reset-view') expect(Math.hypot(last.x - result.before.x, last.y - result.before.y)).toBeLessThan(1)
    if (action !== 'reselect') {
      expect(Math.max(...result.frames.map((point) => Math.hypot(point.x - first.x, point.y - first.y)))).toBeLessThan(1)
    } else {
      await expect(page.locator('#star-name')).toHaveText('Sirius A')
      const bounds = (await page.locator('#scene canvas').boundingBox())!
      const sirius = await starPoint(page, 'sirius-a')
      expect(Math.hypot(sirius.x - bounds.x - bounds.width / 2, sirius.y - bounds.y - bounds.height / 2)).toBeLessThan(1)
    }
  }
})

test('hands active focus to pointer input, deselection and reduced motion', async ({ page, context, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openViewer(page)
  await page.locator('.catalog summary').click()
  const bounds = (await page.locator('#scene canvas').boundingBox())!
  const empty = { x: bounds.x + bounds.width * 0.25, y: bounds.y + bounds.height * 0.85 }
  for (const action of ['pointer', 'clear', 'reduce']) {
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    await page.evaluate(async () => {
      const anchor = document.querySelector('[data-star-id="sun"]')!
      const initial = anchor.getBoundingClientRect()
      document.querySelector<HTMLButtonElement>('[data-star="sun"]')!.click()
      await new Promise<void>((resolve) => {
        function moved() {
          const current = anchor.getBoundingClientRect()
          if (Math.hypot(current.x - initial.x, current.y - initial.y) > 0.5) resolve()
          else requestAnimationFrame(moved)
        }
        requestAnimationFrame(moved)
      })
    })
    const during = await starPoint(page, 'sun')
    expect(Math.hypot(during.x - bounds.x - bounds.width / 2, during.y - bounds.y - bounds.height / 2)).toBeGreaterThan(1)
    const session = isMobile && action === 'pointer' ? await context.newCDPSession(page) : null
    if (action === 'reduce') await page.emulateMedia({ reducedMotion: 'reduce' })
    else if (action === 'clear') {
      if (isMobile) await page.touchscreen.tap(empty.x, empty.y)
      else await page.mouse.click(empty.x, empty.y)
    } else if (session) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...empty, id: 0 }, { x: empty.x + 30, y: empty.y, id: 1 }] })
    } else {
      await page.mouse.move(empty.x, empty.y)
      await page.mouse.down({ button: 'right' })
    }
    const frames = await page.evaluate(async () => {
      const points: { x: number; y: number }[] = []
      const started = performance.now()
      await new Promise<void>((resolve) => {
        function sample(time: number) {
          const bounds = document.querySelector('[data-star-id="sun"]')!.getBoundingClientRect()
          points.push({ x: bounds.x, y: bounds.y })
          if (time - started >= 400) resolve()
          else requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      })
      return points
    })
    const last = frames.at(-1)!
    if (action === 'reduce') {
      expect(Math.hypot(last.x - bounds.x - bounds.width / 2, last.y - bounds.y - bounds.height / 2)).toBeLessThan(1)
      await expect(page.locator('.is-selected .selection-ring')).toHaveCSS('animation-name', 'none')
    } else {
      expect(Math.max(...frames.map((point) => Math.hypot(point.x - frames[0]!.x, point.y - frames[0]!.y)))).toBeLessThan(1)
      expect(Math.hypot(last.x - bounds.x - bounds.width / 2, last.y - bounds.y - bounds.height / 2)).toBeGreaterThan(1)
    }
    if (action === 'clear') {
      await expect(page.locator('.map-anchor.is-selected')).toHaveCount(0)
      await expect(page.locator('#selection-empty')).toBeVisible()
    } else await expect(page.locator('#star-name')).toHaveText('Sun')
    if (session) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await session.detach()
    } else if (action === 'pointer') await page.mouse.up({ button: 'right' })
  }
})

test('shows attached speed-length motion arrows with fixed heads and strokes', async ({ page, isMobile }, testInfo) => {
  await openViewer(page)
  await openFilter(page)
  await page.getByLabel('V magnitude limit', { exact: true }).fill('12')
  await expect(page.locator('.star-label-detail')).toHaveCount(0)
  await expect(page.locator('[data-star-id="sirius-a"] .star-label')).toHaveText('Sirius A')
  const homeSun = await starPoint(page, 'sun')
  expect(await page.locator('.motion-arrow').count()).toBeGreaterThan(1)
  const visibleArrowCount = await page.locator('.motion-arrow:visible').count()
  expect(visibleArrowCount).toBeGreaterThan(0)
  await expect(page.locator('[data-star-id="sirius-b"]')).toHaveCount(0)
  const sunArrow = page.locator('[data-star-id="sun"] .motion-arrow')
  await expect(sunArrow).toBeVisible()
  await expect(sunArrow).toHaveCSS('opacity', '0.5')
  await expect(sunArrow).toHaveCSS('color', 'rgb(255, 239, 209)')
  const intrinsicLengths = await page.locator('.motion-arrow').evaluateAll((elements) => elements.map((element) => ({
    id: element.parentElement!.dataset.starId,
    length: Number((element as HTMLElement).dataset.maxLength),
  })))
  const sunMaximumLength = intrinsicLengths.find((arrow) => arrow.id === 'sun')!.length
  expect(sunMaximumLength).toBeCloseTo(Math.hypot(12.9, 245.6, 7.78) / 10, 3)
  const sunLengthBefore = await sunArrow.evaluate((element) => parseFloat(element.style.width) - 2 * 5 * 16 / 24)
  expect(sunLengthBefore).toBeGreaterThan(0)
  expect(sunLengthBefore).toBeLessThan(sunMaximumLength)
  const headGeometry = await page.locator('.motion-arrow-icon').evaluateAll((icons) => icons.map((icon) => ({
    height: icon.getAttribute('height'),
    stroke: icon.getAttribute('stroke-width'),
    head: icon.querySelectorAll('path')[1]!.getAttribute('d'),
  })))
  for (const geometry of headGeometry) {
    expect(geometry).toEqual({ height: '16', stroke: '1.7', head: 'm12 5 7 7-7 7' })
  }
  const transverseArrows = page.locator('.motion-arrow[data-motion-mode="transverse"]')
  expect(await transverseArrows.count()).toBeGreaterThan(0)
  for (const shaft of await transverseArrows.locator('.motion-arrow-shaft').all()) {
    await expect(shaft).toHaveCSS('stroke-dasharray', '3px, 2px')
  }
  const arrow = page.locator('[data-star-id="sirius-a"] .motion-arrow')
  await expect(arrow).toHaveAttribute('data-motion-mode', 'full')
  await expect(arrow.locator('.motion-arrow-shaft')).toHaveCSS('stroke-dasharray', 'none')
  await expect(arrow).toBeVisible()
  await expect(arrow).toHaveCSS('opacity', '1')
  await expect(arrow).toHaveCSS('color', 'rgb(201, 223, 255)')
  expect(await page.locator('.map-anchor:not(.is-selected) .motion-arrow:visible').count()).toBeGreaterThan(0)
  const headingBefore = await arrow.evaluate((element) => element.style.transform)
  const sunHeadingBefore = await sunArrow.evaluate((element) => element.style.transform)
  const bounds = (await page.locator('#scene canvas').boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.75)
  await page.mouse.down()
  const sunLengths = [sunLengthBefore]
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(bounds.x + bounds.width * 0.4 + 6 * step, bounds.y + bounds.height * 0.75 - 2.5 * step)
    await page.evaluate(() => new Promise(requestAnimationFrame))
    sunLengths.push(await sunArrow.evaluate((element) => parseFloat(element.style.width) - 2 * 5 * 16 / 24))
  }
  await page.mouse.up()
  await expect.poll(() => arrow.evaluate((element) => element.style.transform)).not.toBe(headingBefore)
  await expect.poll(() => sunArrow.evaluate((element) => element.style.transform)).not.toBe(sunHeadingBefore)
  expect(Math.max(...sunLengths) - Math.min(...sunLengths)).toBeGreaterThan(3)
  expect(sunLengths.at(-1)!).toBeLessThan(sunLengths[0]!)
  expect(sunLengths.every((length) => length > 0 && length <= sunMaximumLength)).toBe(true)
  expect(await page.locator('.motion-arrow:visible').count()).toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(arrow).toBeVisible()
  for (const action of ['Zoom in', 'Zoom out']) {
    await page.getByRole('button', { name: action, exact: true }).click()
    const arrows = await page.locator('.motion-arrow:visible').evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element)
      const transform = new DOMMatrixReadOnly(style.transform)
      const bounds = element.getBoundingClientRect()
      const anchor = element.parentElement!.getBoundingClientRect()
      const svg = element.querySelector('svg')!
      const [shaft, head] = svg.querySelectorAll('path')
      const matrix = shaft!.getScreenCTM()!
      const tailPoint = shaft!.getPointAtLength(0)
      const tipPoint = shaft!.getPointAtLength(shaft!.getTotalLength())
      const tail = new DOMPoint(tailPoint.x, tailPoint.y).matrixTransform(matrix)
      const tip = new DOMPoint(tipPoint.x, tipPoint.y).matrixTransform(matrix)
      const headBounds = head!.getBBox()
      const scaleX = Math.hypot(matrix.a, matrix.b)
      const scaleY = Math.hypot(matrix.c, matrix.d)
      return { width: style.width, maxLength: Number((element as HTMLElement).dataset.maxLength), height: style.height, pointerEvents: style.pointerEvents, scale: Math.hypot(transform.a, transform.b), offset: Math.hypot(bounds.left + bounds.width / 2 - anchor.left, bounds.top + bounds.height / 2 - anchor.top), tailOffset: Math.hypot(tail.x - anchor.left, tail.y - anchor.top), shaftLength: Math.hypot(tip.x - tail.x, tip.y - tail.y), headWidth: headBounds.width * scaleX, headHeight: headBounds.height * scaleY, stroke: parseFloat(getComputedStyle(shaft!).strokeWidth) * scaleY }
    }))
    expect(arrows.length).toBeGreaterThan(1)
    for (const sample of arrows) {
      const length = parseFloat(sample.width) - 2 * 5 * 16 / 24
      expect(length).toBeGreaterThan(0)
      expect(length).toBeLessThanOrEqual(sample.maxLength)
      expect(sample.height).toBe('16px')
      expect(sample.headWidth).toBeCloseTo(7 * 16 / 24, 1)
      expect(sample.headHeight).toBeCloseTo(14 * 16 / 24, 1)
      expect(sample.stroke).toBeCloseTo(1.7 * 16 / 24, 2)
      expect(sample.shaftLength).toBeCloseTo(length, 1)
      expect(sample.pointerEvents).toBe('none')
      expect(sample.scale).toBeCloseTo(1, 5)
      expect(sample.offset).toBeCloseTo(5 + length / 2, 0)
      expect(sample.tailOffset).toBeCloseTo(5, 1)
    }
    expect(await page.locator('.motion-arrow').evaluateAll((elements) => elements.map((element) => ({
      id: element.parentElement!.dataset.starId,
      length: Number((element as HTMLElement).dataset.maxLength),
    })))).toEqual(intrinsicLengths)
    await sceneFits(page)
  }
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Select Sirius B', exact: true }).click()
  await expect(arrow).toHaveCount(0)
  await expect(page.locator('[data-star-id="sirius-b"] .motion-arrow')).toHaveCSS('opacity', '1')
  await expect(page.locator('[data-star-id="sirius-b"] .motion-arrow')).toBeVisible()
  await expect(page.locator('[data-star-id="sirius-b"] .motion-arrow')).not.toHaveCSS('color', 'rgb(201, 223, 255)')
  await expect(page.locator('[data-star-id="sirius-a"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect.poll(async () => {
    const sun = await starPoint(page, 'sun')
    return Math.hypot(sun.x - homeSun.x, sun.y - homeSun.y)
  }).toBeLessThan(1)
  const sun = await starPoint(page, 'sun')
  if (isMobile) await page.touchscreen.tap(sun.x, sun.y)
  else await page.mouse.click(sun.x, sun.y)
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await page.locator('.catalog summary').click()
  await expect(sunArrow).toBeVisible()
  await expect(sunArrow).toHaveCSS('color', 'rgb(255, 239, 209)')
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await sceneFits(page)
  await page.screenshot({ path: testInfo.outputPath('motion-arrows.png'), fullPage: true })
})

test('orbit and pinch move the rendered scene without changing selection', async ({ page, context, isMobile }) => {
  await openViewer(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => {
    const samples = { visible: 0, incorrect: 0 }
    Object.assign(window, { labelSamples: samples })
    function sample() {
      for (const label of document.querySelectorAll<HTMLElement>('.star-label')) {
        if (!label.checkVisibility()) continue
        const text = label.getBoundingClientRect()
        const anchor = label.parentElement!.getBoundingClientRect()
        samples.visible++
        if (label.parentElement!.classList.contains('is-selected')) continue
        const correct = Math.abs(text.left - anchor.left - 22) <= 1 ||
          Math.abs(text.right - anchor.left + 22) <= 1 ||
          Math.abs(text.top - anchor.top - 22) <= 1 ||
          Math.abs(text.bottom - anchor.top + 22) <= 1
        if (!correct) samples.incorrect++
      }
      requestAnimationFrame(sample)
    }
    sample()
  })
  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const before = await canvas.screenshot({ scale: 'css' })
  const startX = bounds.x + bounds.width * 0.35
  const startY = bounds.y + bounds.height * 0.75
  if (isMobile) {
    const session = await context.newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY, id: 0 }] })
    for (let step = 1; step <= 6; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX + step * 12, y: startY - step * 4, id: 0 }] })
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await session.detach()
  } else {
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 140, startY - 60, { steps: 12 })
    await page.mouse.up()
  }
  await expect.poll(async () => changedPixels(before, await canvas.screenshot({ scale: 'css' }))).toBeGreaterThan(250)
  const samples = await page.evaluate(() => (window as unknown as { labelSamples: { visible: number; incorrect: number } }).labelSamples)
  expect(samples.visible).toBeGreaterThan(10)
  expect(samples.incorrect).toBe(0)
  await expect(page.locator('#star-name')).toHaveText('Sirius A')
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  expect(await page.locator('.star-label').count()).toBeGreaterThan(0)
  expect(await page.locator('.star-label').count()).toBeLessThan(22)

  if (isMobile) {
    const session = await context.newCDPSession(page)
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height * 0.6
    const beforePinch = await canvas.screenshot({ scale: 'css' })
    const touches = (spread: number) => [{ x: centerX - spread, y: centerY, id: 0 }, { x: centerX + spread, y: centerY, id: 1 }]
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(30) })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(40) })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(48) })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await session.detach()
    await expect(page.locator('#star-name')).toHaveText('Sirius A')
    await expect.poll(async () => changedPixels(beforePinch, await canvas.screenshot({ scale: 'css' }))).toBeGreaterThan(250)
  }
})

test('clears selection on empty-sky clicks and taps without moving the camera', async ({ page, isMobile }) => {
  await openViewer(page)
  const before = await starPoint(page, 'sirius-a')
  const bounds = (await page.locator('#scene canvas').boundingBox())!
  const empty = { x: bounds.x + bounds.width * 0.25, y: bounds.y + bounds.height * 0.85 }
  await page.mouse.click(empty.x, empty.y, { button: 'right' })
  await expect(page.locator('#star-details')).toBeVisible()
  if (isMobile) await page.touchscreen.tap(empty.x, empty.y)
  else await page.mouse.click(empty.x, empty.y)
  await expect(page.locator('#selection-empty')).toBeVisible()
  await expect(page.locator('#star-details')).toBeHidden()
  await expect(page.locator('#inspector')).not.toHaveAttribute('data-selected-star')
  await expect(page.locator('.map-anchor.is-selected')).toHaveCount(0)
  await expect(page.locator('.dimension-label')).toHaveCount(0)
  await expect(page.locator('.catalog-entry[aria-pressed="true"]')).toHaveCount(0)
  await expect(page.locator('#selection-announcement')).toHaveText('No object selected.')
  const after = await starPoint(page, 'sirius-a')
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1)
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.locator('#selection-empty')).toBeVisible()
  const point = await starPoint(page, 'sirius-a')
  if (isMobile) await page.touchscreen.tap(point.x, point.y)
  else await page.mouse.click(point.x, point.y)
  await expect(page.locator('#star-name')).toHaveText('Sirius A')
  await expect(page.locator('#star-details')).toBeVisible()
  await expect(page.locator('#selection-empty')).toBeHidden()
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await expect(page.locator('[data-star-id="sun"] .star-label')).toBeVisible()
})

test('fits a narrow viewport and keeps long source content inside the inspector', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await openViewer(page)
  await sceneFits(page)
  await expect(page.locator('.map-anchor[data-star-id="sun"]')).toBeVisible()
  await expect(page.locator('.map-anchor[data-star-id="sirius-a"]')).toBeVisible()
  await page.getByText('Coordinates & source', { exact: true }).click()
  await page.locator('#star-notes').scrollIntoViewIfNeeded()
  expect(await page.locator('#inspector').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('narrow-details.png'), fullPage: true })
})

test('keeps tooltips usable by mouse and keyboard without sticky touch hover', async ({ page, isMobile }, testInfo) => {
  await openViewer(page)
  const reset = page.getByRole('button', { name: 'Reset view', exact: true })
  const tooltip = reset.locator('.tooltip')
  if (isMobile) {
    await reset.tap()
    await expect(tooltip).toBeHidden()
  } else {
    await reset.hover()
    await expect(tooltip).toBeVisible()
    await page.mouse.move(1, 1)
    await expect(tooltip).toBeHidden()
  }
  await page.keyboard.press('Tab')
  await reset.focus()
  await expect(reset).toBeFocused()
  await expect(tooltip).toBeVisible()
  await sceneFits(page)
  await page.keyboard.press('Tab')
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Select WISE 0855-0714', exact: true }).click()
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.mouse.move(1, 1)
  await page.setViewportSize({ width: 700, height: 460 })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await sceneFits(page)
  await page.screenshot({ path: testInfo.outputPath('landscape.png'), fullPage: true })
})

test('keeps the catalog usable if WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null
      return original.apply(this, args)
    } as typeof original
  })
  await page.goto('/')
  await expect(page.locator('#scene-status')).toContainText('3D graphics are unavailable')
  await openPreferences(page)
  await openFilter(page)
  await page.locator('.catalog summary').click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await expect(page.getByRole('button', { name: 'Reset view', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Grid', exact: true })).toBeDisabled()
  await page.getByLabel('Catalog', { exact: true }).selectOption('nearest-100')
  await expect(page.locator('.catalog-entry')).toHaveCount(101)
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await expect(page.locator('#constellation')).toHaveText('Not applicable')
  await page.getByLabel('ly', { exact: true }).check()
  await expect(page.locator('#distance-unit')).toHaveText(' ly')
  await expect(page.locator('#scene canvas')).toHaveCount(0)
})
