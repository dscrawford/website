import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.mock('../services/cache.js', () => ({
  getAll: vi.fn(),
  get: vi.fn(),
}))

import * as cache from '../services/cache.js'
import scoresRoutes from './scores.js'

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(scoresRoutes)
  await app.ready()
  return app
}

describe('GET /api/scores', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns cache.getAll() in the success envelope with cache headers', async () => {
    cache.getAll.mockResolvedValue({ nfl: { games: [] }, nba: null })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/scores' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toContain('max-age')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.json()).toEqual({
      success: true,
      data: { leagues: { nfl: { games: [] }, nba: null } },
      error: null,
    })
  })

  it('serves the snapshot without re-reading the cache within its window', async () => {
    cache.getAll.mockResolvedValue({ nfl: null })
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/api/scores' })
    await app.inject({ method: 'GET', url: '/api/scores' })
    expect(cache.getAll).toHaveBeenCalledTimes(1)
  })
})

describe('GET /api/scores/:league', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns cached data as-is when present', async () => {
    const cached = {
      league: 'nfl',
      label: 'NFL',
      games: [{ id: '1' }],
      fetchedAt: '2026-08-21T00:00:00Z',
    }
    cache.get.mockResolvedValue(cached)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/scores/nfl' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ success: true, data: cached, error: null })
  })

  it('returns an empty-but-successful shape before the first poll', async () => {
    cache.get.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/scores/nfl' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      success: true,
      data: { league: 'nfl', label: 'NFL', games: [], fetchedAt: null },
      error: null,
    })
  })

  it.each([
    ['unknown key', 'xyz'],
    ['uppercase variant (case-sensitive)', 'NFL'],
  ])('404s without echoing the input for %s', async (_label, league) => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `/api/scores/${league}` })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.data).toBeNull()
    expect(body.error).not.toContain(league)
    expect(cache.get).not.toHaveBeenCalled()
  })

  it('traversal segments never reach the cache', async () => {
    // Fastify's router rejects the path before our handler runs
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/scores/..' })
    expect(res.statusCode).toBe(404)
    expect(cache.get).not.toHaveBeenCalled()
  })

  it.each(['nfl', 'ncaaf', 'nba', 'cbb', 'mlb'])('accepts valid key %s', async (league) => {
    cache.get.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `/api/scores/${league}` })
    expect(res.statusCode).toBe(200)
    expect(cache.get).toHaveBeenCalledWith(league)
  })

  it('an unexpected cache rejection surfaces as a 500 (documents current contract)', async () => {
    cache.get.mockRejectedValue(new Error('unexpected'))
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/scores/nfl' })
    expect(res.statusCode).toBe(500)
  })
})
