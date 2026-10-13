import { describe, it, expect } from 'vitest'
import { transformStandings, standingsColumns } from './standings-transformer.js'

const stat = (name, displayValue, value) => ({ name, displayValue, value })
const entry = (id, abbreviation, wins, losses, seed, extra = []) => ({
  team: { id, abbreviation, displayName: `${abbreviation} Team`, logos: [{ href: `https://a.espncdn.com/${id}.png` }] },
  stats: [
    stat('wins', String(wins), wins),
    stat('losses', String(losses), losses),
    stat('ties', '0', 0),
    stat('winPercent', '.500', 0.5),
    stat('pointsFor', '100', 100),
    stat('pointsAgainst', '90', 90),
    stat('pointDifferential', '+10', 10),
    stat('divisionRecord', '1-0'),
    stat('vs. Conf.', '2-1'),
    stat('streak', 'W1', 1),
    stat('playoffSeed', String(seed), seed),
    stat('overall', `${wins}-${losses}`),
    ...extra,
  ],
})

const NFL = {
  season: { year: 2026, displayName: '2026' },
  children: [
    {
      id: '8',
      name: 'American Football Conference',
      abbreviation: 'AFC',
      children: [
        { id: '4', name: 'AFC East', abbreviation: 'EAST', standings: { entries: [entry('2', 'BUF', 4, 1, 4), entry('17', 'NE', 3, 2, 5)] } },
      ],
    },
  ],
}

describe('transformStandings', () => {
  it('keeps conference > division nesting, each team in standing order with just the shown stats', () => {
    const out = transformStandings(NFL, 'nfl')
    expect(out.league).toBe('nfl')
    expect(out.season).toEqual({ year: 2026, label: '2026' })
    expect(out.columns.map((c) => c.label)).toEqual(['W', 'L', 'T', 'PCT', 'PF', 'PA', 'DIFF', 'DIV', 'CONF', 'STRK', 'SEED'])
    expect(out.groups).toHaveLength(1)
    const afc = out.groups[0]
    expect(afc).toMatchObject({ id: '8', name: 'American Football Conference', abbreviation: 'AFC', entries: [] })
    expect(afc.groups[0].name).toBe('AFC East')
    expect(afc.groups[0].entries[0]).toEqual({
      team: { id: '2', abbreviation: 'BUF', name: 'BUF Team', logo: 'https://a.espncdn.com/2.png' },
      seed: 4,
      stats: { w: '4', l: '1', t: '0', pct: '.500', pf: '100', pa: '90', diff: '+10', div: '1-0', conf: '2-1', strk: 'W1', seed: '4' },
    })
  })

  it('reorders alphabetical conference lists by seed, but only when every team has one', () => {
    const raw = {
      season: { year: 2026 },
      children: [{ id: '2', name: 'Atlantic Coast Conference', standings: { entries: [entry('59', 'GT', 2, 16, 18), entry('87', 'ND', 4, 14, 15), entry('150', 'DUKE', 16, 2, 1)] } }],
    }
    expect(transformStandings(raw, 'cbb').groups[0].entries.map((e) => e.team.abbreviation)).toEqual(['DUKE', 'ND', 'GT'])

    const unseeded = { ...raw, children: [{ ...raw.children[0], standings: { entries: [entry('59', 'GT', 0, 0, 0), entry('150', 'DUKE', 0, 0, 0)] } }] }
    expect(transformStandings(unseeded, 'cbb').groups[0].entries.map((e) => e.team.abbreviation)).toEqual(['GT', 'DUKE'])
  })

  it('reads the overall split when a stat repeats per home/road split', () => {
    const raw = {
      season: { year: 2026 },
      children: [{ id: '8', name: 'SEC', standings: { entries: [entry('61', 'UGA', 6, 0, 1, [stat('pointsFor', '999', 999)])] } }],
    }
    expect(transformStandings(raw, 'ncaaf').groups[0].entries[0].stats).toEqual({ conf: '2-1', ovr: '6-0', pf: '100', pa: '90', diff: '+10', strk: 'W1' })
  })

  it('drops empty groups, teams without ids, and tolerates a missing payload', () => {
    const raw = {
      children: [
        { id: '1', name: 'Empty', standings: { entries: [] } },
        { id: '2', name: 'Half', standings: { entries: [{ team: {}, stats: [] }, entry('5', 'X', 1, 1, 1)] } },
        null,
      ],
    }
    const out = transformStandings(raw, 'mlb')
    expect(out.groups.map((g) => g.name)).toEqual(['Half'])
    expect(out.groups[0].entries).toHaveLength(1)
    expect(out.groups[0].entries[0].stats.l10).toBe('-')
    const blank = { children: [{ id: '3', name: 'Blank', standings: { entries: [{ team: { id: '9', abbreviation: 'B', logos: [{ href: 'https://evil.example/x.png' }] }, stats: [{ name: 'streak', displayValue: '' }] }] } }] }
    const row = transformStandings(blank, 'mlb').groups[0].entries[0]
    expect(row.stats.strk).toBe('-')
    expect(row.team.logo).toBeNull()
    expect(transformStandings(null, 'mlb')).toEqual({ league: 'mlb', season: { year: null, label: null }, columns: standingsColumns('mlb'), groups: [] })
    expect(standingsColumns('cricket')).toEqual([])
  })
})
