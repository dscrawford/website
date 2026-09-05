// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import BoxScore from '../BoxScore.jsx'

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
          labels: ['AB', 'R', 'H'],
          totals: ['33', '3', '9'],
          players: [
            { name: 'Dane Myers', shortName: 'D. Myers', position: 'CF', stats: ['3', '0', '0'] },
          ],
        },
      ],
    },
  ],
}

const FOOTBALL_BOX = {
  gameId: '402',
  fetchedAt: 'x',
  teams: [
    {
      name: 'Oklahoma Sooners',
      abbreviation: 'OU',
      groups: [
        {
          name: 'passing',
          labels: ['C/ATT', 'INT', 'ZZZ'],
          descriptions: ['Completions/Attempts', 'Interceptions', 'Zed Score'],
          totals: ['5/6', '0', '1'],
          players: [{ name: 'John Mateer', shortName: 'J. Mateer', position: 'QB', stats: ['5/6', '0', '1'] }],
        },
        {
          name: 'interceptions',
          labels: ['INT'],
          totals: [''],
          players: [],
        },
      ],
    },
  ],
}

const noop = () => {}

describe('BoxScore', () => {
  afterEach(cleanup)

  it('renders team, group, header labels, player rows and totals', () => {
    render(<BoxScore boxScore={BOX} loading={false} error={false} onRetry={noop} />)
    expect(screen.getByText('Cincinnati Reds')).toBeTruthy()
    expect(screen.getByText(/batting/i)).toBeTruthy()
    expect(screen.getByText('AB')).toBeTruthy()
    expect(screen.getByText('D. Myers')).toBeTruthy()
    expect(screen.getByText('CF')).toBeTruthy()
    expect(screen.getByText('33')).toBeTruthy()
  })

  it('explains stat headers on hover using the group for context', () => {
    render(<BoxScore boxScore={FOOTBALL_BOX} sport="football" loading={false} error={false} onRetry={noop} />)
    const [passingInt, pickInt] = screen.getAllByRole('columnheader', { name: 'INT' })

    fireEvent.mouseEnter(passingInt)
    expect(screen.getByRole('tooltip').textContent).toContain('Interceptions Thrown')
    fireEvent.mouseLeave(passingInt)

    fireEvent.mouseEnter(pickInt)
    expect(screen.getByRole('tooltip').textContent).toContain('Interceptions')
    expect(screen.getByRole('tooltip').textContent).not.toContain('Thrown')
  })

  it('falls back to the upstream description for labels the glossary does not know', () => {
    render(<BoxScore boxScore={FOOTBALL_BOX} sport="football" loading={false} error={false} onRetry={noop} />)
    fireEvent.mouseEnter(screen.getByRole('columnheader', { name: 'ZZZ' }))
    expect(screen.getByRole('tooltip').textContent).toBe('Zed Score')
  })

  it.each([
    ['descriptions shorter than labels', ['Completions/Attempts']],
    ['an empty-string description', ['Completions/Attempts', '']],
    ['no descriptions at all', undefined],
  ])('shows no tooltip for an unknown label with %s', (_case, descriptions) => {
    const box = {
      gameId: '1',
      fetchedAt: 'x',
      teams: [{ name: 'T', abbreviation: 'T', groups: [{ name: 'passing', labels: ['C/ATT', 'ZZZ'], descriptions, totals: ['', ''], players: [] }] }],
    }
    render(<BoxScore boxScore={box} sport="football" loading={false} error={false} onRetry={noop} />)
    fireEvent.mouseEnter(screen.getByRole('columnheader', { name: 'ZZZ' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('resolves baseball headers without a sport prop from the group alone', () => {
    render(<BoxScore boxScore={BOX} loading={false} error={false} onRetry={noop} />)
    fireEvent.mouseEnter(screen.getByRole('columnheader', { name: 'AB' }))
    expect(screen.getByRole('tooltip').textContent).toContain('At Bats')
  })

  it('leaves the player column header without a tooltip', () => {
    render(<BoxScore boxScore={BOX} loading={false} error={false} onRetry={noop} />)
    fireEvent.mouseEnter(screen.getByRole('columnheader', { name: 'PLAYER' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows a loading state', () => {
    render(<BoxScore boxScore={null} loading error={false} onRetry={noop} />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })

  it('shows an empty message when there are no player stats yet', () => {
    render(
      <BoxScore boxScore={{ gameId: '1', teams: [], fetchedAt: null }} loading={false} error={false} onRetry={noop} />
    )
    expect(screen.getByText(/not available/i)).toBeTruthy()
  })

  it('shows an error state with a retry control', () => {
    render(<BoxScore boxScore={null} loading={false} error onRetry={noop} />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })
})
