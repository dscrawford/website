import { describe, it, expect } from 'vitest'
import { describeStat } from './statGlossary.js'

// Every label ESPN emits for the five supported leagues (captured from live
// summaries); the glossary must resolve all of them so no header is mute
const ESPN_LABELS = {
  football: {
    passing: ['C/ATT', 'YDS', 'AVG', 'TD', 'INT', 'SACKS', 'QBR', 'RTG'],
    rushing: ['CAR', 'YDS', 'AVG', 'TD', 'LONG'],
    receiving: ['REC', 'YDS', 'AVG', 'TD', 'LONG', 'TGTS'],
    fumbles: ['FUM', 'LOST', 'REC'],
    defensive: ['TOT', 'SOLO', 'SACKS', 'TFL', 'PD', 'QB HUR', 'QB HTS', 'TD'],
    interceptions: ['INT', 'YDS', 'TD'],
    kickReturns: ['NO', 'YDS', 'AVG', 'LONG', 'TD'],
    puntReturns: ['NO', 'YDS', 'AVG', 'LONG', 'TD'],
    kicking: ['FG', 'PCT', 'LONG', 'XP', 'PTS'],
    punting: ['NO', 'YDS', 'AVG', 'TB', 'In 20', 'LONG'],
  },
  basketball: {
    stats: ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', 'OREB', 'DREB', 'PF', '+/-'],
  },
  baseball: {
    batting: ['H-AB', 'AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K', '#P', 'AVG', 'OBP', 'SLG'],
    pitching: ['IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'PC-ST', 'ERA', 'PC'],
  },
}

const CASES = Object.entries(ESPN_LABELS).flatMap(([sport, groups]) =>
  Object.entries(groups).flatMap(([group, labels]) => labels.map((label) => [sport, group, label]))
)

describe('describeStat', () => {
  it.each(CASES)('%s / %s / %s has a name and a description', (sport, group, label) => {
    const info = describeStat({ sport, group, label })
    expect(info).not.toBeNull()
    expect(info.name.length).toBeGreaterThan(0)
    expect(info.description.length).toBeGreaterThan(0)
    expect(Object.isFrozen(info)).toBe(true)
  })

  it('disambiguates the same label by stat group', () => {
    const thrown = describeStat({ sport: 'football', group: 'passing', label: 'INT' })
    const made = describeStat({ sport: 'football', group: 'interceptions', label: 'INT' })
    expect(thrown.name).toMatch(/thrown/i)
    expect(made.name).not.toMatch(/thrown/i)

    const catches = describeStat({ sport: 'football', group: 'receiving', label: 'REC' })
    const recoveries = describeStat({ sport: 'football', group: 'fumbles', label: 'REC' })
    expect(catches.name).toMatch(/reception/i)
    expect(recoveries.name).toMatch(/recover/i)

    const perAttempt = describeStat({ sport: 'football', group: 'passing', label: 'AVG' })
    const battingAvg = describeStat({ sport: 'baseball', group: 'batting', label: 'AVG' })
    expect(perAttempt.name).toMatch(/attempt/i)
    expect(battingAvg.name).toMatch(/batting average/i)
  })

  it('falls back from group to sport to common vocabulary', () => {
    expect(describeStat({ sport: 'football', group: 'kicking', label: 'PTS' }).name).toMatch(/kicking/i)
    expect(describeStat({ sport: 'basketball', group: 'stats', label: 'PTS' }).name).toBe('Points')
    expect(describeStat({ sport: 'football', group: 'unknownGroup', label: 'TD' }).name).toBe('Touchdowns')
    expect(describeStat({ label: 'TD' }).name).toBe('Touchdowns')
  })

  it('normalizes case and whitespace in label, group and sport', () => {
    const canonical = describeStat({ sport: 'football', group: 'kickReturns', label: 'NO' })
    expect(describeStat({ sport: 'Football', group: 'KICKRETURNS', label: ' no ' })).toEqual(canonical)
    expect(describeStat({ sport: 'football', group: 'punting', label: 'IN 20' })).toEqual(
      describeStat({ sport: 'football', group: 'punting', label: 'In 20' })
    )
  })

  it('uses the upstream description as a name when the glossary has no entry', () => {
    const info = describeStat({ sport: 'football', group: 'passing', label: 'ZZZ', fallbackName: 'Zed Score' })
    expect(info).toEqual({ name: 'Zed Score', description: null })
  })

  it('never resolves through the prototype chain for upstream-controlled names', () => {
    expect(describeStat({ group: '__proto__', label: 'constructor' })).toBeNull()
    expect(describeStat({ group: 'constructor', label: 'PROTOTYPE' })).toBeNull()
    expect(describeStat({ sport: '__proto__', label: 'hasOwnProperty' })).toBeNull()
    expect(describeStat({ group: 'passing', label: 'TOSTRING' })).toBeNull()
  })

  it('returns null for unknown labels and for non-string input', () => {
    expect(describeStat()).toBeNull()
    expect(describeStat({ label: '\tTD\n' })).toEqual(describeStat({ label: 'TD' }))
    expect(describeStat({ sport: 'football', group: 'passing', label: 'ZZZ' })).toBeNull()
    expect(describeStat({ label: null })).toBeNull()
    expect(describeStat({ label: 42 })).toBeNull()
    expect(describeStat({ label: '' })).toBeNull()
    expect(describeStat({ sport: 7, group: {}, label: 'TD' }).name).toBe('Touchdowns')
    expect(describeStat({ label: 'ZZZ', fallbackName: '' })).toBeNull()
    expect(describeStat({ label: 'ZZZ', fallbackName: 12 })).toBeNull()
  })
})
