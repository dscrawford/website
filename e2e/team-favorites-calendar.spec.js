import { test, expect } from '@playwright/test'

// Team pages, cookie-backed favorites and the scoreboard calendar, driven
// against a mocked API so the runs are deterministic

const team = (id, name, abbreviation) => ({ id, name, abbreviation, score: 0, logo: null, record: '71-70', homeAway: 'home' })
const game = (id, away, home, startTime) => ({
  id,
  startTime,
  status: { state: 'post', period: 9, clock: '0:00', detail: 'Final', completed: true },
  broadcasts: [],
  awayTeam: { ...away, homeAway: 'away', score: 2 },
  homeTeam: { ...home, homeAway: 'home', score: 3 },
})

const CLE = team('5', 'Cleveland Guardians', 'CLE')
const DET = team('6', 'Detroit Tigers', 'DET')
const SEA = team('7', 'Seattle Mariners', 'SEA')
const TEX = team('8', 'Texas Rangers', 'TEX')

const TODAY_GAMES = [game('401', DET, CLE, '2026-09-04T20:00:00Z'), game('402', SEA, TEX, '2026-09-04T23:00:00Z')]
const PAST_GAMES = [game('301', SEA, CLE, '2026-08-21T20:00:00Z')]

const SCHEDULE = {
  teamId: '5',
  team: { abbreviation: 'CLE', name: 'Cleveland Guardians', record: '71-70' },
  season: '2026',
  fetchedAt: 'x',
  games: [
    { id: '301', date: '2026-08-21T20:00:00Z', opponent: { abbreviation: 'SEA', name: 'Seattle Mariners' }, home: true, teamScore: 3, opponentScore: 2, result: 'W', state: 'post', detail: 'Final', record: '70-70', opponentRecord: '60-80' },
    { id: '401', date: '2026-09-04T20:00:00Z', opponent: { abbreviation: 'DET', name: 'Detroit Tigers' }, home: true, teamScore: 3, opponentScore: 2, result: 'W', state: 'post', detail: 'Final', record: '71-70', opponentRecord: '80-61' },
  ],
}

const envelope = (data) => ({ json: { success: true, data, error: null } })
const board = (games, date) => ({
  ...(date ? { date } : {}),
  leagues: { mlb: { league: 'mlb', sport: 'baseball', label: 'MLB', games } },
})

test.beforeEach(async ({ page }) => {
  await page.route('**/api/scores', (route) => route.fulfill(envelope(board(TODAY_GAMES))))
  await page.route('**/api/scores?date=*', (route) => {
    const date = new URL(route.request().url()).searchParams.get('date')
    route.fulfill(envelope(board(date === '2026-08-21' ? PAST_GAMES : [], date)))
  })
  await page.route('**/api/scores/mlb/games/*', (route) => route.fulfill(envelope({ gameId: '401', teams: [], fetchedAt: null })))
  await page.route('**/api/scores/mlb/teams/*/schedule', (route) => route.fulfill(envelope(SCHEDULE)))
  await page.route('**/api/scores/mlb/teams/*/schedule?season=2024', (route) =>
    route.fulfill(
      envelope({
        ...SCHEDULE,
        season: '2024',
        seasonYear: 2024,
        team: { ...SCHEDULE.team, record: '92-70' },
        games: [{ ...SCHEDULE.games[0], id: '201', date: '2024-10-01T20:00:00Z', record: '92-70', opponentRecord: '85-77' }],
      })
    )
  )
})

test('the team page can show a past season, whose games open their box scores by date', async ({ page }) => {
  await page.goto('/sports/teams/mlb/5')
  await expect(page.locator('.team-season-record')).toHaveText('71-70')
  await page.getByRole('combobox', { name: 'Season' }).selectOption('2024')
  await expect(page).toHaveURL(/\/sports\/teams\/mlb\/5\?season=2024$/)
  await expect(page.locator('.team-season-record')).toHaveText('92-70')
  await expect(page.locator('.sched-row')).toHaveCount(1)
  await expect(page.locator('.sched-row a')).toHaveAttribute('href', '/sports/201?league=mlb&date=2024-10-01')
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Season' })).toHaveValue('2024')
})

test('a team name on the scoreboard opens its season page, and each game there opens its box score', async ({ page }) => {
  await page.goto('/sports')
  await page.getByRole('link', { name: 'CLE' }).first().click()
  await expect(page).toHaveURL(/\/sports\/teams\/mlb\/5$/)
  await expect(page.getByRole('heading', { name: /Cleveland Guardians/ })).toBeVisible()
  await expect(page.locator('.team-season-record')).toHaveText('71-70')

  const rows = page.locator('.sched-row')
  await expect(rows).toHaveCount(2)
  // Every cell of a linked row is laid out and readable, not collapsed
  // ("3-2" is ~18px wide; a collapsed cell is 0)
  for (const cell of ['.sched-date', '.sched-opp', '.sched-score', '.sched-result']) {
    const box = await rows.nth(0).locator(cell).boundingBox()
    expect(box.width, cell).toBeGreaterThan(12)
  }
  expect((await rows.nth(0).locator('.sched-opp').boundingBox()).width).toBeGreaterThan(60)
  await expect(rows.nth(0).locator('.sched-opp')).toHaveText(/vs SEA/)
  await expect(rows.nth(0).locator('.sched-opp-record')).toBeVisible()
  await expect(rows.nth(0).locator('.sched-opp-record')).toHaveText('60-80')
  // The August game is not on today's board; its link carries the day it was played
  await rows.nth(0).locator('a').click()
  await expect(page).toHaveURL(/\/sports\/301\?league=mlb&date=2026-08-21$/)
  await expect(page.locator('.game-page-header')).toContainText('SEA')
  await page.getByRole('link', { name: /scoreboard/i }).click()
  await expect(page).toHaveURL(/\/sports\?date=2026-08-21$/)
})

test('favorites persist in a cookie and pin the team to the top of the scoreboard', async ({ page, context }) => {
  await page.goto('/sports/teams/mlb/5')
  await page.getByRole('button', { name: /add .* to favorites/i }).click()
  const cookies = await context.cookies()
  const fav = cookies.find((c) => c.name === 'favTeams')
  expect(fav).toBeTruthy()
  expect(decodeURIComponent(fav.value)).toContain('"id":"5"')

  await page.goto('/sports')
  const favorites = page.getByRole('region', { name: 'Favorites' })
  await expect(favorites).toBeVisible()
  await expect(favorites.locator('.fav-chip-link')).toHaveText(/CLE/)
  // Pinned block sits above the league sections, and only the Guardians game is in it
  const favBox = await favorites.boundingBox()
  const mlbBox = await page.locator('#mlb').boundingBox()
  expect(favBox.y).toBeLessThan(mlbBox.y)
  await expect(favorites.locator('.game-card')).toHaveCount(1)
  await expect(favorites.locator('.game-card')).toContainText('DET')

  // Still there after a reload, and un-starring from the chip clears it
  await page.reload()
  await expect(page.getByRole('region', { name: 'Favorites' })).toBeVisible()
  await page.getByRole('button', { name: /remove .* from favorites/i }).click()
  await expect(page.getByRole('region', { name: 'Favorites' })).toHaveCount(0)
})

test.describe('calendar', () => {
  for (const [label, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['phone', { width: 375, height: 760 }],
  ]) {
    test(`${label}: the picker at the top of the board shows another day's games`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/sports')
      await expect(page.locator('#mlb .game-card')).toHaveCount(2)

      const picker = page.getByRole('group', { name: 'Scoreboard date' })
      await expect(picker).toBeVisible()
      // Top right: in the upper band of the page and right of centre
      const box = await picker.boundingBox()
      expect(box.y).toBeLessThan(200)
      expect(box.x + box.width / 2).toBeGreaterThan(viewport.width / 2)

      // The native calendar input is what the date button opens
      await page.getByLabel('Choose a date').fill('2026-08-21')
      await expect(page).toHaveURL(/\/sports\?date=2026-08-21$/)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('AUG 21, 2026')
      await expect(page.locator('#mlb .game-card')).toHaveCount(1)
      await expect(page.locator('#mlb .game-card')).toContainText('SEA')

      await page.getByRole('button', { name: 'Next day' }).click()
      await expect(page).toHaveURL(/\/sports\?date=2026-08-22$/)
      await expect(page.locator('#mlb')).toContainText('No games today')

      await page.getByRole('button', { name: 'Today' }).click()
      await expect(page).toHaveURL(/\/sports$/)
      await expect(page.locator('#mlb .game-card')).toHaveCount(2)
    })
  }
})
