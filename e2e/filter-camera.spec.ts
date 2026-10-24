import { expect, test, type Page } from '@playwright/test'
import type { ViewerViewState } from '../src/viewer'
import { openFilter, openViewer, zoomViewer } from './support'

async function cameraState(page: Page): Promise<ViewerViewState> {
  await expect(page.locator('#scene-status')).toBeHidden()
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  // Use the app's saved-view serialization to inspect the actual camera without a test hook.
  return page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#save-view-name')!
    input.value = 'Camera regression'
    document.querySelector<HTMLFormElement>('#save-view-form')!.requestSubmit()
    const saved = JSON.parse(localStorage.getItem('star-view-saved-views')!)
    return saved[0].settings.viewState
  })
}

function expectCamera(actual: ViewerViewState, expected: ViewerViewState) {
  for (const key of ['position', 'target'] as const) {
    actual[key].forEach((value, axis) => expect(value, `${key}[${axis}]`).toBeCloseTo(expected[key][axis]!, 8))
  }
  expect(actual.observerRollRadians).toBeCloseTo(expected.observerRollRadians, 8)
  expect(actual.observerTelescope).toBe(expected.observerTelescope)
}

for (const mode of ['overview', 'manual', 'observer'] as const) {
  test(`filter changes preserve the ${mode} camera @mobile`, async ({ page }) => {
    await openViewer(page)
    if (mode === 'manual') {
      await page.locator('#front-view').evaluate((button: HTMLButtonElement) => button.click())
      await zoomViewer(page, 'in')
    } else if (mode === 'observer') {
      await page.locator('#observer-view').click()
      await page.locator('#observer-roll-counterclockwise').click()
      await page.locator('#observer-telescope').click()
    }
    const initial = await cameraState(page)
    expect(initial.home).toBe(mode === 'overview')
    await openFilter(page)

    const changes: [string, () => Promise<unknown>][] = [
      ['distance limit', () => page.locator('#object-distance-limit').fill('8')],
      ['magnitude limit', () => page.locator('#magnitude-limit').fill('4')],
      ['subtype', async () => {
        // Keyboard input also reaches controls behind the floating observer card on mobile.
        await page.locator('.filter-dropdown summary').press('Space')
        const subtype = page.locator('input[data-filter-key="brown_dwarf"]')
        await expect(subtype).toBeChecked()
        await subtype.press('Space')
        await expect(subtype).not.toBeChecked()
        await page.locator('.filter-dropdown summary').press('Space')
      }],
      ['category', () => page.locator('#category-compact_objects').uncheck()],
      ['catalog', () => page.locator('#catalog-range').fill('1')],
      ['constellation stars on', () => page.locator('#show-western-constellation-stars').check()],
      ['constellation stars off', () => page.locator('#show-western-constellation-stars').uncheck()],
      ['overlay on', () => page.locator('#category-interstellar_medium').check()],
      ['overlay off', () => page.locator('#category-interstellar_medium').uncheck()],
      ['reset filters', () => page.locator('#filter-reset').click()],
    ]
    for (const [name, change] of changes) {
      await test.step(name, async () => {
        await change()
        expectCamera(await cameraState(page), initial)
      })
    }
  })
}
