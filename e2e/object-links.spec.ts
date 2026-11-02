import { expect, test, type Page } from '@playwright/test'

async function open(page: Page, path: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('star-view-milky-way-visible', 'false'))
  await page.goto(path)
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true')
}

test('an object link selects its object and the URL follows later selections', async ({ page }) => {
  await open(page, '/objects/proxima-centauri')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'proxima-centauri')
  await expect(page).toHaveTitle('Proxima Centauri – Star View')
  await page.locator('#objects-toggle').click()
  await page.locator('#object-search').fill('Sun')
  await page.locator('#star-list button[data-star="sun"]').click()
  await expect(page).toHaveURL(/\/objects\/sun$/)
  await expect(page).toHaveTitle('Sun – Star View')
})

test('an object link loads the catalog that holds an object outside the start catalog', async ({ page }) => {
  await open(page, '/objects/cns5-0239')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'cns5-0239')
  await expect(page.locator('#star-name')).toHaveText('Achird')
})

test('the start page keeps its URL until an object is selected', async ({ page }) => {
  await open(page, '/')
  await expect(page.locator('#inspector')).toHaveAttribute('data-selected-star', 'sirius-a')
  await expect(page).toHaveURL(/\/$/)
})
