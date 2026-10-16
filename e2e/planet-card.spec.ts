import { expect, test, type Locator, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

async function openPlanet(page: Page, id = 'mars') {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.evaluate(() => document.fonts.ready)
  const objects = page.getByRole('button', { name: 'Objects', exact: true })
  if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
  await page.getByLabel('Search objects').fill('Sun')
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.locator('#object-system-toggle').click()
  await page.locator(`.planet-row[data-planet-id="${id}"] button`).click()
  await expect(page.locator('#planet-globe')).toHaveAttribute('data-texture-ready', 'true')
}

test('Mars has sourced Info sections and its existing moons', async ({ page }, testInfo) => {
  await openPlanet(page)
  await page.locator('#planet-info-toggle').click()
  await expect(page.locator('#planet-info')).toBeVisible()
  await expect(page.locator('#planet-info > section')).toHaveCount(6)
  await expect(page.locator('#planet-info')).toContainText('Valles Marineris')
  await expect(page.locator('#planet-info')).toContainText('Perseverance')
  await expect(page.locator('#planet-info .planet-info-hero a').first()).toHaveAttribute('href', 'https://science.nasa.gov/resource/global-color-views-of-mars/')
  await expect(page.locator('#planet-info img')).toHaveJSProperty('naturalWidth', 1920)
  await page.locator('#planet-card').screenshot({ path: testInfo.outputPath('mars-info.png') })
  await page.locator('#planet-moons-toggle').click()
  await expect(page.locator('#planet-moons')).toContainText('Phobos')
  await expect(page.locator('#planet-moons')).toContainText('Deimos')
})

test('Jupiter has a photographic globe, gas-giant specs and eight selected moons', { tag: '@mobile' }, async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openPlanet(page, 'jupiter')
  const card = page.locator('#planet-card')
  const canvas = page.locator('#planet-globe')
  await expect(card).toHaveAttribute('data-planet-id', 'jupiter')
  await expect(canvas).toHaveAttribute('aria-label', /Great Red Spot/)
  await expect(card.locator('[data-planet-spec="surface-temperature"]')).toContainText('Temperature at 1 bar')
  await expect(card.locator('[data-planet-spec="surface-temperature"]')).toContainText('165 K')
  await expect(card.locator('[data-planet-spec="surface-pressure"]')).toContainText('No solid surface')
  await expect(card).not.toContainText('NaN')
  await card.screenshot({ path: testInfo.outputPath('jupiter-specs.png') })
  const initial = await canvas.screenshot()
  await canvas.focus()
  await page.keyboard.press('ArrowRight')
  expect((await canvas.screenshot()).equals(initial)).toBe(false)
  await page.locator('#planet-add-earth').click()
  await expect(canvas).toHaveAttribute('data-earth-texture-ready', 'true')
  await expect(canvas).toHaveAttribute('aria-label', /same diameter scale/)
  await card.screenshot({ path: testInfo.outputPath('jupiter-earth.png') })
  await page.locator('#planet-info-toggle').click()
  await expect(page.locator('#planet-info > section')).toHaveCount(6)
  await expect(page.locator('#planet-info')).toContainText('Juno')
  await expect(page.locator('#planet-info img')).toHaveJSProperty('naturalWidth', 1920)
  await expect(page.locator('#planet-info img')).toHaveJSProperty('naturalHeight', 2400)
  await card.screenshot({ path: testInfo.outputPath('jupiter-info.png') })
  await page.locator('#planet-moons-toggle').click()
  await expect(page.locator('#planet-moons .moon-row')).toHaveCount(8)
  await expect(page.locator('#planet-moons .moon-row dt')).toHaveText(['Metis', 'Adrastea', 'Amalthea', 'Thebe', 'Io', 'Europa', 'Ganymede', 'Callisto'])
  await card.screenshot({ path: testInfo.outputPath('jupiter-moons.png') })
  // Switching planets must clear the limited moon list and the size comparison.
  await page.keyboard.press('Escape')
  await page.locator('.planet-row[data-planet-id="mars"] button').click()
  await expect(canvas).toHaveAttribute('data-texture-ready', 'true')
  await expect(canvas).toHaveAttribute('data-planet-id', 'mars')
  await expect(canvas).toHaveAttribute('data-comparing-earth', 'false')
  await page.locator('#planet-moons-toggle').click()
  await expect(page.locator('#planet-moons .moon-row dt')).toHaveText(['Phobos', 'Deimos'])
  expect(errors).toEqual([])
})

test('Saturn has rotating rings, gas-giant specs and eight selected moons', { tag: '@mobile' }, async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await openPlanet(page, 'saturn')
  const card = page.locator('#planet-card')
  const canvas = page.locator('#planet-globe')
  await expect(canvas).toHaveAttribute('data-rings-ready', 'true')
  await expect(canvas).toHaveAttribute('data-rings-visible', 'true')
  await expect(canvas).toHaveAttribute('aria-label', /Cassini Division/)
  await expect(card.locator('[data-planet-spec="surface-temperature"]')).toContainText('134 K')
  await expect(card.locator('[data-planet-spec="surface-pressure"]')).toContainText('No solid surface')
  await expect(card).not.toContainText('NaN')
  await card.screenshot({ path: testInfo.outputPath('saturn-specs.png') })
  const initial = await canvas.screenshot()
  await canvas.focus()
  await page.keyboard.press('ArrowUp')
  expect((await canvas.screenshot()).equals(initial)).toBe(false)
  await page.locator('#planet-add-earth').click()
  await expect(canvas).toHaveAttribute('data-earth-texture-ready', 'true')
  await expect(canvas).toHaveAttribute('aria-label', /same diameter scale/)
  await card.screenshot({ path: testInfo.outputPath('saturn-earth.png') })
  await page.locator('#planet-info-toggle').click()
  await expect(page.locator('#planet-info > section')).toHaveCount(6)
  await expect(page.locator('#planet-info')).toContainText('Huygens')
  await expect(page.locator('#planet-info img')).toHaveJSProperty('naturalWidth', 3545)
  await expect(page.locator('#planet-info img')).toHaveJSProperty('naturalHeight', 1834)
  await card.screenshot({ path: testInfo.outputPath('saturn-info.png') })
  await page.locator('#planet-moons-toggle').click()
  await expect(page.locator('#planet-moons .moon-row')).toHaveCount(8)
  await expect(page.locator('#planet-moons .moon-row dt')).toHaveText(['Mimas', 'Enceladus', 'Tethys', 'Dione', 'Rhea', 'Titan', 'Hyperion', 'Iapetus'])
  await card.screenshot({ path: testInfo.outputPath('saturn-moons.png') })
  const moonGlobe = page.locator('#planet-moon-globe')
  for (const [id, name, description] of [
    ['mimas', 'Mimas', /Herschel crater from Cassini/],
    ['enceladus', 'Enceladus', /southern tiger stripes from Cassini/],
    ['tethys', 'Tethys', /Odysseus crater and Ithaca Chasma from Cassini/],
    ['dione', 'Dione', /bright fractured cliffs from Cassini/],
    ['rhea', 'Rhea', /bright wispy fractures from Cassini/],
    ['titan', 'Titan', /soft edge and a faint blue upper layer/],
    ['iapetus', 'Iapetus', /dark brown hemisphere/],
  ] as const) {
    await page.locator('#planet-moons').getByRole('button', { name: new RegExp(`^${name}, orbital distance`) }).click()
    await expect(moonGlobe).toHaveAttribute('data-planet-id', id)
    await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
    await expect(moonGlobe).toHaveAttribute('aria-label', description)
    await moonGlobe.screenshot({ path: testInfo.outputPath(`${id}-globe.png`) })
    if (id === 'titan') {
      const haze = await moonGlobe.screenshot()
      await moonGlobe.focus()
      await page.keyboard.press('ArrowRight')
      await expect.poll(async () => (await moonGlobe.screenshot()).equals(haze)).toBe(false)
      await moonGlobe.screenshot({ path: testInfo.outputPath('titan-globe-rotated.png') })
    }
  }
  const moons = page.locator('#planet-moons')
  const moonImage = page.locator('#planet-moon-image')
  await moons.getByRole('button', { name: /^Hyperion, orbital distance/ }).click()
  await expect(moons).toHaveAttribute('data-selected-moon-id', 'hyperion')
  await expect(moonGlobe).toBeHidden()
  await expect(moonImage).toBeVisible()
  await expect(moonImage).toHaveJSProperty('naturalWidth', 310)
  await expect(moonImage).toHaveJSProperty('naturalHeight', 344)
  await expect(moonImage).toHaveAttribute('alt', /Cassini natural-color mosaic of Hyperion/)
  await expect(moonImage).toHaveAttribute('title', /Gordan Ugarkovic.*CC BY-NC-SA 2.0/)
  await expect(moonImage).toHaveCSS('object-fit', 'contain')
  await expect(moons.locator('[data-planet-spec="moon-hyperion-mean-radius"]')).toContainText('135.1 km')
  await expect(moons.locator('[data-planet-spec="moon-hyperion-semi-major-axis"]')).toContainText('1,500,930 km')
  await expect(moons.locator('#planet-moon-hyperion-surface-gravity-detail-tooltip')).toContainText('local surface gravity varies with position')
  await expect(moons.locator('.moon-globe-unavailable')).toBeHidden()
  await card.screenshot({ path: testInfo.outputPath('hyperion-photo.png') })

  // Returning from a photograph must restore the globe and its rotation controls.
  await moons.getByRole('button', { name: /^Tethys, orbital distance/ }).click()
  await expect(moonImage).toBeHidden()
  await expect(moonGlobe).toBeVisible()
  await expect(moonGlobe).toHaveAttribute('data-planet-id', 'tethys')
  await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
  await expect(moons.locator('[data-planet-spec="moon-tethys-mean-radius"]')).toContainText('530.6 km')
  await expect(moons.locator('[data-planet-spec="moon-tethys-semi-major-axis"]')).toContainText('294,660 km')
  const tethys = await moonGlobe.screenshot()
  await moonGlobe.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await moonGlobe.screenshot()).equals(tethys)).toBe(false)
  await moonGlobe.screenshot({ path: testInfo.outputPath('tethys-after-hyperion.png') })

  // Returning to another icy moon must clear previous visual treatments.
  await page.locator('#planet-moons').getByRole('button', { name: /^Mimas, orbital distance/ }).click()
  await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
  await expect(moonGlobe).toHaveAttribute('aria-label', /Cratered surface/)
  await expect(page.locator('#planet-moon-mimas-mass-detail-tooltip')).toContainText('1/1,900 of the mass of Earth’s Moon')
  await moonGlobe.screenshot({ path: testInfo.outputPath('mimas-after-titan.png') })
  await page.keyboard.press('Escape')
  await page.locator('.planet-row[data-planet-id="jupiter"] button').click()
  await expect(canvas).toHaveAttribute('data-planet-id', 'jupiter')
  await expect(canvas).toHaveAttribute('data-texture-ready', 'true')
  await expect(canvas).toHaveAttribute('data-rings-visible', 'false')
  await expect(canvas).toHaveAttribute('data-comparing-earth', 'false')
  await page.locator('#planet-moons-toggle').click()
  await expect(page.locator('#planet-moons .moon-row dt')).toHaveText(['Metis', 'Adrastea', 'Amalthea', 'Thebe', 'Io', 'Europa', 'Ganymede', 'Callisto'])
  expect(errors).toEqual([])
})

test('Neptune inner moons select photographs and preserve unavailable measurements', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openPlanet(page, 'neptune')
  await page.locator('#planet-moons-toggle').click()
  const moons = page.locator('#planet-moons')
  const image = page.locator('#planet-moon-image')
  const globe = page.locator('#planet-moon-globe')
  await expect(moons.locator('.moon-row dt')).toHaveText([
    'Naiad', 'Thalassa', 'Despina', 'Galatea', 'Larissa', 'Hippocamp', 'Proteus', 'Triton', 'Nereid',
  ])
  // Closely spaced orbits must still have distinct schematic markers.
  const markers = await moons.locator('.planet-body .planet-marker').evaluateAll((nodes) => nodes.map((node) => ({
    x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')),
  })))
  for (let i = 0; i < markers.length; i++) for (let j = i + 1; j < markers.length; j++) {
    expect(Math.hypot(markers[i]!.x - markers[j]!.x, markers[i]!.y - markers[j]!.y)).toBeGreaterThan(8)
  }
  for (const name of ['Naiad', 'Thalassa', 'Despina', 'Galatea', 'Larissa', 'Hippocamp', 'Proteus', 'Triton', 'Nereid']) {
    const id = name.toLowerCase()
    await moons.getByRole('button', { name: new RegExp(`^${name}, orbital distance`) }).click()
    await expect(moons).toHaveAttribute('data-selected-moon-id', id)
    await expect(moons.locator('.planet-orbit.is-highlighted')).toHaveAttribute('data-orbit-id', id)
    await expect(moons.locator('#planet-moon-details')).toHaveAttribute('aria-label', `${name} specifications`)
    await expect(globe).toBeHidden()
    await expect(image).toBeVisible()
    await expect(image).toHaveAttribute('alt', new RegExp(name))
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true)
    await expect(image).toHaveCSS('object-fit', 'contain')
    await expect(moons.locator('.moon-globe-unavailable')).toBeHidden()
    await expect(moons).not.toContainText(/NaN|Infinity/)
    if (['despina', 'galatea', 'larissa', 'hippocamp'].includes(id)) {
      await expect(moons.locator(`[data-planet-spec="moon-${id}-mass"] dd`)).toHaveText('—')
      await expect(moons.locator(`[data-planet-spec="moon-${id}-surface-gravity"] dd`)).toHaveText('—')
    } else if (id === 'naiad' || id === 'thalassa') {
      await expect(moons.locator(`[data-planet-spec="moon-${id}-mass"] dd`)).toContainText('≈')
      await expect(moons.locator(`#planet-moon-${id}-mass-detail-tooltip`)).toContainText('quoted GM uncertainty')
    }
    if (id === 'thalassa') await expect(image).toHaveAttribute('alt', /1989 N5/)
    if (id === 'hippocamp') {
      await expect(image).toHaveAttribute('alt', /S\/2004 N 1/)
      await expect(image).toHaveAttribute('title', /shape and surface are unresolved/)
    }
    if (['naiad', 'thalassa', 'hippocamp'].includes(id)) {
      await page.locator('#planet-card').screenshot({ path: testInfo.outputPath(`${id}-neptune-moons.png`) })
    }
  }
  // A photograph selection must not leave stale imagery when changing to a 3D moon.
  await page.keyboard.press('Escape')
  await page.locator('.planet-row[data-planet-id="mars"] button').click()
  await page.locator('#planet-moons-toggle').click()
  await expect(image).toBeHidden()
  await expect(globe).toBeVisible()
  await expect(globe).toHaveAttribute('data-planet-id', 'phobos')
  await expect(globe).toHaveAttribute('data-model-ready', 'true')
  expect(errors).toEqual([])
})

test('moon tab keeps orbit selection, globe and specs together', { tag: '@mobile' }, async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openPlanet(page, 'jupiter')
  const card = page.locator('#planet-card')
  const planetGlobe = page.locator('#planet-globe')
  const moonGlobe = page.locator('#planet-moon-globe')
  const moons = page.locator('#planet-moons')
  const originalWidth = (await card.boundingBox())!.width
  await page.locator('#planet-moons-toggle').click()
  expect((await card.boundingBox())!.width).toBe(originalWidth)
  await expect(moons).toHaveAttribute('data-selected-moon-id', 'metis')
  await expect(moons.locator('.moon-row dt')).toHaveText(['Metis', 'Adrastea', 'Amalthea', 'Thebe', 'Io', 'Europa', 'Ganymede', 'Callisto'])
  const moonPhoto = moons.locator('#planet-moon-image')
  for (const [id, name, radius, product] of [
    ['metis', 'Metis', '21.5 km', 'PIA02531'],
    ['adrastea', 'Adrastea', '8.2 km', 'PIA01624'],
    ['amalthea', 'Amalthea', '83.5 km', 'PIA02531'],
    ['thebe', 'Thebe', '49.3 km', 'PIA02531'],
  ] as const) {
    await moons.getByRole('button', { name: new RegExp(`^${name}, orbital distance`) }).click()
    await expect(moons).toHaveAttribute('data-selected-moon-id', id)
    await expect(moonGlobe).toBeHidden()
    await expect(moonPhoto).toBeVisible()
    await expect(moonPhoto).toHaveAttribute('alt', new RegExp(name))
    await expect(moonPhoto).toHaveAttribute('title', new RegExp(product))
    await expect(moons.locator(`[data-planet-spec="moon-${id}-mean-radius"]`)).toContainText(radius)
    await expect.poll(() => moonPhoto.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
    await expect(moons.locator('.moon-globe-unavailable')).toBeHidden()
    await expect(moons).not.toContainText(/NaN|Infinity/)
    if (id === 'adrastea') {
      await expect(moons.locator('[data-planet-spec="moon-adrastea-mass"] dd')).toHaveText('—')
      await expect(moons.locator('[data-planet-spec="moon-adrastea-surface-gravity"] dd')).toHaveText('—')
      await expect(moons.locator('#planet-moon-adrastea-mass-detail-tooltip')).toContainText('uncertainty larger than the value')
    }
    await card.screenshot({ path: testInfo.outputPath(`${id}-moon-browser.png`) })
  }
  await moons.getByRole('button', { name: /^Io, orbital distance/ }).click()
  await expect(moonPhoto).toBeHidden()
  await expect(moonGlobe).toBeVisible()
  await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
  await expect(moonGlobe).toHaveAttribute('aria-label', /Sulfur-colored terrain/)
  await expect(moons.locator('.moon-row dd')).toHaveText(['128 K km', '129 K km', '181.4 K km', '221.9 K km', '421.8 K km', '671.1 K km', '1,070.4 K km', '1,882.7 K km'])
  const header = (await card.locator('.planet-heading').boundingBox())!
  const orbit = (await moons.locator('figure').boundingBox())!
  const list = (await moons.locator('.moon-list').boundingBox())!
  const visual = (await moons.locator('.moon-visual').boundingBox())!
  const details = (await moons.locator('.moon-details').boundingBox())!
  expect(Math.abs(orbit.y - (header.y + header.height))).toBeLessThan(2)
  expect(list.x + list.width).toBeLessThanOrEqual(visual.x + 1)
  expect(Math.abs(list.width - visual.width)).toBeLessThan(1)
  expect(Math.abs(list.height - visual.height)).toBeLessThan(1)
  expect(details.x).toBe(list.x)
  expect(Math.abs(details.width - list.width - visual.width)).toBeLessThan(1)
  expect(Math.abs(details.y - list.y - list.height)).toBeLessThan(1)
  expect(await moons.locator('.moon-list').evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  for (const row of await moons.locator('.moon-row').all()) {
    const rowBounds = (await row.boundingBox())!
    const distanceBounds = (await row.locator('dd').boundingBox())!
    expect(Math.abs(rowBounds.x + rowBounds.width - distanceBounds.x - distanceBounds.width)).toBeLessThan(1)
  }
  const firstName = (await moons.locator('.moon-row dt').first().boundingBox())!
  const firstDistance = (await moons.locator('.moon-row dd').first().boundingBox())!
  expect(Math.abs(firstName.y - firstDistance.y)).toBeLessThan(1)
  expect(Math.abs(list.y - visual.y)).toBeLessThan(1)
  expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(moons.locator('h3')).toHaveCount(0)
  await card.screenshot({ path: testInfo.outputPath('jupiter-moon-browser.png') })

  const europa = moons.getByRole('button', { name: /^Europa, orbital distance/ })
  await europa.focus()
  await page.keyboard.press('Enter')
  await expect(europa).toHaveAttribute('aria-pressed', 'true')
  await expect(moons.locator('.planet-orbit.is-highlighted')).toHaveAttribute('data-orbit-id', 'europa')
  await expect(moonGlobe).toHaveAttribute('data-planet-id', 'europa')
  await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
  await expect(moons.locator('[data-planet-spec="moon-europa-mean-radius"]')).toContainText('1,560.8 km')
  await expect(moons.locator('#planet-moon-details')).toHaveAttribute('aria-label', 'Europa specifications')
  for (const help of await moons.locator('.moon-properties .mass-metric-help').all()) {
    await help.focus()
    const tooltip = page.locator(`#${await help.getAttribute('aria-describedby')}`)
    await expect(tooltip).toBeVisible()
    await expect(tooltip).not.toContainText(/NASA|fact sheet|distant stars/i)
    const tooltipBounds = (await tooltip.boundingBox())!
    const cardBounds = (await card.boundingBox())!
    expect(tooltipBounds.x).toBeGreaterThanOrEqual(cardBounds.x)
    expect(tooltipBounds.x + tooltipBounds.width).toBeLessThanOrEqual(cardBounds.x + cardBounds.width)
    await help.blur()
    await expect(tooltip).toBeHidden()
  }
  const orbitalHelp = moons.getByRole('button', { name: 'Orbital semi-major axis', exact: true })
  if (testInfo.project.name === 'desktop') await orbitalHelp.hover()
  else await orbitalHelp.focus()
  const orbitalTooltip = moons.locator('#planet-moon-europa-semi-major-axis-detail-tooltip')
  await expect(orbitalTooltip).toBeVisible()
  await expect(orbitalTooltip).toContainText('not a current distance')
  await card.screenshot({ path: testInfo.outputPath('moon-spec-tooltip.png') })
  await orbitalHelp.blur()
  await page.mouse.move(0, 0)
  await expect(moons.locator('#planet-moon-europa-mean-radius-detail-tooltip')).toContainText('90% of the radius of Earth’s Moon')
  await expect(moons.locator('#planet-moon-europa-mass-detail-tooltip')).toContainText('65% of the mass of Earth’s Moon')
  await expect(moonGlobe).toHaveAttribute('aria-label', /Pale cream ice.*reddish-brown fractures/)
  await card.screenshot({ path: testInfo.outputPath('europa-moon-browser.png') })
  await expect(moons.locator('#planet-moon-europa-surface-gravity-detail-tooltip')).toContainText('1/7.5 of Earth’s gravity')
  await expect(moons.locator('#planet-moon-europa-sidereal-orbit-detail-tooltip')).toContainText('once all the way around Jupiter')
  const initial = await moonGlobe.screenshot()
  await moonGlobe.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await moonGlobe.screenshot()).equals(initial)).toBe(false)
  await moons.getByRole('button', { name: /^Callisto, orbital distance/ }).click()
  await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
  await expect(moonGlobe).toHaveAttribute('aria-label', /Brown-gray terrain/)
  await expect(moons.locator('#planet-moon-callisto-mass-detail-tooltip')).toContainText('1.46 times the mass of Earth’s Moon')
  await card.screenshot({ path: testInfo.outputPath('callisto-moon-browser.png') })
  await moons.getByRole('button', { name: /^Ganymede, orbital distance/ }).click()
  await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
  await expect(moonGlobe).toHaveAttribute('aria-label', /Brown-gray cratered regions and paler grooved ice/)
  await card.screenshot({ path: testInfo.outputPath('ganymede-moon-browser.png') })
  await europa.click()
  await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
  await page.locator('#planet-specs-toggle').click()
  await expect(planetGlobe).toHaveAttribute('data-planet-id', 'jupiter')
  await expect(planetGlobe).toHaveAttribute('data-texture-ready', 'true')
  await page.locator('#planet-add-earth').click()
  await expect(planetGlobe).toHaveAttribute('data-comparing-earth', 'true')
  await page.locator('#planet-moons-toggle').click()
  await expect(moons).toHaveAttribute('data-selected-moon-id', 'europa')
  await expect(moonGlobe).toHaveAttribute('data-comparing-earth', 'false')

  for (const [planetId, count, selectedId] of [
    ['earth', 1, 'moon'], ['saturn', 8, 'mimas'], ['uranus', 5, 'miranda'], ['neptune', 9, 'naiad'], ['mars', 2, 'phobos'],
  ] as const) {
    await page.keyboard.press('Escape')
    await page.locator(`.planet-row[data-planet-id="${planetId}"] button`).click()
    await page.locator('#planet-moons-toggle').click()
    await expect(moons.locator('.moon-row')).toHaveCount(count)
    await expect(moons).toHaveAttribute('data-selected-moon-id', selectedId)
    const moonImage = page.locator('#planet-moon-image')
    if (planetId === 'uranus' || planetId === 'neptune') {
      await expect(moonGlobe).toBeHidden()
      await expect(moonImage).toBeVisible()
      await expect.poll(() => moonImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
      await expect(moonImage).toHaveCSS('object-fit', 'contain')
      await expect(moonImage).toHaveAttribute('title', /NASA \/ JPL.*Voyager 2/)
    } else {
      await expect(moonImage).toBeHidden()
      await expect(moonGlobe).toHaveAttribute('data-model-ready', 'true')
      await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
      await expect(moonGlobe).toHaveAttribute('data-planet-id', selectedId)
    }
    await expect(moons.locator('.moon-globe-unavailable')).toBeHidden()
    if (planetId === 'earth') {
      await expect(moons.locator('#planet-moon-moon-surface-gravity-detail-tooltip')).toContainText('1/6 of Earth’s gravity')
      await card.screenshot({ path: testInfo.outputPath('earth-moon-browser.png') })
    }
    if (planetId === 'saturn') {
      await moons.getByRole('button', { name: /^Titan, orbital distance/ }).click()
      await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
      await expect(moonGlobe).toHaveAttribute('title', /fictional haze map/)
    }
    if (planetId === 'neptune') {
      await moons.getByRole('button', { name: /^Triton, orbital distance/ }).click()
      await expect(moonGlobe).toBeHidden()
      await expect(moonImage).toHaveAttribute('alt', /color mosaic of Triton/)
      await expect(moonImage).toHaveAttribute('title', /NASA \/ JPL \/ USGS.*PIA00317.*Synthesized color/)
      await expect.poll(() => moonImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
      await expect(moons.locator('[data-planet-spec="moon-triton-sidereal-orbit"]')).toContainText('retrograde')
      await card.screenshot({ path: testInfo.outputPath('triton-moon-browser.png') })
      await moons.getByRole('button', { name: /^Proteus, orbital distance/ }).click()
      await expect(moonGlobe).toBeHidden()
      await expect(moonImage).toHaveAttribute('alt', /Proteus/)
      await expect.poll(() => moonImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
      await card.screenshot({ path: testInfo.outputPath('proteus-moon-browser.png') })
      await moons.getByRole('button', { name: /^Nereid, orbital distance/ }).click()
      await expect(moonGlobe).toBeHidden()
      await expect(moonImage).toHaveAttribute('alt', /Nereid/)
      await expect.poll(() => moonImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
      await expect(moons.locator('#planet-moon-details')).toHaveAttribute('aria-label', 'Nereid specifications')
      await card.screenshot({ path: testInfo.outputPath('nereid-moon-browser.png') })
    }
    if (planetId === 'uranus') {
      for (const name of ['Miranda', 'Ariel', 'Umbriel', 'Titania', 'Oberon']) {
        await moons.getByRole('button', { name: new RegExp(`^${name}, orbital distance`) }).click()
        await expect(moonImage).toHaveAttribute('alt', new RegExp(name))
        await expect.poll(() => moonImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
        await expect(moonGlobe).toBeHidden()
        await card.screenshot({ path: testInfo.outputPath(`${name.toLowerCase()}-moon-browser.png`) })
      }
    }
    if (planetId === 'mars') {
      await expect(moonGlobe).toHaveAttribute('aria-label', /Phobos 3D view.*Irregular shape.*Stickney crater/)
      await card.screenshot({ path: testInfo.outputPath('phobos-moon-browser.png') })
      const phobos = await moonGlobe.screenshot()
      await moonGlobe.focus()
      await page.keyboard.press('ArrowRight')
      await expect.poll(async () => (await moonGlobe.screenshot()).equals(phobos)).toBe(false)
      await moons.getByRole('button', { name: /^Deimos, orbital distance/ }).click()
      await expect(moonGlobe).toHaveAttribute('data-model-ready', 'true')
      await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
      await expect(moonGlobe).toHaveAttribute('aria-label', /Deimos 3D view.*Irregular shape/)
      await expect(moons.locator('#planet-moon-details')).toHaveAttribute('aria-label', 'Deimos specifications')
      await expect(moons.locator('[data-planet-spec="moon-deimos-mean-radius"]')).toContainText('6.2 km')
      await card.screenshot({ path: testInfo.outputPath('mars-moon-browser.png') })
    }
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  await page.keyboard.press('Escape')
  await page.locator('.planet-row[data-planet-id="mercury"] button').click()
  await expect(page.locator('#planet-moons-toggle')).toBeHidden()
  await expect(moons).toBeEmpty()
  expect(errors).toEqual([])
})

test('pins the globe and header and compares planets with Earth at one scale', { tag: '@mobile' }, async ({ page }, testInfo) => {
  await openPlanet(page)
  const canvas = page.locator('#planet-globe')
  const header = page.locator('.planet-physical-header')
  await page.locator('#planet-add-earth').click()
  await expect(canvas).toHaveAttribute('data-earth-texture-ready', 'true')
  await expect(canvas).toHaveAttribute('aria-label', /same diameter scale/)
  const globeBefore = await canvas.boundingBox()
  const headerBefore = await header.boundingBox()
  await page.locator('#planet-card .card-scroll-content').evaluate((element) => { element.scrollTop = 400 })
  expect(await canvas.boundingBox()).toEqual(globeBefore)
  expect(await header.boundingBox()).toEqual(headerBefore)
  await expect(page.locator('#planet-atmosphere-heading')).toBeVisible()
  await page.locator('#planet-card').screenshot({ path: testInfo.outputPath('mars-earth-scrolled.png') })

  // Measure the rendered globe silhouettes, independent of the scale calculation.
  const image = PNG.sync.read(await canvas.screenshot())
  const diameters = [0, 1].map((half) => {
    let first = image.height
    let last = -1
    for (let y = 0; y < image.height; y++) {
      for (let x = Math.floor(half * image.width / 2); x < (half + 1) * image.width / 2; x++) {
        const i = (y * image.width + x) * 4
        // Exclude faint bloom outside the limb; brighter Earth clouds otherwise
        // enlarge its measured silhouette without changing the physical scale.
        if (Math.max(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!) > 60) {
          first = Math.min(first, y)
          last = Math.max(last, y)
        }
      }
    }
    return last - first + 1
  })
  expect(diameters[0]! / diameters[1]!).toBeCloseTo(3389.5 / 6371, 1)
  await page.locator('#planet-add-earth').click()
  await expect(canvas).toHaveAttribute('data-comparing-earth', 'false')
  await expect(page.locator('#planet-globe-labels')).toHaveCount(0)
  for (const id of ['mercury', 'venus', 'earth']) {
    await page.keyboard.press('Escape')
    await page.locator(`.planet-row[data-planet-id="${id}"] button`).click()
    await expect(canvas).toHaveAttribute('data-planet-id', id)
    await expect(page.locator('#planet-add-earth')).toHaveAttribute('aria-pressed', 'false')
    if (id === 'earth') await expect(page.locator('#planet-add-earth')).toBeDisabled()
    else {
      await page.locator('#planet-add-earth').click()
      await expect(canvas).toHaveAttribute('data-comparing-earth', 'true')
    }
  }
  // Both fact pages stay available without disturbing the independent globe comparison.
  await page.keyboard.press('Escape')
  await page.locator('.planet-row[data-planet-id="mercury"] button').click()
  const facts = page.locator('#planet-physical-specs')
  const stats = page.locator('#planet-stats-toggle')
  const ids = () => facts.locator('[data-planet-spec]').evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.planetSpec!))
  const primaryIds = await ids()
  expect(primaryIds).toEqual(['mean-diameter', 'mean-radius', 'mass', 'volume', 'mean-density', 'surface-gravity', 'escape-velocity', 'synodic-rotation-period', 'surface-temperature', 'temperature'])
  await page.locator('#planet-card').screenshot({ path: testInfo.outputPath('mercury-key-facts.png') })
  await page.locator('#planet-add-earth').click()
  await stats.focus()
  await page.keyboard.press('Enter')
  await expect(facts).toHaveAttribute('data-stats-page', '2')
  expect(await ids()).toEqual(['flattening', 'surface-area', 'orbit-inclination', 'axial-inclination', 'albedo', 'absolute-magnitude', 'apparent-magnitude'])
  await expect(canvas).toHaveAttribute('data-comparing-earth', 'true')
  await page.locator('#planet-card').screenshot({ path: testInfo.outputPath('mercury-more-facts.png') })
  await stats.click()
  expect(await ids()).toEqual(primaryIds)
  const atmosphere = page.locator('#planet-atmosphere-section')
  await atmosphere.scrollIntoViewIfNeeded()
  const pressure = await atmosphere.locator('[data-planet-spec="surface-pressure"]').boundingBox()
  const composition = await atmosphere.locator('[data-planet-spec="composition"]').boundingBox()
  expect(pressure!.x + pressure!.width).toBeLessThanOrEqual(composition!.x)
  expect(pressure!.y).toBeCloseTo(composition!.y, 0)
  await expect(atmosphere.locator('li')).toHaveText(['Sodium (Na)', 'Magnesium (Mg)', 'Oxygen (O)', 'Hydrogen (H)', 'Helium (He)', 'Potassium (K)', 'Calcium (Ca)'])
  await atmosphere.locator('summary').click()
  await expect(atmosphere.locator('dl')).toBeHidden()
  await atmosphere.locator('summary').click()
  await expect(atmosphere.locator('dl')).toBeVisible()
  expect(await facts.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await stats.click()
  await page.keyboard.press('Escape')
  await page.locator('.planet-row[data-planet-id="jupiter"] button').click()
  await expect(facts).toHaveAttribute('data-stats-page', '1')
  await expect(page.locator('[data-planet-spec="surface-temperature"]')).toContainText('Temperature at 1 bar')
  await expect(page.locator('[data-planet-spec="surface-pressure"]')).toContainText('No solid surface')
  await expect(stats).toHaveAttribute('aria-pressed', 'false')
})

test('a dragged globe coasts, a second click stops it, and momentum settles', async ({ page }) => {
  await openPlanet(page)
  const canvas = page.locator('#planet-globe')
  const bounds = (await canvas.boundingBox())!
  const pull = async () => {
    await page.mouse.move(bounds.x + bounds.width / 2 - 45, bounds.y + bounds.height / 2)
    await page.mouse.down()
    await page.mouse.move(bounds.x + bounds.width / 2 + 45, bounds.y + bounds.height / 2, { steps: 8 })
    await page.mouse.up()
    await expect(canvas).toHaveAttribute('data-spinning', 'true')
  }
  await pull()
  const coasting = await canvas.screenshot()
  await page.waitForTimeout(80)
  expect((await canvas.screenshot()).equals(coasting)).toBe(false)
  await canvas.click()
  await expect(canvas).toHaveAttribute('data-spinning', 'false')
  const stopped = await canvas.screenshot()
  await page.waitForTimeout(120)
  expect((await canvas.screenshot()).equals(stopped)).toBe(true)
  await pull()
  await expect(canvas).toHaveAttribute('data-spinning', 'false', { timeout: 5000 })
})

async function globePixels(canvas: Locator) {
  const image = PNG.sync.read(await canvas.screenshot())
  let count = 0
  let totalX = 0
  let totalY = 0
  // Exclude the focus outline and measure the rendered globe itself.
  for (let y = 4; y < image.height - 4; y++) {
    for (let x = 4; x < image.width - 4; x++) {
      const offset = (y * image.width + x) * 4
      if (Math.max(image.data[offset]!, image.data[offset + 1]!, image.data[offset + 2]!) <= 60) continue
      count++
      totalX += x
      totalY += y
    }
  }
  return { count, x: totalX / count, y: totalY / count, width: image.width, height: image.height }
}

async function waitForGlobeFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

test('globe camera zoom and modifier panning are bounded and disabled for Earth comparison', async ({ page }) => {
  await openPlanet(page)
  const canvas = page.locator('#planet-globe')
  await canvas.focus()
  const bounds = (await canvas.boundingBox())!
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const initial = await globePixels(canvas)
  await page.mouse.move(center.x, center.y)
  await page.mouse.wheel(0, -120)
  await waitForGlobeFrame(page)
  expect((await globePixels(canvas)).count).toBeGreaterThan(initial.count * 1.05)

  const pan = async (modifier: 'Control' | 'Meta', deltaX: number, deltaY = 0) => {
    await page.keyboard.down(modifier)
    await page.mouse.move(center.x, center.y)
    await page.mouse.down()
    await page.mouse.move(center.x + deltaX, center.y + deltaY, { steps: 5 })
    await page.mouse.up()
    await page.keyboard.up(modifier)
    await waitForGlobeFrame(page)
  }
  for (const modifier of ['Control', 'Meta'] as const) {
    const before = await globePixels(canvas)
    await pan(modifier, 25)
    expect((await globePixels(canvas)).x).toBeGreaterThan(before.x + 20)
    await expect(canvas).toHaveAttribute('data-spinning', 'false')
  }
  await pan('Control', 600, 400)
  const atPanLimit = await canvas.screenshot()
  await pan('Control', 600, 400)
  expect((await canvas.screenshot()).equals(atPanLimit)).toBe(true)
  const panned = await globePixels(canvas)
  expect(panned.count).toBeGreaterThan(initial.count / 2)
  expect(panned.x).toBeLessThan(panned.width * 0.85)
  expect(panned.y).toBeLessThan(panned.height * 0.85)

  await page.mouse.move(center.x, center.y)
  await page.mouse.wheel(0, -10000)
  await waitForGlobeFrame(page)
  const atZoomLimit = await canvas.screenshot()
  await page.mouse.wheel(0, -10000)
  await waitForGlobeFrame(page)
  expect((await canvas.screenshot()).equals(atZoomLimit)).toBe(true)
  await page.mouse.wheel(0, 10000)
  await waitForGlobeFrame(page)
  const atZoomOutLimit = await canvas.screenshot()
  await page.mouse.wheel(0, 10000)
  await waitForGlobeFrame(page)
  expect((await canvas.screenshot()).equals(atZoomOutLimit)).toBe(true)

  await page.locator('#planet-add-earth').click()
  await expect(canvas).toHaveAttribute('data-earth-texture-ready', 'true')
  await canvas.focus()
  // Ignore the focus outline, which changes when switching between keyboard and mouse input.
  const comparison = await globePixels(canvas)
  await page.mouse.move(center.x, center.y)
  await page.mouse.wheel(0, -10000)
  await waitForGlobeFrame(page)
  expect(await globePixels(canvas)).toEqual(comparison)
  await pan('Control', 80, 40)
  expect(await globePixels(canvas)).toEqual(comparison)
  await pan('Meta', -80, -40)
  expect(await globePixels(canvas)).toEqual(comparison)

  await page.locator('#planet-add-earth').click()
  await canvas.focus()
  const reset = await globePixels(canvas)
  expect(reset.count).toBe(initial.count)
  expect(reset.x).toBeCloseTo(initial.x, 1)
  expect(reset.y).toBeCloseTo(initial.y, 1)
  await page.mouse.move(center.x, center.y)
  await page.mouse.wheel(0, -120)
  await waitForGlobeFrame(page)
  expect((await globePixels(canvas)).count).toBeGreaterThan(initial.count * 1.05)
})

test('planet and moon globes support touch pinch and pan without rotating or coasting', { tag: '@mobile' }, async ({ page }) => {
  await openPlanet(page, 'jupiter')
  const session = await page.context().newCDPSession(page)
  const gesture = async (canvas: Locator, spread: number, deltaX = 0, deltaY = 0) => {
    const bounds = (await canvas.boundingBox())!
    const x = bounds.x + bounds.width / 2
    const y = bounds.y + bounds.height / 2
    const touches = (distance: number, offsetX = 0, offsetY = 0) => [
      { x: x - distance + offsetX, y: y + offsetY, id: 0 },
      { x: x + distance + offsetX, y: y + offsetY, id: 1 },
    ]
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(35) })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(spread, deltaX, deltaY) })
    // Lifting one finger first must not turn the remaining finger into a pinch or a rotation.
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: touches(spread, deltaX, deltaY).slice(0, 1) })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(spread, deltaX + 5, deltaY).slice(0, 1) })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await waitForGlobeFrame(page)
  }
  const planet = page.locator('#planet-globe')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const canvas of [planet, page.locator('#planet-moon-globe')]) {
    if (canvas !== planet) {
      await page.locator('#planet-moons-toggle').click()
      await expect(canvas).toHaveAttribute('data-texture-ready', 'true')
    }
    const initial = await globePixels(canvas)
    await gesture(canvas, 38)
    const zoomed = await globePixels(canvas)
    expect(zoomed.count).toBeGreaterThan(initial.count * 1.05)
    await gesture(canvas, 35, 25)
    const panned = await globePixels(canvas)
    expect(panned.x - zoomed.x).toBeGreaterThan(20 * (panned.width / (await canvas.boundingBox())!.width))
    await expect(canvas).toHaveAttribute('data-spinning', 'false')
    const stopped = await canvas.screenshot()
    await page.waitForTimeout(100)
    expect((await canvas.screenshot()).equals(stopped)).toBe(true)
  }
  await page.locator('#planet-specs-toggle').click()
  await page.locator('#planet-add-earth').click()
  await expect(planet).toHaveAttribute('data-earth-texture-ready', 'true')
  const comparison = await planet.screenshot()
  await gesture(planet, 60, 25, 15)
  expect((await planet.screenshot()).equals(comparison)).toBe(true)
  expect(errors).toEqual([])
  await session.detach()
})
