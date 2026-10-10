import { expect, test } from '@playwright/test'
import { openViewer } from './support'

test.use({ bypassCSP: false })

test('runs under the strict production content security policy without violations', async ({ page }) => {
  const violations: string[] = []
  await page.exposeFunction('reportCspViolation', (violation: string) => violations.push(violation))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { reportCspViolation(value: string): void }).reportCspViolation(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
  await openViewer(page)
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(policy).toContain("style-src 'self';")
  expect(policy).toContain("require-trusted-types-for 'script'")
  await page.locator('#object-specs-toggle').click()
  await page.locator('#mass-toggle').click()
  await expect(page.locator('#mass-card')).toBeVisible()
  await page.locator('#mass-close').click()
  await page.getByRole('button', { name: 'Stellar motion', exact: true }).click()
  await expect(page.locator('.time-markers i').last()).toHaveCSS('left', /px$/)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await page.getByLabel('Search objects').fill('Sun')
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click()
  await page.locator('#object-system-toggle').click()
  await page.locator('.planet-row[data-planet-id="saturn"]').click()
  await expect(page.locator('#planet-globe')).toHaveAttribute('data-texture-ready', 'true')
  expect(violations).toEqual([])
})
