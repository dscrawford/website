// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import SchedulePanel from '../SchedulePanel.jsx'

const GAME = {
  id: '401',
  homeTeam: { id: '5', name: 'Guardians', abbreviation: 'CLE', score: 3 },
  awayTeam: { id: '6', name: 'Tigers', abbreviation: 'DET', score: 2 },
}

function schedule(teamId, abbreviation) {
  return {
    teamId,
    team: { abbreviation, name: abbreviation },
    season: '2026',
    fetchedAt: 'x',
    games: [
      {
        id: '401',
        date: '2026-09-04T20:00Z',
        opponent: { abbreviation: 'X', name: 'X' },
        home: true,
        teamScore: 3,
        opponentScore: 2,
        result: null,
        state: 'in',
        detail: 'Top 5th',
      },
    ],
  }
}

describe('SchedulePanel', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollTo = vi.fn()
    globalThis.fetch = vi.fn((url) => {
      const m = String(url).match(/\/api\/scores\/mlb\/teams\/(\d+)\/schedule/)
      if (!m) return Promise.reject(new Error(`unexpected ${url}`))
      const ab = m[1] === '5' ? 'CLE' : 'DET'
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: schedule(m[1], ab), error: null }) })
    })
  })

  afterEach(() => {
    cleanup()
    delete globalThis.fetch
    delete HTMLElement.prototype.scrollTo
  })

  it('renders the away and home team schedules as two labelled regions', async () => {
    render(<SchedulePanel leagueKey="mlb" game={GAME} />)
    await waitFor(() => expect(screen.getByText('DET')).toBeTruthy())
    expect(screen.getByText('CLE')).toBeTruthy()
    const panels = screen.getAllByRole('region')
    expect(panels).toHaveLength(2)
    expect(panels[0].textContent).toContain('DET')
    expect(panels[1].textContent).toContain('CLE')
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/mlb/teams/6/schedule', expect.anything())
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/mlb/teams/5/schedule', expect.anything())
  })

  it('renders nothing when the game carries no team ids', () => {
    const { container } = render(
      <SchedulePanel
        leagueKey="mlb"
        game={{ ...GAME, homeTeam: { ...GAME.homeTeam, id: null }, awayTeam: { ...GAME.awayTeam, id: null } }}
      />
    )
    expect(container.innerHTML).toBe('')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('renders only the panel for the team whose id is present', async () => {
    render(<SchedulePanel leagueKey="mlb" game={{ ...GAME, homeTeam: { ...GAME.homeTeam, id: null } }} />)
    await waitFor(() => expect(screen.getByText('DET')).toBeTruthy())
    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(screen.queryByText('CLE')).toBeNull()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
