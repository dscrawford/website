import { describe, it, expect } from 'vitest'
import { formatMatchup, formatVenue } from './gameVenue.js'

const teams = { awayTeam: { abbreviation: 'TEX' }, homeTeam: { abbreviation: 'OU' } }

describe('formatMatchup', () => {
  it('reads away @ home for a normal game', () => {
    expect(formatMatchup({ ...teams, neutralSite: false })).toBe('TEX @ OU')
  })

  it('reads away vs home at a neutral site', () => {
    expect(formatMatchup({ ...teams, neutralSite: true })).toBe('TEX vs OU')
  })

  it('is empty when a team is missing', () => {
    expect(formatMatchup({ awayTeam: { abbreviation: 'TEX' } })).toBe('')
    expect(formatMatchup(null)).toBe('')
  })
})

describe('formatVenue', () => {
  it('joins stadium, city and state', () => {
    expect(formatVenue({ name: 'Cotton Bowl', city: 'Dallas', state: 'TX' })).toBe('Cotton Bowl \u00B7 Dallas, TX')
  })

  it('drops missing parts', () => {
    expect(formatVenue({ name: 'Aviva Stadium', city: 'Dublin', state: null })).toBe('Aviva Stadium \u00B7 Dublin')
    expect(formatVenue({ name: 'Somewhere', city: null, state: null })).toBe('Somewhere')
  })

  it('is empty without a stadium name', () => {
    expect(formatVenue(null)).toBe('')
    expect(formatVenue({ city: 'Dallas', state: 'TX' })).toBe('')
  })
})
