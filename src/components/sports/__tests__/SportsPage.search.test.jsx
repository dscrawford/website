// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const LEAGUES = {
  nfl: { league: 'nfl', label: 'NFL', games: [] },
  ncaaf: {
    league: 'ncaaf',
    label: 'NCAAF',
    games: [
      {
        id: '1',
        startTime: 'x',
        status: { state: 'pre', detail: '' },
        broadcasts: [],
        awayTeam: { name: 'Oklahoma Sooners', abbreviation: 'OU', score: 0 },
        homeTeam: { name: 'Texas Longhorns', abbreviation: 'TEX', score: 0 },
      },
      {
        id: '2',
        startTime: 'x',
        status: { state: 'pre', detail: '' },
        broadcasts: [],
        awayTeam: { name: 'NC State Wolfpack', abbreviation: 'NCSU', score: 0 },
        homeTeam: { name: 'Virginia Cavaliers', abbreviation: 'UVA', score: 0 },
      },
    ],
  },
  nba: { league: 'nba', label: 'NBA', games: [] },
  cbb: { league: 'cbb', label: 'College Basketball', games: [] },
  mlb: { league: 'mlb', label: 'MLB', games: [] },
}

vi.mock('../../../hooks/useSportsData.js', () => ({
  default: () => ({
    leagues: LEAGUES,
    loading: false,
    error: null,
    lastUpdated: new Date(),
    refetch: vi.fn(),
  }),
}))

import SportsPage from '../SportsPage.jsx'

describe('SportsPage search', () => {
  afterEach(cleanup)

  it('filters cards by full name when the card shows the abbreviation', () => {
    render(<SportsPage navigate={vi.fn()} />)
    expect(screen.getByText('OU')).toBeTruthy()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'oklahoma' } })
    expect(screen.getByText('OU')).toBeTruthy()
    expect(screen.queryByText('NCSU')).toBeNull()
  })

  it('filters by abbreviation', () => {
    render(<SportsPage navigate={vi.fn()} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'uva' } })
    expect(screen.getByText('NCSU')).toBeTruthy()
    expect(screen.queryByText('OU')).toBeNull()
  })

  it('hides empty leagues while searching and shows a no-match message', () => {
    render(<SportsPage navigate={vi.fn()} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(screen.queryByRole('heading', { name: 'NFL' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'NCAAF' })).toBeNull()
    expect(screen.getByText(/no games match/i)).toBeTruthy()
  })

  it('Ctrl+F focuses the search box instead of browser find', () => {
    render(<SportsPage navigate={vi.fn()} />)
    const box = screen.getByRole('searchbox')
    const ev = fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
    expect(document.activeElement).toBe(box)
    expect(ev).toBe(false) // preventDefault was called
  })

  it('Escape clears the query from the search box', () => {
    render(<SportsPage navigate={vi.fn()} />)
    const box = screen.getByRole('searchbox')
    fireEvent.change(box, { target: { value: 'uva' } })
    box.focus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(box.value).toBe('')
    expect(screen.getByText('OU')).toBeTruthy()
  })
})
