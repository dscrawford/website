import { describe, it, expect } from 'vitest'
import { gridFromCalendar, gridFromSeasonTypes, weekIndexAt } from './season-grid.js'

const CALENDAR = {
  leagues: [
    {
      season: { year: 2025, displayName: '2025', startDate: '2025-02-01T08:00Z', endDate: '2026-01-21T07:59Z' },
      calendar: [
        {
          label: 'Regular Season',
          value: '2',
          entries: [
            { label: 'Week 1', value: '1', startDate: '2025-08-23T07:00Z', endDate: '2025-09-02T06:59Z' },
            { label: 'Week 2', value: '2', startDate: '2025-09-02T07:00Z', endDate: '2025-09-08T06:59Z' },
            { label: 'Week 3', value: '3', startDate: '2025-09-08T07:00Z', endDate: '2025-09-15T06:59Z' },
          ],
        },
        {
          label: 'Postseason',
          value: '3',
          entries: [
            { label: 'Bowls', value: '1', startDate: '2025-12-13T08:00Z', endDate: '2026-01-21T07:59Z' },
            { label: 'CFP', value: '999', startDate: '2025-12-19T08:00Z', endDate: '2026-01-20T07:59Z' },
          ],
        },
        { label: 'Off Season', value: '4', entries: [{ label: 'All-Star', value: '1', startDate: '2026-01-21T08:00Z', endDate: '2026-02-01T07:59Z' }] },
      ],
    },
  ],
}

const SEASON = {
  year: 2026,
  displayName: '2025-26',
  types: {
    items: [
      { type: 1, startDate: '2025-07-01T07:00Z', endDate: '2025-11-03T07:59Z' },
      { type: 2, startDate: '2025-11-03T08:00Z', endDate: '2026-03-17T06:59Z' },
      { type: 3, startDate: '2026-03-17T07:00Z', endDate: '2026-04-08T06:59Z' },
      { type: 4, startDate: '2026-04-08T07:00Z', endDate: '2026-07-13T06:59Z' },
    ],
  },
}

describe('gridFromCalendar', () => {
  it('lays out regular-season and bowl weeks from the scoreboard calendar, with a preseason week before them', () => {
    const grid = gridFromCalendar(CALENDAR)
    expect(grid.year).toBe(2025)
    expect(grid.label).toBe('2025')
    expect(grid.weeks.map((w) => [w.type, w.week, w.label])).toEqual([
      [1, 1, 'Preseason'],
      [2, 1, 'Week 1'],
      [2, 2, 'Week 2'],
      [2, 3, 'Week 3'],
      [3, 1, 'Bowls'],
    ])
    expect(grid.weeks[0].start).toBe(Date.parse('2025-02-01T08:00Z'))
    expect(grid.weeks[0].end).toBe(Date.parse('2025-08-23T07:00Z') - 1)
  })

  it('skips synthetic calendar entries and the off season, and rejects payloads without a calendar', () => {
    const labels = gridFromCalendar(CALENDAR).weeks.map((w) => w.label)
    expect(labels).not.toContain('CFP')
    expect(labels).not.toContain('All-Star')
    expect(gridFromCalendar({ leagues: [{ season: { year: 2025 }, calendar: [] }] })).toBeNull()
    expect(gridFromCalendar(null)).toBeNull()
  })
})

describe('gridFromSeasonTypes', () => {
  it('counts seven-day weeks from the regular season start through the postseason', () => {
    const grid = gridFromSeasonTypes(SEASON)
    expect(grid.year).toBe(2026)
    expect(grid.label).toBe('2025-26')
    const regular = grid.weeks.filter((w) => w.type === 2)
    const post = grid.weeks.filter((w) => w.type === 3)
    expect(regular).toHaveLength(20)
    expect(post).toHaveLength(3)
    expect(regular[0].start).toBe(Date.parse('2025-11-03T08:00Z'))
    expect(regular[19].start).toBe(Date.parse('2026-03-16T08:00Z'))
    expect(post[0]).toMatchObject({ week: 1, label: 'Week 21' })
    expect(post[0].start).toBe(Date.parse('2026-03-23T08:00Z'))
  })

  it('rejects seasons without regular-season dates', () => {
    expect(gridFromSeasonTypes({ year: 2026, types: { items: [] } })).toBeNull()
    expect(gridFromSeasonTypes(null)).toBeNull()
  })
})

describe('weekIndexAt', () => {
  const weeks = gridFromCalendar(CALENDAR).weeks

  it('finds the week a day falls in', () => {
    expect(weeks[weekIndexAt(weeks, '2025-09-06')].label).toBe('Week 2')
    expect(weeks[weekIndexAt(weeks, '2025-09-08')].label).toBe('Week 3')
    expect(weeks[weekIndexAt(weeks, '2025-08-20')].label).toBe('Preseason')
    expect(weeks[weekIndexAt(weeks, '2026-01-01')].label).toBe('Bowls')
  })

  it('holds the last started week through gaps and after the season, and -1 before it', () => {
    expect(weeks[weekIndexAt(weeks, '2025-10-15')].label).toBe('Week 3')
    expect(weeks[weekIndexAt(weeks, '2026-01-25')].label).toBe('Bowls')
    expect(weekIndexAt(weeks, '2025-01-01')).toBe(-1)
    expect(weekIndexAt(weeks, 'nonsense')).toBe(-1)
  })
})
