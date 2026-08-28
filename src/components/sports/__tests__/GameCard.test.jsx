// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import GameCard from '../GameCard.jsx'

const GAME = {
  id: '401',
  startTime: '2026-08-28T20:00:00Z',
  status: { state: 'in', detail: 'Top 5th' },
  broadcasts: [],
  homeTeam: { name: 'Cubs', abbreviation: 'CHC', score: 3, logo: null, record: null, homeAway: 'home' },
  awayTeam: { name: 'Reds', abbreviation: 'CIN', score: 2, logo: null, record: null, homeAway: 'away' },
}

describe('GameCard box score link', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    cleanup()
    delete globalThis.fetch
  })

  it('renders a box score link without fetching anything', () => {
    render(<GameCard game={GAME} navigate={vi.fn()} />)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    const link = screen.getByRole('link', { name: /box score/i })
    expect(link.getAttribute('href')).toBe('/sports/401')
  })

  it('navigates client-side to /sports/{gameId} on click', () => {
    const navigate = vi.fn()
    render(<GameCard game={GAME} navigate={navigate} />)
    fireEvent.click(screen.getByRole('link', { name: /box score/i }))
    expect(navigate).toHaveBeenCalledWith('/sports/401')
  })

  it('omits the link when the game has no id', () => {
    render(<GameCard game={{ ...GAME, id: null }} navigate={vi.fn()} />)
    expect(screen.queryByRole('link', { name: /box score/i })).toBeNull()
  })
})
