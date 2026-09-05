import { test, expect } from '@playwright/test'

// The game page fetches from /api; the preview server has no proxy, so the
// scoreboard and box score are served from fixtures at the network layer
const GAME = {
  id: '401',
  startTime: '2026-09-04T20:00:00Z',
  status: { state: 'post', period: 4, clock: '0:00', detail: 'Final', completed: true },
  broadcasts: [],
  homeTeam: { name: 'Oklahoma', abbreviation: 'OU', score: 35, logo: null, record: null, homeAway: 'home' },
  awayTeam: { name: 'Temple', abbreviation: 'TEM', score: 3, logo: null, record: null, homeAway: 'away' },
}

const BOX = {
  gameId: '401',
  fetchedAt: 'x',
  teams: [
    {
      name: 'Oklahoma Sooners',
      abbreviation: 'OU',
      groups: [
        {
          name: 'passing',
          labels: ['C/ATT', 'YDS', 'AVG', 'TD', 'INT'],
          descriptions: ['Completions/Attempts', 'Yards', 'Yards Per Pass Attempt', 'Touchdowns', 'Interceptions'],
          totals: ['5/6', '106', '17.7', '1', '0'],
          players: [{ name: 'John Mateer', shortName: 'John Mateer', position: 'QB', stats: ['5/6', '106', '17.7', '1', '0'] }],
        },
      ],
    },
  ],
}

test.describe('Box score stat glossary', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/scores', (route) =>
      route.fulfill({
        json: { success: true, data: { leagues: { ncaaf: { league: 'ncaaf', sport: 'football', label: 'NCAAF', games: [GAME] } } }, error: null },
      })
    )
    await page.route('**/api/scores/ncaaf/games/401', (route) =>
      route.fulfill({ json: { success: true, data: BOX, error: null } })
    )
  })

  test('hovering a stat header shows its full name and meaning', async ({ page }) => {
    await page.goto('/sports/401')
    const header = page.getByRole('columnheader', { name: 'C/ATT' })
    await expect(header).toBeVisible()
    await expect(page.getByRole('tooltip')).toHaveCount(0)

    await header.hover()
    const tip = page.getByRole('tooltip')
    await expect(tip).toBeVisible()
    await expect(tip).toContainText('Completions / Attempts')
    await expect(tip).toContainText('Passes completed')

    // Tooltip stays inside the viewport
    const box = await tip.boundingBox()
    const viewport = page.viewportSize()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)

    await page.mouse.move(0, 0)
    await expect(page.getByRole('tooltip')).toHaveCount(0)
  })

  test('keyboard focus opens the tooltip and Escape closes it', async ({ page }) => {
    await page.goto('/sports/401')
    const header = page.getByRole('columnheader', { name: 'INT' })
    await header.focus()
    await expect(page.getByRole('tooltip')).toContainText('Interceptions Thrown')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toHaveCount(0)
  })
})
