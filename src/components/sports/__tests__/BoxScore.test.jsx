// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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

describe('BoxScore', () => {
  afterEach(cleanup)

  it('renders team, group, header labels, player rows and totals', () => {
    render(<BoxScore boxScore={BOX} loading={false} error={false} onRetry={() => {}} />)
    expect(screen.getByText('Cincinnati Reds')).toBeTruthy()
    expect(screen.getByText(/batting/i)).toBeTruthy()
    expect(screen.getByText('AB')).toBeTruthy()
    expect(screen.getByText('D. Myers')).toBeTruthy()
    expect(screen.getByText('CF')).toBeTruthy()
    expect(screen.getByText('33')).toBeTruthy()
  })

  it('shows a loading state', () => {
    render(<BoxScore boxScore={null} loading error={false} onRetry={() => {}} />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })

  it('shows an empty message when there are no player stats yet', () => {
    render(
      <BoxScore boxScore={{ gameId: '1', teams: [], fetchedAt: null }} loading={false} error={false} onRetry={() => {}} />
    )
    expect(screen.getByText(/not available/i)).toBeTruthy()
  })

  it('shows an error state with a retry control', () => {
    render(<BoxScore boxScore={null} loading={false} error onRetry={() => {}} />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })
})
