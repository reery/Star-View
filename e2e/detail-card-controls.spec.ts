import { expect, test, type Locator } from '@playwright/test'
import { openSpecs, openViewer } from './support'

test('aligns close and lock controls on every selected-object detail card', { tag: '@mobile' }, async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openViewer(page)
  await openSpecs(page)

  const interactWithScene = async () => {
    const { width, height } = page.viewportSize()!
    await page.mouse.move(width - 4, height / 2)
    await page.mouse.down()
    await page.mouse.move(width - 14, height / 2 + 10, { steps: 2 })
    await page.mouse.up()
  }

  const checkCard = async (name: string, toggle: Locator) => {
    await toggle.click()
    const card = page.locator(`#${name}-card`)
    const lock = page.locator(`#${name}-lock`)
    const close = page.locator(`#${name}-close`)
    await expect(card).toBeVisible()
    await expect(lock).toHaveAttribute('aria-pressed', 'false')
    const geometry = await card.evaluate((element) => {
      const heading = element.querySelector<HTMLElement>('.panel-heading')!
      const buttons = [...heading.querySelectorAll<HTMLButtonElement>(':scope > .panel-lock')]
      const [lock, close] = buttons.slice(-2).map((button) => button.getBoundingClientRect())
      const bounds = element.getBoundingClientRect()
      const title = heading.querySelector('h2')!.getBoundingClientRect()
      const group = heading.querySelector('[role="group"]')?.getBoundingClientRect()
      return {
        rightInset: bounds.right - close!.right,
        topInset: close!.top - bounds.top,
        gap: close!.left - lock!.right,
        titleRight: title.right,
        groupRight: group?.right,
        groupTop: group?.top,
        lockLeft: lock!.left,
        lockBottom: lock!.bottom,
        clippedTabs: [...heading.querySelectorAll<HTMLButtonElement>('[role="group"] > button:not([hidden])')]
          .filter((button) => button.scrollWidth > button.clientWidth).map((button) => button.id),
        viewportRight: window.innerWidth,
        cardRight: bounds.right,
        buttons: buttons.slice(-2).map((button) => {
          const box = button.getBoundingClientRect()
          const icon = button.querySelector('svg')!.getBoundingClientRect()
          return { width: box.width, height: box.height, top: box.top, iconX: icon.x - box.x, iconY: icon.y - box.y }
        }),
      }
    })
    expect(geometry.rightInset, name).toBeCloseTo(0, 3)
    expect(geometry.topInset, name).toBeCloseTo(0, 3)
    expect(geometry.gap, name).toBeCloseTo(0, 3)
    expect(geometry.buttons[0], name).toEqual(geometry.buttons[1])
    expect(geometry.buttons[0]!.width, name).toBe(44)
    expect(geometry.buttons[0]!.height, name).toBe(45)
    expect(geometry.titleRight, name).toBeLessThanOrEqual(geometry.lockLeft)
    if (geometry.groupRight !== undefined && geometry.groupTop! < geometry.lockBottom) {
      expect(geometry.groupRight, name).toBeLessThanOrEqual(geometry.lockLeft)
    }
    expect(geometry.clippedTabs, name).toEqual([])
    expect(geometry.cardRight, name).toBeLessThanOrEqual(geometry.viewportRight)
    await card.locator('.panel-heading').screenshot({ path: testInfo.outputPath(`${name}-heading.png`) })

    await lock.click()
    await expect(lock).toHaveAttribute('aria-pressed', 'true')
    await interactWithScene()
    await expect(card).toBeVisible()
    await close.click()
    await expect(card).toBeHidden()
    await expect(toggle).toBeFocused()
    await toggle.press('Enter')
    await expect(card).toBeVisible()
    await expect(lock).toHaveAttribute('aria-pressed', 'true')
    await lock.click()
    await expect(lock).toHaveAttribute('aria-pressed', 'false')
    await interactWithScene()
    await expect(card).toBeHidden()
  }

  for (const name of ['object-type', 'constellation', 'spectral', 'temperature', 'luminosity', 'mass', 'radius', 'magnitude', 'distance']) {
    await checkCard(name, page.locator(`#${name}-toggle`))
  }

  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('Sun')
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await openSpecs(page)
  await checkCard('metallicity', page.locator('#metallicity-toggle'))
  await page.locator('#object-system-toggle').click()
  await checkCard('planet', page.locator('.planet-row[data-planet-id="jupiter"] button'))
  expect(errors).toEqual([])
})
