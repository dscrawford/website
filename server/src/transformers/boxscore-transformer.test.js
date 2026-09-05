import { describe, it, expect } from 'vitest'
import { transformBoxScore } from './boxscore-transformer.js'

function mlbLikeSummary() {
  return {
    boxscore: {
      players: [
        {
          team: { displayName: 'Cincinnati Reds', abbreviation: 'CIN' },
          statistics: [
            {
              type: 'batting',
              labels: ['H-AB', 'AB', 'R', 'H', 'RBI'],
              totals: ['9-33', '33', '3', '9', '3'],
              athletes: [
                {
                  athlete: {
                    displayName: 'Dane Myers',
                    shortName: 'D. Myers',
                    position: { abbreviation: 'CF' },
                  },
                  stats: ['0-3', '3', '0', '0', '0'],
                },
                {
                  athlete: { displayName: 'Elly De La Cruz' },
                  position: { abbreviation: 'SS' },
                  stats: ['2-4', '4', '1', '2', '1'],
                },
              ],
            },
            {
              name: 'pitching',
              labels: ['IP', 'H', 'R'],
              totals: ['8.0', '6', '3'],
              athletes: [
                {
                  athlete: { displayName: 'Rhett Lowder', position: { abbreviation: 'P' } },
                  stats: ['5.0', '6', '3'],
                },
              ],
            },
          ],
        },
        {
          team: { displayName: 'Chicago Cubs', abbreviation: 'CHC' },
          statistics: [],
        },
      ],
    },
  }
}

describe('transformBoxScore', () => {
  it('maps teams, stat groups and player rows', () => {
    const out = transformBoxScore(mlbLikeSummary())
    expect(out.teams).toHaveLength(2)

    const [reds, cubs] = out.teams
    expect(reds.name).toBe('Cincinnati Reds')
    expect(reds.abbreviation).toBe('CIN')
    expect(reds.groups).toHaveLength(2)

    const batting = reds.groups[0]
    expect(batting.name).toBe('batting')
    expect(batting.labels).toEqual(['H-AB', 'AB', 'R', 'H', 'RBI'])
    expect(batting.totals).toEqual(['9-33', '33', '3', '9', '3'])
    expect(batting.players[0]).toEqual({
      name: 'Dane Myers',
      shortName: 'D. Myers',
      position: 'CF',
      stats: ['0-3', '3', '0', '0', '0'],
    })
    // entry-level position (MLB shape) also resolves
    expect(batting.players[1].position).toBe('SS')

    expect(cubs.groups).toEqual([])
  })

  it('group name falls back to type then "stats"', () => {
    const raw = mlbLikeSummary()
    expect(transformBoxScore(raw).teams[0].groups[0].name).toBe('batting')
    delete raw.boxscore.players[0].statistics[0].type
    expect(transformBoxScore(raw).teams[0].groups[0].name).toBe('stats')
  })

  it('returns empty teams for pregame summaries without players', () => {
    expect(transformBoxScore({ boxscore: { teams: [] } })).toEqual({ teams: [] })
    expect(transformBoxScore({})).toEqual({ teams: [] })
    expect(transformBoxScore(null)).toEqual({ teams: [] })
  })

  it('caps hostile array sizes and string lengths', () => {
    const raw = {
      boxscore: {
        players: Array.from({ length: 10 }, () => ({
          team: { displayName: 'x'.repeat(500) },
          statistics: Array.from({ length: 20 }, () => ({
            type: 'g',
            labels: Array.from({ length: 100 }, () => 'L'.repeat(99)),
            totals: [],
            athletes: Array.from({ length: 200 }, () => ({
              athlete: { displayName: 'p'.repeat(300) },
              stats: Array.from({ length: 100 }, () => 's'.repeat(99)),
            })),
          })),
        })),
      },
    }
    const out = transformBoxScore(raw)
    expect(out.teams.length).toBeLessThanOrEqual(2)
    const g = out.teams[0].groups
    expect(g.length).toBeLessThanOrEqual(6)
    expect(g[0].labels.length).toBeLessThanOrEqual(16)
    expect(g[0].players.length).toBeLessThanOrEqual(60)
    expect(g[0].players[0].stats.length).toBeLessThanOrEqual(16)
    expect(g[0].players[0].name.length).toBeLessThanOrEqual(64)
    expect(g[0].labels[0].length).toBeLessThanOrEqual(16)
  })

  it('drops athletes with no resolvable name and freezes output', () => {
    const raw = mlbLikeSummary()
    raw.boxscore.players[0].statistics[0].athletes.push({ athlete: {}, stats: ['1'] })
    const out = transformBoxScore(raw)
    expect(out.teams[0].groups[0].players).toHaveLength(2)
    expect(Object.isFrozen(out)).toBe(true)
    expect(Object.isFrozen(out.teams[0].groups[0].players[0])).toBe(true)
  })

  it('coerces non-string stats safely', () => {
    const raw = mlbLikeSummary()
    raw.boxscore.players[0].statistics[0].athletes[0].stats = [5, null, { evil: 1 }, 'ok']
    const stats = transformBoxScore(raw).teams[0].groups[0].players[0].stats
    expect(stats).toEqual(['5', '', '', 'ok'])
  })
})

describe('transformBoxScore descriptions', () => {
  function summaryWith(group) {
    return { boxscore: { players: [{ team: { displayName: 'X' }, statistics: [group] }] } }
  }

  it('passes ESPN column descriptions through alongside labels', () => {
    const out = transformBoxScore(
      summaryWith({ name: 'passing', labels: ['C/ATT', 'INT'], descriptions: ['Completions/Attempts', 'Interceptions'] })
    )
    const group = out.teams[0].groups[0]
    expect(group.descriptions).toEqual(['Completions/Attempts', 'Interceptions'])
    expect(Object.isFrozen(group.descriptions)).toBe(true)
  })

  it('keeps descriptions index-aligned with labels', () => {
    const out = transformBoxScore(
      summaryWith({ name: 'passing', labels: ['A', 'B'], descriptions: ['a', 'b', 'c', 'd'] })
    )
    expect(out.teams[0].groups[0].descriptions).toEqual(['a', 'b'])
  })

  it('strips control and bidi-override characters from upstream text', () => {
    const out = transformBoxScore(
      summaryWith({
        name: 'pass\u0000ing',
        labels: ['IN\u200BT'],
        descriptions: ['\u202ETcatnoc\u202C support\n at evil.example  '],
      })
    )
    const group = out.teams[0].groups[0]
    expect(group.name).toBe('pass ing')
    expect(group.labels).toEqual(['IN T'])
    expect(group.descriptions).toEqual(['Tcatnoc  support  at evil.example'])
  })

  it('defaults to an empty list and caps hostile descriptions', () => {
    expect(transformBoxScore(summaryWith({ name: 'passing', labels: ['A'] })).teams[0].groups[0].descriptions).toEqual([])
    const out = transformBoxScore(
      summaryWith({
        name: 'passing',
        labels: ['A'],
        descriptions: Array.from({ length: 40 }, () => 'y'.repeat(500)).concat([{ evil: 1 }, 7]),
      })
    )
    const descriptions = out.teams[0].groups[0].descriptions
    expect(descriptions.length).toBeLessThanOrEqual(16)
    expect(descriptions.every((d) => typeof d === 'string' && d.length <= 64)).toBe(true)
  })
})
