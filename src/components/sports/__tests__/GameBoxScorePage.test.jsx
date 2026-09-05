// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import GameBoxScorePage from '../GameBoxScorePage.jsx'

const GAME = {
  id: '401',
  startTime: '2026-08-28T20:00:00Z',
  status: { state: 'in', period: 5, clock: '0:00', detail: 'Top 5th', completed: false },
  broadcasts: [],
  homeTeam: { id: '16', name: 'Cubs', abbreviation: 'CHC', score: 3, logo: null, record: null, homeAway: 'home' },
  awayTeam: { id: '17', name: 'Reds', abbreviation: 'CIN', score: 2, logo: null, record: null, homeAway: 'away' },
}

const BOX = {
  gameId: '401',
  fetchedAt: 'x',
  teams: [
    {
      name: 'Cincinnati Reds',
      abbreviation: 'CIN',
      groups: [
        {
          name: 'batting',
          labels: ['AB'],
          totals: ['33'],
          players: [{ name: 'Dane Myers', shortName: 'D. Myers', position: 'CF', stats: ['3'] }],
        },
      ],
    },
  ],
}

function mockEndpoints({ leagues, box } = {}) {
  globalThis.fetch = vi.fn((url) => {
    const sched = String(url).match(/\/api\/scores\/mlb\/teams\/(\d+)\/schedule/)
    if (sched) {
      const abbreviation = sched[1] === '16' ? 'CHC' : 'CIN'
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: { teamId: sched[1], team: { abbreviation, name: abbreviation }, season: '2026', fetchedAt: 'x', games: [] },
          error: null,
        }),
      })
    }
    if (String(url).startsWith('/api/scores/mlb/games/')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: box ?? BOX, error: null }),
      })
    }
    if (String(url) === '/api/scores') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: { leagues: leagues ?? { mlb: { league: 'mlb', sport: 'baseball', label: 'MLB', games: [GAME] } } },
          error: null,
        }),
      })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

describe('GameBoxScorePage', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    HTMLElement.prototype.scrollTo = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    delete globalThis.fetch
    delete HTMLElement.prototype.scrollTo
  })

  it('resolves the league from the scoreboard and renders header + box score', async () => {
    mockEndpoints()
    render(<GameBoxScorePage navigate={vi.fn()} gameId="401" />)
    await waitFor(() => expect(screen.getByText('CHC')).toBeTruthy())
    expect(screen.getByText('CIN')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('D. Myers')).toBeTruthy())
    // box fetch went to the resolved league
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/mlb/games/401', expect.anything())
  })

  it('shows not-found when no league contains the game', async () => {
    mockEndpoints({ leagues: { mlb: { league: 'mlb', label: 'MLB', games: [] } } })
    render(<GameBoxScorePage navigate={vi.fn()} gameId="999" />)
    await waitFor(() => expect(screen.getByText(/game not found/i)).toBeTruthy())
  })

  it('offers a back link to the scoreboard', async () => {
    mockEndpoints()
    const navigate = vi.fn()
    render(<GameBoxScorePage navigate={navigate} gameId="401" />)
    const back = await screen.findByRole('link', { name: /scoreboard/i })
    expect(back.getAttribute('href')).toBe('/sports')
  })
  it('passes the league sport through so stat headers explain themselves', async () => {
    mockEndpoints()
    render(<GameBoxScorePage navigate={vi.fn()} gameId="401" />)
    const header = await screen.findByRole('columnheader', { name: 'AB' })
    fireEvent.mouseEnter(header)
    expect(screen.getByRole('tooltip').textContent).toContain('At Bats')
  })
  it('degrades to no tooltip when cached league data predates the sport field', async () => {
    const box = {
      gameId: '401',
      fetchedAt: 'x',
      teams: [{ name: 'T', abbreviation: 'T', groups: [{ name: 'stats', labels: ['STL'], totals: ['2'], players: [{ name: 'P', shortName: 'P', position: 'G', stats: ['2'] }] }] }],
    }
    mockEndpoints({ leagues: { mlb: { league: 'mlb', label: 'MLB', games: [GAME] } }, box })
    render(<GameBoxScorePage navigate={vi.fn()} gameId="401" />)
    fireEvent.mouseEnter(await screen.findByRole('columnheader', { name: 'STL' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows both teams season schedules once the game resolves', async () => {
    mockEndpoints()
    render(<GameBoxScorePage navigate={vi.fn()} gameId="401" />)
    await waitFor(() => expect(screen.getAllByRole('region')).toHaveLength(2))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/mlb/teams/17/schedule', expect.anything())
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/mlb/teams/16/schedule', expect.anything())
  })
})
