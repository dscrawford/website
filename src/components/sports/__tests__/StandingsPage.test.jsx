// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import StandingsPage from '../StandingsPage.jsx'

const col = (key, label, title) => ({ key, label, stat: key, title })
const entry = (id, abbreviation, name, w, l, seed) => ({ team: { id, abbreviation, name, logo: null }, seed, stats: { w: String(w), l: String(l), seed: String(seed) } })
const NFL = {
  league: 'nfl',
  season: { year: 2026, label: '2026' },
  columns: [col('w', 'W', 'Wins'), col('l', 'L', 'Losses'), col('seed', 'SEED', 'Conference playoff seed')],
  groups: [
    {
      id: '7',
      name: 'National Football Conference',
      abbreviation: 'NFC',
      groups: [
        { id: '1', name: 'NFC East', entries: [entry('21', 'PHI', 'Philadelphia Eagles', 2, 3, 11), entry('6', 'DAL', 'Dallas Cowboys', 2, 3, 12)] },
        { id: '10', name: 'NFC North', entries: [entry('8', 'DET', 'Detroit Lions', 5, 0, 1)] },
      ],
      entries: [],
    },
  ],
  fetchedAt: 'x',
}
const CFB = {
  league: 'ncaaf',
  season: { year: 2025, label: '2025' },
  columns: [col('conf', 'CONF', 'Conference record'), col('ovr', 'OVERALL', 'Overall record')],
  groups: [{ id: '8', name: 'Southeastern Conference', abbreviation: 'sec', entries: [{ team: { id: '61', abbreviation: 'UGA', name: 'Georgia Bulldogs', logo: null }, seed: 1, stats: { conf: '8-0', ovr: '12-1' } }] }],
  fetchedAt: 'x',
}

describe('StandingsPage', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn((url) => {
      const body = String(url).startsWith('/api/scores/nfl/standings') ? NFL : String(url).startsWith('/api/scores/ncaaf/standings') ? CFB : null
      if (!body) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: body, error: null }) })
    })
  })

  afterEach(() => {
    cleanup()
    delete globalThis.fetch
  })

  it('shows each division under its conference, teams numbered by their place regardless of record', async () => {
    const navigate = vi.fn()
    render(<StandingsPage navigate={navigate} leagueKey="nfl" />)
    expect(await screen.findByRole('heading', { name: 'National Football Conference' })).toBeTruthy()
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/nfl/standings', expect.anything())
    expect(screen.getByText('NFL')).toBeTruthy()

    const east = screen.getByRole('table', { name: 'NFC East' })
    expect(within(east).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['#', 'NFC EAST', 'W', 'L', 'SEED'])
    const rows = within(east).getAllByRole('row').slice(1)
    expect(within(rows[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', 'PHIPhiladelphia Eagles', '2', '3', '11'])
    expect(within(rows[1]).getAllByRole('cell')[0].textContent).toBe('2')

    const link = within(rows[0]).getByRole('link', { name: 'PHI' })
    expect(link.getAttribute('href')).toBe('/sports/teams/nfl/21')
    fireEvent.click(link)
    expect(navigate).toHaveBeenCalledWith('/sports/teams/nfl/21')
    expect(screen.queryByRole('link', { name: /polls/i })).toBeNull()
  })

  it('shows college conferences as flat tables with a link to the polls', async () => {
    const navigate = vi.fn()
    render(<StandingsPage navigate={navigate} leagueKey="ncaaf" />)
    const sec = await screen.findByRole('table', { name: 'Southeastern Conference' })
    expect(within(sec).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['#', 'SOUTHEASTERN CONFERENCE', 'CONF', 'OVERALL'])
    expect(within(sec).getByRole('link', { name: 'UGA' })).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: /polls/i }))
    expect(navigate).toHaveBeenCalledWith('/sports/rankings/ncaaf')
  })

  it('offers past seasons; the pick goes into the URL and ?season= drives the request', async () => {
    const navigate = vi.fn()
    const { rerender } = render(<StandingsPage navigate={navigate} leagueKey="nfl" />)
    const select = await screen.findByRole('combobox', { name: /season/i })
    expect(select.value).toBe(String(new Date().getFullYear()))
    fireEvent.change(select, { target: { value: '2024' } })
    expect(navigate).toHaveBeenCalledWith('/sports/standings/nfl?season=2024')

    rerender(<StandingsPage navigate={navigate} leagueKey="nfl" search="?season=2024" />)
    expect(globalThis.fetch).toHaveBeenLastCalledWith('/api/scores/nfl/standings?season=2024', expect.anything())
    expect(screen.getByRole('combobox', { name: /season/i }).value).toBe('2024')
  })

  it('links back to the scoreboard, refuses unknown leagues, and offers a retry on failure', async () => {
    const navigate = vi.fn()
    const { rerender } = render(<StandingsPage navigate={navigate} leagueKey="cricket" />)
    expect(screen.getByText(/unknown league/i)).toBeTruthy()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link', { name: /scoreboard/i }))
    expect(navigate).toHaveBeenCalledWith('/sports')

    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 500 })
    rerender(<StandingsPage navigate={navigate} leagueKey="nba" />)
    expect(await screen.findByRole('button', { name: /retry/i })).toBeTruthy()

    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { league: 'mlb', season: null, columns: [], groups: [], fetchedAt: null }, error: null }) })
    rerender(<StandingsPage navigate={navigate} leagueKey="mlb" />)
    expect(await screen.findByRole('button', { name: /retry/i })).toBeTruthy()
    expect(screen.queryByText(/no standings for this season/i)).toBeNull()
  })
})
