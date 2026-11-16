import { test, expect } from '@playwright/test'

test('top nav lists games and sports', async ({ page }) => {
  await page.goto('/')
  const nav = page.locator('.nav-links')
  await expect(nav).toContainText('GAMES | SPORTS | CODE | RESUME')

  const games = page.getByRole('button', { name: 'GAMES' })
  await expect(page.getByRole('menu')).toHaveCount(0)
  await games.click()
  const fishing = page.getByRole('menuitem', { name: 'Fishing Game' })
  await expect(fishing).toBeVisible()
  await expect(fishing).toHaveAttribute('href', '/FishingGame/')

  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('SPORTS opens the sports page', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ json: { games: [] } }))
  await page.goto('/')
  await page.getByRole('link', { name: 'SPORTS' }).click()
  await expect(page).toHaveURL(/\/sports$/)
})
