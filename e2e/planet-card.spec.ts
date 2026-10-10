import { expect, test, type Page } from '@playwright/test'
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

test('Jupiter has a photographic globe, gas-giant specs and only four Galilean moons', { tag: '@mobile' }, async ({ page }, testInfo) => {
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
  await expect(page.locator('#planet-moons .moon-row')).toHaveCount(4)
  await expect(page.locator('#planet-moons .moon-row dt')).toHaveText(['Io', 'Europa', 'Ganymede', 'Callisto'])
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

test('Saturn has rotating rings, gas-giant specs and six selected moons', { tag: '@mobile' }, async ({ page }, testInfo) => {
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
  await expect(page.locator('#planet-moons .moon-row')).toHaveCount(6)
  await expect(page.locator('#planet-moons .moon-row dt')).toHaveText(['Mimas', 'Enceladus', 'Dione', 'Rhea', 'Titan', 'Iapetus'])
  await card.screenshot({ path: testInfo.outputPath('saturn-moons.png') })
  const moonGlobe = page.locator('#planet-moon-globe')
  for (const [id, name, description] of [
    ['mimas', 'Mimas', /Herschel crater from Cassini/],
    ['enceladus', 'Enceladus', /southern tiger stripes from Cassini/],
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
  // Returning to an icy moon must clear Titan's atmospheric treatment.
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
  await expect(page.locator('#planet-moons .moon-row dt')).toHaveText(['Io', 'Europa', 'Ganymede', 'Callisto'])
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
  await expect(moonGlobe).toHaveAttribute('data-texture-ready', 'true')
  await expect(moons.locator('.moon-row dt')).toHaveText(['Io', 'Europa', 'Ganymede', 'Callisto'])
  await expect(moonGlobe).toHaveAttribute('aria-label', /Sulfur-colored terrain/)
  await expect(moons.locator('.moon-row dd')).toHaveText(['421.8 K km', '671.1 K km', '1,070.4 K km', '1,882.7 K km'])
  const header = (await card.locator('.planet-heading').boundingBox())!
  const orbit = (await moons.locator('figure').boundingBox())!
  const list = (await moons.locator('.moon-list').boundingBox())!
  const details = (await moons.locator('.moon-details').boundingBox())!
  expect(Math.abs(orbit.y - (header.y + header.height))).toBeLessThan(2)
  expect(list.x + list.width).toBeLessThanOrEqual(details.x + 1)
  expect(Math.abs(list.width - details.width)).toBeLessThan(1)
  for (const row of await moons.locator('.moon-row').all()) {
    const rowBounds = (await row.boundingBox())!
    const distanceBounds = (await row.locator('dd').boundingBox())!
    expect(Math.abs(rowBounds.x + rowBounds.width - distanceBounds.x - distanceBounds.width)).toBeLessThan(1)
  }
  const firstName = (await moons.locator('.moon-row dt').first().boundingBox())!
  const firstDistance = (await moons.locator('.moon-row dd').first().boundingBox())!
  expect(Math.abs(firstName.y - firstDistance.y)).toBeLessThan(1)
  expect(Math.abs(list.y - details.y)).toBeLessThan(1)
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
    ['earth', 1, 'moon'], ['saturn', 6, 'mimas'], ['uranus', 5, 'miranda'], ['neptune', 3, 'proteus'], ['mars', 2, 'phobos'],
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
