import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { readFileSync } from 'node:fs'
import { Box3, PerspectiveCamera, Sphere, Spherical, Vector3 } from 'three'
import { parseStarCatalog, type Star } from '../src/catalog'
import { galacticToWorld, LIGHT_YEARS_PER_PARSEC } from '../src/astronomy'
import { arrowPixelMask, hideEarthOrbit, hideMilkyWay, isolatedArrows, measureArrowShaft, motionArrows, openFilter, openPreferences, openViewer, selectCatalog, starPoint, type MotionArrowSnapshot } from './support'

function resetCamera(stars: readonly Star[], bounds: { width: number; height: number }, selectedId: string | null, distanceScale = 1) {
  const sun = galacticToWorld(stars.find((star) => star.id === 'sun')!)
  const selected = selectedId === null || selectedId === 'sun' ? null : galacticToWorld(stars.find((star) => star.id === selectedId)!)
  const target = selected ? sun.clone().lerp(selected, 0.5) : sun
  const camera = new PerspectiveCamera(44, bounds.width / bounds.height, 0.01, 1000)
  const verticalAngle = camera.fov * Math.PI / 360
  const fitAngle = Math.min(verticalAngle, Math.atan(Math.tan(verticalAngle) * camera.aspect))
  const distance = (selected
    ? Math.max(sun.distanceTo(selected) / 2, 0.75) / Math.sin(fitAngle) * 1.6
    : 50 / LIGHT_YEARS_PER_PARSEC) * distanceScale
  camera.position.copy(target).addScaledVector(new Vector3(-4.8, 3.8, -6.2).normalize(), distance)
  camera.lookAt(target)
  camera.updateMatrixWorld()
  return camera
}

function catalogCamera(stars: readonly Star[], bounds: { width: number; height: number }) {
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
  await selectCatalog(page, 'nearest-1000')
  await expect(page.locator('#catalog-count')).toHaveText(/\/1001$/)
  expect(catalogRequests.filter((name) => name.startsWith('nearest-1000-'))).toHaveLength(1)
  await selectCatalog(page, 'nearest-neighbors')
  await expect(page.locator('#catalog-count')).toHaveText(/\/22$/)
  await selectCatalog(page, 'nearest-1000')
  await expect(page.locator('#catalog-count')).toHaveText(/\/1001$/)
  expect(catalogRequests.filter((name) => name.startsWith('nearest-1000-'))).toHaveLength(1)
})

test('loads compact remnants on demand and shows type-specific sourced fields', async ({ page }) => {
  const compactRequests: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (/\/assets\/compact-remnants-[^/]+\.json$/.test(path)) compactRequests.push(path)
  })
  await openViewer(page)
  expect(compactRequests).toHaveLength(0)
  await openFilter(page)
  await page.locator('details.filter-dropdown > summary').click()
  await page.getByLabel('Black holes', { exact: true }).check()
  await expect(page.locator('#catalog-count')).toHaveText(/\/291$/)
  await expect(page.locator('#scene')).toHaveAttribute('data-grid-spacing-pc', '0.5')
  await expect(page.locator('#scene')).toHaveAttribute('data-grid-half-size-pc', '31')
  expect(compactRequests).toHaveLength(1)
  await page.getByLabel('Object visibility distance', { exact: true }).fill('22')
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('Gaia BH1')
  await page.getByRole('button', { name: 'Select Gaia BH1' }).click()
  await expect(page.locator('#object-type')).toHaveText('Black hole')
  await expect(page.locator('#mass')).toHaveText('9.27 +/- 0.1 solar')
  await expect(page.locator('#compact-status')).toHaveText('Confirmed')
  await expect(page.locator('#orbital-period')).toHaveText('185.387 +/- 0.003 days')
  await expect(page.locator('.stellar-property:visible')).toHaveCount(0)

  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.getByLabel('Pulsars', { exact: true }).check()
  await page.getByLabel('Black holes', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('PSR')
  await expect(page.getByRole('button', { name: /^Select PSR/ }).first()).toBeVisible()
  const pulsarDistances = (await page.locator('.catalog-distance').allTextContents()).map((distance) => Number.parseFloat(distance))
  expect(pulsarDistances.length).toBeGreaterThan(2)
  expect(pulsarDistances).toEqual([...pulsarDistances].sort((first, second) => first - second))
  await page.getByLabel('Search objects').fill('PSR J0030+0451')
  await page.getByRole('button', { name: 'Select PSR J0030+0451' }).click()
  await expect(page.locator('#object-type')).toHaveText('Pulsar')
  await expect(page.locator('#mass')).toHaveText('Not available')
  await expect(page.locator('#rotation-period')).toContainText('0.0048654533')
  await expect(page.locator('#radio-luminosity')).toHaveText('0.12 mJy kpc²')
  expect(compactRequests).toHaveLength(1)
})

test('adds the bright-star catalog as a deduplicated optional overlay', async ({ page }) => {
  await openViewer(page)
  await openFilter(page)
  const toggle = page.getByRole('switch', { name: 'Always show bright stars' })
  await expect(toggle).not.toBeChecked()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  const sunBeforeToggle = await starPoint(page, 'sun')
  const gridBeforeToggle = await page.locator('#scene').getAttribute('data-grid-half-size-pc')
  expect(gridBeforeToggle).toBe('31')
  await toggle.check()
  await expect(page.locator('#catalog-count')).toHaveText(/\/133$/)
  await expect(page.locator('[data-star="bright-canopus"]')).toHaveCount(0)
  expect(await page.locator('.catalog-entry').evaluateAll((entries) => {
    const ids = entries.map((entry) => (entry as HTMLElement).dataset.star)
    return new Set(ids).size === ids.length
  })).toBe(true)
  expect(Number(await page.locator('.projected-labels').getAttribute('data-core-count'))).toBeLessThan(133)
  expect(await starPoint(page, 'sun')).toEqual(sunBeforeToggle)
  await expect(page.locator('#scene')).toHaveAttribute('data-grid-half-size-pc', gridBeforeToggle!)

  const distance = page.getByLabel('Object visibility distance', { exact: true })
  await distance.fill('22')
  await expect(page.locator('#object-distance-limit-value')).toHaveText('3000 ly')
  await expect(distance).toHaveAttribute('aria-valuetext', '3000 light-years')
  await expect(page.locator('#grid-spacing')).toHaveText('195.69 ly grid')
  await expect(page.locator('#scene')).toHaveAttribute('data-grid-spacing-pc', '60')
  await expect(page.locator('#scene')).toHaveAttribute('data-grid-half-size-pc', '920')
  await expect(page.locator('.projected-labels')).toHaveAttribute('data-core-count', '133')
  await expect(page.locator('[data-star="bright-canopus"]')).toHaveCount(1)

  await toggle.uncheck()
  await expect(page.locator('#catalog-count')).toHaveText(/\/22$/)
  await expect(page.locator('[data-star="bright-canopus"]')).toHaveCount(0)
})

test('adds independent Western constellation and famous-cluster landmark layers', async ({ page }) => {
  await openViewer(page)
  await openFilter(page)
  const bright = page.getByRole('switch', { name: 'Always show bright stars' })
  const western = page.getByRole('switch', { name: 'Western constellation stars' })
  const clusters = page.getByRole('switch', { name: 'Famous cluster stars' })
  await expect(bright).not.toBeChecked()
  await expect(western).not.toBeChecked()
  await expect(clusters).not.toBeChecked()
  await expect(western.locator('xpath=ancestor::label/preceding-sibling::label[1]')).toContainText('Always show bright stars')
  await expect(clusters.locator('xpath=ancestor::label/preceding-sibling::label[1]')).toContainText('Western constellation stars')

  await western.check()
  await expect(page.locator('#catalog-count')).toHaveText(/\/711$/)
  await bright.check()
  await expect(page.locator('#catalog-count')).toHaveText(/\/712$/)
  const distance = page.getByLabel('Object visibility distance', { exact: true })
  await distance.fill('24')
  await expect(page.locator('#object-distance-limit-value')).toHaveText('10000 ly')
  await expect(distance).toHaveAttribute('aria-valuetext', '10000 light-years')
  await expect(page.locator('#scene')).toHaveAttribute('data-grid-spacing-pc', '200')
  await expect(page.locator('#scene')).toHaveAttribute('data-grid-half-size-pc', '3067')

  await bright.uncheck()
  await western.uncheck()
  await clusters.check()
  await expect(page.locator('#catalog-count')).toHaveText(/\/64$/)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('Alcyone')
  await expect(page.getByRole('button', { name: 'Select Alcyone' })).toBeVisible()
  await page.getByLabel('Search objects').fill('Theta1 Orionis C')
  await page.getByRole('button', { name: 'Select Theta1 Orionis C' }).click()
  await expect(page.locator('#star-name')).toHaveText('Theta1 Orionis C')
  await page.locator('#object-card-details > summary').click()
  await expect(page.locator('#temperature')).toHaveText('39,000 K')
  await expect(page.locator('#mass')).toHaveText('33.4 solar')
  await expect(page.locator('#luminosity')).toHaveText('177,827.941 solar')
  await expect(page.locator('#radius')).toHaveText('9.4 solar')

  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await western.check()
  await expect(page.locator('#catalog-count')).toHaveText(/\/746$/)
  await bright.check()
  await expect(page.locator('#catalog-count')).toHaveText(/\/747$/)
})

test('positions Earth from the orbit slider and remembers its stop', async ({ page }, testInfo) => {
  await openViewer(page)
  const scene = page.locator('#scene')
  const canvas = scene.locator('canvas')
  await expect(scene).toHaveAttribute('data-earth-orbit-visible', 'true')
  await expect(scene).toHaveAttribute('data-earth-orbit-date', /^\d{4}-\d{2}-\d{2}$/)
  await expect(scene).toHaveAttribute('data-earth-orbit-radius-pc', '0.35')
  const longitude = Number(await scene.getAttribute('data-earth-ecliptic-longitude-deg'))
  expect(longitude).toBeGreaterThanOrEqual(0)
  expect(longitude).toBeLessThan(360)

  await openFilter(page)
  const slider = page.getByRole('slider', { name: 'Earth’s orbit' })
  await expect(slider).toHaveValue('1')
  await expect(slider).toHaveAttribute('aria-valuetext', 'Now')
  await expect(page.locator('#earth-orbit-mode-value')).toHaveText('Now')
  await expect(slider.locator('xpath=ancestor::div[contains(@class, "range-filter")]/following-sibling::label[1]')).toContainText('Show Milky Way')
  const visible = await canvas.screenshot({ scale: 'css', path: testInfo.outputPath('earth-orbit-now.png') })

  await slider.fill('0')
  await expect(page.locator('#earth-orbit-mode-value')).toHaveText('Off')
  await expect(scene).toHaveAttribute('data-earth-orbit-visible', 'false')
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  expect(changedPixels(visible, await canvas.screenshot({ scale: 'css' }))).toBeGreaterThan(30)

  const year = new Date().getUTCFullYear()
  await slider.fill('2')
  await expect(page.locator('#earth-orbit-mode-value')).toHaveText('Jan')
  await expect(scene).toHaveAttribute('data-earth-orbit-visible', 'true')
  await expect(scene).toHaveAttribute('data-earth-orbit-date', `${year}-01-15`)
  const january = await canvas.screenshot({ scale: 'css', path: testInfo.outputPath('earth-orbit-january.png') })
  await slider.fill('8')
  await expect(page.locator('#earth-orbit-mode-value')).toHaveText('Jul')
  await expect(scene).toHaveAttribute('data-earth-orbit-date', `${year}-07-15`)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  expect(changedPixels(january, await canvas.screenshot({ scale: 'css' }))).toBeGreaterThan(30)

  await slider.fill('2')
  await openViewer(page)
  await openFilter(page)
  await expect(page.getByRole('slider', { name: 'Earth’s orbit' })).toHaveValue('2')
  await expect(page.locator('#earth-orbit-mode-value')).toHaveText('Jan')
  await expect(scene).toHaveAttribute('data-earth-orbit-date', `${year}-01-15`)
})

test('toggles the optimized Milky Way backdrop and remembers the choice', async ({ page }, testInfo) => {
  await openViewer(page)
  const scene = page.locator('#scene')
  const canvas = scene.locator('canvas')
  await expect(scene).toHaveAttribute('data-milky-way-visible', 'true')
  await expect(scene).toHaveAttribute('data-milky-way-ready', 'true')
  await openFilter(page)
  const toggle = page.getByRole('switch', { name: 'Show Milky Way' })
  await expect(toggle).toBeChecked()
  await expect(toggle.locator('xpath=ancestor::label/following-sibling::label[1]')).toContainText('Motion arrows')

  const backdrop = await canvas.screenshot({ scale: 'css', path: testInfo.outputPath('milky-way-on.png') })
  await toggle.uncheck()
  await expect(scene).toHaveAttribute('data-milky-way-visible', 'false')
  expect(changedPixels(backdrop, await canvas.screenshot({ scale: 'css' }))).toBeGreaterThan(10_000)

  await openViewer(page)
  await openFilter(page)
  await expect(page.getByRole('switch', { name: 'Show Milky Way' })).not.toBeChecked()
  await expect(scene).toHaveAttribute('data-milky-way-visible', 'false')
  await expect(scene).not.toHaveAttribute('data-milky-way-ready')
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
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const problems = await page.evaluate(() => {
    const failures: string[] = []
    const scene = document.querySelector('#scene')!.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth > viewportWidth) failures.push('page horizontal overflow')
    if (scene.width < 200 || scene.height < 200) failures.push('scene too small')
    const labels = [...document.querySelectorAll<HTMLElement>('.map-label')].filter((label) => label.checkVisibility())
    for (const label of labels) {
      const bounds = label.getBoundingClientRect()
      if (bounds.left < scene.left || bounds.right > scene.right || bounds.top < scene.top || bounds.bottom > scene.bottom) failures.push(`clipped label ${label.textContent}`)
      if (viewportWidth <= 720) continue
      for (const obstacle of label.matches('.distance-label') ? [] : document.querySelectorAll<HTMLElement>('[data-scene-obstacle]')) {
        if (!obstacle.checkVisibility()) continue
        const other = obstacle.getBoundingClientRect()
        if (bounds.left < other.right && bounds.right > other.left && bounds.top < other.bottom && bounds.bottom > other.top) failures.push(`label ${label.textContent} overlaps ${obstacle.className}`)
      }
    }
    for (const control of document.querySelectorAll<HTMLElement>('button, summary')) {
      if (!control.checkVisibility()) continue
      const bounds = control.getBoundingClientRect()
      const minimum = control.matches('.catalog-entry') ? 36 : 44
      if (bounds.width < minimum || bounds.height < minimum) failures.push(`small control ${control.getAttribute('aria-label')}`)
      if (bounds.left < 0 || bounds.right > viewportWidth + 1) failures.push('control overflow')
    }
    return failures
  })
  expect(problems).toEqual([])
}

test('switches project catalogs while preserving settings and compatible selection', async ({ page }, testInfo) => {
  await openViewer(page)
  await openPreferences(page)
  await page.getByLabel('Star labels', { exact: true }).fill('20')
  await openFilter(page)
  const catalogSlider = page.getByLabel('Catalog', { exact: true })
  await expect(catalogSlider).toHaveValue('0')
  await expect(page.locator('#catalog-range-value')).toHaveText('Nearest neighbors')
  await expect(page.locator('#object-type')).toHaveText('White star')
  await expect(page.locator('#constellation')).toHaveText('Canis Major')
  await expect(page.locator('#absolute-mag')).toHaveText('1.42')
  await expect(page.getByLabel('ly', { exact: true })).toBeChecked()
  await page.getByLabel('V magnitude limit', { exact: true }).fill('9')
  await page.getByLabel('Object visibility distance', { exact: true }).fill('3')
  await page.getByLabel('Arrow length', { exact: true }).selectOption('50000')
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const sunBeforeCatalogSwitch = await starPoint(page, 'sun')
  const siriusBeforeCatalogSwitch = await starPoint(page, 'sirius-a')
  for (const id of ['nearest-100', 'nearest-neighbors', 'nearest-100']) {
    await selectCatalog(page, id)
    await page.getByRole('button', { name: 'Objects', exact: true }).click()
    await expect(page.locator('#scene canvas')).toHaveCount(1)
    await expect(page.locator('.projected-labels')).toHaveCount(1)
    expect(await page.locator('.catalog-entry').count()).toBeGreaterThan(0)
    await expect(page.locator('#star-name')).toHaveText('Sirius A')
    await expect(page.locator('#visibility-base')).toHaveText('Sirius A')
    await expect(page.locator('#distance-unit')).toHaveText(' ly')
    await expect(page.locator('#magnitude-limit')).toHaveValue('9')
    await expect(page.locator('#label-limit')).toHaveValue('20')
    await expect(page.locator('.projected-labels')).toHaveAttribute('data-name-budget', '20')
    await expect(page.locator('#object-distance-limit-value')).toHaveText('20 ly')
    await expect(page.locator('#toggle-grid')).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.catalog')).toBeVisible()
    expect(await starPoint(page, 'sun')).toEqual(sunBeforeCatalogSwitch)
    expect(await starPoint(page, 'sirius-a')).toEqual(siriusBeforeCatalogSwitch)
  }
  await page.getByRole('button', { name: 'Select GJ 229 A', exact: true }).click()
  await expect(page.locator('#constellation')).toHaveText('Lepus')
  await expect(page.locator('#luminosity')).toHaveText('0.0526 solar')
  await expect(page.locator('.motion-arrow')).toHaveCount(0)
  const nearestArrows = await motionArrows(page)
  expect(nearestArrows.some((arrow) => arrow.mode === 'full' && arrow.selected && arrow.opacity === 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('nearest-100.png'), fullPage: true })
  await selectCatalog(page, 'nearest-neighbors')
  await expect(page.locator('#star-details')).toBeHidden()
  await expect(page.locator('#visibility-base')).toHaveText('Sun')
  await expect(page.locator('[data-star-id="sun"]')).toHaveAttribute('data-visibility', 'base')
  await selectCatalog(page, 'nearest-100')
  await expect(page.locator('#star-details')).toBeHidden()
  await expect(page.locator('#visibility-base')).toHaveText('Sun')
  await sceneFits(page)
})

test('searches the virtualized nearest-1000 list within bounded name budgets', { tag: '@mobile' }, async ({ page }) => {
  await openViewer(page)
  await selectCatalog(page, 'nearest-1000')
  await expect(page.locator('#catalog-count')).toHaveText(/\/1001$/)
  await page.getByLabel('Arrow length', { exact: true }).selectOption('50000')
  const nameBudget = 40
  const activeAnchors = await page.locator('.map-anchor[data-star-id]').count()
  expect(activeAnchors, 'arrows no longer need DOM anchors').toBeLessThanOrEqual(nameBudget)
  await expect(page.locator('.motion-arrow')).toHaveCount(0)
  expect((await motionArrows(page)).length).toBeGreaterThan(0)
  expect(await page.locator('.star-label:visible').count()).toBeLessThanOrEqual(nameBudget)
  const catalog = page.getByRole('button', { name: 'Objects', exact: true })
  if (await catalog.getAttribute('aria-expanded') === 'false') await catalog.click()
  const renderedRows = page.locator('.catalog-entry')
  expect(await renderedRows.count()).toBeLessThan(30)
  await page.getByLabel('Search objects').fill('cns5 4902')
  await expect(renderedRows).toHaveCount(1)
  await expect(page.locator('#catalog-count')).toHaveText('1/1001')
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
  await page.getByLabel('Search objects').fill('Arcturus')
  await page.getByRole('button', { name: 'Select Arcturus', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Arcturus')
  await page.getByLabel('Search objects').fill('Alsafi')
  await page.getByRole('button', { name: 'Select Alsafi', exact: true }).click()
  await expect(page.locator('#radius')).toHaveText('0.826 solar')
  await expect(page.locator('#metallicity')).toHaveText('-0.407 dex')
  await expect(page.locator('#age')).toHaveText('9.933 Gyr')
})

test('defaults to light-years, converts every distance without moving the camera, and remembers units', async ({ page }) => {
  await openViewer(page)
  await openPreferences(page)
  const before = await starPoint(page, 'sun')
  await expect(page.getByLabel('ly', { exact: true })).toBeChecked()
  const viewerDistanceLy = Number.parseFloat(await page.locator('#viewer-distance').innerText())
  expect(viewerDistanceLy).toBeGreaterThan(0)
  await expect(page.locator('#viewer-distance')).toHaveText(/^[\d,.]+ ly$/)
  await expect(page.locator('#distance-value')).toHaveText('8.61')
  await expect(page.locator('#star-distance')).toHaveText('8.61 ly')
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
  await expect(page.locator('#viewer-distance')).toHaveText(/^[\d,.]+ pc$/)
  const viewerDistancePc = Number.parseFloat((await page.locator('#viewer-distance').innerText()).replaceAll(',', ''))
  expect(viewerDistancePc).toBeCloseTo(viewerDistanceLy / 3.261563777, 1)
  await expect(page.locator('#distance-value')).toHaveText('2.64')
  await expect(page.locator('#star-distance')).toHaveText('2.64 pc')
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
  await openFilter(page)
  await page.locator('#filter-lock').click()
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
  await expect.poll(async () => (await motionArrows(page)).some((arrow) => arrow.id === 'barnards-star')).toBe(true)
  await expect(page.locator('#constellation')).toHaveText('Ophiuchus')
  const canvas = (await page.locator('#scene canvas').boundingBox())!
  const position = await starPoint(page, 'barnards-star')
  await page.mouse.click(canvas.x + canvas.width * 0.1, canvas.y + canvas.height * 0.8)
  await expect(page.locator('#star-details')).toBeHidden()
  await expect(page.locator('#visibility-base')).toHaveText("Barnard's Star")
  await expect(faint).toHaveAttribute('data-visibility', 'base')
  expect(await starPoint(page, 'barnards-star')).toEqual(position)
  await selectCatalog(page, 'nearest-100')
  await expect(page.locator('#star-details')).toBeHidden()
  await expect(page.locator('#visibility-base')).toHaveText("Barnard's Star")
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await expect(page.locator('#constellation')).toHaveText('Not applicable')
  await expect(page.locator('#absolute-mag')).toHaveText('4.83')
})

test('renders faint objects as small colored cores without halos at either pixel density', async ({ page }, testInfo) => {
  await openViewer(page)
  await hideMilkyWay(page)
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
  const sample = (buffer: Buffer, isArrowPixel: (x: number, y: number) => boolean) => {
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
        if (radius > 6 && radius < 10 && !isArrowPixel((pixelX + 0.5) / ratio, (pixelY + 0.5) / ratio)) {
          haloBrightness += red + green + blue
          haloPixels++
        }
      }
    }
    return { coreArea: corePixels / ratio ** 2, halo: haloBrightness / haloPixels }
  }
  const faintMask = arrowPixelMask(await motionArrows(page), bounds)
  const faint = sample(await canvas.screenshot({ ...options, path: testInfo.outputPath('background-dot.png') }), faintMask)
  expect(faint.coreArea).toBeGreaterThan(2)
  expect(faint.coreArea).toBeLessThan(10)
  expect(faint.halo).toBeLessThan(1)
  await page.getByLabel('V magnitude limit', { exact: true }).fill('12')
  await expect(page.locator('[data-star-id="barnards-star"]')).toHaveAttribute('data-visibility', 'eligible')
  expect(await starPoint(page, 'barnards-star')).toEqual(point)
  const eligibleMask = arrowPixelMask(await motionArrows(page), bounds)
  const eligible = sample(await canvas.screenshot({ ...options, path: testInfo.outputPath('eligible-dot.png') }), eligibleMask)
  expect(eligible.coreArea).toBeGreaterThan(45)
  expect(eligible.coreArea).toBeLessThan(85)
  expect(eligible.halo).toBeGreaterThan(4)
})

test('catalog starts closed and opens independently with the keyboard', async ({ page }) => {
  await openViewer(page)
  const catalog = page.getByRole('button', { name: 'Objects', exact: true })
  await expect(catalog).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#catalog-count')).toHaveText(/\/22$/)
  await expect(page.locator('#star-list')).toBeHidden()
  await catalog.focus()
  await page.keyboard.press('Enter')
  await expect(catalog).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#star-list')).toBeVisible()
  await sceneFits(page)
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await catalog.click()
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await page.locator('#object-card-details > summary').click()
  await page.getByText('Coordinates & source', { exact: true }).click()
  await expect(catalog).toHaveAttribute('aria-expanded', 'false')
  await catalog.focus()
  await page.keyboard.press('Space')
  await expect(catalog).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: 'Select Sun', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.source-details')).toHaveAttribute('open')
})

test('opens an accessible project info card', { tag: '@mobile' }, async ({ page }) => {
  await openViewer(page)
  const info = page.getByRole('button', { name: 'Info', exact: true })
  await expect(info).toHaveAttribute('aria-expanded', 'false')
  await expect(info.locator('.tooltip')).toHaveText('Info')
  await info.click()
  await expect(info).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#info-panel')).toBeVisible()
  await expect(page.locator('#info-heading')).toHaveText('Star View')
  await expect(page.locator('.info-meta')).toContainText('MIT')
  await expect(page.locator('.info-meta')).toContainText('v0.2')
  await expect(page.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/reery/Star-View')
  await sceneFits(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('#info-panel')).toBeHidden()
  await expect(info).toBeFocused()
})

test('presents the selected object beside an expandable control dock', async ({ page }, testInfo) => {
  await openViewer(page)
  await expect(page.locator('.app-header, .scene-heading, .catalog-footer')).toHaveCount(0)
  await expect(page.locator('.scene-brand, #brand-icon, #plane-key')).toHaveCount(0)
  await expect(page.locator('.scene-wrap > .visibility-observer')).toContainText('Visibility from: Sirius A | Distance from viewer:')
  await expect(page.locator('.selected-object > summary')).toHaveCount(0)
  await expect(page.locator('.selected-object')).toHaveCSS('border-radius', '11px')
  await expect(page.locator('.dock-card:visible')).toHaveCount(0)
  const panelButtons = page.locator('.panel-button')
  await expect(panelButtons).toHaveCount(5)
  expect(await panelButtons.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))).toEqual(['Stellar motion', 'Filter', 'Preferences', 'Objects', 'Info'])
  expect(await panelButtons.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-expanded')))).toEqual(['false', 'false', 'false', 'false', 'false'])
  await expect(page.locator('#object-card-details')).not.toHaveAttribute('open')
  await expect(page.locator('#star-name')).toBeVisible()
  await expect(page.locator('.properties-section')).toBeHidden()
  const primaryProperties = page.locator('.properties-section .properties')
  await expect(primaryProperties.locator('#distance-value')).toHaveText('8.61')
  await expect(primaryProperties.locator('#absolute-mag')).toHaveText('1.42')
  await page.screenshot({ path: testInfo.outputPath('compact-default.png'), fullPage: true })
  await page.locator('#object-card-details > summary').click()
  await expect(page.locator('.properties-section')).toBeVisible()
  expect(await page.locator('.properties-section dt:visible').allTextContents()).toEqual([
    'Distance from Sun', 'Object type', 'Constellation', 'Spectral type', 'Temperature',
    'Bolometric luminosity', 'Mass', 'Radius', 'Metallicity [M/H]', 'Age', 'Absolute mag. (V)',
  ])
  await expect(page.locator('#luminosity-row')).toBeVisible()
  await expect(page.locator('#luminosity')).toHaveText('24.74 solar')
  await expect(page.locator('.properties-section .properties > div').first()).toHaveCSS('font-size', '14px')
  await expect(page.locator('#object-card-details > .selection-summary')).toHaveCSS('border-bottom-width', '0px')
  await expect(page.locator('.properties-section')).toHaveCSS('border-bottom-width', '0px')
  expect(await page.locator('.source-details').evaluate((details) => details.closest('.selected-object') !== null)).toBe(true)
  expect(await page.locator('#catalog-range').evaluate((slider) => slider.closest('.filter-section') !== null)).toBe(true)
  expect(await page.locator('#catalog-range').evaluate((slider) => slider.closest('.preferences') !== null)).toBe(false)
  await openPreferences(page)
  await expect(page.locator('#preferences-panel')).toBeVisible()
  await expect(page.locator('#object-card-details')).toHaveAttribute('open', '')
  await expect(page.locator('#distance-units-label')).toHaveCSS('font-size', '14px')
  await expect(page.locator('#distance-units .unit-options span').first()).toHaveCSS('font-size', '12px')
  await expect(page.locator('#distance-units .unit-options span').first()).toHaveCSS('height', '34px')
  await expect(page.locator('.power-saving-choice')).toHaveCSS('font-size', '14px')
  await expect(page.getByRole('switch', { name: 'Power saving mode' })).not.toBeChecked()
  await page.screenshot({ path: testInfo.outputPath('compact-preferences.png'), fullPage: true })
  const labels = page.getByLabel('Star labels', { exact: true })
  await expect(labels).toHaveAttribute('min', '0')
  await expect(labels).toHaveAttribute('max', '140')
  await expect(labels).toHaveAttribute('step', '20')
  await expect(labels).toHaveValue('40')
  await labels.fill('0')
  await expect(page.locator('#label-limit-value')).toHaveText('Off')
  await expect(page.locator('.star-label:visible')).toHaveCount(0)
  await expect(page.locator('.is-selected .selection-ring')).toBeVisible()
  await labels.fill('20')
  await expect(page.locator('.projected-labels')).toHaveAttribute('data-name-budget', '20')
  expect(await page.locator('.star-label:visible').count()).toBeLessThanOrEqual(20)
  await labels.fill('140')
  await openFilter(page)
  await expect(page.getByRole('button', { name: 'Preferences', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#preferences-panel')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Filter', exact: true })).toHaveAttribute('aria-expanded', 'true')
  const placement = await page.locator('#inspector').evaluate((inspector) => {
    const selected = inspector.querySelector('.selected-object')!.getBoundingClientRect()
    const button = inspector.querySelector('#filter-toggle')!.getBoundingClientRect()
    const panel = inspector.querySelector('#filter-panel')!.getBoundingClientRect()
    const rail = inspector.querySelector('.dock-rail')!.getBoundingClientRect()
    const viewButton = inspector.querySelector('#reset-view')!.getBoundingClientRect()
    return { selectedLeft: selected.left, selectedRight: selected.right, viewButtonLeft: viewButton.left, buttonLeft: button.left, buttonWidth: button.width, panelRight: panel.right, panelWidth: panel.width, bottomGap: Math.abs(panel.bottom - rail.bottom) }
  })
  expect(placement.selectedLeft).toBe(20)
  expect(placement.selectedRight).toBeLessThan(placement.viewButtonLeft)
  expect(placement.panelRight).toBeLessThan(placement.buttonLeft)
  expect(placement.buttonWidth).toBe(44)
  expect(placement.panelWidth).toBeLessThan(292)
  expect(placement.bottomGap).toBeLessThan(1)
  await expect(page.locator('#filter-heading').locator('..')).toHaveCSS('min-height', '44px')
  const catalogSlider = page.getByLabel('Catalog', { exact: true })
  await expect(catalogSlider).toHaveAttribute('type', 'range')
  await expect(catalogSlider).toHaveAttribute('min', '0')
  await expect(catalogSlider).toHaveAttribute('max', '2')
  await expect(catalogSlider).toHaveAttribute('aria-valuetext', 'Nearest neighbors')
  await expect(page.locator('#catalog-range-bounds span')).toHaveText(['22 objects', '1001 objects'])
  const categoryNames = ['Compact objects', 'Stellar systems', 'Interstellar medium', 'Stellar remnants', 'Large-scale structures']
  await expect(page.locator('#object-categories .toggle-text > span:first-child')).toHaveText(categoryNames)
  for (const [name, checked, available] of [
    ['Compact objects', true, true], ['Stellar systems', false, false], ['Interstellar medium', false, true],
    ['Stellar remnants', false, true], ['Large-scale structures', false, false],
  ] as const) {
    const toggle = page.getByRole('switch', { name, exact: true })
    await expect(toggle).toBeChecked({ checked })
    if (available) await expect(toggle).toBeEnabled()
    else {
      await expect(toggle).toBeDisabled()
      await expect(toggle).toHaveAccessibleDescription('No data yet')
    }
  }
  await expect(page.locator('.filter-toggle').first()).toHaveCSS('font-size', '14px')
  await expect(page.locator('.category-toggle').first()).toHaveCSS('font-size', '14px')
  await expect(page.locator('#motion-frame-label')).toHaveCSS('font-size', '14px')
  await expect(page.locator('#motion-frame .unit-options span').first()).toHaveCSS('font-size', '12px')
  const distance = page.getByLabel('Object visibility distance', { exact: true })
  const magnitude = page.getByLabel('V magnitude limit', { exact: true })
  await expect(distance).toHaveAttribute('min', '0')
  await expect(distance).toHaveAttribute('max', '24')
  await expect(distance).toHaveValue('14')
  await expect(page.locator('#object-distance-limit-value')).toHaveText('100 ly')
  await expect(magnitude).toHaveAttribute('type', 'range')
  await expect(magnitude).toHaveAttribute('max', '25')
  await selectCatalog(page, 'nearest-100')
  await expect(page.locator('#catalog-range-value')).toHaveText('Nearest 100 objects')
  await magnitude.fill('25')
  await expect(page.locator('[data-star-id="10pc-0098"]')).toHaveAttribute('data-visibility', 'eligible')

  const typeGroups = [
    ['Sun', 'Stars', 'Brown dwarfs', 'White dwarfs', 'Neutron stars', 'Pulsars', 'Black holes'],
    ['Binaries', 'Multiple systems'],
    ['Molecular clouds', 'Dark nebulae', 'Reflection nebulae', 'H II regions'],
    ['Planetary nebulae', 'Supernova remnants', 'Pulsar-wind nebulae'],
    ['Bubbles', 'Superbubbles', 'Dust sheets', 'Local Bubble'],
  ]
  const typeDropdown = page.locator('details.filter-dropdown')
  await expect(typeDropdown).not.toHaveAttribute('open')
  await expect(page.locator('#object-type-options')).toBeHidden()
  await typeDropdown.locator('summary').click()
  await expect(page.locator('#object-type-options')).toBeVisible()
  await expect(page.locator('#object-type-filter-summary')).toHaveText('4 of 10')
  await expect(page.locator('.type-group-heading')).toHaveText(categoryNames)
  await expect(page.locator('.object-type-option > span:not(.filter-hint)')).toHaveText(typeGroups.flat())
  const option = (name: string) => page.getByLabel(name, { exact: true })
  for (const name of ['Sun', 'Stars', 'Brown dwarfs', 'White dwarfs']) {
    await expect(option(name)).toBeChecked()
    await expect(option(name)).toBeEnabled()
  }
  for (const name of ['Neutron stars', 'Pulsars', 'Black holes']) {
    await expect(option(name)).not.toBeChecked()
    await expect(option(name)).toBeEnabled()
  }
  for (const name of ['Reflection nebulae', 'H II regions', 'Planetary nebulae']) {
    await expect(option(name)).toBeChecked()
    await expect(option(name)).toBeDisabled()
  }
  for (const name of [...typeGroups[1]!, ...typeGroups[2]!.slice(0, 2), ...typeGroups[3]!.slice(1), ...typeGroups[4]!]) {
    await expect(option(name)).not.toBeChecked()
    await expect(option(name)).toBeDisabled()
    await expect(option(name)).toHaveAccessibleDescription('No data yet')
  }
  await sceneFits(page)
  await page.screenshot({ path: testInfo.outputPath('interface-hierarchy.png'), fullPage: true })
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  const rows = page.locator('.catalog-entry')
  await expect(rows).toHaveCount(101)
  await expect(page.locator('.star-list')).toHaveCSS('max-height', '340px')
  const rowLayout = await rows.evaluateAll((entries) => entries.slice(0, 2).map((entry) => {
    const bounds = entry.getBoundingClientRect()
    return { top: bounds.top, height: bounds.height }
  }))
  expect(rowLayout.map(({ height }) => height)).toEqual([36, 36])
  expect(rowLayout[1]!.top - rowLayout[0]!.top).toBe(36)
  await page.screenshot({ path: testInfo.outputPath('compact-objects.png'), fullPage: true })
  const info = page.getByRole('button', { name: 'Info', exact: true })
  await expect(info.locator('.tooltip')).toHaveText('Info')
  await info.click()
  await expect(page.getByRole('button', { name: 'Objects', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(info).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#info-panel')).toBeVisible()
  await expect(page.locator('#info-heading')).toHaveText('Star View')
  await expect(page.locator('.info-meta')).toContainText('MIT')
  await expect(page.locator('.info-meta')).toContainText('v0.2')
  await expect(page.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/reery/Star-View')
  await sceneFits(page)
  await page.screenshot({ path: testInfo.outputPath('compact-info.png'), fullPage: true })
})

test('dismisses unlocked control cards on every scene interaction while locked cards stay open', async ({ page }) => {
  await openViewer(page)
  const canvas = page.locator('#scene canvas')
  await expect(page.locator('.panel-lock')).toHaveCount(4)
  await expect(page.locator('#info-panel .panel-lock')).toHaveCount(0)

  await openPreferences(page)
  const sunBeforeRotation = await starPoint(page, 'sun')
  const bounds = (await canvas.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height * 0.7)
  await page.mouse.down()
  await expect(page.locator('#preferences-panel')).toBeHidden()
  await page.mouse.move(bounds.x + bounds.width * 0.45, bounds.y + bounds.height * 0.62, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('#selected-object-card')).toBeVisible()
  const sunAfterRotation = await starPoint(page, 'sun')
  expect(Math.hypot(sunAfterRotation.x - sunBeforeRotation.x, sunAfterRotation.y - sunBeforeRotation.y)).toBeGreaterThan(2)

  for (const [name, panel] of [['Stellar motion', 'motion'], ['Filter', 'filter'], ['Objects', 'objects'], ['Info', 'info']] as const) {
    const toggle = page.getByRole('button', { name, exact: true })
    await toggle.click()
    await expect(page.locator(`#${panel}-panel`)).toBeVisible()
    await canvas.click({ position: { x: 2, y: 2 } })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  }

  await page.getByRole('button', { name: 'Stellar motion', exact: true }).click()
  const motionLock = page.locator('#motion-lock')
  await motionLock.click()
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await expect(page.locator('#motion-panel')).toBeVisible()
  await expect(page.locator('#filter-panel')).toBeVisible()
  await page.getByRole('button', { name: 'Preferences', exact: true }).click()
  await expect(page.locator('#motion-panel')).toBeVisible()
  await expect(page.locator('#filter-panel')).toBeHidden()
  await expect(page.locator('#preferences-panel')).toBeVisible()
  await canvas.click({ position: { x: 2, y: 2 } })
  await expect(page.locator('#preferences-panel')).toBeHidden()
  await expect(page.locator('#motion-panel')).toBeVisible()
  await motionLock.click()
  await canvas.click({ position: { x: 2, y: 2 } })
  await expect(page.locator('#motion-panel')).toBeHidden()

  await openFilter(page)
  const filterLock = page.locator('#filter-lock')
  await expect(filterLock).toHaveAccessibleName('Keep Filter open')
  await expect(filterLock).toHaveCSS('color', 'rgb(237, 198, 155)')
  await filterLock.click()
  await expect(filterLock).toHaveAttribute('aria-pressed', 'true')
  await expect(filterLock).toHaveAccessibleName('Keep Filter open')
  await expect(filterLock).toHaveCSS('color', 'rgb(255, 138, 42)')
  await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height * 0.7)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.65, { steps: 4 })
  await page.mouse.up()
  await expect(page.locator('#filter-panel')).toBeVisible()
  const point = await starPoint(page, 'sun')
  await page.mouse.click(point.x, point.y)
  await expect(page.locator('#filter-panel')).toBeVisible()
  await expect(page.locator('#selected-object-card')).toBeVisible()
})

test('filters the map and object browser even when an excluded object is selected', async ({ page }) => {
  await openViewer(page)
  await openFilter(page)
  const distance = page.getByLabel('Object visibility distance', { exact: true })
  const barnard = page.locator('[data-star-id="barnards-star"]')
  await distance.fill('0')
  await expect(page.locator('#object-distance-limit-value')).toHaveText('5 ly')
  await expect(barnard).toHaveCount(0)
  await expect(page.locator('[data-star-id="sirius-a"]')).toHaveAttribute('data-map-visible', 'true')
  await expect(page.locator('[data-star="barnards-star"]')).toHaveCount(0)
  await expect(page.locator('[data-star="sirius-a"]')).toHaveCount(1)
  await expect(page.locator('#catalog-count')).toHaveText(`${await page.locator('.catalog-entry').count()}/22`)
  await distance.fill('14')
  await expect(page.locator('[data-star="barnards-star"]')).toHaveCount(1)
  await expect(barnard).toHaveCount(0)

  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Select Luhman 16 A', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Luhman 16 A')
  await openFilter(page)

  const typeDropdown = page.locator('details.filter-dropdown')
  await expect(typeDropdown).not.toHaveAttribute('open')
  await typeDropdown.locator('summary').click()
  const luhmanA = page.locator('[data-star-id="luhman-16-a"]')
  const luhmanB = page.locator('[data-star-id="luhman-16-b"]')
  const sun = page.locator('[data-star-id="sun"]')
  const stars = page.getByLabel('Stars', { exact: true })
  const sunChoice = page.getByLabel('Sun', { exact: true })
  const brownDwarfs = page.getByLabel('Brown dwarfs', { exact: true })
  await expect(page.locator('#object-type-filter-summary')).toHaveText('4 of 10')
  await stars.uncheck()
  await expect(page.locator('#object-type-filter-summary')).toHaveText('3 of 10')
  await expect(sun).toHaveAttribute('data-map-visible', 'true')
  await expect(sun).toBeVisible()
  await sunChoice.uncheck()
  await expect(page.locator('#object-type-filter-summary')).toHaveText('2 of 10')
  await expect(sun).toHaveCount(0)
  await stars.check()
  await expect(sun).toHaveCount(0)
  await sunChoice.check()
  await expect(sun).toHaveAttribute('data-map-visible', 'true')
  await expect(sun).toBeVisible()
  await brownDwarfs.uncheck()
  await expect(page.locator('#object-type-filter-summary')).toHaveText('3 of 10')
  await expect(luhmanA).toHaveAttribute('data-map-visible', 'false')
  await expect(luhmanA).toBeHidden()
  await expect(luhmanB).toHaveCount(0)
  await expect(page.locator('[data-star="luhman-16-a"]')).toHaveCount(0)
  await expect(page.locator('[data-star="luhman-16-b"]')).toHaveCount(0)
  await expect(page.locator('#star-name')).toHaveText('Luhman 16 A')
  await expect(page.locator('#visibility-base')).toHaveText('Luhman 16 A')
  await expect(luhmanB).toHaveCount(0)
  await expect(brownDwarfs).not.toBeChecked()

  await selectCatalog(page, 'nearest-100')
  await expect(brownDwarfs).not.toBeChecked()
  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByLabel('Brown dwarfs', { exact: true })).toBeChecked()
  await openPreferences(page)
  await expect(page.getByRole('switch', { name: 'Power saving mode' })).not.toBeChecked()
})

test('renders temperature-colored objects, measurements, and a responsive interface', { tag: '@mobile' }, async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('requestfailed', (request) => errors.push(request.url()))
  await openViewer(page)
  await hideMilkyWay(page)
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await expect(page.locator('#distance-value')).toHaveText('8.61')
  await expect(page.locator('#inspector').getByText('Galactic height', { exact: true })).toHaveCount(0)
  await expect(page.locator('#height-pc, #height-side, #height-signed')).toHaveCount(0)
  await expect(page.locator('.properties-section dt', { hasText: 'Distance from Sun' })).toHaveCount(1)
  await expect(page.locator('#object-count')).toHaveCount(0)
  await expect(page.locator('#catalog-count')).toHaveText(/\/22$/)
  await expect(page.locator('.catalog-entry')).toHaveCount(22)
  expect(await page.locator('.map-anchor[data-star-id]').count()).toBeLessThan(22)
  expect(await page.locator('.map-anchor[data-star-id]').count()).toBeGreaterThan(0)
  await expect(page.locator('.dimension-label')).toHaveCount(1)
  await expect(page.locator('.height-label')).toHaveCount(0)
  if (!isMobile) {
    await expect(page.locator('.distance-label')).toBeVisible()
  }
  await expect(page.locator('#brand-icon')).toHaveCount(0)
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
  const hotCenterCounts: number[] = []
  for (const id of ['sun', 'sirius-a']) {
    const position = await starPoint(page, id)
    const centerX = Math.round(position.x - bounds.x)
    const centerY = Math.round(position.y - bounds.y)
    let hotCenterPixels = 0
    let coloredPixels = 0
    for (let pixelY = centerY - 9; pixelY <= centerY + 9; pixelY++) {
      for (let pixelX = centerX - 9; pixelX <= centerX + 9; pixelX++) {
        const distance = Math.hypot(pixelX + 0.5 - (position.x - bounds.x), pixelY + 0.5 - (position.y - bounds.y))
        if (distance > 8) continue
        const offset = (pixelY * image.width + pixelX) * 4
        const red = image.data[offset] ?? 0
        const green = image.data[offset + 1] ?? 0
        const blue = image.data[offset + 2] ?? 0
        if (distance <= 2.6 && Math.min(red, green, blue) > 210 && Math.max(red, green, blue) - Math.min(red, green, blue) < 35) hotCenterPixels++
        if (distance >= 4 && red + green + blue > 50 && (id === 'sun' ? red > blue + 12 : blue > red + 12)) coloredPixels++
      }
    }
    expect(hotCenterPixels, `${id} must contain a visible hot-white center`).toBeGreaterThan(4)
    expect(coloredPixels, `${id} must retain a colored bloom outside its white center`).toBeGreaterThan(8)
    hotCenterCounts.push(hotCenterPixels)
  }
  expect(Math.abs(hotCenterCounts[0]! - hotCenterCounts[1]!)).toBeLessThanOrEqual(10)
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('switches between real and exaggerated star colors and remembers the preference', async ({ page }) => {
  await openViewer(page)
  await openPreferences(page)
  const exaggerated = page.getByRole('radio', { name: 'Exaggerated', exact: true })
  const real = page.getByRole('radio', { name: 'Real', exact: true })
  await expect(exaggerated).toBeChecked()
  await expect(page.locator('#selected-swatch')).toHaveCSS('background-color', 'rgb(117, 169, 255)')
  const canvas = page.locator('#scene canvas')
  const vividPixels = await canvas.screenshot({ scale: 'css' })

  await real.check()
  await expect(page.locator('#selected-swatch')).toHaveCSS('background-color', 'rgb(186, 214, 255)')
  await expect(page.locator('[data-star="sirius-a"] .star-swatch')).toHaveCSS('background-color', 'rgb(186, 214, 255)')
  await expect(page.locator('[data-star-id="sirius-a"]')).toHaveCSS('--star-color', 'rgb(186,214,255)')
  expect((await motionArrows(page)).find((arrow) => arrow.id === 'sirius-a')?.color).toBe('rgb(186,214,255)')
  expect(changedPixels(vividPixels, await canvas.screenshot({ scale: 'css' }))).toBeGreaterThan(20)

  await page.reload()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await openPreferences(page)
  await expect(real).toBeChecked()
  await expect(page.locator('#selected-swatch')).toHaveCSS('background-color', 'rgb(186, 214, 255)')
})

test('renders brown and sub-brown dwarfs in visible brown shades', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openViewer(page)
  const swatch = (id: string) => page.locator(`[data-star="${id}"] .star-swatch`).evaluate((element) => getComputedStyle(element).backgroundColor)
  const channels = (color: string) => color.match(/\d+/g)!.slice(0, 3).map(Number)
  const brightness = ([red, green, blue]: number[]) => 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
  const luhman = channels(await swatch('luhman-16-a'))
  const wise = channels(await swatch('wise-0855-0714'))
  for (const [red, green, blue] of [luhman, wise]) {
    expect(red).toBeGreaterThan(green!)
    expect(green).toBeGreaterThan(blue!)
    expect(red! - blue!).toBeGreaterThan(60)
  }
  expect(brightness(wise)).toBeLessThan(brightness(luhman))
  await page.locator('[data-star="luhman-16-a"]').evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator('#star-name')).toHaveText('Luhman 16 A')
  const expected = await swatch('luhman-16-a')
  expect(await page.locator('#selected-swatch').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(expected)
  expect(await page.locator('[data-star-id="luhman-16-a"].is-selected .selection-ring').evaluate((element) => getComputedStyle(element).borderTopColor)).toBe(expected)
  const point = await starPoint(page, 'luhman-16-a')
  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const image = PNG.sync.read(await canvas.screenshot({
    scale: 'css', path: testInfo.outputPath('brown-dwarf.png'),
    style: '.projected-labels, .projected-axes { visibility: hidden !important; }',
  }))
  const centerX = point.x - bounds.x
  const centerY = point.y - bounds.y
  let brownPixels = 0
  for (let pixelY = Math.floor(centerY - 3); pixelY <= Math.ceil(centerY + 3); pixelY++) {
    for (let pixelX = Math.floor(centerX - 3); pixelX <= Math.ceil(centerX + 3); pixelX++) {
      if (Math.hypot(pixelX + 0.5 - centerX, pixelY + 0.5 - centerY) > 3) continue
      const offset = (pixelY * image.width + pixelX) * 4
      const [red, green, blue] = [image.data[offset]!, image.data[offset + 1]!, image.data[offset + 2]!]
      if (red > 120 && red > green + 25 && green > blue + 20) brownPixels++
    }
  }
  expect(brownPixels, 'the selected brown dwarf core must render brown').toBeGreaterThan(12)
})

test('renders soft halos beyond crisp cores and boosts only the selected halo', async ({ page }, testInfo) => {
  await openViewer(page)
  await hideMilkyWay(page)
  await hideEarthOrbit(page)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
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
  let isArrowPixel = arrowPixelMask(await motionArrows(page), bounds)
  const sample = (image: PNG, inner: number, outer: number) => {
    const values: number[] = []
    for (let pixelY = Math.floor(centerY - outer); pixelY <= Math.ceil(centerY + outer); pixelY++) {
      for (let pixelX = Math.floor(centerX - outer); pixelX <= Math.ceil(centerX + outer); pixelX++) {
        const distance = Math.hypot(pixelX + 0.5 - centerX, pixelY + 0.5 - centerY)
        if (pixelY + 0.5 - centerY < Math.abs(pixelX + 0.5 - centerX) || distance < inner || distance > outer) continue
        if (isArrowPixel(pixelX + 0.5, pixelY + 0.5)) continue
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
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect.poll(() => starPoint(page, 'sun')).toEqual(sun)
  isArrowPixel = arrowPixelMask(await motionArrows(page), bounds)
  const selected = PNG.sync.read(await canvas.screenshot(options))
  expect(sample(selected, 6, 8)).toBeGreaterThan(innerGlow * 1.1)
  expect(sample(selected, 0, 3)).toBe(sample(base, 0, 3))
  await page.mouse.click(empty.x, empty.y)
  await expect(page.locator('.map-anchor.is-selected')).toHaveCount(0)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  expect(changedPixels(PNG.sync.write(base), await canvas.screenshot(options))).toBe(0)
})

test('shrinks distant star cores while retaining bright glare around a 1,000-light-year overview', async ({ page }, testInfo) => {
  await openViewer(page)
  await hideMilkyWay(page)
  await openFilter(page)
  await page.getByRole('switch', { name: 'Always show bright stars' }).check()
  await expect.poll(() => page.locator('#catalog-count').textContent()).not.toBe('22/22')
  await page.getByRole('switch', { name: 'Motion arrows' }).uncheck()
  await page.locator('[data-star="sun"]').evaluate((button: HTMLButtonElement) => button.click())
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.locator('[data-star="sirius-a"]').evaluate((button: HTMLButtonElement) => button.click())
  await page.getByLabel('Object visibility distance', { exact: true }).fill('0')
  await page.getByLabel('V magnitude limit', { exact: true }).fill('0')
  await page.locator('details.filter-dropdown > summary').click()
  await page.locator('#object-type-filter').getByLabel('Sun', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Grid', exact: true }).click()

  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  await page.mouse.click(bounds.x + bounds.width * 0.15, bounds.y + bounds.height * 0.85)
  await expect(page.locator('.map-anchor.is-selected')).toHaveCount(0)
  const sirius = await starPoint(page, 'sirius-a')
  const centerX = sirius.x - bounds.x
  const centerY = sirius.y - bounds.y
  const options = {
    scale: 'css' as const,
    style: '.projected-axes, .projected-labels, .scene-toolbar, .control-dock, .scene-legend, .visibility-observer { visibility: hidden !important; }',
  }
  const sample = (image: PNG, inner: number, outer: number) => {
    const values: number[] = []
    for (let pixelY = Math.floor(centerY - outer); pixelY <= Math.ceil(centerY + outer); pixelY++) {
      for (let pixelX = Math.floor(centerX - outer); pixelX <= Math.ceil(centerX + outer); pixelX++) {
        const distance = Math.hypot(pixelX + 0.5 - centerX, pixelY + 0.5 - centerY)
        if (distance < inner || distance > outer) continue
        const offset = (pixelY * image.width + pixelX) * 4
        values.push(image.data[offset]! + image.data[offset + 1]! + image.data[offset + 2]!)
      }
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  const near = PNG.sync.read(await canvas.screenshot({ ...options, path: testInfo.outputPath('sirius-near-glow.png') }))
  for (let count = 0; count < 12; count++) await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
  await expect.poll(() => starPoint(page, 'sirius-a')).toEqual(sirius)
  const far = PNG.sync.read(await canvas.screenshot({ ...options, path: testInfo.outputPath('sirius-far-glow.png') }))
  const nearGlow = sample(near, 6, 14)
  const farGlow = sample(far, 6, 14)
  expect(farGlow).toBeGreaterThan(0)
  expect(farGlow).toBeLessThan(nearGlow * 0.5)
  expect(sample(far, 0, 1.5)).toBeGreaterThan(100)
  expect(sample(far, 0, 3)).toBeLessThan(sample(near, 0, 3) * 0.7)
})

test('keeps the magnitude-7 all-catalog overview from washing out at roughly 1,000 light-years', async ({ page }, testInfo) => {
  await openViewer(page)
  await hideMilkyWay(page)
  await openFilter(page)
  await selectCatalog(page, 'nearest-1000')
  await expect(page.locator('#catalog-count')).toHaveText(/\/1001$/)
  for (const name of ['Always show bright stars', 'Western constellation stars', 'Famous cluster stars']) {
    await page.getByRole('switch', { name }).check()
  }
  await expect.poll(async () => Number(await page.locator('.projected-labels').getAttribute('data-core-count'))).toBeGreaterThan(1000)
  await page.getByLabel('Object visibility distance', { exact: true }).fill('19')
  await page.getByLabel('V magnitude limit', { exact: true }).fill('7')
  await page.getByRole('switch', { name: 'Motion arrows' }).uncheck()
  await page.locator('[data-star="sun"]').evaluate((button: HTMLButtonElement) => button.click())
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()

  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  await page.mouse.click(bounds.x + bounds.width * 0.15, bounds.y + bounds.height * 0.85)
  for (let count = 0; count < 12; count++) await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
  const image = PNG.sync.read(await canvas.screenshot({
    scale: 'css',
    path: testInfo.outputPath('all-catalogs-1000ly.png'),
    style: '.projected-axes, .projected-labels, .scene-toolbar, .control-dock, .scene-legend, .visibility-observer { visibility: hidden !important; }',
  }))
  let luminousPixels = 0
  let whitePixels = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset]!
    const green = image.data[offset + 1]!
    const blue = image.data[offset + 2]!
    if (red + green + blue > 30) luminousPixels++
    if (red > 200 && green > 200 && blue > 200) whitePixels++
  }
  const pixelCount = image.width * image.height
  expect(Number(await page.locator('.projected-labels').getAttribute('data-halo-count'))).toBeGreaterThan(50)
  expect(luminousPixels / pixelCount).toBeLessThan(0.08)
  expect(whitePixels / pixelCount).toBeLessThan(0.01)
})

test('makes Sirius glow larger and brighter than Barnard with zoom-stable magnitude sizes', async ({ page }, testInfo) => {
  await openViewer(page)
  await hideMilkyWay(page)
  await openFilter(page)
  // Keep the arrow mask present at both zoom levels so it cannot enter the
  // sampled halo annulus midway through this halo-only comparison.
  await page.getByLabel('Arrow length', { exact: true }).selectOption('50000')
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.locator('#objects-lock').click()
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
    let isArrowPixel = arrowPixelMask(await motionArrows(page), bounds)
    const pixels: number[] = []
    for (let pixelY = Math.floor(centerY - 11); pixelY <= Math.ceil(centerY + 11); pixelY++) {
      for (let pixelX = Math.floor(centerX - 11); pixelX <= Math.ceil(centerX + 11); pixelX++) {
        const distance = Math.hypot(pixelX + 0.5 - centerX, pixelY + 0.5 - centerY)
        if (distance < 6 || distance > 11 || isArrowPixel(pixelX + 0.5, pixelY + 0.5)) continue
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
          if (distance > 25 || isArrowPixel(pixelX + 0.5, pixelY + 0.5)) continue
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
    isArrowPixel = arrowPixelMask(await motionArrows(page), bounds)
    const afterZoom = extent(PNG.sync.read(await canvas.screenshot(options)))
    expect(Math.abs(afterZoom.radius - beforeZoom.radius)).toBeLessThan(1)
    expect(Math.abs(afterZoom.outerPixels - beforeZoom.outerPixels)).toBeLessThan(10)
  }
  expect(glow[1]!).toBeGreaterThan(1)
  expect(glow[0]!).toBeGreaterThan(glow[1]! * 3)
})

test('keeps bright and selected halos strongly temperature-tinted without clipping', async ({ page }, testInfo) => {
  await openViewer(page)
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.locator('#objects-lock').click()
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
      const isArrowPixel = arrowPixelMask(await motionArrows(page), bounds)
      const image = PNG.sync.read(await canvas.screenshot({
        scale: 'css', path: testInfo.outputPath(`${id}-${selected ? 'selected' : 'base'}-tint.png`),
        style: '.projected-labels, .scene-toolbar, .scene-brand, .scene-legend, .plane-key, .visibility-observer { visibility: hidden !important; }',
      }))
      const color = { red: 0, green: 0, blue: 0 }
      let count = 0
      for (let pixelY = Math.floor(centerY - 9); pixelY <= Math.ceil(centerY + 9); pixelY++) {
        for (let pixelX = Math.floor(centerX - 9); pixelX <= Math.ceil(centerX + 9); pixelX++) {
          const distance = Math.hypot(pixelX + 0.5 - centerX, pixelY + 0.5 - centerY)
          if (distance < 6 || distance > 9 || isArrowPixel(pixelX + 0.5, pixelY + 0.5)) continue
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
        expect(color.red / color.blue).toBeGreaterThan(0.4)
        expect(color.green / color.blue).toBeGreaterThan(0.6)
      } else {
        expect(color.red - color.blue).toBeGreaterThan(10)
        expect(color.red).toBeGreaterThan(color.green)
        expect(color.green).toBeGreaterThan(color.blue)
        expect(color.blue / color.red).toBeGreaterThan(0.22)
      }
      colors.push(color)
    }
    expect(colors[1]!.red + colors[1]!.green + colors[1]!.blue).toBeGreaterThan(colors[0]!.red + colors[0]!.green + colors[0]!.blue)
    expect(Math.abs(colors[1]!.red / colors[1]!.blue - colors[0]!.red / colors[0]!.blue)).toBeLessThan(0.18)
  }
})

test('toggles the grid without moving stars and preserves its state across reset', { tag: '@mobile' }, async ({ page, isMobile }, testInfo) => {
  await openViewer(page)
  await hideMilkyWay(page)
  await openFilter(page)
  await page.getByLabel('Arrow length', { exact: true }).selectOption('50000')
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
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
  const screenshotOptions = { scale: 'css' as const, style: '.projected-labels, .scene-toolbar, .control-dock, .scene-brand, .scene-legend, .plane-key, .visibility-observer, .tooltip { visibility: hidden !important; }' }
  const arrowsBefore = (await motionArrows(page)).map((arrow) => arrow.id)
  expect(arrowsBefore.length).toBeGreaterThan(0)
  const gridOn = await canvas.screenshot(screenshotOptions)
  if (isMobile) await grid.tap()
  else await grid.click()
  await expect(grid).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#grid-tooltip')).toHaveText('Show grid')
  await expect(page.locator('#grid-legend')).toBeHidden()
  await expect(page.locator('#plane-key')).toHaveCount(0)
  await expect(page.locator('.axis-label:visible')).toHaveCount(0)
  await expect(page.locator('#scene-epoch')).toBeVisible()
  await expect(page.locator('#star-name')).toHaveText('Sirius A')
  await expect(page.locator('.dimension-label')).toHaveCount(1)
  expect((await motionArrows(page)).map((arrow) => arrow.id)).toEqual(arrowsBefore)
  expect(await starPoint(page, 'sun')).toEqual(sunBefore)
  const gridOff = await canvas.screenshot(screenshotOptions)
  expect(changedPixels(gridOn, gridOff)).toBeGreaterThan(200)
  const canvasBounds = (await canvas.boundingBox())!
  const isArrowPixel = arrowPixelMask(await motionArrows(page), canvasBounds)
  const beforeImage = PNG.sync.read(gridOn)
  const afterImage = PNG.sync.read(gridOff)
  for (const tip of axisTips) {
    const centerX = Math.round(sunBefore.x + (tip.x - sunBefore.x) * 0.85 - canvasBounds.x)
    const centerY = Math.round(sunBefore.y + (tip.y - sunBefore.y) * 0.85 - canvasBounds.y)
    let axisPixels = 0
    for (let pixelY = centerY - 2; pixelY <= centerY + 2; pixelY++) {
      for (let pixelX = centerX - 2; pixelX <= centerX + 2; pixelX++) {
        if (isArrowPixel(pixelX + 0.5, pixelY + 0.5)) continue
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
  const sunAfterReset = await starPoint(page, 'sun')
  await expect(grid).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.axis-label:visible')).toHaveCount(0)
  const resetGridOff = await canvas.screenshot(screenshotOptions)
  await grid.focus()
  await page.keyboard.press('Enter')
  await expect(grid).toHaveAttribute('aria-pressed', 'true')
  expect(await starPoint(page, 'sun')).toEqual(sunAfterReset)
  await expect(page.locator('#grid-legend')).toBeVisible()
  await expect(page.locator('#grid-tooltip')).toHaveText('Hide grid')
  await expect.poll(async () => changedPixels(resetGridOff, await canvas.screenshot(screenshotOptions))).toBeGreaterThan(200)
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

test('fades grid pixels toward the edge without fading the scene', { tag: '@mobile' }, async ({ page, isMobile }) => {
  await openViewer(page)
  await openFilter(page)
  await page.getByLabel('Object visibility distance', { exact: true }).fill('0')
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const options = { scale: 'css' as const, style: '.projected-axes, .projected-labels, .scene-toolbar, .scene-brand, .scene-legend, .plane-key, .visibility-observer { visibility: hidden !important; }' }
  const on = PNG.sync.read(await canvas.screenshot(options))
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  const off = PNG.sync.read(await canvas.screenshot(options))
  const stars = parseStarCatalog(readFileSync(new URL('../src/data/stars.csv', import.meta.url), 'utf8'))
  const camera = resetCamera(stars, bounds, 'sirius-a', 1.3 ** 2)
  const radius = 3
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
  const sunPosition = galacticToWorld(stars.find((star) => star.id === 'sun')!)
  const siriusPosition = galacticToWorld(stars.find((star) => star.id === 'sirius-a')!)
  const canvas = page.locator('#scene canvas')
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.locator('#objects-lock').click()

  for (const side of [-1, 1]) {
    await page.getByRole('button', { name: 'Select Sirius A', exact: true }).click()
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
    const bounds = (await canvas.boundingBox())!
    const initial = new Spherical().setFromVector3(resetCamera(stars, bounds, 'sirius-a').position.sub(sunPosition))
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
    const overlappingArrows = (await motionArrows(page)).map((arrow) => arrow.id)
    for (const id of ['sun', 'sirius-a', 'sirius-b']) {
      expect(overlappingArrows, `${id} keeps its motion arrow`).toContain(id)
    }
    const sun = await starPoint(page, 'sun')
    const nearest = side === -1 ? 'sun' : 'sirius'
    const image = PNG.sync.read(await canvas.screenshot({ scale: 'css', path: testInfo.outputPath(`${nearest}-in-front.png`) }))
    const centerX = Math.round(sun.x - bounds.x)
    const centerY = Math.round(sun.y - bounds.y)
    let matchingPixels = 0
    for (let pixelY = centerY - 5; pixelY <= centerY + 5; pixelY++) {
      for (let pixelX = centerX - 5; pixelX <= centerX + 5; pixelX++) {
        const distance = Math.hypot(pixelX + 0.5 - (sun.x - bounds.x), pixelY + 0.5 - (sun.y - bounds.y))
        if (distance < 2.5 || distance > 4.5) continue
        const offset = (pixelY * image.width + pixelX) * 4
        const red = image.data[offset]!
        const blue = image.data[offset + 2]!
        if (side === -1 ? red > 120 && red > blue + 25 : blue > 120 && blue > red + 25) matchingPixels++
      }
    }
    expect(matchingPixels, `${nearest} must occlude the farther star even while Sun stays selected`).toBeGreaterThanOrEqual(8)
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

test('targets ordinary selections, zooms around them, and resets around the selected distance line', { tag: '@mobile' }, async ({ page, isMobile }) => {
  await openViewer(page)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  const canvasBounds = (await page.locator('#scene canvas').boundingBox())!
  const stars = parseStarCatalog(readFileSync(new URL('../src/data/stars.csv', import.meta.url), 'utf8'))
  await page.getByRole('button', { name: 'Select Proxima Centauri', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Proxima Centauri')
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  const center = { x: canvasBounds.x + canvasBounds.width / 2, y: canvasBounds.y + canvasBounds.height / 2 }
  await expect.poll(async () => {
    const selected = await starPoint(page, 'proxima-centauri')
    return Math.hypot(selected.x - center.x, selected.y - center.y)
  }).toBeLessThan(2)

  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  const reset = resetCamera(stars, canvasBounds, 'proxima-centauri')
  for (const id of ['sun', 'proxima-centauri']) {
    const projected = galacticToWorld(stars.find((star) => star.id === id)!).project(reset)
    const actual = await starPoint(page, id)
    expect(actual.x).toBeCloseTo(canvasBounds.x + (projected.x + 1) * canvasBounds.width / 2, 0)
    expect(actual.y).toBeCloseTo(canvasBounds.y + (1 - projected.y) * canvasBounds.height / 2, 0)
  }

  const sun = await starPoint(page, 'sun')
  if (isMobile) await page.touchscreen.tap(sun.x, sun.y)
  else await page.mouse.click(sun.x, sun.y)
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await expect(page.locator('#distance-value')).toHaveText('0.00')
  await expect(page.locator('#selection-announcement')).toHaveText('Sun, 0.00 ly from the Sun.')
  await expect(page.locator('.dimension-label')).toHaveCount(0)

  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  const focusedSun = await starPoint(page, 'sun')
  const beforeZoom = await starPoint(page, 'alpha-centauri-a')
  const separationBefore = Math.hypot(beforeZoom.x - focusedSun.x, beforeZoom.y - focusedSun.y)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(async () => {
    const first = await starPoint(page, 'sun')
    const second = await starPoint(page, 'alpha-centauri-a')
    return Math.hypot(first.x - second.x, first.y - second.y)
  }).toBeGreaterThan(separationBefore)

  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Select Sirius A', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Sirius A')
  await expect(page.locator('#selection-announcement')).toHaveText('Sirius A, 8.61 ly from the Sun.')
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Sirius A')

  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  const sunButton = page.getByRole('button', { name: 'Select Sun', exact: true })
  await sunButton.click()
  await expect(sunButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await page.getByRole('button', { name: 'Select Sirius A', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.locator('#object-card-details > summary').click()
  await page.getByText('Coordinates & source', { exact: true }).click()
  await expect(page.locator('#velocity-x')).toHaveText('14.96 km/s')
  await expect(page.locator('#temperature')).toHaveText('9,845 K')
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Select WISE 0855-0714', exact: true }).click()
  await expect(page.locator('#velocity-x')).toHaveText('Not available')
  await expect(page.locator('#luminosity-row')).not.toHaveAttribute('hidden')
  await expect(page.locator('#luminosity')).toHaveText('0.00000000269 solar')
})

test('navigates backward and forward through selection history', { tag: '@mobile' }, async ({ page }) => {
  await openViewer(page)
  const back = page.getByRole('button', { name: 'Previous selection', exact: true })
  const forward = page.getByRole('button', { name: 'Next selection', exact: true })
  await expect(back).toBeDisabled()
  await expect(forward).toBeDisabled()

  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.getByRole('button', { name: 'Select Proxima Centauri', exact: true }).click()
  await expect(back).toBeEnabled()
  await expect(forward).toBeDisabled()

  await back.click()
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await expect(forward).toBeEnabled()
  await back.click()
  await expect(page.locator('#star-name')).toHaveText('Sirius A')
  await expect(back).toBeDisabled()

  await forward.click()
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await page.getByRole('button', { name: "Select Barnard's Star", exact: true }).click()
  await expect(forward).toBeDisabled()
  await back.click()
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await forward.click()
  await expect(page.locator('#star-name')).toHaveText("Barnard's Star")
})

test('eases focus through intermediate frames while preserving camera position', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openViewer(page)
  await openFilter(page)
  await page.getByLabel('V magnitude limit', { exact: true }).fill('25')
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
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
  const camera = catalogCamera(stars, bounds)
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
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
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
      const scene = document.querySelector('#scene')!.getBoundingClientRect()
      return { before, frames, center: { x: scene.x + scene.width / 2, y: scene.y + scene.height / 2 } }
    }, action)
    const first = result.frames[0]!
    const last = result.frames.at(-1)!
    if (action === 'reset-view') expect(Math.hypot(last.x - result.center.x, last.y - result.center.y)).toBeLessThan(1)
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

test('hands active focus to pointer input, deselection and reduced motion', { tag: '@mobile' }, async ({ page, context, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openViewer(page)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  const bounds = (await page.locator('#scene canvas').boundingBox())!
  const empty = { x: bounds.x + bounds.width * 0.25, y: bounds.y + bounds.height * 0.85 }
  for (const action of ['pointer', 'clear', 'reduce']) {
    await page.locator('[data-star="sirius-a"]').evaluate((button: HTMLButtonElement) => button.click())
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    const duringOffset = await page.evaluate(async () => {
      const anchor = document.querySelector('[data-star-id="sun"]')!
      const initial = anchor.getBoundingClientRect()
      document.querySelector<HTMLButtonElement>('[data-star="sun"]')!.click()
      return new Promise<number>((resolve) => {
        function moved() {
          const current = anchor.getBoundingClientRect()
          if (Math.hypot(current.x - initial.x, current.y - initial.y) > 0.5) {
            const scene = document.querySelector('#scene')!.getBoundingClientRect()
            resolve(Math.hypot(current.x - scene.x - scene.width / 2, current.y - scene.y - scene.height / 2))
          }
          else requestAnimationFrame(moved)
        }
        requestAnimationFrame(moved)
      })
    })
    expect(duringOffset).toBeGreaterThan(0.5)
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
      await expect(page.locator('#selected-object-card')).toBeHidden()
    } else await expect(page.locator('#star-name')).toHaveText('Sun')
    if (session) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await session.detach()
    } else if (action === 'pointer') await page.mouse.up({ button: 'right' })
  }
})

test('scrubs and plays the physical stellar-motion timeline in both directions', { tag: '@mobile' }, async ({ page, isMobile }) => {
  await openViewer(page)
  const timeline = page.getByRole('region', { name: 'Stellar motion timeline' })
  const slider = page.getByRole('slider', { name: 'Simulation time' })
  const faster = page.getByRole('button', { name: 'Increase playback speed' })
  const slower = page.getByRole('button', { name: 'Decrease playback speed' })
  const follow = page.getByRole('button', { name: 'Follow selection' })
  const visibilityCaption = page.locator('.visibility-observer')
  const selectedCard = page.locator('#selected-object-card')
  const objectDetails = page.locator('#object-card-details')
  const sourceDetails = page.locator('.source-details')
  await objectDetails.locator('> summary').click()
  await sourceDetails.locator('> summary').click()
  await expect(objectDetails).toHaveAttribute('open', '')
  await expect(sourceDetails).toHaveAttribute('open', '')
  const captionBoundsBefore = (await visibilityCaption.boundingBox())!
  const captionBottomBefore = captionBoundsBefore.y + captionBoundsBefore.height
  await expect(timeline).toBeHidden()
  await page.getByRole('button', { name: 'Stellar motion', exact: true }).click()
  await expect(timeline).toBeVisible()
  await expect(objectDetails).toHaveAttribute('open', '')
  await expect(sourceDetails).toHaveAttribute('open', '')
  const selectedBounds = (await selectedCard.boundingBox())!
  const motionBounds = (await timeline.boundingBox())!
  expect(motionBounds.y - selectedBounds.y - selectedBounds.height).toBeGreaterThanOrEqual(9)
  expect(motionBounds.y - selectedBounds.y - selectedBounds.height).toBeLessThanOrEqual(11)
  expect(await selectedCard.evaluate((card) => card.scrollHeight)).toBeGreaterThan(await selectedCard.evaluate((card) => card.clientHeight))
  if (isMobile) await expect(visibilityCaption).toHaveClass(/is-avoiding-motion/)
  else await expect(visibilityCaption).not.toHaveClass(/is-avoiding-motion/)
  const captionBoundsAfter = (await visibilityCaption.boundingBox())!
  const captionBottomAfter = captionBoundsAfter.y + captionBoundsAfter.height
  if (isMobile) expect(captionBottomAfter).toBeLessThan(captionBottomBefore - 100)
  else expect(captionBottomAfter).toBeCloseTo(captionBottomBefore, 0)
  await expect(timeline.getByRole('heading')).toHaveCount(0)
  const motionLock = page.getByRole('button', { name: 'Keep Stellar motion open' })
  await expect(motionLock).toBeVisible()
  expect(await slower.evaluate((button) => button.previousElementSibling?.id)).toBe('time-follow')
  await expect(follow).toHaveAttribute('aria-pressed', 'false')
  await expect(timeline.locator('.time-readout > span')).toHaveCount(0)
  await expect(timeline.locator('.time-directions')).toHaveText('PastFuture')
  const timelineBounds = (await timeline.boundingBox())!
  const lockBounds = (await motionLock.boundingBox())!
  const fasterBounds = (await faster.boundingBox())!
  expect(Math.abs(lockBounds.x + lockBounds.width - timelineBounds.x - timelineBounds.width)).toBeLessThan(2)
  expect(Math.abs(lockBounds.y - timelineBounds.y)).toBeLessThan(2)
  expect(lockBounds.x - fasterBounds.x - fasterBounds.width).toBeGreaterThan(8)
  await motionLock.click()
  await expect(motionLock).toHaveAttribute('aria-pressed', 'true')
  await page.locator('#scene canvas').click({ position: { x: 2, y: 2 } })
  await expect(timeline).toBeVisible()
  await motionLock.click()
  await expect(slider).toHaveAttribute('min', '-500000')
  await expect(slider).toHaveAttribute('max', '500000')
  await expect(slider).toHaveAttribute('step', 'any')
  await expect(page.locator('.time-markers i')).toHaveCount(11)
  await expect(page.locator('.time-markers i.major')).toHaveCount(10)
  expect(await page.locator('.time-markers i.major').evaluateAll((markers) => markers.map((marker) => marker.getAttribute('data-label')))).toEqual([
    '500k', '400k', '300k', '200k', '100k', '100k', '200k', '300k', '400k', '500k',
  ])
  await expect(page.locator('#time-value')).toHaveText('Now')
  await expect(page.locator('#time-speed-value')).toHaveText('1k years / 1s')

  await faster.click()
  await expect(page.locator('#time-speed-value')).toHaveText('1k years / 0.5s')
  await expect(faster).toBeDisabled()
  for (let count = 0; count < 15; count++) await slower.click()
  await expect(page.locator('#time-speed-value')).toHaveText('1k years / 15s')
  await expect(slower).toBeDisabled()

  await openFilter(page)
  await page.getByLabel('Arrow length', { exact: true }).selectOption('50000')
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.getByRole('button', { name: 'Stellar motion', exact: true }).click()
  await page.locator('[data-star="sirius-a"]').evaluate((button: HTMLButtonElement) => button.click())
  const distanceLabel = page.locator('.dimension-label')
  const initialDistance = await distanceLabel.textContent()
  const initialCardSubtitle = await page.locator('#star-distance').textContent()
  const catalogDistance = await page.locator('#distance-value').textContent()
  const before = await starPoint(page, 'sirius-a')
  const arrow = (await motionArrows(page)).find((candidate) => candidate.id === 'sirius-a')!
  await slider.fill('1000')
  await expect(page.locator('#scene')).toHaveAttribute('data-simulation-years', '1000')
  await expect(page.locator('#time-value')).toHaveText('+1,000 yr')
  await expect(distanceLabel).toBeVisible()
  const after = await starPoint(page, 'sirius-a')
  const travelX = after.x - before.x
  const travelY = after.y - before.y
  const arrowX = arrow.tipX - arrow.tailX
  const arrowY = arrow.tipY - arrow.tailY
  expect(Math.hypot(travelX, travelY)).toBeGreaterThan(0.5)
  expect(travelX * arrowX + travelY * arrowY, 'the star follows its displayed physical-motion vector').toBeGreaterThan(0)

  await slider.fill('25000')
  await expect(distanceLabel).toBeVisible()
  await expect(distanceLabel).not.toHaveText(initialDistance!)
  await expect(page.locator('#star-distance')).not.toHaveText(initialCardSubtitle!)
  await expect(page.locator('#star-distance')).toHaveText(await distanceLabel.textContent() ?? '')
  await expect(page.locator('#distance-value')).toHaveText(catalogDistance!)

  await page.locator('[data-star="sirius-a"]').evaluate((button: HTMLButtonElement) => button.click())
  await follow.click()
  await expect(page.locator('#scene')).toHaveAttribute('data-follow-target', 'star')
  const followedStarBefore = await starPoint(page, 'sirius-a')
  await slider.fill('50000')
  const followedStarAfter = await starPoint(page, 'sirius-a')
  expect(Math.hypot(followedStarAfter.x - followedStarBefore.x, followedStarAfter.y - followedStarBefore.y)).toBeLessThan(1)
  await follow.click()

  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await follow.click()
  await expect(page.locator('#scene')).toHaveAttribute('data-follow-target', 'distance')
  const pathAnchor = distanceLabel.locator('..')
  const followedPathBefore = (await pathAnchor.boundingBox())!
  await slider.fill('75000')
  const followedPathAfter = (await pathAnchor.boundingBox())!
  expect(Math.hypot(followedPathAfter.x - followedPathBefore.x, followedPathAfter.y - followedPathBefore.y)).toBeLessThan(8)
  await follow.click()

  await page.getByRole('button', { name: 'Return timeline to now' }).click()
  await expect(slider).toHaveValue('0')
  await expect(page.locator('#scene')).toHaveAttribute('data-simulation-years', '0')
  await expect(page.locator('#time-value')).toHaveText('Now')
  await slider.fill('500000')
  await page.getByRole('button', { name: 'Play stellar motion' }).click()
  await expect(page.getByRole('button', { name: 'Pause stellar motion' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => Number(await page.locator('#scene').getAttribute('data-simulation-years'))).toBeLessThan(500000)
  await page.getByRole('button', { name: 'Pause stellar motion' }).click()
  const paused = await page.locator('#scene').getAttribute('data-simulation-years')
  await page.waitForTimeout(80)
  await expect(page.locator('#scene')).toHaveAttribute('data-simulation-years', paused!)
})

test('shows attached travel-length motion arrows with selectable horizons', { tag: '@mobile' }, async ({ page, isMobile }, testInfo) => {
  await openViewer(page)
  await openFilter(page)
  await page.getByLabel('V magnitude limit', { exact: true }).fill('12')
  await expect(page.locator('.star-label-detail')).toHaveCount(0)
  await expect(page.locator('[data-star-id="sirius-a"] .star-label')).toHaveText('Sirius A')
  const homeSun = await starPoint(page, 'sun')
  const horizon = page.getByLabel('Arrow length', { exact: true })
  const motionArrowsToggle = page.getByRole('switch', { name: 'Motion arrows' })
  const motionFrame = page.getByRole('group', { name: 'Motion frame' })
  await expect(motionArrowsToggle).toBeChecked()
  await expect(motionFrame.getByRole('radio', { name: 'Galactic' })).toBeChecked()
  await expect(motionFrame.getByRole('radio', { name: 'Solar' })).not.toBeChecked()
  await expect(horizon).toHaveValue('1000')
  await expect(horizon.locator('option')).toHaveText(['1k years', '5k years', '10k years', '25k years', '50k years'])
  await horizon.selectOption('50000')
  await expect(page.locator('.motion-arrow')).toHaveCount(0)
  const arrowFor = (arrows: readonly MotionArrowSnapshot[], id: string) => arrows.find((arrow) => arrow.id === id)
  const heading = (arrow: MotionArrowSnapshot) => Math.atan2(arrow.tailY - arrow.y, arrow.tailX - arrow.x)
  const expectAttached = (arrows: readonly MotionArrowSnapshot[]) => {
    expect(arrows.length).toBeGreaterThan(1)
    for (const arrow of arrows) {
      expect(arrow.length, `${arrow.id} projected shaft`).toBeGreaterThan(0)
      expect(arrow.length, `${arrow.id} projected shaft`).toBeCloseTo(arrow.projectedDistance - 5, 3)
      expect(Math.hypot(arrow.tailX - arrow.x, arrow.tailY - arrow.y), `${arrow.id} tail attaches to the dot`).toBeCloseTo(5, 2)
      expect(Math.hypot(arrow.tipX - arrow.tailX, arrow.tipY - arrow.tailY), `${arrow.id} tip`).toBeCloseTo(arrow.length, 2)
      expect(Math.hypot(arrow.tipX - arrow.x, arrow.tipY - arrow.y), `${arrow.id} projected travel`).toBeCloseTo(arrow.projectedDistance, 2)
    }
  }
  const initial = await motionArrows(page)
  expectAttached(initial)
  await motionArrowsToggle.uncheck()
  await expect.poll(async () => (await motionArrows(page)).length).toBe(0)
  await motionArrowsToggle.check()
  await expect.poll(async () => (await motionArrows(page)).length).toBe(initial.length)
  await expect(page.locator('[data-star-id="sirius-b"]')).toHaveCount(0)
  expect(arrowFor(initial, 'sirius-b')).toBeUndefined()
  const sunArrow = arrowFor(initial, 'sun')!
  expect(sunArrow).toMatchObject({ mode: 'full', selected: false, opacity: 0.5, color: 'rgb(255,204,79)' })
  expect(Math.hypot(sunArrow.x - homeSun.x, sunArrow.y - homeSun.y), 'the Sun arrow starts at its dot').toBeLessThan(0.5)
  const siriusArrow = arrowFor(initial, 'sirius-a')!
  expect(siriusArrow).toMatchObject({ mode: 'full', selected: true, opacity: 1, color: 'rgb(117,169,255)' })
  expect(initial.some((arrow) => !arrow.selected && arrow.opacity === 0.5)).toBe(true)
  await motionFrame.getByRole('radio', { name: 'Solar' }).check()
  await expect.poll(async () => arrowFor(await motionArrows(page), 'sun')).toBeUndefined()
  const solarSirius = arrowFor(await motionArrows(page), 'sirius-a')!
  expect(solarSirius.projectedDistance).toBeLessThan(siriusArrow.projectedDistance)
  await motionFrame.getByRole('radio', { name: 'Galactic' }).check()
  await expect.poll(async () => arrowFor(await motionArrows(page), 'sun')).toBeDefined()
  await expect.poll(async () => arrowFor(await motionArrows(page), 'sirius-a')?.projectedDistance).toBeCloseTo(siriusArrow.projectedDistance, 3)
  await horizon.selectOption('25000')
  const shortSirius = arrowFor(await motionArrows(page), 'sirius-a')!
  expect(shortSirius.projectedDistance).toBeCloseTo(siriusArrow.projectedDistance / 2, 2)
  await horizon.selectOption('50000')
  await expect.poll(async () => arrowFor(await motionArrows(page), 'sirius-a')?.projectedDistance).toBeCloseTo(siriusArrow.projectedDistance, 3)
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  const bounds = (await page.locator('#scene canvas').boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.3)
  await page.mouse.down()
  const siriusLengths = [siriusArrow.length]
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(bounds.x + bounds.width * 0.3 + 6 * step, bounds.y + bounds.height * 0.3 - 2.5 * step)
    siriusLengths.push(arrowFor(await motionArrows(page), 'sirius-a')!.length)
  }
  await page.mouse.up()
  await expect.poll(async () => heading(arrowFor(await motionArrows(page), 'sirius-a')!)).not.toBeCloseTo(heading(siriusArrow), 3)
  expect(Math.max(...siriusLengths) - Math.min(...siriusLengths)).toBeGreaterThan(3)
  expect(siriusLengths.every((length) => length > 0)).toBe(true)
  expectAttached(await motionArrows(page))
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect.poll(async () => arrowFor(await motionArrows(page), 'sirius-a') !== undefined).toBe(true)
  const resetDistance = arrowFor(await motionArrows(page), 'sirius-a')!.projectedDistance
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  expect(arrowFor(await motionArrows(page), 'sirius-a')!.projectedDistance).toBeGreaterThan(resetDistance)
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
  expectAttached(await motionArrows(page))
  await expect(page.locator('.motion-arrow')).toHaveCount(0)
  await sceneFits(page)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Select Sirius B', exact: true }).click()
  await expect(page.locator('[data-star-id="sirius-a"]')).toHaveCount(0)
  await expect.poll(async () => arrowFor(await motionArrows(page), 'sirius-b')?.opacity).toBe(1)
  const siriusBArrows = await motionArrows(page)
  expect(arrowFor(siriusBArrows, 'sirius-a')).toBeUndefined()
  expect(arrowFor(siriusBArrows, 'sirius-b')!.selected).toBe(true)
  expect(arrowFor(siriusBArrows, 'sirius-b')!.color).not.toBe(siriusArrow.color)
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  const resetStars = parseStarCatalog(readFileSync(new URL('../src/data/stars.csv', import.meta.url), 'utf8'))
  const reset = resetCamera(resetStars, bounds, 'sirius-b')
  const resetSun = galacticToWorld(resetStars.find((star) => star.id === 'sun')!).project(reset)
  const actualSun = await starPoint(page, 'sun')
  expect(actualSun.x).toBeCloseTo(bounds.x + (resetSun.x + 1) * bounds.width / 2, 0)
  expect(actualSun.y).toBeCloseTo(bounds.y + (1 - resetSun.y) * bounds.height / 2, 0)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  const sun = await starPoint(page, 'sun')
  if (isMobile) await page.touchscreen.tap(sun.x, sun.y)
  else await page.mouse.click(sun.x, sun.y)
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await expect.poll(async () => arrowFor(await motionArrows(page), 'sun')?.selected).toBe(true)
  expect(arrowFor(await motionArrows(page), 'sun')).toMatchObject({ opacity: 1, color: 'rgb(255,204,79)' })
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await sceneFits(page)
  await page.screenshot({ path: testInfo.outputPath('motion-arrows.png'), fullPage: true })
})

test('draws dashed transverse and solid full-motion shafts with a zoom-stable stroke', { tag: '@mobile' }, async ({ page, isMobile }, testInfo) => {
  await openViewer(page)
  await selectCatalog(page, 'nearest-100')
  await expect(page.locator('#catalog-count')).toHaveText(/\/101$/)
  await page.getByLabel('V magnitude limit', { exact: true }).fill('25')
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const style = '.projected-labels, .projected-axes, .scene-toolbar, .control-dock, .scene-brand, .scene-legend, .plane-key, .visibility-observer { visibility: hidden !important; }'
  const strokeWidths: number[] = []
  // The smaller mobile canvas needs more zoom before shafts stand apart.
  for (const zoomSteps of [isMobile ? 5 : 2, 1]) {
    for (let step = 0; step < zoomSteps; step++) await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    const totals = { full: { samples: 0, gaps: 0, width: 0, shafts: 0 }, transverse: { samples: 0, gaps: 0, width: 0, shafts: 0 } }
    // Full Galactic-rest velocities are generally much faster than the
    // transverse-only subset, so use a horizon that keeps each mode measurable.
    for (const [mode, years] of [['full', '5000'], ['transverse', '25000']] as const) {
      await openFilter(page)
      await page.getByLabel('Arrow length', { exact: true }).selectOption(years)
      await page.getByRole('button', { name: 'Filter', exact: true }).click()
      const arrows = await motionArrows(page)
      const image = PNG.sync.read(await canvas.screenshot({ scale: 'css', style, path: testInfo.outputPath(`shafts-${strokeWidths.length}-${mode}.png`) }))
      for (const arrow of isolatedArrows(arrows, bounds).filter((candidate) => candidate.mode === mode)) {
        if (arrow.length < 9) continue
        const shaft = measureArrowShaft(image, arrow, bounds)
        if (shaft.samples === 0) continue
        const total = totals[mode]
        total.samples += shaft.samples
        total.gaps += shaft.gaps
        total.width += shaft.strokeWidth
        total.shafts++
      }
    }
    expect(totals.transverse.samples, 'isolated transverse shafts to sample').toBeGreaterThan(12)
    expect(totals.full.samples, 'isolated full-motion shafts to sample').toBeGreaterThan(12)
    expect(totals.transverse.gaps / totals.transverse.samples, 'transverse shafts are dashed').toBeGreaterThan(0.25)
    expect(totals.full.gaps / totals.full.samples, 'full-motion shafts are solid').toBeLessThan(0.15)
    strokeWidths.push(totals.full.width / totals.full.shafts)
  }
  for (const width of strokeWidths) {
    expect(width, 'stroke keeps the 16 px icon scale').toBeGreaterThan(0.8)
    expect(width, 'stroke keeps the 16 px icon scale').toBeLessThan(1.8)
  }
  expect(Math.abs(strokeWidths[0]! - strokeWidths[1]!), 'zoom does not scale strokes').toBeLessThan(0.35)
})

test('orbit and pinch move the rendered scene without changing selection', { tag: '@mobile' }, async ({ page, context, isMobile }) => {
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

test('keeps observer drags screen-relative after rolling the view', { tag: '@mobile' }, async ({ page, context, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openViewer(page)
  await page.getByRole('button', { name: 'Enter observer view', exact: true }).click()
  await expect(page.locator('#scene')).toHaveAttribute('data-observer-view', 'true')
  const rollCounterclockwise = page.getByRole('button', { name: 'Roll view counterclockwise', exact: true })
  for (let step = 0; step < 6; step++) await rollCounterclockwise.click()
  await expect(page.locator('#scene')).toHaveAttribute('data-observer-roll-degrees', '90')

  const canvas = page.locator('#scene canvas')
  const bounds = (await canvas.boundingBox())!
  const observerFrame = () => page.locator('#scene').evaluate((scene: HTMLElement) => ({
    direction: scene.dataset.observerViewDirection!.split(',').map(Number),
    up: scene.dataset.observerScreenUp!.split(',').map(Number),
  }))
  const before = await observerFrame()
  const startX = bounds.x + bounds.width / 2
  const startY = bounds.y + bounds.height * 0.65
  if (isMobile) {
    const session = await context.newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY, id: 0 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX, y: startY - 80, id: 0 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await session.detach()
  } else {
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX, startY - 80, { steps: 6 })
    await page.mouse.up()
  }
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const after = await observerFrame()
  const delta = before.direction.map((value, index) => after.direction[index]! - value)
  const right = [
    before.direction[1]! * before.up[2]! - before.direction[2]! * before.up[1]!,
    before.direction[2]! * before.up[0]! - before.direction[0]! * before.up[2]!,
    before.direction[0]! * before.up[1]! - before.direction[1]! * before.up[0]!,
  ]
  const dot = (first: number[], second: number[]) => first.reduce((sum, value, index) => sum + value * second[index]!, 0)
  expect(Math.hypot(...delta)).toBeGreaterThan(0.05)
  expect(Math.abs(dot(delta, before.up))).toBeGreaterThan(Math.abs(dot(delta, right)) * 2)
  await expect(page.locator('#scene')).toHaveAttribute('data-observer-roll-degrees', '90')
  await expect(page.locator('#star-name')).toHaveText('Sirius A')
})

test('clears selection on empty-sky clicks and taps without moving the camera', { tag: '@mobile' }, async ({ page, isMobile }) => {
  await openViewer(page)
  const before = await starPoint(page, 'sirius-a')
  const bounds = (await page.locator('#scene canvas').boundingBox())!
  const empty = { x: bounds.x + bounds.width * 0.25, y: bounds.y + bounds.height * 0.85 }
  await page.mouse.click(empty.x, empty.y, { button: 'right' })
  await expect(page.locator('#star-details')).toBeVisible()
  if (isMobile) await page.touchscreen.tap(empty.x, empty.y)
  else await page.mouse.click(empty.x, empty.y)
  await expect(page.locator('#selected-object-card')).toBeHidden()
  await expect(page.locator('#star-details')).toBeHidden()
  await expect(page.locator('#inspector')).not.toHaveAttribute('data-selected-star')
  await expect(page.locator('.map-anchor.is-selected')).toHaveCount(0)
  await expect(page.locator('.dimension-label')).toHaveCount(0)
  await expect(page.locator('.catalog-entry[aria-pressed="true"]')).toHaveCount(0)
  await expect(page.locator('#selection-announcement')).toHaveText('No object selected.')
  const after = await starPoint(page, 'sirius-a')
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1)
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  const stars = parseStarCatalog(readFileSync(new URL('../src/data/stars.csv', import.meta.url), 'utf8'))
  const reset = resetCamera(stars, bounds, null)
  for (const id of ['sun', 'alpha-centauri-a']) {
    const projected = galacticToWorld(stars.find((star) => star.id === id)!).project(reset)
    const actual = await starPoint(page, id)
    expect(actual.x).toBeCloseTo(bounds.x + (projected.x + 1) * bounds.width / 2, 0)
    expect(actual.y).toBeCloseTo(bounds.y + (1 - projected.y) * bounds.height / 2, 0)
  }
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.locator('#selected-object-card')).toBeHidden()
  const point = await starPoint(page, 'alpha-centauri-a')
  if (isMobile) await page.touchscreen.tap(point.x, point.y)
  else await page.mouse.click(point.x, point.y)
  await expect(page.locator('#star-name')).toHaveText('Alpha Centauri A')
  await expect(page.locator('#motion-data')).toHaveText('Full space motion')
  await expect.poll(async () => motionArrows(page).then((arrows) => arrows.find((arrow) => arrow.id === 'alpha-centauri-a')?.mode)).toBe('full')
  await expect(page.locator('#selected-object-card')).toBeVisible()
  await expect(page.locator('#star-details')).toBeVisible()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
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
  await page.locator('#object-card-details > summary').click()
  await page.getByText('Coordinates & source', { exact: true }).click()
  await page.locator('#star-notes').scrollIntoViewIfNeeded()
  expect(await page.locator('#inspector').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('narrow-details.png'), fullPage: true })
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await expect(page.locator('.selected-object')).toBeVisible()
  await expect(page.locator('#filter-panel')).toBeVisible()
  await expect(page.locator('#object-card-details')).not.toHaveAttribute('open')
  await sceneFits(page)
  await page.screenshot({ path: testInfo.outputPath('narrow-filter.png'), fullPage: true })
})

test('keeps tooltips usable by mouse and keyboard without sticky touch hover', { tag: '@mobile' }, async ({ page, isMobile }, testInfo) => {
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
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Select WISE 0855-0714', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
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
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await expect(page.getByRole('button', { name: 'Reset view', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Grid', exact: true })).toBeDisabled()
  await selectCatalog(page, 'nearest-100')
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await expect(page.locator('.catalog-entry')).toHaveCount(101)
  await expect(page.locator('#star-name')).toHaveText('Sun')
  await expect(page.locator('#constellation')).toHaveText('Not applicable')
  await openPreferences(page)
  await page.getByLabel('ly', { exact: true }).check()
  await expect(page.locator('#distance-unit')).toHaveText(' ly')
  await expect(page.locator('#scene canvas')).toHaveCount(0)
})
