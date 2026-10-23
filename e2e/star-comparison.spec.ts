import { expect, test } from '@playwright/test'
import { openFilter, openPreferences, openSpecs, selectCatalog, selectObject } from './support'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true', { timeout: 15000 })
})

test('Escape clears pointer focus without removing keyboard focus cues', async ({ page }, testInfo) => {
  await openSpecs(page)
  await page.locator('#object-compare-toggle').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('#object-compare-toggle')).not.toBeFocused()
  await expect(page.locator('#object-compare-toggle')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#object-specs')).toBeVisible()
  await page.locator('#selected-object-card').screenshot({ path: testInfo.outputPath('escape-pending.png') })
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Proxima Centauri')
  await page.locator('#object-compare-toggle').focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('#object-compare-toggle')).not.toBeFocused()
  await expect(page.locator('#star-comparison-heading')).toBeVisible()
  await page.locator('#selected-object-card').screenshot({ path: testInfo.outputPath('escape-active.png') })
})

test('arms a comparison without changing the card and cancels it @mobile', async ({ page, isMobile }) => {
  const card = page.locator('#selected-object-card')
  const originalWidth = (await card.boundingBox())!.width
  await page.locator('#object-compare-toggle').click()
  await expect(page.locator('#object-compare-toggle')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#object-compare-toggle')).toHaveCSS('color', 'rgb(240, 128, 128)')
  await expect(page.locator('#object-card-details')).not.toHaveAttribute('open')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
  expect((await card.boundingBox())!.width).toBe(originalWidth)
  await expect(page.locator('#star-comparison-hint')).toContainText('Compare a star against Sirius A.')
  if (isMobile) {
    await expect(page.locator('#comparison-escape')).toBeHidden()
    await page.locator('#object-compare-toggle').click()
  } else {
    await expect(page.locator('#comparison-escape')).toBeVisible()
    await page.mouse.move(900, 420)
    const hint = (await page.locator('#star-comparison-hint').boundingBox())!
    expect(hint.x).toBe(918)
    expect(hint.y).toBe(442)
    await page.keyboard.press('Escape')
  }
  await expect(page.locator('#star-comparison-hint')).toBeHidden()
  await expect(page.locator('#object-compare-toggle')).toHaveAttribute('aria-pressed', 'false')
})

test('previews the hovered comparison star with its icon and resets over empty space', async ({ page }, testInfo) => {
  await page.locator('#object-compare-toggle').click()
  const point = await page.locator('[data-star-id="sun"]').evaluate((anchor) => {
    const rect = anchor.getBoundingClientRect()
    return { x: rect.x, y: rect.y }
  })
  await page.mouse.move(point.x, point.y)
  await expect(page.locator('#star-comparison-hint')).toHaveText('Compare Sun against Sirius A. ESC to abort.')
  await expect(page.locator('#comparison-candidate-icon')).toBeVisible()
  await expect(page.locator('#comparison-hint-icon')).toBeVisible()
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
  await page.locator('#star-comparison-hint').screenshot({ path: testInfo.outputPath('comparison-hover-hint.png') })
  await page.mouse.move(900, 420)
  await expect(page.locator('#star-comparison-hint')).toHaveText('Compare a star against Sirius A. ESC to abort.')
  await expect(page.locator('#comparison-candidate-icon')).toBeHidden()
  await page.mouse.move(point.x, point.y)
  await expect(page.locator('#comparison-candidate-name')).toHaveText('Sun')
  await page.locator('#object-compare-toggle').hover()
  await expect(page.locator('#comparison-candidate-name')).toHaveText('a star')
  await page.keyboard.press('Escape')
  await expect(page.locator('#star-comparison-hint')).toBeHidden()
})

test('chooses an individual comparison member from a multiple system @mobile', async ({ page, isMobile }, testInfo) => {
  await selectObject(page, 'Alpha Centauri A')
  await page.locator('#object-compare-toggle').click()
  const point = await page.locator('.map-anchor[data-star-id="alpha-centauri-a"]').evaluate((anchor) => {
    const rect = anchor.getBoundingClientRect()
    return { x: rect.x, y: rect.y }
  })
  if (isMobile) await page.touchscreen.tap(point.x, point.y)
  else await page.mouse.click(point.x, point.y)
  const picker = page.locator('#star-comparison-members')
  await expect(picker).toBeVisible()
  await expect(page.locator('#star-comparison-hint')).toBeHidden()
  await expect(page.locator('#comparison-system-name')).toHaveText('Alpha Centauri')
  await expect(picker.locator('button')).toHaveText(['Alpha Centauri A', 'Alpha Centauri B', 'Proxima Centauri'])
  await expect(picker.locator('canvas')).toHaveCount(3)
  await expect(picker.getByRole('button', { name: 'Compare Alpha Centauri A', exact: true })).toBeDisabled()
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'alpha-centauri-a')
  const bounds = (await picker.boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(12)
  expect(bounds.y).toBeGreaterThanOrEqual(12)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width - 12)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize()!.height - 12)
  await picker.screenshot({ path: testInfo.outputPath('comparison-system-picker.png') })
  if (isMobile) await picker.getByRole('button', { name: 'Compare Proxima Centauri', exact: true }).click()
  else {
    await page.keyboard.press('End')
    await expect(picker.getByRole('button', { name: 'Compare Proxima Centauri', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
  }
  await expect(picker).toBeHidden()
  await expect(page.locator('#comparison-other-name')).toHaveText('Proxima Centauri')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'alpha-centauri-a')
  await expect(page.locator('.map-anchor.is-selected')).toHaveAttribute('data-star-id', 'alpha-centauri-a')
  await expect(page.locator('#object-compare-toggle')).toHaveAttribute('aria-label', 'Clear comparison')
})

test('dismisses a system picker outside and stays ready for another comparison @mobile', async ({ page, isMobile }) => {
  const tap = async (id: string) => {
    const point = await page.locator(`.map-anchor[data-star-id="${id}"]`).evaluate((anchor) => {
      const rect = anchor.getBoundingClientRect()
      return { x: rect.x, y: rect.y }
    })
    if (isMobile) await page.touchscreen.tap(point.x, point.y)
    else await page.mouse.click(point.x, point.y)
  }
  await page.locator('#object-compare-toggle').click()
  await tap('sirius-a')
  await expect(page.locator('#star-comparison-members')).toBeVisible()
  await tap('sun')
  await expect(page.locator('#star-comparison-members')).toBeHidden()
  await expect(page.locator('#star-comparison-hint')).toBeVisible()
  await expect(page.locator('#star-comparison-heading')).toBeHidden()
  await expect(page.locator('#object-compare-toggle')).toHaveAttribute('aria-label', 'Cancel comparison')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
  await tap('sirius-a')
  await expect(page.locator('#star-comparison-members')).toBeVisible()
  if (isMobile) await page.locator('#object-compare-toggle').click()
  else await page.keyboard.press('Escape')
  await expect(page.locator('#star-comparison-members')).toBeHidden()
  await expect(page.locator('#star-comparison-hint')).toBeHidden()
  if (!isMobile) await expect(page.locator('#object-compare-toggle')).not.toBeFocused()
  await page.locator('#object-compare-toggle').click()
  await tap('sun')
  await expect(page.locator('#comparison-other-name')).toHaveText('Sun')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
})

test('compares once, keeps the main selection and opens details from either column @mobile', async ({ page, isMobile }, testInfo) => {
  await openSpecs(page)
  const originalWidth = (await page.locator('#selected-object-card').boundingBox())!.width
  const originalMass = (await page.locator('#mass').boundingBox())!
  const observer = await page.locator('#visibility-base').textContent()
  if (!isMobile) await page.locator('#mass-toggle').click()
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Proxima Centauri')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
  await expect(page.locator('#visibility-base')).toHaveText(observer!)
  await expect(page.locator('#comparison-main-name')).toHaveText('Sirius A')
  await expect(page.locator('#comparison-other-name')).toHaveText('Proxima Centauri')
  await expect(page.locator('#object-subtypes-count')).toHaveText('3')
  await expect(page.locator('[data-comparison-value="subtypes"]')).toHaveText('3')
  await expect(page.locator('#object-subtypes-empty-row')).toBeHidden()
  await expect(page.locator('#star-comparison-hint')).toBeHidden()
  await expect(page.locator('[data-comparison-value="mass"]')).toHaveText('0.1 M☉')
  await expect(page.locator('[data-comparison-value="distance-toggle"]')).toContainText('4.25 ly')
  expect((await page.locator('#selected-object-card').boundingBox())!.width).toBeGreaterThan(originalWidth)
  if (!isMobile) {
    const mainMass = (await page.locator('#mass').boundingBox())!
    expect(mainMass.x + mainMass.width).toBeLessThan(originalMass.x + originalMass.width)
    const comparisonMass = (await page.locator('[data-comparison-value="mass"]').boundingBox())!
    expect(comparisonMass.x + comparisonMass.width - mainMass.x - mainMass.width).toBeLessThan(120)
    await expect(page.locator('#mass-card')).toBeVisible()
    const selected = (await page.locator('#selected-object-card').boundingBox())!
    const mass = (await page.locator('#mass-card').boundingBox())!
    expect(mass.x).toBeGreaterThanOrEqual(selected.x + selected.width + 10)
    await page.locator('#mass-close').click()
    await page.locator('#mass-toggle').hover()
    expect(await page.locator('[data-comparison-value="mass"]').evaluate((cell) => getComputedStyle(cell.parentElement!, '::before').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
    expect(await page.locator('#mass-toggle').evaluate((button) => getComputedStyle(button.closest('.mass-row')!, '::before').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
    await page.locator('#selected-object-card').screenshot({ path: testInfo.outputPath('comparison-hover.png') })
    await page.locator('#mass-row dt').hover()
    expect(await page.locator('[data-comparison-value="mass"]').evaluate((cell) => getComputedStyle(cell.parentElement!, '::before').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
    await page.locator('[data-comparison-value="mass"]').hover()
    expect(await page.locator('[data-comparison-value="mass"]').evaluate((cell) => getComputedStyle(cell.parentElement!, '::before').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
    expect(await page.locator('#mass-toggle').evaluate((button) => getComputedStyle(button.closest('.mass-row')!, '::before').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
  }
  await page.locator('[data-comparison-value="mass"]').click()
  await expect(page.locator('#mass-card')).toBeVisible()
  await expect(page.locator('#mass-reference-origin')).toHaveText('vs Proxima Centauri')
  await expect(page.locator('#mass-reference-origin')).toHaveAttribute('aria-pressed', 'true')
  await page.locator(isMobile ? '#mass-close' : '#mass-toggle').click()
  await expect(page.locator('#mass-card')).toBeHidden()
  await page.locator('#mass-toggle').click()
  await expect(page.locator('#mass-card')).toBeVisible()
  await expect(page.locator('#mass-heading')).toContainText('Mass')
  await page.locator('#mass-close').click()
  await page.locator('#selected-object-card').screenshot({ path: testInfo.outputPath('comparison.png') })
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 844 })
    const aligned = await page.locator('#magnitude-row').evaluate((row) => {
      const labels = row.querySelectorAll('dt > span')
      const main = row.querySelectorAll('dd:nth-child(2) button > span')
      const compared = row.querySelectorAll('.comparison-value > button > span')
      return [...labels].every((label, index) => Math.abs(label.getBoundingClientRect().top - main[index]!.getBoundingClientRect().top) < 2 && Math.abs(label.getBoundingClientRect().top - compared[index]!.getBoundingClientRect().top) < 2)
    })
    expect(aligned).toBe(true)
    expect(await page.locator('#selected-object-card').evaluate((card) => card.scrollWidth <= card.clientWidth)).toBe(true)
    await page.locator('#selected-object-card').screenshot({ path: testInfo.outputPath('comparison-narrow.png') })
    await page.setViewportSize({ width: 390, height: 844 })
  }
  // A normal next selection ends comparison, with no comparison target in selection history.
  await selectObject(page, 'Sun')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sun')
  await expect(page.locator('#star-comparison-heading')).toBeHidden()
  await page.locator('#selection-back').click()
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
})

test('preserves value formatting, missing fields and distance units for both columns @mobile', async ({ page }) => {
  await selectObject(page, 'Proxima Centauri')
  await openSpecs(page)
  const ids = ['temperature', 'luminosity', 'mass', 'radius', 'metallicity', 'age', 'absolute-mag', 'apparent-mag']
  const baseline = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, document.getElementById(id)!.textContent])), ids)
  await selectObject(page, 'Sun')
  await openSpecs(page)
  await expect(page.locator('#constellation-row')).toBeHidden()
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Proxima Centauri')
  await expect(page.locator('#constellation-row')).toBeVisible()
  await expect(page.locator('[data-comparison-value="constellation"]')).toHaveText('Centaurus')
  for (const id of ids.filter((id) => id !== 'apparent-mag')) {
    const key = `[data-comparison-value="${id}"] ${id === 'age' ? '> span' : '> button > span'}:first-child`
    await expect(page.locator(key)).toHaveText(baseline[id]!)
  }
  await expect(page.locator('[data-comparison-value="absolute-mag"] > button > span:last-child')).toHaveText(baseline['apparent-mag']!)
  await openPreferences(page)
  await page.locator('#unit-pc').check()
  await page.getByRole('button', { name: 'Preferences', exact: true }).click()
  await openSpecs(page)
  await expect(page.locator('#distance-unit')).toHaveText(' pc')
  await expect(page.locator('[data-comparison-value="distance-toggle"]')).toContainText('pc')
  await page.locator('#object-compare-toggle').click()
  await expect(page.locator('#constellation-row')).toBeHidden()
  await expect(page.locator('[data-comparison-value]')).toHaveCount(0)
})

test('allows substellar comparison and disables comparison for nebulae', async ({ page }) => {
  await selectObject(page, 'Luhman 16 A')
  await expect(page.locator('#object-compare-toggle')).toBeEnabled()
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Sun')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'luhman-16-a')
  await expect(page.locator('#comparison-other-name')).toHaveText('Sun')
  await page.locator('#object-compare-toggle').click()
  await openFilter(page)
  await page.getByRole('switch', { name: 'Interstellar medium', exact: true }).check()
  await page.getByLabel('Object visibility distance', { exact: true }).fill('20')
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await selectObject(page, 'Orion Nebula')
  await expect(page.locator('#object-compare-toggle')).toBeDisabled()
})

test('consumes scene picks and component selections without moving the selected star @mobile', async ({ page, isMobile }) => {
  await page.locator('#object-compare-toggle').click()
  const point = await page.locator('[data-star-id="sun"]').evaluate((anchor) => {
    const rect = anchor.getBoundingClientRect()
    return { x: rect.x, y: rect.y }
  })
  if (isMobile) await page.touchscreen.tap(point.x, point.y)
  else await page.mouse.click(point.x, point.y)
  await expect(page.locator('#comparison-other-name')).toHaveText('Sun')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
  await expect(page.locator('.map-anchor.is-selected')).toHaveAttribute('data-star-id', 'sirius-a')
  await expect(page.locator('#mass-card')).toBeHidden()
  await page.locator('#object-compare-toggle').click()
  await page.locator('#object-compare-toggle').click()
  await page.getByRole('button', { name: 'Show Sirius B', exact: true }).click()
  await expect(page.locator('#comparison-other-name')).toHaveText('Sirius B')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
})

test('retains model qualifiers and shows missing main-star infrared data explicitly', async ({ page }) => {
  await selectCatalog(page, 'nearest-100')
  await openSpecs(page)
  await expect(page.locator('#infrared-magnitude-row')).toBeHidden()
  await page.locator('#object-compare-toggle').click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('10pc-0068')
  await page.locator('[data-star="10pc-0068"]').click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
  await expect(page.locator('[data-comparison-value="mass"] > button > span')).toHaveText('10.7–25.8 M♃')
  await expect(page.locator('[data-comparison-value="mass"] > button > small')).toHaveText('Mass (model)')
  await expect(page.locator('[data-comparison-value="temperature"] > button > span')).toHaveText('502–539 K')
  await expect(page.locator('#infrared-magnitude-row')).toBeVisible()
  await expect(page.locator('#infrared-magnitude-row > dd:nth-child(2)')).toHaveText('—')
  await expect(page.locator('[data-comparison-value="infrared-magnitude"] > span')).toHaveText('12.02 ± 0.01')
  await expect(page.locator('[data-comparison-value="infrared-magnitude"] > span')).toHaveAttribute('title', /F480M/)
  await page.locator('#object-compare-toggle').click()
  await expect(page.locator('#infrared-magnitude-row')).toBeHidden()
  await expect(page.locator('#infrared-magnitude')).toHaveText('')
})

test('uses both stars throughout the detail cards @mobile', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openSpecs(page)
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Proxima Centauri')
  const other = (metric: string) => page.locator(`[data-comparison-value="${metric}"] button`)
  await other('distance-toggle').click()
  await expect(page.locator('#distance-comparison')).toHaveAttribute('aria-label', /Sirius A from Sun:.*Proxima Centauri from Sun:.*Shared distance scale/)
  await expect(page.locator('#distance-reference-sun')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#distance-reference-origin')).toBeHidden()
  await page.locator('#distance-card').screenshot({ path: testInfo.outputPath('distance-pair.png') })
  await page.locator('#distance-close').click()
  await other('spectral-type').click()
  await expect(page.locator('#spectral-selected-name')).toHaveText('Sirius A')
  await expect(page.locator('#spectral-reference-name')).toHaveText('Proxima Centauri')
  await page.locator('#spectral-mk').click()
  await expect(page.locator('#mk-diagram svg')).toContainText('Proxima Centauri')
  await page.locator('#spectral-close').click()
  await other('temperature').click()
  await expect(page.locator('#temperature-scale .temperature-marker')).toHaveCount(2)
  await expect(page.locator('#temperature-scale [data-object-id="sun"]')).toHaveCount(0)
  await expect(page.locator('#temperature-spectrum .temperature-spectrum-reference')).toHaveAttribute('data-object-id', 'proxima-centauri')
  await expect(page.locator('.temperature-comparison-tile[data-object-id="sirius-a"][data-metric="ratio"]')).toContainText('Proxima Centauri’s temperature')
  await expect(page.locator('#temperature-spectrum-legend')).not.toContainText('origin')
  await page.locator('#temperature-close').click()
  await other('luminosity').click()
  await expect(page.locator('#luminosity-flux-bar [data-object-id="proxima-centauri"]')).toHaveCount(1)
  await expect(page.locator('#luminosity-flux-sun')).toBeHidden()
  await expect(page.locator('#luminosity-scale')).toHaveAttribute('aria-label', /Sirius A:.*Proxima Centauri:/)
  await expect(page.locator('#luminosity-scale .luminosity-object-marker')).toHaveCount(3)
  await expect(page.locator('#luminosity-class-bar .luminosity-object-marker')).toHaveCount(3)
  await page.locator('#luminosity-card').screenshot({ path: testInfo.outputPath('luminosity-pair.png') })
  await page.locator('#luminosity-close').click()
  await other('mass').click()
  await expect(page.locator('#mass-reference-origin')).toHaveText('vs Proxima Centauri')
  await expect(page.locator('#mass-reference-origin')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('#mass-close').click()
  await other('radius').click()
  await expect(page.locator('#radius-selected-column')).toHaveText('Sirius A')
  await expect(page.locator('#radius-reference-column')).toHaveText('Proxima Centauri')
  await expect(page.locator('#radius-reference-origin')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('#radius-close').click()
  await other('metallicity').click()
  await expect(page.locator('#metallicity-scale')).toHaveAttribute('aria-label', /Sirius A.*Proxima Centauri/)
  await expect(page.locator('#metallicity-marker-value')).toContainText('Sirius A')
  await expect(page.locator('[data-comparison-metallicity]')).toContainText('Proxima Centauri')
  await expect(page.locator('.metallicity-tick-sun .metallicity-tick-dex')).toHaveText('0')
  await page.locator('#metallicity-card').screenshot({ path: testInfo.outputPath('metallicity-pair.png') })
  await page.locator('#metallicity-close').click()
  await other('absolute-mag').click()
  for (const kind of ['absolute', 'apparent']) {
    await expect(page.locator(`#magnitude-${kind}-scale [data-object-id="sirius-a"]`)).toBeVisible()
    await expect(page.locator(`#magnitude-${kind}-scale [data-object-id="proxima-centauri"]`)).toBeVisible()
  }
  await expect(page.locator('#magnitude-absolute-scale [data-object-id="sun"]')).toBeVisible()
  await expect(page.locator('#magnitude-apparent-scale [data-object-id="venus"]')).toBeVisible()
  await page.locator('#magnitude-close').click()
  await page.locator('#object-subtypes-row summary').click()
  await page.locator('#designations-row summary').click()
  for (const id of ['object-subtypes', 'object-designations']) {
    const columns = page.locator(`#${id}`).locator('..').locator(':scope > ul')
    await expect(columns).toHaveCount(2)
    await expect(columns.nth(0)).toHaveAttribute('aria-label', 'Sirius A')
    await expect(columns.nth(1)).toHaveAttribute('aria-label', 'Proxima Centauri')
    const first = (await columns.nth(0).boundingBox())!, second = (await columns.nth(1).boundingBox())!
    expect(Math.abs(first.width - second.width)).toBeLessThan(1)
    expect(second.x).toBeGreaterThan(first.x)
  }
  await page.locator('#selected-object-card').screenshot({ path: testInfo.outputPath('split-details.png') })
  await page.locator('#object-compare-toggle').click()
  await page.locator('#temperature-toggle').click()
  await expect(page.locator('#temperature-spectrum .temperature-spectrum-reference')).toHaveAttribute('data-object-id', 'sun')
  expect(errors).toEqual([])
})

test('pairs six luminosity tiles with compact shared flux and luminosity bars @mobile', async ({ page, isMobile }, testInfo) => {
  await openSpecs(page)
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Proxima Centauri')
  await page.locator('[data-comparison-value="luminosity"] button').click()
  const card = page.locator('#luminosity-card')
  await expect(card.locator('.planet-fact-tile:visible')).toHaveCount(6)
  await expect(card.locator('[data-luminosity-star="selected"]')).toHaveText(['Sirius A', 'Sirius A', 'Sirius A'])
  await expect(card.locator('[data-luminosity-star="comparison"]')).toHaveText(['Proxima Centauri', 'Proxima Centauri', 'Proxima Centauri'])
  await expect(page.locator('#luminosity-comparison-value')).toHaveText('0.00144')
  const tiles = await card.locator('.luminosity-factor').evaluateAll((tiles) => tiles.map((tile) => {
    const name = tile.querySelector('.luminosity-factor-name')!
    const quantity = tile.querySelector<HTMLElement>('.luminosity-factor-quantity')!
    const value = quantity.querySelector('strong, #luminosity-value, #luminosity-comparison-value') ?? quantity
    const text = name.querySelector('span')!.firstChild!
    const wholeWords = [...text.textContent!.matchAll(/\S+/g)].every((word) => {
      const range = document.createRange()
      range.setStart(text, word.index)
      range.setEnd(text, word.index + word[0].length)
      return range.getClientRects().length === 1
    })
    return { top: tile.getBoundingClientRect().top, height: tile.getBoundingClientRect().height,
      nameTop: name.getBoundingClientRect().top, nameBottom: name.getBoundingClientRect().bottom, quantityTop: quantity.getBoundingClientRect().top,
      headerFirst: tile.firstElementChild === name, headerColor: getComputedStyle(name).backgroundColor, wholeWords,
      headingColor: getComputedStyle(document.querySelector('#luminosity-scales-heading')!).backgroundColor,
      font: getComputedStyle(value).fontSize, fits: tile.scrollWidth <= tile.clientWidth }
  }))
  for (let index = 0; index < 3; index++) {
    const primary = tiles[index]!, other = tiles[index + 3]!
    expect(other.top).toBeGreaterThanOrEqual(primary.top + primary.height)
    expect(other.height).toBeLessThan(primary.height * 0.7)
    expect(other.font).toBe(primary.font)
    expect(other.quantityTop - other.nameBottom).toBeLessThanOrEqual(5)
    expect(primary.fits && other.fits).toBe(true)
    for (const tile of [primary, other]) {
      expect(tile.headerFirst).toBe(true)
      expect(tile.nameTop - tile.top).toBeLessThanOrEqual(1)
      expect(tile.headerColor).toBe(tile.headingColor)
      expect(tile.wholeWords).toBe(true)
    }
  }
  await expect(card.locator('.luminosity-comparison-tile .star-swatch')).toHaveCount(3)
  await expect(card.locator('.luminosity-comparison-tile :is(svg, h3, .luminosity-factor-unit)')).toHaveCount(0)
  await expect(card.locator('.luminosity-flux-row:visible')).toHaveCount(0)
  await expect(card.locator('.luminosity-distance-bar')).toHaveCount(1)
  await expect(card.locator('#luminosity-flux-bar [data-planet="Earth"]')).toHaveCount(1)
  await expect(page.locator('#luminosity-calculation-note')).toBeHidden()
  const heading = page.locator('#luminosity-flux-heading button')
  await heading.scrollIntoViewIfNeeded()
  if (isMobile) await heading.tap()
  else await heading.hover()
  await expect(page.locator('#luminosity-flux-tooltip')).toBeVisible()
  await heading.focus()
  await page.keyboard.press('Tab')
  await page.mouse.move(page.viewportSize()!.width - 1, page.viewportSize()!.height - 1)
  await expect(page.locator('#luminosity-scale-value')).toBeHidden()
  await expect(page.locator('#luminosity-scale-selected-label')).toContainText('24.74 L☉')
  await expect(page.locator('#luminosity-scale-reference-label')).toContainText('0.001 L☉')
  await expect(page.locator('#luminosity-scale-sun-label')).toHaveText('Sun1 L☉')
  await expect(page.locator('#luminosity-class-bar-sun-label')).toHaveText('Sun1 L☉')
  await expect(page.locator('#luminosity-flux-bar-selected-label')).toContainText('Sirius A (5.0 AU)')
  await expect(page.locator('#luminosity-flux-bar-selected-label small.luminosity-marker-detail')).toHaveText('33,700 W/m² at 1 AU')
  await expect(page.locator('#luminosity-flux-bar-reference-label')).toContainText('0.038 AU')
  await expect(page.locator('#luminosity-flux-bar-reference-label small.luminosity-marker-detail')).toHaveText('1.96 W/m² at 1 AU')
  await expect(page.locator('#luminosity-class-bar')).toHaveAttribute('aria-label', /Sirius A:.*Proxima Centauri:/)
  for (const id of ['luminosity-flux-bar', 'luminosity-scale', 'luminosity-class-bar']) {
    const bar = page.locator(`#${id}`)
    await expect(bar.locator('.luminosity-object-marker')).toHaveCount(id === 'luminosity-flux-bar' ? 2 : 3)
    await bar.scrollIntoViewIfNeeded()
    const geometry = await bar.evaluate((bar) => {
      const bounds = bar.getBoundingClientRect()
      const labels = [...bar.querySelectorAll<HTMLElement>('.luminosity-plot-label')].map((label) => {
        const marker = label.parentElement!
        const box = label.getBoundingClientRect()
        return { color: getComputedStyle(marker).backgroundColor, lineColor: getComputedStyle(marker, '::after').backgroundColor,
          labelColor: getComputedStyle(label).color, left: box.left, right: box.right, top: box.top, bottom: box.bottom }
      })
      return { left: bounds.left, right: bounds.right, bottom: bounds.bottom, labels }
    })
    for (const label of geometry.labels) {
      expect(label.color).toBe(label.lineColor)
      expect(label.color).toBe(label.labelColor)
      expect(label.left).toBeGreaterThanOrEqual(geometry.left - 1)
      expect(label.right).toBeLessThanOrEqual(geometry.right + 1)
    }
    for (let index = 0; index < geometry.labels.length; index++) for (const other of geometry.labels.slice(index + 1)) {
      const label = geometry.labels[index]!
      expect(label.right <= other.left || other.right <= label.left || label.bottom <= other.top || other.bottom <= label.top).toBe(true)
    }
    expect(geometry.bottom - Math.max(...geometry.labels.map((label) => label.bottom))).toBeLessThan(5)
  }
  const legend = await page.locator('.luminosity-class-heading-row').evaluate((row) => ({
    axisSize: getComputedStyle(document.querySelector('#luminosity-class-low')!).fontSize,
    legendSize: getComputedStyle(row.querySelector('.luminosity-median-legend')!).fontSize,
    color: getComputedStyle(row.querySelector('i')!).backgroundColor,
    tick: getComputedStyle(document.querySelector('.luminosity-class-median')!).backgroundColor,
    beside: row.querySelector('.luminosity-median-legend')!.getBoundingClientRect().left >= row.querySelector('h4')!.getBoundingClientRect().right,
    gap: row.querySelector('.luminosity-median-legend')!.getBoundingClientRect().left - row.querySelector('h4')!.getBoundingClientRect().right,
  }))
  expect(legend.legendSize).toBe(legend.axisSize)
  expect(legend.color).toBe(legend.tick)
  expect(legend.beside).toBe(true)
  expect(legend.gap).toBeLessThanOrEqual(11)
  expect(await card.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await card.screenshot({ path: testInfo.outputPath('luminosity-comparison-scales.png') })
  await card.locator('.card-scroll-content').evaluate((element) => { element.scrollTop = 0 })
  await card.screenshot({ path: testInfo.outputPath('luminosity-comparison-tiles.png') })
  await page.locator('#luminosity-close').click()
  await page.locator('#object-compare-toggle').click()
  await page.locator('#luminosity-toggle').click()
  await expect(card.locator('.planet-fact-tile:visible')).toHaveCount(3)
  await expect(card.locator('.luminosity-factor-name:visible')).toHaveCount(0)
  await expect(page.locator('#luminosity-scale-value')).toBeVisible()
  await expect(page.locator('#luminosity-flux-origin-value')).toBeVisible()
  await expect(card.locator('.luminosity-flux-row:visible .mass-metric-heading')).toHaveText(['Sun', 'Sirius A'])
  await expect(page.locator('#luminosity-class-bar .luminosity-object-marker')).toHaveCount(1)
})

test('keeps L 140-289 flux solar referenced across comparison and origin changes @mobile', async ({ page }, testInfo) => {
  await selectCatalog(page, 'nearest-1000')
  await openSpecs(page)
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'L 140-289')
  await page.locator('[data-comparison-value="luminosity"] button').click()
  const card = page.locator('#luminosity-card')
  const flux = card.locator('#luminosity-flux-bar')
  await expect(flux.locator('[data-object-id="cns5-2404"]')).toContainText('(0.1 AU)')
  await expect(flux).toHaveAttribute('aria-label', /L 140-289: Earth at 0.0713 AU receives 1,360 watts/)
  const distance = await flux.evaluate((bar) => {
    const maximum = Number(document.querySelector('#luminosity-distance-axis-high')!.textContent!.replace(' AU', ''))
    return parseFloat(bar.querySelector<HTMLElement>('[data-object-id="cns5-2404"]')!.style.left) / 100 * maximum
  })
  expect(distance).toBeCloseTo(Math.sqrt(0.00508559976), 3)
  for (const id of ['luminosity-scale', 'luminosity-class-bar']) {
    await expect(card.locator(`#${id} [data-object-id="sun"]`)).toHaveCount(1)
    await expect(card.locator(`#${id} .luminosity-object-marker`)).toHaveCount(3)
  }
  await flux.scrollIntoViewIfNeeded()
  await card.screenshot({ path: testInfo.outputPath('luminosity-l-140-289-flux.png') })
  await page.locator('#luminosity-close').click()
  await page.locator('#comparison-other-select').click()
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'cns5-2404')
  await openSpecs(page)
  await page.locator('#set-origin').click()
  await page.locator('#luminosity-toggle').click()
  await expect(card.locator('#luminosity-flux-origin-distance')).toHaveText('0.0713 AU')
  await expect(card.locator('#luminosity-flux-sun-distance')).toHaveText('1 AU')
  await page.locator('#luminosity-close').click()
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Sun')
  await page.locator('[data-comparison-value="luminosity"] button').click()
  await expect(flux.locator('[data-object-id="cns5-2404"]')).toContainText('(0.1 AU)')
  for (const id of ['luminosity-scale', 'luminosity-class-bar']) {
    await expect(card.locator(`#${id} [data-object-id="sun"]`)).toHaveCount(1)
    await expect(card.locator(`#${id} .luminosity-object-marker`)).toHaveCount(2)
  }
})

test('selects the comparison star and records a normal selection @mobile', async ({ page }) => {
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Proxima Centauri')
  await page.locator('#comparison-other-select').click()
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'proxima-centauri')
  await expect(page.locator('#visibility-base')).toHaveText('Proxima Centauri')
  await expect(page.locator('#object-compare-toggle')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#star-comparison-heading')).toBeHidden()
  await expect(page.locator('[data-comparison-value]')).toHaveCount(0)
  await page.locator('#selection-back').click()
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
})

test('opens type and constellation for the clicked column @mobile', async ({ page, isMobile }) => {
  await selectObject(page, 'Sun')
  await openSpecs(page)
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Sirius B')
  await page.locator('[data-comparison-value="object-type"] button').click()
  await expect(page.locator('#object-type-card')).toHaveAttribute('data-object-type', 'white_dwarf')
  if (isMobile) await page.locator('#object-type-close').click()
  await page.locator('#object-type-toggle').click()
  await expect(page.locator('#object-type-card')).toHaveAttribute('data-object-type', 'star')
  await page.locator('#object-type-close').click()
  await expect(page.locator('#constellation-toggle')).toBeDisabled()
  await page.locator('[data-comparison-value="constellation"] button').click()
  await expect(page.locator('#constellation-heading')).toHaveText('Canis Major')
  await page.locator('#constellation-grid').click()
  await expect(page.locator('#constellation-heading')).toHaveText('Canis Major')
  await page.locator('#constellation-close').click()
  await page.locator('#object-compare-toggle').click()
  await expect(page.locator('#constellation-row')).toBeHidden()
})

test('uses consistent hover bounds and highlights expanded text boxes', async ({ page }, testInfo) => {
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Proxima Centauri')
  const highlight = async (selector: string, pseudo = '::before') => page.locator(selector).evaluate((node, pseudo) => {
    const rect = node.getBoundingClientRect()
    const style = getComputedStyle(node, pseudo)
    return { left: rect.left + parseFloat(style.left), right: rect.right - parseFloat(style.right), top: rect.top + parseFloat(style.top), bottom: rect.bottom - parseFloat(style.bottom), color: style.backgroundColor }
  }, pseudo)
  await page.locator('#comparison-other-select').hover()
  const header = await highlight('#comparison-other-select')
  await page.locator('#mass-toggle').hover()
  const mass = await highlight('#mass-row')
  expect(header.color).toBe(mass.color)
  expect(header.right).toBeCloseTo(mass.right, 1)
  for (const selector of ['#mass-toggle', '#mass-row dt', '[data-comparison-value="mass"]']) {
    await page.locator(selector).hover()
    expect(await highlight('#mass-row')).toEqual(mass)
  }
  const row = (await page.locator('#mass-row').boundingBox())!
  expect(mass.top).toBeCloseTo(row.y - 1, 1)
  expect(mass.bottom).toBeCloseTo(row.y + row.height + 1, 1)
  await page.locator('[data-comparison-value="mass"] button').click()
  await page.mouse.move(1400, 880)
  expect((await highlight('#mass-row')).color).toBe(mass.color)
  await expect(page.locator('[data-comparison-value="mass"] button')).toHaveAttribute('aria-expanded', 'true')
  await page.locator('#selected-object-card').screenshot({ path: testInfo.outputPath('shared-selected-highlight.png') })
  await page.locator('#mass-close').click()
  await page.mouse.move(1400, 880)
  expect((await highlight('#mass-row')).color).toBe('rgba(0, 0, 0, 0)')
  for (const id of ['object-subtypes-row', 'designations-row']) {
    const summary = page.locator(`#${id} summary`)
    await summary.hover()
    expect((await highlight(`#${id} summary`, '::after')).color).toBe(mass.color)
    await summary.click()
    await page.mouse.move(1400, 880)
    expect((await highlight(`#${id} summary`, '::after')).color).toBe(mass.color)
  }
  await page.locator('#selected-object-card').screenshot({ path: testInfo.outputPath('expanded-box-highlights.png') })
})

test('keeps type and constellation highlights on the selected side, sharing matching values @mobile', async ({ page, isMobile }) => {
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Proxima Centauri')
  const moveAway = () => page.mouse.move(page.viewportSize()!.width - 2, page.viewportSize()!.height - 2)
  const colors = (selector: string) => page.locator(selector).evaluate((row) => ({ left: getComputedStyle(row, '::before').backgroundColor, right: getComputedStyle(row, '::after').backgroundColor }))
  for (const metric of ['object-type', 'constellation'] as const) {
    const row = metric === 'object-type' ? '.object-type-row' : '#constellation-row'
    await page.locator(`#${metric}-toggle`).click()
    await moveAway()
    expect((await colors(row)).left).not.toBe('rgba(0, 0, 0, 0)')
    expect((await colors(row)).right).toBe('rgba(0, 0, 0, 0)')
    await expect(page.locator(`[data-comparison-value="${metric}"] button`)).toHaveAttribute('aria-expanded', 'false')
    if (isMobile) await page.locator(`#${metric}-close`).click()
    await page.locator(`[data-comparison-value="${metric}"] button`).click()
    await moveAway()
    expect((await colors(row)).left).toBe('rgba(0, 0, 0, 0)')
    expect((await colors(row)).right).not.toBe('rgba(0, 0, 0, 0)')
    await expect(page.locator(`#${metric}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator(`[data-comparison-value="${metric}"] button`)).toHaveAttribute('aria-expanded', 'true')
    await page.locator(`#${metric}-close`).click()
    await moveAway()
    expect(await colors(row)).toEqual({ left: 'rgba(0, 0, 0, 0)', right: 'rgba(0, 0, 0, 0)' })
  }
  await page.locator('#object-compare-toggle').click()
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Sirius B')
  await page.locator('[data-comparison-value="constellation"] button').click()
  await expect(page.locator('#constellation-toggle')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('[data-comparison-value="constellation"] button')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#constellation-row')).toHaveAttribute('data-comparison-active', 'both')
  expect(await page.locator('#constellation-row').evaluate((row) => getComputedStyle(row, '::before').right)).toBe('-8px')
  await page.locator('#constellation-close').click()
  await selectObject(page, 'Sun')
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Alpha Centauri A')
  await page.locator('[data-comparison-value="object-type"] button').click()
  await expect(page.locator('#object-type-toggle')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('[data-comparison-value="object-type"] button')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.object-type-row')).toHaveAttribute('data-comparison-active', 'both')
})

test('pairs distance labels with star names and stacks named alternate-unit rows @mobile', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    type Draw = { text: string; x: number; y: number; color: string; align: string }
    const calls: Draw[] = []
    ;(window as unknown as { distanceText: Draw[] }).distanceText = calls
    const active = new WeakSet<HTMLCanvasElement>()
    const proto = CanvasRenderingContext2D.prototype
    const fillRect = proto.fillRect, fillText = proto.fillText
    proto.fillRect = function (x, y, width, height) {
      if (x === 0 && y === 0 && width === 560 && height === 232) { active.add(this.canvas); calls.length = 0 }
      fillRect.call(this, x, y, width, height)
    }
    proto.fillText = function (text, x, y, maxWidth) {
      if (active.has(this.canvas)) calls.push({ text, x, y, color: String(this.fillStyle), align: this.textAlign })
      if (maxWidth === undefined) fillText.call(this, text, x, y)
      else fillText.call(this, text, x, y, maxWidth)
    }
  })
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Proxima Centauri')
  await page.locator('[data-comparison-value="distance-toggle"] button').click()
  await expect(page.locator('#distance-comparison')).toHaveAttribute('aria-label', /Proxima Centauri from Sun/)
  const draws = await page.evaluate(() => (window as unknown as { distanceText: { text: string; x: number; y: number; color: string; align: string }[] }).distanceText)
  for (const name of ['Sirius A', 'Proxima Centauri']) {
    const labels = draws.flatMap((draw, index) => draw.text === name && draw.align === 'left' ? [{ name: draw, value: draws[index + 1]! }] : [])
    expect(labels).toHaveLength(2)
    for (const pair of labels) {
      expect(pair.value.text).toMatch(/ ly$/)
      expect(pair.value.x).toBe(pair.name.x)
      expect(pair.value.y).toBeGreaterThan(pair.name.y)
      expect(pair.value.y - pair.name.y).toBeLessThan(20)
      expect(pair.value.color).toBe(pair.name.color)
    }
    const footers = draws.flatMap((draw, index) => draw.text === name && draw.align === 'right' ? [{ name: draw, value: draws[index + 1]! }] : [])
    expect(footers).toHaveLength(2)
    for (const pair of footers) {
      expect(pair.value.text).toMatch(/ pc$/)
      expect(pair.name.x).toBeLessThan(pair.value.x)
      expect(pair.name.y).toBe(pair.value.y)
      expect(pair.value.color).toBe(pair.name.color)
    }
  }
  for (const pane of [0, 1]) {
    const rows = draws.filter((draw) => draw.align === 'right' && draw.text.endsWith(' pc') && Math.floor(draw.x / 280) === pane)
    expect(rows).toHaveLength(2)
    expect(rows[1]!.y).toBeGreaterThan(rows[0]!.y)
  }
  await page.locator('#distance-card').screenshot({ path: testInfo.outputPath('named-distance-labels.png') })
})

test('pairs temperature, appearance and reciprocal ratios in stable left and right columns @mobile', async ({ page, isMobile }, testInfo) => {
  await page.locator('#object-compare-toggle').click()
  await selectObject(page, 'Proxima Centauri')
  await page.locator('[data-comparison-value="temperature"] button').click()
  const tile = (id: string, metric: string) => page.locator(`.temperature-comparison-tile[data-object-id="${id}"][data-metric="${metric}"]`)
  await expect(page.locator('#temperature-card .temperature-comparison-tile')).toHaveCount(6)
  await expect(page.locator('#temperature-scale [data-selected="true"]')).toHaveText('Sirius A · 9,845 K')
  await expect(page.locator('#temperature-scale [data-selected="true"] > span')).toHaveCSS('font-weight', '600')
  await expect(tile('sirius-a', 'temperature').locator('dd')).toHaveText('9,845 K')
  await expect(tile('proxima-centauri', 'temperature').locator('dd')).toHaveText('2,930 K')
  await expect(tile('sirius-a', 'appearance').locator('dd')).toHaveText('Blue-white appearance')
  await expect(tile('proxima-centauri', 'appearance').locator('dd')).toHaveText('Orange-red appearance')
  await expect(tile('sirius-a', 'ratio').locator('dd')).toHaveText('3.36× Proxima Centauri’s temperature')
  await expect(tile('proxima-centauri', 'ratio').locator('dd')).toHaveText('0.298× Sirius A’s temperature')
  await expect(page.locator('#temperature-celsius')).toBeHidden()
  await expect(page.locator('#temperature-fahrenheit')).toBeHidden()
  const checkColumns = async () => {
    const layout = await page.locator('#temperature-card').evaluate((card) => {
      const tiles = [...card.querySelectorAll<HTMLElement>('.temperature-comparison-tile')]
      return {
        overflow: card.scrollWidth > card.clientWidth + 1,
        entries: tiles.map((tile) => ({ id: tile.dataset.objectId, metric: tile.dataset.metric, bounds: tile.getBoundingClientRect(), name: tile.querySelector('dt > span:not(.sr-only)')!.textContent,
          heading: tile.querySelector('dt')!.getBoundingClientRect(), icon: tile.querySelector('.star-swatch')!.getBoundingClientRect(), value: tile.querySelector('dd')!.getBoundingClientRect(), overflow: tile.scrollWidth > tile.clientWidth + 1 })),
      }
    })
    expect(layout.overflow).toBe(false)
    for (const metric of ['temperature', 'appearance', 'ratio']) {
      const main = layout.entries.find((entry) => entry.id === 'sirius-a' && entry.metric === metric)!
      const other = layout.entries.find((entry) => entry.id === 'proxima-centauri' && entry.metric === metric)!
      expect(main.name).toBe('Sirius A')
      expect(other.name).toBe('Proxima Centauri')
      expect(main.bounds.right).toBeLessThan(other.bounds.left)
      expect(main.bounds.width).toBeCloseTo(other.bounds.width, 0)
      expect(main.value.top).toBeCloseTo(other.value.top, 0)
      for (const entry of [main, other]) {
        expect(entry.heading.bottom).toBeLessThanOrEqual(entry.value.top)
        expect(entry.icon.height).toBe(20)
        expect(entry.overflow).toBe(false)
      }
    }
  }
  await checkColumns()
  await page.locator('#temperature-card').screenshot({ path: testInfo.outputPath('paired-temperature.png') })
  await page.locator('#temperature-comparison-facts').scrollIntoViewIfNeeded()
  await page.locator('#temperature-card').screenshot({ path: testInfo.outputPath('paired-temperature-facts.png') })
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 844 })
    await checkColumns()
    await page.locator('#temperature-card .card-scroll-content').evaluate((node) => { node.scrollTop = 0 })
    await page.locator('#temperature-card').screenshot({ path: testInfo.outputPath('paired-temperature-narrow.png') })
    await page.locator('#temperature-comparison-facts').scrollIntoViewIfNeeded()
    await page.locator('#temperature-card').screenshot({ path: testInfo.outputPath('paired-temperature-facts-narrow.png') })
    await page.setViewportSize({ width: 390, height: 844 })
  }
  await page.locator('#temperature-close').click()
  await page.locator('#object-compare-toggle').click()
  await page.locator('#temperature-toggle').click()
  await expect(page.locator('.temperature-overview')).toBeVisible()
  await expect(page.locator('#temperature-celsius')).toBeVisible()
  await expect(page.locator('#temperature-fahrenheit')).toBeVisible()
  await expect(page.locator('.temperature-comparison-tile')).toHaveCount(0)
})

test('clears a retained header focus when cancelling pointer comparison with Escape @mobile', async ({ page }, testInfo) => {
  await openSpecs(page)
  const summary = page.locator('#object-card-details > summary')
  await page.locator('#object-compare-toggle').click()
  // Some browsers leave focus on this enclosing summary after its button is clicked.
  await summary.focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('#object-compare-toggle')).toHaveAttribute('aria-pressed', 'false')
  await expect(summary).not.toBeFocused()
  await expect(page.locator('#selected-object-card :focus-visible')).toHaveCount(0)
  await expect(page.locator('#object-specs')).toBeVisible()
  expect(await summary.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe('none')
  await page.locator('#selected-object-card').screenshot({ path: testInfo.outputPath('escape-no-header-line.png') })
  await page.locator('#object-compare-toggle').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#object-compare-toggle')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(page.locator('#object-compare-toggle')).toBeFocused()
  await expect(page.locator('#object-compare-toggle')).toHaveAttribute('aria-pressed', 'false')
  expect(await page.locator('#object-compare-toggle').evaluate((node) => node.matches(':focus-visible'))).toBe(true)
})

test('keeps a comparison star with no individual temperature explicitly unavailable', async ({ page }) => {
  await selectCatalog(page, 'nearest-100')
  await openSpecs(page)
  await page.locator('#object-compare-toggle').click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('10pc-0068')
  await page.locator('[data-star="10pc-0068"]').click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.locator('[data-comparison-value="temperature"] button').click()
  await expect(page.locator('.temperature-comparison-tile[data-object-id="10pc-0068"][data-metric="temperature"] dd')).toHaveText('—Individual temperature unavailable.')
  for (const metric of ['appearance', 'ratio']) {
    await expect(page.locator(`.temperature-comparison-tile[data-object-id="10pc-0068"][data-metric="${metric}"] dd`)).toHaveText('—')
  }
  await expect(page.locator('.temperature-comparison-tile[data-object-id="sirius-a"][data-metric="ratio"] dd')).toHaveText('—')
})
