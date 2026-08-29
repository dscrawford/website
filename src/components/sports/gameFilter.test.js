import { describe, it, expect } from 'vitest'
import { filterGames } from './gameFilter.js'

function game(id, away, awayAbbr, home, homeAbbr) {
  return {
    id,
    awayTeam: { name: away, abbreviation: awayAbbr },
    homeTeam: { name: home, abbreviation: homeAbbr },
  }
}

const GAMES = [
  game('1', 'Oklahoma Sooners', 'OU', 'Texas Longhorns', 'TEX'),
  game('2', 'Ohio Bobcats', 'OHIO', 'Miami RedHawks', 'M-OH'),
  game('3', 'NC State Wolfpack', 'NCSU', 'Virginia Cavaliers', 'UVA'),
]

describe('filterGames', () => {
  it('returns all games for an empty or whitespace query', () => {
    expect(filterGames(GAMES, '')).toBe(GAMES)
    expect(filterGames(GAMES, '   ')).toBe(GAMES)
    expect(filterGames(GAMES, null)).toBe(GAMES)
  })

  it('matches by abbreviation', () => {
    expect(filterGames(GAMES, 'OU').map((g) => g.id)).toEqual(['1'])
    expect(filterGames(GAMES, 'uva').map((g) => g.id)).toEqual(['3'])
  })

  it('matches by full team name, case-insensitively and partially', () => {
    expect(filterGames(GAMES, 'oklahoma').map((g) => g.id)).toEqual(['1'])
    expect(filterGames(GAMES, 'WOLFPACK').map((g) => g.id)).toEqual(['3'])
    expect(filterGames(GAMES, 'state').map((g) => g.id)).toEqual(['3'])
  })

  it('matches either side of the matchup', () => {
    expect(filterGames(GAMES, 'longhorns').map((g) => g.id)).toEqual(['1'])
    expect(filterGames(GAMES, 'miami').map((g) => g.id)).toEqual(['2'])
  })

  it('abbreviation queries only match whole abbreviations, not name substrings', () => {
    // "OU" must not surface every team containing the letters "ou"
    // (Sooners/Bobcats both contain "ou" in other fields)
    const ids = filterGames(GAMES, 'ou').map((g) => g.id)
    expect(ids).toEqual(['1'])
  })

  it('multi-word queries require every word to match', () => {
    expect(filterGames(GAMES, 'nc state').map((g) => g.id)).toEqual(['3'])
    expect(filterGames(GAMES, 'oklahoma texas').map((g) => g.id)).toEqual(['1'])
    expect(filterGames(GAMES, 'oklahoma virginia')).toEqual([])
  })

  it('returns empty for no matches and tolerates malformed games', () => {
    expect(filterGames(GAMES, 'zzz')).toEqual([])
    expect(filterGames([{ id: 'x' }], 'ou')).toEqual([])
  })
})
