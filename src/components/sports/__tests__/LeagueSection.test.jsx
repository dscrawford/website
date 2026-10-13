// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import LeagueSection from '../LeagueSection.jsx'

describe('LeagueSection', () => {
  afterEach(cleanup)

  it("links a college league to that day's rankings and its standings", () => {
    const navigate = vi.fn()
    render(<LeagueSection id="ncaaf" label="NCAAF" games={[]} navigate={navigate} date="2025-11-29" />)
    const rankings = screen.getByRole('link', { name: 'RANKINGS' })
    expect(rankings.getAttribute('href')).toBe('/sports/rankings/ncaaf?date=2025-11-29')
    fireEvent.click(rankings)
    expect(navigate).toHaveBeenCalledWith('/sports/rankings/ncaaf?date=2025-11-29')
    expect(screen.getByRole('link', { name: 'STANDINGS' }).getAttribute('href')).toBe('/sports/standings/ncaaf')
    expect(screen.getByText('No games today')).toBeTruthy()
  })

  it('links a pro league to its standings only', () => {
    render(<LeagueSection id="nfl" label="NFL" games={[]} navigate={vi.fn()} />)
    expect(screen.queryByRole('link', { name: 'RANKINGS' })).toBeNull()
    expect(screen.getByRole('link', { name: 'STANDINGS' }).getAttribute('href')).toBe('/sports/standings/nfl')
  })
})
