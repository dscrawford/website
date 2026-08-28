import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./cache.js', () => ({
  get: vi.fn(),
  set: vi.fn(),
}))
vi.mock('./espn-client.js', () => ({
  fetchScoreboard: vi.fn(),
}))
vi.mock('../transformers/game-transformer.js', () => ({
  transformScoreboard: vi.fn(),
}))

import * as cache from './cache.js'
import { fetchScoreboard } from './espn-client.js'
import { transformScoreboard } from '../transformers/game-transformer.js'
import { getLeague, getAll } from './lazy-fetcher.js'
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

    expect(fetchScoreboard).toHaveBeenCalledWith('basketball', 'nba')
    expect(cache.set).toHaveBeenCalledWith('nba', expect.objectContaining({
      league: 'nba',
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
