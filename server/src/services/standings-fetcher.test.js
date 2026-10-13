import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./cache.js', () => ({ get: vi.fn(), set: vi.fn() }))
vi.mock('./espn-client.js', () => ({ fetchStandings: vi.fn() }))

import * as cache from './cache.js'
import { fetchStandings } from './espn-client.js'
import { getStandings } from './standings-fetcher.js'
import { DATE_CACHE_TTL_SECONDS, STANDINGS_CACHE_TTL_SECONDS } from '../config.js'

const RAW = {
  season: { year: 2026, displayName: '2026' },
  children: [{ id: '8', name: 'AFC', children: [{ id: '4', name: 'AFC East', standings: { entries: [{ team: { id: '2', abbreviation: 'BUF' }, stats: [{ name: 'wins', displayValue: '4' }] }] } }] }],
}

describe('getStandings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    cache.get.mockResolvedValue(null)
  })

  it('fetches divisions for pro leagues, conferences for college, and caches the transformed table', async () => {
    fetchStandings.mockResolvedValue(RAW)
    const out = await getStandings('nfl')
    expect(fetchStandings).toHaveBeenCalledWith('football', 'nfl', 3, undefined)
    expect(out.groups[0].groups[0].entries[0].stats.w).toBe('4')
    expect(cache.set).toHaveBeenCalledWith('stand:nfl', out, STANDINGS_CACHE_TTL_SECONDS)

    await getStandings('ncaaf')
    expect(fetchStandings).toHaveBeenLastCalledWith('football', 'college-football', undefined, undefined)
  })

  it('keys and holds past seasons separately', async () => {
    fetchStandings.mockResolvedValue(RAW)
    await getStandings('mlb', '2024')
    expect(fetchStandings).toHaveBeenCalledWith('baseball', 'mlb', 3, '2024')
    expect(cache.set).toHaveBeenCalledWith('stand:mlb@2024', expect.anything(), DATE_CACHE_TTL_SECONDS)
  })

  it('serves the cache, rejects bad input, and returns null on upstream failure', async () => {
    const hit = { league: 'nba', groups: [] }
    cache.get.mockResolvedValueOnce(hit)
    expect(await getStandings('nba')).toBe(hit)
    expect(await getStandings('cricket')).toBeNull()
    expect(await getStandings('nba', '20x4')).toBeNull()
    expect(fetchStandings).not.toHaveBeenCalled()
    fetchStandings.mockResolvedValue(null)
    expect(await getStandings('nba')).toBeNull()
    expect(cache.set).not.toHaveBeenCalled()
  })
})
