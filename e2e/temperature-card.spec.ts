import { expect, test, type Page } from '@playwright/test'
import { openSpecs } from './support'

async function select(page: Page, name: string) {
  if (await page.locator('#temperature-card').isVisible()) await page.locator('#temperature-close').click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill(name)
  await page.getByRole('button', { name: `Select ${name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await openSpecs(page)
}

test('shows the selected temperature, spectrum and compact context with normal card controls', { tag: '@mobile' }, async ({ page, isMobile }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await openSpecs(page)
  await page.locator('#temperature-row dt').click()
  const card = page.locator('#temperature-card')
  await expect(card).toBeVisible()
  await expect(page.locator('#temperature-value')).toHaveText('9,845 K')
  await expect(page.locator('#temperature-object-name')).toHaveCount(0)
  await expect(page.locator('#temperature-scale [data-selected="true"]')).toHaveText('Sirius A')
  await expect(page.locator('#temperature-celsius')).toHaveText('9,572 °C')
  await expect(page.locator('#temperature-fahrenheit')).toHaveText('17,261 °F')
  await expect(page.locator('#temperature-appearance')).toHaveText('Blue-white appearance')
  await expect(page.locator('#temperature-solar-ratio')).toHaveText('1.71× Sun’s temperature')
  await expect(card.locator('.temperature-facts .planet-fact-tile')).toHaveCount(2)
  await expect(page.locator('#temperature-scale')).toHaveAttribute('aria-label', /Sirius A, selected: 9,845 K.*Sun, origin: 5,772 K/)
  await expect(page.locator('.temperature-classes')).toHaveText('MKGFABO')
  await expect(page.locator('#temperature-spectrum svg')).toHaveAttribute('aria-label', /Peak 294 nanometers in UV/)
  await expect(page.locator('#temperature-spectrum .temperature-spectrum-reference')).toHaveAttribute('data-object-id', 'sun')
  await expect(page.locator('#temperature-spectrum-legend')).toHaveText('Sirius A, peak 294 nmSun, peak 502 nm')
  await expect(page.locator('#temperature-spectrum circle, #temperature-spectrum .temperature-peak-label, #temperature-spectrum .temperature-peak-line')).toHaveCount(0)
  await expect(page.locator('#temperature-spectrum-heading svg')).toHaveCount(0)
  const layout = await card.evaluate((root) => {
    const scale = root.querySelector('#temperature-scale')!.getBoundingClientRect()
    const labels = [...root.querySelectorAll<HTMLElement>('.temperature-marker > span')].map((node) => node.getBoundingClientRect())
    const legendEntries = [...root.querySelectorAll('.temperature-spectrum-key')].map((key) => {
      const range = document.createRange()
      range.selectNodeContents(key.querySelector('span')!)
      return { key: key.getBoundingClientRect(), text: range.getBoundingClientRect() }
    })
    return {
      // Allow the one-pixel difference from the card's rounded border geometry.
      overflow: root.scrollWidth > root.clientWidth + 1,
      barHeight: root.querySelector('.temperature-track')!.getBoundingClientRect().height,
      valueSize: parseFloat(getComputedStyle(root.querySelector('#temperature-value')!).fontSize),
      iconMatchesValue: getComputedStyle(root.querySelector('#temperature-value-icon')!).color === getComputedStyle(root.querySelector('#temperature-value')!).color,
      tileSpacing: [...root.querySelectorAll('.temperature-facts .planet-fact-tile')].map((tile) => tile.querySelector('dd')!.getBoundingClientRect().left - tile.querySelector('.planet-fact-icon')!.getBoundingClientRect().right),
      tileAlignment: [...root.querySelectorAll('.temperature-facts .planet-fact-tile')].every((tile) => {
        const value = tile.querySelector('dd')!.getBoundingClientRect()
        const icon = tile.querySelector('.planet-fact-icon')!.getBoundingClientRect()
        return Math.abs(value.top + value.height / 2 - icon.top - icon.height / 2) < 1
      }),
      legendLabelsFit: [...root.querySelectorAll('.temperature-spectrum-key > span')].every((label) => label.getBoundingClientRect().height < 20),
      legendClearance: legendEntries.every(({ key, text }, index) => text.right <= key.right + 1 && legendEntries.slice(index + 1).every((other) => Math.abs(other.key.top - key.top) > 1 || other.key.left - text.right >= 12)),
      selectedPosition: parseFloat((root.querySelector('[data-selected="true"]') as HTMLElement).style.left),
      badLabels: labels.some((label, index) => label.left < scale.left - 2 || label.right > scale.right + 2 || labels.slice(index + 1).some((other) => label.left < other.right && label.right > other.left && label.top < other.bottom && label.bottom > other.top)),
    }
  })
  expect(layout.overflow).toBe(false)
  expect(layout.barHeight).toBe(6)
  expect(layout.valueSize).toBe(28)
  expect(layout.iconMatchesValue).toBe(true)
  expect(layout.tileSpacing.every((gap) => gap >= 8)).toBe(true)
  expect(layout.tileAlignment).toBe(true)
  expect(layout.legendLabelsFit).toBe(true)
  expect(layout.legendClearance).toBe(true)
  expect(layout.selectedPosition).toBeCloseTo(Math.log(9845 / 2400) / Math.log(30000 / 2400) * 100, 3)
  expect(layout.badLabels).toBe(false)
  await page.screenshot({ path: testInfo.outputPath('temperature-card.png') })
  await card.screenshot({ path: testInfo.outputPath('temperature-detail.png') })
  const lock = page.getByRole('button', { name: 'Keep Temperature open', exact: true })
  await expect(lock).toHaveAttribute('aria-pressed', 'false')
  const lockBounds = (await lock.boundingBox())!
  const closeBounds = (await page.locator('#temperature-close').boundingBox())!
  expect(lockBounds.x + lockBounds.width).toBeLessThanOrEqual(closeBounds.x + 1)
  const viewport = page.viewportSize()!
  const scenePoint = { x: viewport.width / 2, y: viewport.height - 4 }
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, scenePoint)).toBe('CANVAS')
  const dragScene = async () => {
    await page.mouse.move(scenePoint.x, scenePoint.y)
    await page.mouse.down()
    await page.mouse.move(scenePoint.x + 18, scenePoint.y, { steps: 3 })
    await page.mouse.up()
  }
  await lock.click()
  await expect(lock).toHaveAttribute('aria-pressed', 'true')
  await dragScene()
  await expect(card).toBeVisible()
  await lock.click()
  await expect(lock).toHaveAttribute('aria-pressed', 'false')
  await dragScene()
  await expect(card).toBeHidden()
  await openSpecs(page)
  await page.locator('#temperature-toggle').click()
  await card.locator('.card-scroll-content').evaluate((node) => { node.scrollTop = node.scrollHeight })
  await page.locator('#temperature-close').click()
  await expect(page.locator('#temperature-toggle')).toBeFocused()
  await page.locator('#temperature-toggle').press('Enter')
  await expect(card).toBeVisible()
  expect(await card.locator('.card-scroll-content').evaluate((node) => node.scrollTop)).toBe(0)
  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()
  await expect(page.locator('#temperature-toggle')).toBeFocused()
  await page.locator('#luminosity-toggle').click()
  await expect(page.locator('#luminosity-card')).toBeVisible()
  const headingStyle = await page.evaluate(() => ['temperature-spectrum-heading', 'luminosity-flux-heading'].map((id) => {
    const style = getComputedStyle(document.getElementById(id)!)
    return [style.fontSize, style.fontWeight, style.backgroundColor, style.borderTop, style.padding]
  }))
  expect(headingStyle[0]).toEqual(headingStyle[1])
  if (isMobile) await page.locator('#luminosity-close').click()
  await page.locator('#temperature-toggle').click()
  await expect(page.locator('#luminosity-card')).toBeHidden()
  await expect(card).toBeVisible()
  if (!isMobile) {
    await page.locator('#luminosity-toggle').click()
    await expect(card).toBeHidden()
    await expect(page.locator('#luminosity-card')).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('compares a non-Sun origin, merges roles and suppresses the origin when the Sun is selected', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await openSpecs(page)
  await page.locator('#set-origin').click()
  await page.locator('#temperature-toggle').click()
  await expect(page.locator('#temperature-scale .temperature-marker')).toHaveCount(2)
  await expect(page.locator('#temperature-scale [data-origin="true"]')).toHaveText('Sirius A · origin')
  await expect(page.locator('#temperature-spectrum .temperature-spectrum-reference')).toHaveAttribute('data-object-id', 'sun')
  await select(page, 'Sun')
  await page.locator('#temperature-toggle').click()
  await expect(page.locator('#temperature-value')).toHaveText('5,772 K')
  await expect(page.locator('#temperature-scale .temperature-marker')).toHaveCount(1)
  await expect(page.locator('#temperature-scale [data-origin="true"]')).toHaveCount(0)
  await expect(page.locator('#temperature-appearance')).toHaveText('Warm-white appearance')
  await expect(page.locator('#temperature-spectrum .temperature-spectrum-reference')).toHaveAttribute('data-object-id', 'sirius-a')
  await select(page, 'Sirius B')
  await page.getByRole('button', { name: 'Show Sirius B', exact: true }).click()
  await page.locator('#temperature-toggle').click()
  await expect(page.locator('#temperature-scale .temperature-marker')).toHaveCount(3)
  await expect(page.locator('#temperature-scale [data-origin="true"]')).toContainText('Sirius A · origin')
  await expect(page.locator('#temperature-spectrum .temperature-spectrum-reference')).toHaveAttribute('data-object-id', 'sirius-a')
  await expect(page.locator('#temperature-spectrum-legend')).toHaveText('Sirius B, peak 114 nmSirius A · origin, peak 294 nm')
  await page.screenshot({ path: testInfo.outputPath('temperature-origin-comparison.png') })
})
