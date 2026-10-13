import { describe, it, expect } from 'vitest'
import { transformRanking, transformTeamIndex } from './rankings-transformer.js'

const TEAMS = transformTeamIndex({
  sports: [
    {
      leagues: [
        {
          teams: [
            { team: { id: '61', abbreviation: 'UGA', displayName: 'Georgia Bulldogs', logos: [{ href: 'https://a.espncdn.com/61.png' }] } },
            { team: { id: '87', abbreviation: 'ND', displayName: 'Notre Dame Fighting Irish', logos: [] } },
            { team: { abbreviation: 'NOID' } },
          ],
        },
      ],
    },
  ],
})

const rank = (id, current, extra = {}) => ({
  current,
  previous: current + 1,
  points: 100 - current,
  firstPlaceVotes: current === 1 ? 60 : 0,
  trend: '+1',
  record: { summary: '6-0' },
  team: { $ref: `http://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/2026/teams/${id}?lang=en` },
  ...extra,
})

const RAW = {
  id: '1',
  name: 'AP Top 25',
  shortName: 'AP Poll',
  type: 'ap',
  occurrence: { displayValue: 'Week 7' },
  date: '2026-10-11T07:00Z',
  shortHeadline: '2026 AP Poll: Week 7',
  ranks: [rank('87', 2), rank('61', 1)],
  others: [rank('999', 0, { trend: '+26' })],
  droppedOut: [rank('87', 0, { previous: 13 })],
}

describe('transformTeamIndex', () => {
  it('maps ids to names and logos and drops teams without an id', () => {
    expect(Object.keys(TEAMS)).toEqual(['61', '87'])
    expect(TEAMS['61']).toEqual({ abbreviation: 'UGA', name: 'Georgia Bulldogs', logo: 'https://a.espncdn.com/61.png' })
    expect(TEAMS['87'].logo).toBeNull()
    expect(transformTeamIndex(null)).toEqual({})
  })
})

describe('transformRanking', () => {
  it('resolves team references through the index and orders ranks first to last', () => {
    const poll = transformRanking(RAW, TEAMS)
    expect(poll).toMatchObject({ id: '1', type: 'ap', name: 'AP Top 25', shortName: 'AP Poll', week: 'Week 7', date: '2026-10-11T07:00Z', headline: '2026 AP Poll: Week 7' })
    expect(poll.ranks.map((r) => r.rank)).toEqual([1, 2])
    expect(poll.ranks[0]).toEqual({
      rank: 1,
      previous: 2,
      trend: '+1',
      points: 99,
      firstPlaceVotes: 60,
      record: '6-0',
      team: { id: '61', abbreviation: 'UGA', name: 'Georgia Bulldogs', logo: 'https://a.espncdn.com/61.png' },
    })
    expect(poll.others[0].team).toEqual({ id: '999', abbreviation: '???', name: 'Unknown', logo: null })
    expect(poll.droppedOut[0]).toMatchObject({ previous: 13, team: { abbreviation: 'ND' } })
  })

  it('also accepts site-API shaped entries that embed the team', () => {
    const poll = transformRanking(
      { ...RAW, ranks: [{ current: 1, team: { id: '5', abbreviation: 'TEX', displayName: 'Texas Longhorns' }, recordSummary: '3-0' }] },
      {}
    )
    expect(poll.ranks[0].record).toBe('3-0')
    expect(poll.ranks[0].team).toEqual({ id: '5', abbreviation: 'TEX', name: 'Texas Longhorns', logo: null })
  })

  it('rejects polls without an id or type and survives malformed entries', () => {
    expect(transformRanking(null)).toBeNull()
    expect(transformRanking({ name: 'x' })).toBeNull()
    const poll = transformRanking({ ...RAW, ranks: [null, 42, rank('61', 1)] }, TEAMS)
    expect(poll.ranks).toHaveLength(1)
  })

  it('scrubs control characters out of upstream strings', () => {
    const poll = transformRanking({ ...RAW, name: 'AP\u0000 Top‮ 25' }, TEAMS)
    expect(poll.name).toBe('AP  Top  25')
  })
})
