import { describe, it, expect } from 'vitest'
import { formatDateTime, formatDate } from './gameTime.js'

describe('formatDateTime', () => {
  it.each([
    ['null dateStr with a fallback', null, 'Q1 12:00', 'Q1 12:00'],
    ['undefined dateStr with no fallback', undefined, undefined, 'TBD'],
    ['empty string dateStr', '', 'fallback', 'fallback'],
    ['invalid date string with a fallback', 'not-a-date', '7:30 PM ET', '7:30 PM ET'],
    ['invalid date string with no fallback', 'not-a-date', undefined, 'TBD'],
  ])('%s', (_label, dateStr, fallback, expected) => {
    expect(formatDateTime(dateStr, fallback)).toBe(expected)
  })

  it('formats a valid ISO date', () => {
    // TZ=UTC pinned in the npm test script
    expect(formatDateTime('2026-01-15T18:30:00Z')).toMatch(
      /^Jan 15, \d{1,2}:\d{2}[\s\u202f](AM|PM)$/u
    )
  })
})

describe('formatDate', () => {
  it.each([
    ['invalid date string', 'not-a-date'],
    ['empty string', ''],
    ['null', null],
  ])('returns "" for %s', (_label, dateStr) => {
    expect(formatDate(dateStr)).toBe('')
  })

  it('formats a valid ISO date as "Mon D"', () => {
    expect(formatDate('2026-03-01T12:00:00Z')).toBe('Mar 1')
  })
})
