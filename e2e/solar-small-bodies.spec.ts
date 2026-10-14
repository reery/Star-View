import { expect, test, type Page } from '@playwright/test'

async function openSun(page: Page) {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  const objects = page.getByRole('button', { name: 'Objects', exact: true })
  if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
  await page.getByLabel('Search objects').fill('Sun')
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.locator('#object-system-toggle').click()
}

test('Sun disclosures cover all small bodies and only the selected extra orbit', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openSun(page)
  const system = page.locator('#object-system')
  const asteroids = system.locator('[data-body-group="asteroid-belt"]')
  const dwarfs = system.locator('[data-body-group="dwarf-planets"]')
  await expect(asteroids).not.toHaveAttribute('open')
  await expect(dwarfs).not.toHaveAttribute('open')
  await expect(system.locator('[data-orbit-id]')).toHaveCount(8)
  await page.locator('#selected-object-card').screenshot({ path: testInfo.outputPath('sun-system-groups.png') })
  await asteroids.locator('summary').click()
  await dwarfs.locator('summary').click()
  await expect(asteroids.locator('.planet-row dt')).toHaveText(['Ceres', 'Vesta', 'Pallas', 'Hygiea'])
  await expect(dwarfs.locator('.planet-row dt')).toHaveText(['Pluto', 'Eris', 'Haumea', 'Makemake', 'Gonggong', 'Quaoar', 'Orcus', 'Sedna', 'Salacia', 'Máni', 'Aya', 'Varda', 'Chiminigagua', 'Achlys'])
  const ids = ['ceres','vesta','pallas','hygiea','pluto','eris','haumea','makemake','gonggong','quaoar','orcus','sedna','salacia','mani','aya','varda','chiminigagua','achlys']
  const moonless = new Set(['ceres','vesta','pallas','hygiea','sedna','aya'])
  for (const id of ids) {
    await system.locator(`.planet-row[data-planet-id="${id}"] button`).click()
    const card = page.locator('#planet-card')
    await expect(card).toHaveAttribute('data-planet-id', id)
    await expect(system.locator('[data-orbit-id]')).toHaveCount(9)
    await expect(system.locator(`[data-orbit-id="${id}"]`)).toHaveClass(/is-highlighted/)
    await expect(card).not.toContainText(/NaN|undefined|Infinity/)
    const radiusRatio = card.locator('[data-planet-spec="mean-radius"] .planet-ratio-row')
    await expect(radiusRatio.locator('.planet-ratio-value')).not.toHaveText('1×')
    if (id === 'ceres') {
      await expect(radiusRatio).toHaveAttribute('aria-label', '0.0737× Earth')
      await expect(card.locator('[data-planet-spec="mass"] .planet-ratio-value')).toHaveText('0.000157×')
    }
    if (id === 'pluto') {
      await expect(radiusRatio).toHaveAttribute('aria-label', '0.187× Earth')
      await expect(card.locator('[data-planet-spec="mass"] .planet-ratio-value')).toHaveText('0.00218×')
      await expect(page.locator('#planet-globe')).toHaveAttribute('data-texture-ready', 'true')
      await expect(page.locator('#planet-globe')).toHaveAttribute('aria-label', /unobserved southern cap/)
      await card.screenshot({ path: testInfo.outputPath('pluto-specs.png') })
    } else {
      await expect(page.locator('#planet-image')).toBeVisible()
      await expect(page.locator('#planet-image')).toHaveJSProperty('complete', true)
      expect(await page.locator('#planet-image').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
      if (id === 'ceres') await card.screenshot({ path: testInfo.outputPath('ceres-specs.png') })
    }
    if (moonless.has(id)) await expect(page.locator('#planet-moons-toggle')).toBeHidden()
    else {
      await page.locator('#planet-moons-toggle').click()
      await expect(page.locator('#planet-moons .moon-row')).not.toHaveCount(0)
      await expect(page.locator('#planet-moons')).not.toContainText(/NaN|undefined|Infinity/)
    }
    await page.locator('#planet-info-toggle').click()
    await expect(page.locator('#planet-info > section')).toHaveCount(3)
    if (id === 'sedna') await card.screenshot({ path: testInfo.outputPath('sedna-info.png') })
    await page.keyboard.press('Escape')
    await expect(system.locator('[data-orbit-id]')).toHaveCount(8)
  }
  await system.locator('.planet-row[data-planet-id="ceres"] button').click()
  await system.locator('.planet-row[data-planet-id="vesta"] button').click()
  await expect(system.locator('[data-orbit-id]')).toHaveCount(9)
  await expect(system.locator('[data-orbit-id="ceres"]')).toHaveCount(0)
  await expect(system.locator('[data-orbit-id="vesta"]')).toHaveCount(1)
  await page.keyboard.press('Escape')
  // Return to the original planet path after photo, globe and moon switching.
  await system.locator('.planet-row[data-planet-id="earth"] button').click()
  await expect(page.locator('#planet-globe')).toBeVisible()
  await expect(page.locator('#planet-image')).toBeHidden()
  await expect(page.locator('[data-planet-spec="mean-radius"] .planet-ratio-value')).toHaveText('1×')
  await expect(system.locator('[data-orbit-id]')).toHaveCount(8)
  expect(errors).toEqual([])
})

test('small-body disclosures and moon selection fit a narrow screen', { tag: '@mobile' }, async ({ page }, testInfo) => {
  await openSun(page)
  await page.locator('[data-body-group="dwarf-planets"] summary').click()
  await page.locator('.planet-row[data-planet-id="pluto"] button').click()
  await page.locator('#planet-moons-toggle').click()
  await expect(page.locator('#planet-moons .moon-row dt')).toHaveText(['Charon','Styx','Nix','Kerberos','Hydra'])
  await page.locator('.moon-row[data-moon-id="nix"] button').click()
  await expect(page.locator('#planet-moon-image')).toBeVisible()
  await expect(page.locator('#planet-moons')).toHaveAttribute('data-selected-moon-id', 'nix')
  await page.locator('#planet-card').screenshot({ path: testInfo.outputPath('pluto-moons.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
