import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./cache.js', () => ({
  get: vi.fn(),
  set: vi.fn(),
}))
vi.mock('./espn-client.js', () => ({
  fetchScoreboard: vi.fn(),
  fetchSummary: vi.fn(),
  fetchTeamSchedule: vi.fn(),
}))
vi.mock('../transformers/schedule-transformer.js', () => ({
  transformSchedule: vi.fn(),
}))
vi.mock('../transformers/game-transformer.js', () => ({
  transformScoreboard: vi.fn(),
}))
vi.mock('../transformers/boxscore-transformer.js', () => ({
  transformBoxScore: vi.fn(),
}))

import * as cache from './cache.js'
import { fetchScoreboard, fetchSummary, fetchTeamSchedule } from './espn-client.js'
import { transformSchedule } from '../transformers/schedule-transformer.js'
import { transformScoreboard } from '../transformers/game-transformer.js'
import { transformBoxScore } from '../transformers/boxscore-transformer.js'
import { getLeague, getAll, getBoxScore, getTeamSchedule } from './lazy-fetcher.js'
import { LEAGUES } from '../config.js'

describe('lazy-fetcher', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('serves from cache without touching ESPN when fresh', async () => {
    const cached = { league: 'nfl', label: 'NFL', games: [], fetchedAt: 'x' }
    cache.get.mockResolvedValue(cached)
    const result = await getLeague('nfl')
    expect(result).toBe(cached)
    expect(fetchScoreboard).not.toHaveBeenCalled()
  })

  it('fetches, transforms and caches on a miss', async () => {
    cache.get.mockResolvedValue(null)
    fetchScoreboard.mockResolvedValue({ events: [] })
    transformScoreboard.mockReturnValue([{ id: 'g1' }])

    const result = await getLeague('nba')

    expect(fetchScoreboard).toHaveBeenCalledWith('basketball', 'nba', '')
    expect(cache.set).toHaveBeenCalledWith('nba', expect.objectContaining({
      league: 'nba',
      sport: 'basketball',
      label: 'NBA',
      games: [{ id: 'g1' }],
      fetchedAt: expect.any(String),
    }))
    expect(result.games).toEqual([{ id: 'g1' }])
  })

  it('dedups concurrent misses into one ESPN request', async () => {
    cache.get.mockResolvedValue(null)
    let release
    fetchScoreboard.mockReturnValue(new Promise((r) => { release = r }))
    transformScoreboard.mockReturnValue([])

    const [a, b] = [getLeague('mlb'), getLeague('mlb')]
    release({ events: [] })
    const [ra, rb] = await Promise.all([a, b])

    expect(fetchScoreboard).toHaveBeenCalledTimes(1)
    expect(ra).toEqual(rb)
  })

  it('allows a fresh fetch after the previous one settles', async () => {
    cache.get.mockResolvedValue(null)
    fetchScoreboard.mockResolvedValue({ events: [] })
    transformScoreboard.mockReturnValue([])
    await getLeague('nfl')
    await getLeague('nfl')
    expect(fetchScoreboard).toHaveBeenCalledTimes(2)
  })

  it('returns null when ESPN gives nothing, without caching', async () => {
    cache.get.mockResolvedValue(null)
    fetchScoreboard.mockResolvedValue(null)
    const result = await getLeague('cbb')
    expect(result).toBeNull()
    expect(cache.set).not.toHaveBeenCalled()
  })

  it('returns null when the fetch throws, without caching', async () => {
    cache.get.mockResolvedValue(null)
    fetchScoreboard.mockRejectedValue(new Error('boom'))
    const result = await getLeague('nfl')
    expect(result).toBeNull()
    expect(cache.set).not.toHaveBeenCalled()
  })

  it('rejects unknown leagues without fetching', async () => {
    const result = await getLeague('cricket')
    expect(result).toBeNull()
    expect(fetchScoreboard).not.toHaveBeenCalled()
    expect(cache.get).not.toHaveBeenCalled()
  })

  it('getAll covers every configured league keyed by league key', async () => {
    cache.get.mockResolvedValue(null)
    fetchScoreboard.mockResolvedValue({ events: [] })
    transformScoreboard.mockReturnValue([])
    const all = await getAll()
    expect(Object.keys(all).sort()).toEqual(LEAGUES.map((l) => l.key).sort())
    expect(fetchScoreboard).toHaveBeenCalledTimes(LEAGUES.length)
  })
})

describe('lazy-fetcher — box scores', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('serves a cached box score without touching ESPN', async () => {
    const cached = { gameId: '401', teams: [] }
    cache.get.mockResolvedValue(cached)
    const result = await getBoxScore('mlb', '401')
    expect(result).toBe(cached)
    expect(cache.get).toHaveBeenCalledWith('box:mlb:401')
    expect(fetchSummary).not.toHaveBeenCalled()
  })

  it('fetches, transforms and caches on a miss under a box-scoped key', async () => {
    cache.get.mockResolvedValue(null)
    fetchSummary.mockResolvedValue({ boxscore: {} })
    transformBoxScore.mockReturnValue({ teams: [{ name: 'Reds' }] })

    const result = await getBoxScore('mlb', '401816711')

    expect(fetchSummary).toHaveBeenCalledWith('baseball', 'mlb', '401816711')
    expect(cache.set).toHaveBeenCalledWith('box:mlb:401816711', expect.objectContaining({
      gameId: '401816711',
      teams: [{ name: 'Reds' }],
      fetchedAt: expect.any(String),
    }))
    expect(result.teams).toEqual([{ name: 'Reds' }])
  })

  it('dedups concurrent misses for the same game', async () => {
    cache.get.mockResolvedValue(null)
    let release
    fetchSummary.mockReturnValue(new Promise((r) => { release = r }))
    transformBoxScore.mockReturnValue({ teams: [] })
    const [a, b] = [getBoxScore('nba', '77'), getBoxScore('nba', '77')]
    release({ boxscore: {} })
    await Promise.all([a, b])
    expect(fetchSummary).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid league or game id without fetching', async () => {
    expect(await getBoxScore('cricket', '123')).toBeNull()
    expect(await getBoxScore('mlb', 'DROP TABLE')).toBeNull()
    expect(await getBoxScore('mlb', '1'.repeat(20))).toBeNull()
    expect(await getBoxScore('mlb', '')).toBeNull()
    expect(fetchSummary).not.toHaveBeenCalled()
    expect(cache.get).not.toHaveBeenCalled()
  })

  it('returns null on upstream failure without caching', async () => {
    cache.get.mockResolvedValue(null)
    fetchSummary.mockResolvedValue(null)
    expect(await getBoxScore('nfl', '55')).toBeNull()
    fetchSummary.mockRejectedValue(new Error('boom'))
    expect(await getBoxScore('nfl', '56')).toBeNull()
    expect(cache.set).not.toHaveBeenCalled()
  })
})

describe('lazy-fetcher — college scoreboard params', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it.each([
    ['ncaaf', 'football', 'college-football', 'groups=80&limit=300'],
    ['cbb', 'basketball', 'mens-college-basketball', 'groups=50&limit=300'],
  ])('%s requests the full division, not just featured games', async (key, sport, league, params) => {
    cache.get.mockResolvedValue(null)
    fetchScoreboard.mockResolvedValue({ events: [] })
    transformScoreboard.mockReturnValue([])
    await getLeague(key)
    expect(fetchScoreboard).toHaveBeenCalledWith(sport, league, params)
  })
})

describe('getTeamSchedule', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('serves a cached schedule without touching ESPN', async () => {
    const cached = { teamId: '5', games: [], fetchedAt: 'x' }
    cache.get.mockResolvedValue(cached)
    expect(await getTeamSchedule('mlb', '5')).toBe(cached)
    expect(cache.get).toHaveBeenCalledWith('sched:mlb:5')
    expect(fetchTeamSchedule).not.toHaveBeenCalled()
  })

  it('fetches, transforms and caches on a miss with a longer TTL than scores', async () => {
    cache.get.mockResolvedValue(null)
    fetchTeamSchedule.mockResolvedValue({ events: [] })
    transformSchedule.mockReturnValue({ teamId: '5', games: [{ id: 'g' }] })
    const result = await getTeamSchedule('mlb', '5')
    expect(fetchTeamSchedule).toHaveBeenCalledWith('baseball', 'mlb', '5')
    expect(transformSchedule).toHaveBeenCalledWith({ events: [] }, '5')
    expect(cache.set).toHaveBeenCalledWith(
      'sched:mlb:5',
      expect.objectContaining({ teamId: '5', games: [{ id: 'g' }], fetchedAt: expect.any(String) }),
      expect.any(Number)
    )
    expect(cache.set.mock.calls[0][2]).toBeGreaterThan(60)
    expect(result.games).toEqual([{ id: 'g' }])
  })

  it('dedups concurrent misses for the same team', async () => {
    cache.get.mockResolvedValue(null)
    let release
    fetchTeamSchedule.mockReturnValue(new Promise((r) => { release = r }))
    transformSchedule.mockReturnValue({ teamId: '13', games: [] })
    const [a, b] = [getTeamSchedule('nba', '13'), getTeamSchedule('nba', '13')]
    release({ events: [] })
    await Promise.all([a, b])
    expect(fetchTeamSchedule).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid league or team id without fetching', async () => {
    expect(await getTeamSchedule('cricket', '5')).toBeNull()
    expect(await getTeamSchedule('mlb', '../x')).toBeNull()
    expect(await getTeamSchedule('mlb', '007')).toBeNull()
    expect(await getTeamSchedule('mlb', '1'.repeat(20))).toBeNull()
    expect(await getTeamSchedule('mlb', '')).toBeNull()
    expect(await getTeamSchedule('mlb', 5)).toBeNull()
    expect(fetchTeamSchedule).not.toHaveBeenCalled()
    expect(cache.get).not.toHaveBeenCalled()
  })

  it('returns null on upstream failure without caching', async () => {
    cache.get.mockResolvedValue(null)
    fetchTeamSchedule.mockResolvedValue(null)
    expect(await getTeamSchedule('mlb', '5')).toBeNull()
    expect(cache.set).not.toHaveBeenCalled()
    fetchTeamSchedule.mockRejectedValue(new Error('boom'))
    expect(await getTeamSchedule('mlb', '5')).toBeNull()
  })

  it('returns null rather than partial data when the cache write fails after a good fetch', async () => {
    cache.get.mockResolvedValue(null)
    fetchTeamSchedule.mockResolvedValue({ events: [] })
    transformSchedule.mockReturnValue({ teamId: '5', games: [] })
    cache.set.mockRejectedValue(new Error('redis down'))
    expect(await getTeamSchedule('mlb', '5')).toBeNull()
  })
})
