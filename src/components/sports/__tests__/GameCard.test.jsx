// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import GameCard from '../GameCard.jsx'

const GAME = {
  id: '401',
  league: 'mlb',
  startTime: '2026-08-28T20:00:00Z',
  status: { state: 'in', detail: 'Top 5th' },
  broadcasts: [],
  homeTeam: { name: 'Cubs', abbreviation: 'CHC', score: 3, logo: null, record: null, homeAway: 'home' },
  awayTeam: { name: 'Reds', abbreviation: 'CIN', score: 2, logo: null, record: null, homeAway: 'away' },
}

describe('GameCard box score expansion', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { gameId: '401', teams: [], fetchedAt: null },
        error: null,
      }),
    })
  })

  afterEach(() => {
    cleanup()
    delete globalThis.fetch
  })

  it('renders collapsed without fetching (lazy)', () => {
    render(<GameCard game={GAME} leagueKey="mlb" />)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /box score/i }).getAttribute('aria-expanded')).toBe('false')
  })

  it('expands on click and fetches the box score once', async () => {
    render(<GameCard game={GAME} leagueKey="mlb" />)
    const toggle = screen.getByRole('button', { name: /box score/i })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/mlb/games/401', expect.anything())
    )
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
