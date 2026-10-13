import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./cache.js', () => ({ get: vi.fn(), set: vi.fn() }))
vi.mock('./espn-client.js', () => ({
  fetchScoreboard: vi.fn(),
  fetchSeason: vi.fn(),
  fetchTeams: vi.fn(),
  fetchRankingsIndex: vi.fn(),
  fetchRanking: vi.fn(),
}))

import * as cache from './cache.js'
import { fetchScoreboard, fetchSeason, fetchTeams, fetchRankingsIndex, fetchRanking } from './espn-client.js'
import { getRankings } from './rankings-fetcher.js'
import { DATE_CACHE_TTL_SECONDS, RANKINGS_CACHE_TTL_SECONDS } from '../config.js'

const CALENDAR = {
  leagues: [
    {
      season: { year: 2025, displayName: '2025', startDate: '2025-02-01T08:00Z' },
      calendar: [
        {
          value: '2',
          entries: [
            { label: 'Week 13', value: '13', startDate: '2025-11-18T08:00Z', endDate: '2025-11-25T07:59Z' },
            { label: 'Week 14', value: '14', startDate: '2025-11-25T08:00Z', endDate: '2025-12-02T07:59Z' },
          ],
        },
        { value: '3', entries: [{ label: 'Bowls', value: '1', startDate: '2025-12-13T08:00Z', endDate: '2026-01-21T07:59Z' }] },
      ],
    },
  ],
}

const ref = (week, poll) => ({ $ref: `http://x/seasons/2025/types/2/weeks/${week}/rankings/${poll}?lang=en` })
const poll = (id, type, week, date, teamId = '61') => ({
  id,
  type,
  name: `Poll ${id}`,
  occurrence: { displayValue: `Week ${week}` },
  date,
  ranks: [{ current: 1, team: { $ref: `http://x/teams/${teamId}` } }],
})
const TEAMS = { sports: [{ leagues: [{ teams: [{ team: { id: '61', abbreviation: 'UGA', displayName: 'Georgia Bulldogs' } }] }] }] }

describe('getRankings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    cache.get.mockResolvedValue(null)
    fetchScoreboard.mockResolvedValue(CALENDAR)
    fetchTeams.mockResolvedValue(TEAMS)
  })

  it('returns null for leagues without polls or malformed dates without calling ESPN', async () => {
    expect(await getRankings('nfl', '2025-11-23')).toBeNull()
    expect(await getRankings('ncaaf', '2025-13-45')).toBeNull()
    expect(await getRankings('cricket')).toBeNull()
    expect(fetchScoreboard).not.toHaveBeenCalled()
  })

  it('serves a cached day without touching ESPN', async () => {
    const hit = { league: 'ncaaf', date: '2025-11-23', polls: [] }
    cache.get.mockResolvedValueOnce(hit)
    expect(await getRankings('ncaaf', '2025-11-23')).toBe(hit)
    expect(cache.get).toHaveBeenCalledWith('rank:ncaaf@2025-11-23')
    expect(fetchScoreboard).not.toHaveBeenCalled()
  })

  it("picks, per poll, the latest edition out by the end of the day across the day's week and the next", async () => {
    // Sunday Nov 23: AP week 14 is out that morning, the CFP week 14 not until Tuesday
    fetchRankingsIndex.mockImplementation(async (_s, _l, _y, type, week) =>
      type === 3 ? { items: [] } : week === 13 ? { items: [ref(13, '1'), ref(13, '21'), ref(13, '20')] } : { items: [ref(14, '1'), ref(14, '21')] }
    )
    fetchRanking.mockImplementation(async (_s, _l, _y, _t, week, id) => {
      if (id === '1') return poll('1', 'ap', week, week === 13 ? '2025-11-16T08:00Z' : '2025-11-23T08:00Z')
      if (id === '21') return poll('21', 'cfp', week, week === 13 ? '2025-11-18T08:00Z' : '2025-11-25T08:00Z')
      return null
    })

    const out = await getRankings('ncaaf', '2025-11-23')
    expect(out).toMatchObject({ league: 'ncaaf', label: 'NCAAF', date: '2025-11-23', season: { year: 2025, label: '2025' }, week: 'Week 13' })
    expect(out.polls.map((p) => [p.id, p.week])).toEqual([
      ['1', 'Week 14'],
      ['21', 'Week 13'],
    ])
    expect(out.polls[0].ranks[0].team).toMatchObject({ abbreviation: 'UGA', name: 'Georgia Bulldogs' })
    // AP and CFP from week 14, then only the CFP again from week 13; never
    // the FCS poll ESPN also lists
    expect(fetchRanking).toHaveBeenCalledTimes(3)
    expect(fetchRanking).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), '20')
    expect(cache.set).toHaveBeenCalledWith('rank:ncaaf@2025-11-23', out, DATE_CACHE_TTL_SECONDS)
    expect(cache.set).toHaveBeenCalledWith('grid:ncaaf@2025', expect.objectContaining({ year: 2025 }), expect.any(Number))
    expect(cache.set).toHaveBeenCalledWith('teams:ncaaf', expect.objectContaining({ 61: expect.anything() }), expect.any(Number))
  })

  it('walks back to the last published edition when the current week has none, such as bowl season', async () => {
    fetchRankingsIndex.mockImplementation(async (_s, _l, _y, type, week) => (type === 2 && week === 14 ? { items: [ref(14, '1'), ref(14, '2'), ref(14, '21')] } : { items: [] }))
    fetchRanking.mockImplementation(async (_s, _l, _y, _t, week, id) => poll(id, id, week, '2025-11-30T08:00Z'))

    const out = await getRankings('ncaaf', '2025-12-20')
    expect(out.week).toBe('Bowls')
    expect(out.polls.map((p) => [p.id, p.week])).toEqual([
      ['1', 'Week 14'],
      ['2', 'Week 14'],
      ['21', 'Week 14'],
    ])
    // Bowls, then back through week 14: the search stops once every poll is found
    expect(fetchRankingsIndex).toHaveBeenCalledTimes(2)
  })

  it('does not cache a day when any poll, the index or the team directory failed to load', async () => {
    fetchRankingsIndex.mockResolvedValue({ items: [ref(14, '1')] })
    fetchRanking.mockResolvedValue(null)
    expect(await getRankings('ncaaf', '2025-11-29')).toBeNull()
    expect(cache.set).not.toHaveBeenCalledWith(expect.stringMatching(/^rank:/), expect.anything(), expect.anything())

    fetchRanking.mockImplementation(async (_s, _l, _y, _t, week, id) => poll(id, 'ap', week, '2025-11-23T08:00Z'))
    fetchTeams.mockResolvedValue(null)
    expect(await getRankings('ncaaf', '2025-11-29')).toBeNull()

    fetchTeams.mockResolvedValue(TEAMS)
    fetchRankingsIndex.mockResolvedValue(null)
    expect(await getRankings('ncaaf', '2025-11-29')).toBeNull()
    expect(cache.set).not.toHaveBeenCalledWith(expect.stringMatching(/^rank:/), expect.anything(), expect.anything())
  })

  it("defaults to today with the live TTL and lays basketball weeks out from the season's type dates", async () => {
    const today = new Date().toISOString().slice(0, 10)
    fetchScoreboard.mockResolvedValue({ leagues: [{ season: { year: 2026, displayName: '2025-26' }, calendar: ['2025-11-03T08:00Z'] }] })
    fetchSeason.mockResolvedValue({
      year: 2026,
      displayName: '2025-26',
      types: { items: [{ type: 2, startDate: '2025-11-03T08:00Z', endDate: '2026-03-17T06:59Z' }] },
    })
    fetchRankingsIndex.mockResolvedValue({ items: [] })

    const out = await getRankings('cbb')
    expect(fetchSeason).toHaveBeenCalledWith('basketball', 'mens-college-basketball', 2026)
    expect(out).toMatchObject({ league: 'cbb', date: today, season: { year: 2026, label: '2025-26' }, polls: [] })
    expect(cache.set).toHaveBeenCalledWith(`rank:cbb@${today}`, out, RANKINGS_CACHE_TTL_SECONDS)
  })

  it('returns null, caching nothing, when the season cannot be resolved', async () => {
    fetchScoreboard.mockResolvedValue(null)
    expect(await getRankings('ncaaf', '2025-11-23')).toBeNull()
    expect(cache.set).not.toHaveBeenCalled()
  })

  it('dedups concurrent misses for one day into one pipeline run', async () => {
    fetchRankingsIndex.mockResolvedValue({ items: [] })
    const [a, b] = await Promise.all([getRankings('ncaaf', '2025-11-23'), getRankings('ncaaf', '2025-11-23')])
    expect(a).toBe(b)
    expect(fetchScoreboard).toHaveBeenCalledTimes(1)
  })
})
