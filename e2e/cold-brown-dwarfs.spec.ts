import { expect, test } from '@playwright/test'
import { openSpecs, selectCatalog } from './support'

test('cold brown dwarfs retain sourced model ranges and the adopted 2023 velocity @mobile', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  const objects = page.getByRole('button', { name: 'Objects', exact: true })
  for (const catalog of ['nearest-100', 'nearest-1000']) {
    await selectCatalog(page, catalog)
    await expect(page.locator('#scene-status')).toBeHidden()
    for (const id of ['10pc-0068', '10pc-0084', '10pc-0068']) {
      if (await objects.getAttribute('aria-expanded') === 'false') await objects.click()
      await page.getByLabel('Search objects').fill(id)
      await page.locator(`[data-star="${id}"]`).click()
      if (await objects.getAttribute('aria-expanded') === 'true') await objects.click()
      await openSpecs(page)
      if (id === '10pc-0068') {
        await expect(page.locator('#temperature')).toHaveText('502–539 K')
        await expect(page.locator('#mass')).toHaveText('10.7–25.8 M♃')
        await expect(page.locator('#radius')).toHaveText('0.886–1.019 R♃')
        for (const metric of ['temperature', 'mass', 'radius']) {
          await expect(page.locator(`#${metric}-toggle`)).toBeDisabled()
        }
        await page.locator('#temperature-row').focus()
        await expect(page.locator('#temperature-source-tooltip')).toBeVisible()
        await expect(page.locator('#temperature-source-tooltip')).toContainText('assumed ages of 1 and 5 Gyr')
        const bounds = await page.locator('#temperature-source-tooltip').boundingBox()
        const rowBounds = await page.locator('#temperature-row').boundingBox()
        expect(bounds!.y).toBeGreaterThan(rowBounds!.y + rowBounds!.height)
        expect(bounds!.y + bounds!.height).toBeLessThan(page.viewportSize()!.height)
        await page.screenshot({ path: testInfo.outputPath(`${catalog}-${id}-range-tooltip.png`) })
        await expect(page.locator('#infrared-magnitude')).toHaveText('12.016 ± 0.011')
      } else {
        await expect(page.locator('#temperature')).toHaveText('361 K')
        await expect(page.locator('#mass')).toHaveText('0.012 M☉')
        await expect(page.locator('#radius')).toHaveText('0.099 R☉')
        await expect(page.locator('#temperature-toggle')).toBeEnabled()
        await expect(page.locator('#temperature-source-tooltip')).toBeHidden()
        await expect(page.locator('#mass')).not.toHaveAttribute('aria-label')
        await expect(page.locator('#infrared-magnitude')).toHaveText('13.487 ± 0.005')
      }
      await expect(page.locator('#infrared-magnitude-label')).toHaveText('Apparent mag. (F480M)')
      await expect(page.locator('#age')).toHaveText('—')
      await expect(page.locator('#apparent-mag')).toHaveText('—')
      await expect(page.locator('#magnitude-toggle')).toBeDisabled()
      const sourceDetails = page.locator('#object-specs .source-details')
      if (await sourceDetails.getAttribute('open') === null) await sourceDetails.locator('summary').click()
      if (id === '10pc-0068') {
        await expect(page.locator('#radial-velocity')).toHaveText('35.8 ± 0.16 km/s')
        await expect(page.locator('#motion-data')).toHaveText('Full space motion')
        await expect(page.locator('#star-notes')).toContainText('46.9 +/- 2.5')
        await expect(page.locator('#star-notes')).toContainText('https://arxiv.org/abs/1109.2897')
      } else {
        await expect(page.locator('#radial-velocity')).toHaveText('—')
        await expect(page.locator('#motion-data')).toHaveText('Transverse only; radial velocity unavailable')
        await expect(page.locator('#star-notes')).toContainText('5 +/- 3 Gyr')
      }
      await page.locator('#temperature-row').scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`${catalog}-${id}-specs.png`) })
      if (await page.locator('#object-info-toggle').getAttribute('aria-expanded') === 'false') {
        await page.locator('#object-info-toggle').click()
      }
      if (id === '10pc-0068') {
        await expect(page.locator('#object-info')).toContainText('Sources: earlier velocity analysis')
        await expect(page.locator('#object-info')).toContainText('46.9 ± 2.5')
        await expect(page.locator('#object-info a[href="https://arxiv.org/abs/2303.04885"]')).toBeVisible()
        await expect(page.locator('#object-info a[href="https://arxiv.org/abs/1109.2897"]')).toBeVisible()
      } else {
        await expect(page.locator('#object-info')).toContainText('not a measured age')
      }
      await page.locator('#object-info').scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`${catalog}-${id}-info.png`) })
      await page.locator('#object-specs-toggle').click()
    }
  }
  expect(errors).toEqual([])
})
