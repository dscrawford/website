import { test, expect } from '@playwright/test'

// Rankings and standings pages against a mocked API, reached from the
// scoreboard's league headers and a team page

const team = (id, abbreviation, name) => ({ id, abbreviation, name, logo: null })
const RANKINGS = {
  league: 'ncaaf',
  label: 'NCAAF',
  date: '2025-11-29',
  season: { year: 2025, label: '2025' },
  week: 'Week 14',
  fetchedAt: 'x',
  polls: [
    {
      id: '1',
      type: 'ap',
      name: 'AP Top 25',
      shortName: 'AP Poll',
      week: 'Week 14',
      date: '2025-11-23T08:00Z',
      ranks: [
        { rank: 1, previous: 1, trend: '-', points: 1500, firstPlaceVotes: 55, record: '11-0', team: team('194', 'OSU', 'Ohio State Buckeyes') },
        { rank: 2, previous: 3, trend: '+1', points: 1450, firstPlaceVotes: 5, record: '11-0', team: team('84', 'IU', 'Indiana Hoosiers') },
      ],
      others: [],
      droppedOut: [],
    },
    {
      id: '21',
      type: 'cfp',
      name: 'Playoff Committee Rankings',
      shortName: 'CFP Rankings',
      week: 'Week 14',
      date: '2025-11-25T08:00Z',
      ranks: [{ rank: 1, previous: 1, trend: '-', points: 0, firstPlaceVotes: 0, record: '11-0', team: team('84', 'IU', 'Indiana Hoosiers') }],
      others: [],
      droppedOut: [],
    },
  ],
}

const entry = (id, abbreviation, name, w, l) => ({ team: team(id, abbreviation, name), seed: 1, stats: { w: String(w), l: String(l) } })
const STANDINGS = {
  league: 'nfl',
  season: { year: 2026, label: '2026' },
  columns: [
    { key: 'w', label: 'W', stat: 'wins', title: 'Wins' },
    { key: 'l', label: 'L', stat: 'losses', title: 'Losses' },
  ],
  groups: [
    {
      id: '7',
      name: 'National Football Conference',
      groups: [{ id: '1', name: 'NFC East', entries: [entry('21', 'PHI', 'Philadelphia Eagles', 2, 3), entry('6', 'DAL', 'Dallas Cowboys', 4, 1)] }],
      entries: [],
    },
  ],
  fetchedAt: 'x',
}

const SCHEDULE = {
  teamId: '21',
  team: { abbreviation: 'PHI', name: 'Philadelphia Eagles', record: '2-3', standing: '1st in NFC East', rank: null },
  season: '2026',
  fetchedAt: 'x',
  games: [],
}

const envelope = (data) => ({ json: { success: true, data, error: null } })

test.describe('Rankings and standings', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/scores', (route) =>
      route.fulfill(envelope({ leagues: { nfl: { league: 'nfl', sport: 'football', label: 'NFL', games: [] }, ncaaf: { league: 'ncaaf', sport: 'football', label: 'NCAAF', games: [] } } }))
    )
    await page.route('**/api/scores/ncaaf/rankings**', (route) => route.fulfill(envelope(RANKINGS)))
    await page.route('**/api/scores/nfl/standings**', (route) => route.fulfill(envelope(STANDINGS)))
    await page.route('**/api/scores/nfl/teams/21/schedule**', (route) => route.fulfill(envelope(SCHEDULE)))
  })

  test('college rankings open from the scoreboard, default to the CFP poll and switch to the AP poll', async ({ page }) => {
    await page.goto('/sports')
    await page.locator('#ncaaf').getByRole('link', { name: 'RANKINGS' }).click()
    await expect(page).toHaveURL(/\/sports\/rankings\/ncaaf$/)
    await expect(page.getByRole('heading', { name: 'Playoff Committee Rankings' })).toBeVisible()
    await page.getByRole('button', { name: 'AP Poll' }).click()
    await expect(page).toHaveURL(/poll=ap/)
    await expect(page.getByRole('heading', { name: 'AP Top 25' })).toBeVisible()
    const rows = page.getByRole('row')
    await expect(rows.nth(1)).toContainText('OSU')
    await expect(rows.nth(2)).toContainText('IU')
    await expect(rows.nth(2)).toContainText('+1')
  })

  test('pro standings list each division with teams numbered by place, and a team page links to them', async ({ page }) => {
    await page.goto('/sports/teams/nfl/21')
    const standing = page.getByRole('link', { name: '1st in NFC East' })
    await expect(standing).toBeVisible()
    await standing.click()
    await expect(page).toHaveURL(/\/sports\/standings\/nfl$/)
    await expect(page.getByRole('heading', { name: 'National Football Conference' })).toBeVisible()
    const east = page.getByRole('table', { name: 'NFC East' })
    await expect(east.getByRole('row').nth(1)).toContainText('1PHI')
    await expect(east.getByRole('row').nth(2)).toContainText('2DAL')
    await page.getByRole('combobox', { name: 'Season' }).selectOption('2024')
    await expect(page).toHaveURL(/season=2024/)
  })
})
