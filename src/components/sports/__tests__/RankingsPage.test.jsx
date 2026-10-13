// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react'
import RankingsPage from '../RankingsPage.jsx'

const team = (id, abbreviation, name) => ({ id, abbreviation, name, logo: null })
const AP = {
  id: '1',
  type: 'ap',
  name: 'AP Top 25',
  shortName: 'AP Poll',
  headline: '2025 AP Poll: Week 14',
  week: 'Week 14',
  date: '2025-11-23T08:00Z',
  ranks: [
    { rank: 1, previous: 1, trend: '-', points: 1500, firstPlaceVotes: 55, record: '11-0', team: team('194', 'OSU', 'Ohio State Buckeyes') },
    { rank: 2, previous: 3, trend: '+1', points: 1450, firstPlaceVotes: 5, record: '11-0', team: team('84', 'IU', 'Indiana Hoosiers') },
    { rank: 3, previous: 0, trend: '+30', points: 1200, firstPlaceVotes: 0, record: '9-2', team: team('99', 'NWC', 'Newcomers') },
  ],
  others: [{ rank: 0, previous: 0, trend: '+26', points: 92, firstPlaceVotes: 0, record: '7-4', team: team('275', 'WIS', 'Wisconsin Badgers') }],
  droppedOut: [{ rank: 0, previous: 13, trend: '-13', points: 0, firstPlaceVotes: 0, record: '7-4', team: team('2483', 'ORE', 'Oregon Ducks') }],
}
const CFP = {
  ...AP,
  id: '21',
  type: 'cfp',
  name: 'Playoff Committee Rankings',
  shortName: 'CFP Rankings',
  date: '2025-11-25T08:00Z',
  ranks: [{ rank: 1, previous: 1, trend: '-', points: 0, firstPlaceVotes: 0, record: '11-0', team: team('194', 'OSU', 'Ohio State Buckeyes') }],
  others: [],
  droppedOut: [],
}
const DATA = { league: 'ncaaf', label: 'NCAAF', date: '2025-11-29', season: { year: 2025, label: '2025' }, week: 'Week 14', polls: [AP, CFP], fetchedAt: 'x' }

describe('RankingsPage', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).startsWith('/api/scores/ncaaf/rankings')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: DATA, error: null }) })
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
    })
  })

  afterEach(() => {
    cleanup()
    delete globalThis.fetch
  })

  it('defaults to the CFP ranking when one exists and switches polls with tabs kept in the URL', async () => {
    const navigate = vi.fn()
    render(<RankingsPage navigate={navigate} leagueKey="ncaaf" search="?date=2025-11-29" />)
    expect(await screen.findByRole('heading', { name: 'Playoff Committee Rankings' })).toBeTruthy()
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/ncaaf/rankings?date=2025-11-29', expect.anything())
    expect(screen.getByRole('heading', { name: /RANKINGS AS OF NOV 29, 2025/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'CFP Rankings', pressed: true })).toBeTruthy()
    // Committee rankings carry no ballot points, so those columns are hidden
    expect(screen.queryByRole('columnheader', { name: 'PTS' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'AP Poll' }))
    expect(navigate).toHaveBeenCalledWith('/sports/rankings/ncaaf?date=2025-11-29&poll=ap')
  })

  it('lists a poll first to last with records, movement, votes, others receiving votes and drop-outs, each team linking to its page', async () => {
    const navigate = vi.fn()
    render(<RankingsPage navigate={navigate} leagueKey="ncaaf" search="?poll=ap" />)
    expect(await screen.findByRole('heading', { name: 'AP Top 25' })).toBeTruthy()
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/ncaaf/rankings', expect.anything())
    expect(screen.getByText(/Week 14/)).toBeTruthy()

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    const first = within(rows[0]).getAllByRole('cell').map((c) => c.textContent)
    expect(first).toEqual(['1', 'OSUOhio State Buckeyes', '11-0', '—', '1500', '55'])
    expect(within(rows[1]).getByText('+1').className).toContain('rank-trend--up')
    expect(within(rows[2]).getByText('NEW')).toBeTruthy()

    const link = within(rows[1]).getByRole('link', { name: 'IU' })
    expect(link.getAttribute('href')).toBe('/sports/teams/ncaaf/84')
    fireEvent.click(link)
    expect(navigate).toHaveBeenCalledWith('/sports/teams/ncaaf/84')

    expect(screen.getByText(/Others receiving votes/).closest('p').textContent).toContain('WIS 92')
    expect(screen.getByText(/Dropped out/).closest('p').textContent).toContain('ORE')
  })

  it('moves between days with the date picker, keeping the chosen poll, and links back to that day', async () => {
    const navigate = vi.fn()
    render(<RankingsPage navigate={navigate} leagueKey="ncaaf" search="?date=2025-11-29&poll=ap" />)
    await screen.findByRole('heading', { name: 'AP Top 25' })
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(navigate).toHaveBeenCalledWith('/sports/rankings/ncaaf?date=2025-11-28&poll=ap')
    expect(screen.getByRole('link', { name: /scoreboard/i }).getAttribute('href')).toBe('/sports?date=2025-11-29')
    fireEvent.click(screen.getByRole('link', { name: /conference standings/i }))
    expect(navigate).toHaveBeenCalledWith('/sports/standings/ncaaf')
  })

  it('refuses leagues without polls and reports a day with none', async () => {
    const { rerender } = render(<RankingsPage navigate={vi.fn()} leagueKey="nfl" />)
    expect(screen.getByText(/no rankings for this league/i)).toBeTruthy()
    expect(globalThis.fetch).not.toHaveBeenCalled()

    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { ...DATA, polls: [] }, error: null }) })
    rerender(<RankingsPage navigate={vi.fn()} leagueKey="ncaaf" search="?date=2025-02-01" />)
    await waitFor(() => expect(screen.getByText(/no poll published/i)).toBeTruthy())
  })

  it('treats an unstamped empty answer (ESPN unreachable) as a failure rather than a day without polls', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { league: 'ncaaf', date: null, polls: [], fetchedAt: null }, error: null }) })
    render(<RankingsPage navigate={vi.fn()} leagueKey="ncaaf" />)
    expect(await screen.findByRole('button', { name: /retry/i })).toBeTruthy()
    expect(screen.queryByText(/no poll published/i)).toBeNull()
  })

  it('offers a retry when the request fails', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 500 })
    render(<RankingsPage navigate={vi.fn()} leagueKey="cbb" />)
    const retry = await screen.findByRole('button', { name: /retry/i })
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { ...DATA, league: 'cbb', polls: [AP] }, error: null }) })
    fireEvent.click(retry)
    expect(await screen.findByRole('heading', { name: 'AP Top 25' })).toBeTruthy()
  })
})
