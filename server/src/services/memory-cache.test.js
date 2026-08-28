import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// REDIS_URL=memory selects the in-process backend (no Redis in the k8s pod);
// config.js reads env at import, so re-import per test
async function memoryCache() {
  vi.resetModules()
  process.env.REDIS_URL = 'memory'
  return import('./cache.js')
}

describe('cache service — memory backend', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.REDIS_URL
  })

  it('round-trips a value through set/get', async () => {
    const cache = await memoryCache()
    await cache.set('nfl', { games: [1, 2] })
    expect(await cache.get('nfl')).toEqual({ games: [1, 2] })
  })

  it('returns a copy, not a shared mutable reference', async () => {
    const cache = await memoryCache()
    const original = { games: [] }
    await cache.set('nfl', original)
    const out = await cache.get('nfl')
    out.games.push('mutated')
    expect(await cache.get('nfl')).toEqual({ games: [] })
  })

  it('expires entries after the TTL like Redis EX', async () => {
    const cache = await memoryCache()
    await cache.set('nba', { games: [] }, 60)
    vi.advanceTimersByTime(59_000)
    expect(await cache.get('nba')).toEqual({ games: [] })
    vi.advanceTimersByTime(2_000)
    expect(await cache.get('nba')).toBeNull()
  })

  it('getAll returns null for missing leagues and data for present ones', async () => {
    const cache = await memoryCache()
    await cache.set('mlb', { games: ['g'] })
    const all = await cache.getAll()
    expect(all.mlb).toEqual({ games: ['g'] })
    expect(all.nfl).toBeNull()
  })

  it('connect/disconnect are safe no-ops', async () => {
    const cache = await memoryCache()
    const client = cache.connect()
    await expect(client.connect()).resolves.toBeUndefined()
    await expect(cache.disconnect()).resolves.toBeUndefined()
  })
})
