import { test, expect } from '@playwright/test'

// The GOTG web UI lives under /games, served by the cluster rather than this
// site, so the link must be a plain page load to dcraw.net (where sign-in's
// cookie and callback are), not an in-app route.
test('top nav links to the games UI on dcraw.net', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))
  await page.goto('/')
  const games = page.locator('.top-nav a', { hasText: 'GAMES' })
  await expect(games).toHaveAttribute('href', 'https://dcraw.net/games/ui/')
  await expect(games).not.toHaveAttribute('target', /.+/)
})
