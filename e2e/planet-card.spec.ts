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
  await expect(page.locator('#planet-moons > section')).toHaveCount(4)
  await expect(page.locator('#planet-moons h3')).toHaveText(['Io', 'Europa', 'Ganymede', 'Callisto'])
  await card.screenshot({ path: testInfo.outputPath('jupiter-moons.png') })
  // Switching planets must clear the limited moon list and the size comparison.
  await page.keyboard.press('Escape')
  await page.locator('.planet-row[data-planet-id="mars"] button').click()
  await expect(canvas).toHaveAttribute('data-texture-ready', 'true')
  await expect(canvas).toHaveAttribute('data-planet-id', 'mars')
  await expect(canvas).toHaveAttribute('data-comparing-earth', 'false')
  await page.locator('#planet-moons-toggle').click()
  await expect(page.locator('#planet-moons h3')).toHaveText(['Phobos', 'Deimos'])
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
  await expect(page.locator('#planet-moons > section')).toHaveCount(6)
  await expect(page.locator('#planet-moons h3')).toHaveText(['Mimas', 'Enceladus', 'Dione', 'Rhea', 'Titan', 'Iapetus'])
  await card.screenshot({ path: testInfo.outputPath('saturn-moons.png') })
  await page.keyboard.press('Escape')
  await page.locator('.planet-row[data-planet-id="jupiter"] button').click()
  await expect(canvas).toHaveAttribute('data-planet-id', 'jupiter')
  await expect(canvas).toHaveAttribute('data-texture-ready', 'true')
  await expect(canvas).toHaveAttribute('data-rings-visible', 'false')
  await expect(canvas).toHaveAttribute('data-comparing-earth', 'false')
  await page.locator('#planet-moons-toggle').click()
  await expect(page.locator('#planet-moons h3')).toHaveText(['Io', 'Europa', 'Ganymede', 'Callisto'])
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
