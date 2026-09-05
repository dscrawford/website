import { test, expect } from '@playwright/test'

const GAME = {
  id: '401',
  startTime: '2026-09-04T20:00:00Z',
  status: { state: 'in', period: 5, clock: '0:00', detail: 'Top 5th', completed: false },
  broadcasts: [],
  homeTeam: { id: '5', name: 'Guardians', abbreviation: 'CLE', score: 3, logo: null, record: null, homeAway: 'home' },
  awayTeam: { id: '6', name: 'Tigers', abbreviation: 'DET', score: 2, logo: null, record: null, homeAway: 'away' },
}

// 40 played games, the live game, then 10 upcoming: long enough to need a scrollbar
function schedule(teamId, abbreviation) {
  const games = []
  for (let i = 0; i < 40; i++) {
    const result = ['W', 'L', 'T'][i % 3]
    games.push({
      id: `p${i}`,
      date: `2026-06-${String((i % 28) + 1).padStart(2, '0')}T00:00Z`,
      opponent: { abbreviation: 'OPP', name: 'Opponent' },
      home: i % 2 === 0,
      teamScore: result === 'W' ? 5 : 2,
      opponentScore: result === 'L' ? 5 : 2,
      result,
      state: 'post',
      detail: 'Final',
    })
  }
  const isHome = teamId === '5'
  games.push({
    id: '401',
    date: '2026-09-04T20:00Z',
    opponent: { abbreviation: isHome ? 'DET' : 'CLE', name: 'x' },
    home: isHome,
    teamScore: isHome ? 3 : 2,
    opponentScore: isHome ? 2 : 3,
    result: null,
    state: 'in',
    detail: 'Top 5th',
  })
  for (let i = 0; i < 10; i++) {
    games.push({
      id: `u${i}`,
      date: `2026-09-${String(i + 5).padStart(2, '0')}T00:00Z`,
      opponent: { abbreviation: 'NXT', name: 'Next' },
      home: true,
      teamScore: null,
      opponentScore: null,
      result: null,
      state: 'pre',
      detail: '7:10 PM',
    })
  }
  return { teamId, team: { abbreviation, name: abbreviation }, season: '2026', fetchedAt: 'x', games }
}

const rgb = (s) => s.match(/\d+/g).map(Number)

test.describe('Team season schedules on the game page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/scores', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: { leagues: { mlb: { league: 'mlb', sport: 'baseball', label: 'MLB', games: [GAME] } } },
          error: null,
        },
      })
    )
    await page.route('**/api/scores/mlb/games/401', (route) =>
      route.fulfill({ json: { success: true, data: { gameId: '401', teams: [], fetchedAt: null }, error: null } })
    )
    await page.route('**/api/scores/mlb/teams/5/schedule', (route) =>
      route.fulfill({ json: { success: true, data: schedule('5', 'CLE'), error: null } })
    )
    await page.route('**/api/scores/mlb/teams/6/schedule', (route) =>
      route.fulfill({ json: { success: true, data: schedule('6', 'DET'), error: null } })
    )
  })

  test('desktop: side by side, scrolled to the current game and the four before it, coloured results', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.goto('/sports/401')
    const panels = page.getByRole('region')
    await expect(panels).toHaveCount(2)
    const [a, b] = await Promise.all([panels.nth(0).boundingBox(), panels.nth(1).boundingBox()])
    expect(Math.abs(a.y - b.y)).toBeLessThan(2)
    expect(a.x).toBeLessThan(b.x)

    const list = panels.nth(0).locator('.sched-list')
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)

    const current = panels.nth(0).locator('[aria-current="true"]')
    await expect(current).toBeVisible()
    await expect(current).toContainText('CLE')
    const inView = await list.evaluate((el) => {
      const rows = Array.from(el.querySelectorAll('li'))
      const idx = rows.findIndex((r) => r.getAttribute('aria-current') === 'true')
      const box = el.getBoundingClientRect()
      return rows.slice(idx - 4, idx + 1).every((r) => {
        const rb = r.getBoundingClientRect()
        return rb.top >= box.top - 1 && rb.bottom <= box.bottom + 1
      })
    })
    expect(inView).toBe(true)

    const colours = await Promise.all(
      ['w', 'l', 't'].map((k) =>
        panels.nth(0).locator(`.sched-result--${k}`).first().evaluate((el) => getComputedStyle(el).color)
      )
    )
    const [win, loss, tie] = colours.map(rgb)
    expect(win[1]).toBeGreaterThan(win[0])
    expect(loss[0]).toBeGreaterThan(loss[1])
    expect(Math.max(...tie) - Math.min(...tie)).toBeLessThan(40)
  })

  test('phone: schedules stack and the list scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await page.goto('/sports/401')
    const panels = page.getByRole('region')
    await expect(panels).toHaveCount(2)
    const [a, b] = await Promise.all([panels.nth(0).boundingBox(), panels.nth(1).boundingBox()])
    expect(b.y).toBeGreaterThan(a.y + a.height - 1)
    expect(Math.abs(a.x - b.x)).toBeLessThan(2)

    const list = panels.nth(0).locator('.sched-list')
    expect(['auto', 'scroll']).toContain(await list.evaluate((el) => getComputedStyle(el).overflowY))
    const before = await list.evaluate((el) => el.scrollTop)
    await list.evaluate((el) => el.scrollBy(0, 100))
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(before)
  })
})
