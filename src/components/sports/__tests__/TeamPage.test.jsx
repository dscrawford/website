// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import TeamPage from '../TeamPage.jsx'
import { FAVORITES_COOKIE, readFavorites } from '../../../hooks/useFavorites.js'

const SCHEDULE = {
  teamId: '5',
  team: { abbreviation: 'CLE', name: 'Cleveland Guardians', record: '71-70' },
  season: '2026',
  fetchedAt: 'x',
  games: [
    { id: '401', date: '2026-09-04T20:00Z', opponent: { abbreviation: 'DET', name: 'Detroit Tigers' }, home: true, teamScore: 3, opponentScore: 2, result: 'W', state: 'post', detail: 'Final', record: '71-70', opponentRecord: '80-61' },
    { id: '402', date: '2026-09-05T20:00Z', opponent: { abbreviation: 'DET', name: 'Detroit Tigers' }, home: true, teamScore: null, opponentScore: null, result: null, state: 'pre', detail: '7:10 PM', record: null, opponentRecord: null },
  ],
}

describe('TeamPage', () => {
  beforeEach(() => {
    document.cookie = `${FAVORITES_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    globalThis.fetch = vi.fn((url) => {
      if (String(url) === '/api/scores/mlb/teams/5/schedule') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: SCHEDULE, error: null }) })
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
    })
    HTMLElement.prototype.scrollTo = vi.fn()
  })

  afterEach(() => {
    cleanup()
    delete globalThis.fetch
    delete HTMLElement.prototype.scrollTo
  })

  it("shows the team, its record and every game of the season, each linking to that game's box score", async () => {
    const navigate = vi.fn()
    render(<TeamPage navigate={navigate} leagueKey="mlb" teamId="5" />)
    await waitFor(() => expect(screen.getByRole('heading', { name: /Cleveland Guardians/ })).toBeTruthy())
    expect(document.querySelector('.team-season-record').textContent).toBe('71-70')
    expect(screen.getByText('MLB')).toBeTruthy()

    const links = screen.getAllByRole('link', { name: /DET/ })
    expect(links).toHaveLength(2)
    expect(links[0].getAttribute('href')).toBe('/sports/401?league=mlb&date=2026-09-04')
    fireEvent.click(links[0])
    expect(navigate).toHaveBeenCalledWith('/sports/401?league=mlb&date=2026-09-04')
  })

  it('has a favorite toggle that writes the team to the cookie', async () => {
    render(<TeamPage navigate={vi.fn()} leagueKey="mlb" teamId="5" />)
    const star = await screen.findByRole('button', { name: /add .* to favorites/i })
    fireEvent.click(star)
    expect(readFavorites()).toEqual([{ league: 'mlb', id: '5', abbreviation: 'CLE', name: 'Cleveland Guardians' }])
    expect(screen.getByRole('button', { name: /remove .* from favorites/i })).toBeTruthy()
  })

  it('links back to the scoreboard and refuses unknown leagues', () => {
    const navigate = vi.fn()
    const { rerender } = render(<TeamPage navigate={navigate} leagueKey="mlb" teamId="5" />)
    fireEvent.click(screen.getByRole('link', { name: /scoreboard/i }))
    expect(navigate).toHaveBeenCalledWith('/sports')
    rerender(<TeamPage navigate={navigate} leagueKey="cricket" teamId="5" />)
    expect(screen.getByText(/unknown league/i)).toBeTruthy()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
