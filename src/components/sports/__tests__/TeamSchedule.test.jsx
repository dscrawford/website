// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import TeamSchedule from '../TeamSchedule.jsx'

const game = (id, date, extra = {}) => ({
  id,
  date,
  opponent: { abbreviation: 'SEA', name: 'Seattle Mariners' },
  home: true,
  teamScore: 6,
  opponentScore: 4,
  result: 'W',
  state: 'post',
  detail: 'Final',
  ...extra,
})

const SCHEDULE = {
  teamId: '5',
  team: { abbreviation: 'CLE', name: 'Cleveland Guardians', record: '71-70' },
  season: '2026',
  fetchedAt: 'x',
  games: [
    game('1', '2026-03-27T02:10Z'),
    game('2', '2026-03-28T02:10Z', { home: false, teamScore: 3, opponentScore: 5, result: 'L' }),
    game('3', '2026-03-29T02:10Z', { teamScore: 2, opponentScore: 2, result: 'T' }),
    game('4', '2026-03-30T02:10Z', { teamScore: null, opponentScore: null, result: null, state: 'post', detail: 'Postponed' }),
    game('5', '2026-03-31T02:10Z', { teamScore: 1, opponentScore: 0, result: null, state: 'in', detail: 'Top 5th' }),
    game('6', '2026-04-01T02:10Z', { teamScore: null, opponentScore: null, result: null, state: 'pre', detail: '4/1 - 7:10 PM' }),
  ],
}

const noop = () => {}

describe('TeamSchedule', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollTo = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    delete HTMLElement.prototype.scrollTo
  })

  it('renders the team, season and one compact row per game', () => {
    render(<TeamSchedule schedule={SCHEDULE} loading={false} error={false} onRetry={noop} currentGameId="5" />)
    expect(screen.getByText('CLE')).toBeTruthy()
    expect(screen.getByText(/2026/)).toBeTruthy()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(6)

    const first = within(rows[0])
    expect(first.getByText('Mar 27')).toBeTruthy()
    expect(first.getByText('vs SEA')).toBeTruthy()
    expect(first.getByText('6-4')).toBeTruthy()
    expect(first.getByText('W').className).toContain('sched-result--w')

    expect(within(rows[1]).getByText('@ SEA')).toBeTruthy()
    expect(within(rows[1]).getByText('L').className).toContain('sched-result--l')
    expect(within(rows[2]).getByText('T').className).toContain('sched-result--t')
  })

  it('shows the season record next to the team, preferring the schedule and falling back to the scoreboard', () => {
    const { rerender, container } = render(<TeamSchedule schedule={SCHEDULE} loading={false} error={false} onRetry={noop} currentGameId="5" record="70-71" />)
    expect(screen.getByText('71-70').className).toBe('sched-record')
    expect(screen.queryByText('70-71')).toBeNull()

    const noRecord = { ...SCHEDULE, team: { ...SCHEDULE.team, record: null } }
    rerender(<TeamSchedule schedule={noRecord} loading={false} error={false} onRetry={noop} currentGameId="5" record="10-6-1" />)
    expect(screen.getByText('10-6-1')).toBeTruthy()

    rerender(<TeamSchedule schedule={noRecord} loading={false} error={false} onRetry={noop} currentGameId="5" record={null} />)
    expect(container.querySelector('.sched-record')).toBeNull()
  })

  it('reads "vs" for neutral-site games even when the team is listed as away', () => {
    const neutral = { ...SCHEDULE, games: [game('n', '2026-10-10T16:30Z', { home: false, neutral: true, opponent: { abbreviation: 'TEX', name: 'Texas' } })] }
    render(<TeamSchedule schedule={neutral} loading={false} error={false} onRetry={noop} currentGameId="n" />)
    expect(screen.getByText('vs TEX')).toBeTruthy()
  })

  it('shows status instead of a score for postponed and upcoming games, and the live score for in-progress ones', () => {
    render(<TeamSchedule schedule={SCHEDULE} loading={false} error={false} onRetry={noop} currentGameId="5" />)
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[3]).getByText('Postponed')).toBeTruthy()
    expect(within(rows[3]).queryByText(/\d-\d/)).toBeNull()
    expect(within(rows[4]).getByText('1-0')).toBeTruthy()
    expect(within(rows[4]).queryByText(/^[WLT]$/)).toBeNull()
    expect(within(rows[5]).queryByText(/\d-\d/)).toBeNull()
    expect(within(rows[5]).queryByText(/^[WLT]$/)).toBeNull()
  })

  it('highlights the current game and scrolls so it and the previous four are in view', () => {
    // jsdom has no layout; give each row a synthetic offset so the maths is checkable
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function () {
      if (this.tagName !== 'LI') return 100
      return 100 + Array.from(this.parentElement.children).indexOf(this) * 20
    })
    render(<TeamSchedule schedule={SCHEDULE} loading={false} error={false} onRetry={noop} currentGameId="6" />)
    const rows = screen.getAllByRole('listitem')
    expect(rows[5].getAttribute('aria-current')).toBe('true')
    expect(rows[5].className).toContain('sched-row--current')
    expect(rows[0].getAttribute('aria-current')).toBeNull()
    // Index 5 is current, so row index 1 (5 - 4) sits at the top of the viewport
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({ top: 100 + 1 * 20 - 100 })
  })

  it('falls back to the next unplayed game when the current game is not in the schedule', () => {
    render(<TeamSchedule schedule={SCHEDULE} loading={false} error={false} onRetry={noop} currentGameId="h1a2b3c4" />)
    const rows = screen.getAllByRole('listitem')
    expect(rows[4].getAttribute('aria-current')).toBe('true')
  })

  it('shows loading, error with retry, and empty states', () => {
    const { rerender } = render(<TeamSchedule schedule={null} loading error={false} onRetry={noop} currentGameId="5" />)
    expect(screen.getByText(/loading/i)).toBeTruthy()

    const onRetry = vi.fn()
    rerender(<TeamSchedule schedule={null} loading={false} error onRetry={onRetry} currentGameId="5" />)
    screen.getByRole('button', { name: /retry/i }).click()
    expect(onRetry).toHaveBeenCalled()

    rerender(<TeamSchedule schedule={{ ...SCHEDULE, games: [] }} loading={false} error={false} onRetry={noop} currentGameId="5" />)
    expect(screen.getByText(/no games/i)).toBeTruthy()
  })
})
