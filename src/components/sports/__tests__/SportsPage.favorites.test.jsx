// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { FAVORITES_COOKIE } from '../../../hooks/useFavorites.js'

const game = (id, away, home) => ({
  id,
  startTime: '2026-09-04T20:00Z',
  status: { state: 'pre', detail: '7:10 PM' },
  broadcasts: [],
  awayTeam: { id: away[0], name: away[1], abbreviation: away[2], score: 0, record: null },
  homeTeam: { id: home[0], name: home[1], abbreviation: home[2], score: 0, record: null },
})

const LEAGUES = {
  nfl: { league: 'nfl', label: 'NFL', games: [] },
  ncaaf: { league: 'ncaaf', label: 'NCAAF', games: [] },
  nba: { league: 'nba', label: 'NBA', games: [] },
  cbb: { league: 'cbb', label: 'College Basketball', games: [] },
  mlb: {
    league: 'mlb',
    label: 'MLB',
    games: [game('1', ['7', 'Seattle Mariners', 'SEA'], ['8', 'Texas Rangers', 'TEX']), game('2', ['6', 'Detroit Tigers', 'DET'], ['5', 'Cleveland Guardians', 'CLE'])],
  },
}

const sportsData = vi.fn()
vi.mock('../../../hooks/useSportsData.js', () => ({ default: (...args) => sportsData(...args) }))

import SportsPage from '../SportsPage.jsx'

describe('SportsPage — favorites and date', () => {
  beforeEach(() => {
    document.cookie = `${FAVORITES_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    window.history.replaceState(null, '', '/sports')
    sportsData.mockReset()
    sportsData.mockReturnValue({ leagues: LEAGUES, loading: false, error: null, lastUpdated: new Date(), refetch: vi.fn() })
  })
  afterEach(cleanup)

  it('shows no favorites section until a team is starred', () => {
    render(<SportsPage navigate={vi.fn()} />)
    expect(screen.queryByRole('region', { name: /favorites/i })).toBeNull()
  })

  it("pins favorite teams and their games at the top, linking each team to its page", () => {
    document.cookie = `${FAVORITES_COOKIE}=${encodeURIComponent(JSON.stringify([{ league: 'mlb', id: '5', abbreviation: 'CLE', name: 'Cleveland Guardians' }]))}; path=/`
    const navigate = vi.fn()
    render(<SportsPage navigate={navigate} />)
    const fav = screen.getByRole('region', { name: /favorites/i })
    // The favorites block precedes every league section
    const sections = Array.from(document.querySelectorAll('section'))
    expect(sections[0]).toBe(fav)
    const chip = within(fav).getByRole('link', { name: /^CLE\s?MLB$/ })
    expect(chip.getAttribute('href')).toBe('/sports/teams/mlb/5')
    fireEvent.click(chip)
    expect(navigate).toHaveBeenCalledWith('/sports/teams/mlb/5')
    // Only the Guardians game is pinned
    expect(within(fav).getAllByRole('link', { name: /box score/i })).toHaveLength(1)
    expect(within(fav).getByText('DET')).toBeTruthy()
  })

  it('team names on game cards link to the team page', () => {
    const navigate = vi.fn()
    render(<SportsPage navigate={navigate} />)
    const sea = screen.getByRole('link', { name: /SEA/ })
    expect(sea.getAttribute('href')).toBe('/sports/teams/mlb/7')
    fireEvent.click(sea)
    expect(navigate).toHaveBeenCalledWith('/sports/teams/mlb/7')
  })

  it('reads ?date= from the URL, asks the data hook for that day, and changes the URL from the picker', () => {
    window.history.replaceState(null, '', '/sports?date=2026-09-04')
    const navigate = vi.fn()
    render(<SportsPage navigate={navigate} />)
    expect(sportsData).toHaveBeenCalledWith('2026-09-04')
    expect(screen.getByRole('button', { name: /pick a date/i }).textContent).toMatch(/Sep 4/)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Sep 4/i)
    fireEvent.click(screen.getByRole('button', { name: /next day/i }))
    expect(navigate).toHaveBeenCalledWith('/sports?date=2026-09-05')
  })

  it('shows the live board with no date in the URL and drops ?date= when returning to today', () => {
    const navigate = vi.fn()
    render(<SportsPage navigate={navigate} />)
    expect(sportsData).toHaveBeenCalledWith(undefined)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/LIVE SPORTS SCOREBOARD/)
    expect(screen.queryByRole('button', { name: /^today$/i })).toBeNull()
  })
})
