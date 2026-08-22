import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const redisInstances = []

vi.mock('ioredis', () => {
  return {
    default: class FakeRedis {
      constructor() {
        this.get = vi.fn()
        this.set = vi.fn()
        this.quit = vi.fn().mockResolvedValue('OK')
        this.on = vi.fn()
        this.pipeline = vi.fn(() => {
          const commands = []
          const pipelineObj = {
            get: (key) => {
              commands.push(key)
              return pipelineObj
            },
            exec: vi.fn(() => this._pipelineExecImpl(commands)),
          }
          return pipelineObj
        })
        this._pipelineExecImpl = () => Promise.resolve([])
        redisInstances.push(this)
      }
    },
  }
})

import * as cache from './cache.js'

function currentFakeRedis() {
  return redisInstances[redisInstances.length - 1]
}

describe('cache service', () => {
  beforeEach(() => {
    redisInstances.length = 0
  })

  afterEach(async () => {
    await cache.disconnect()
  })

  describe('before connect() is called', () => {
    it('get() returns null', async () => {
      expect(await cache.get('nfl')).toBeNull()
    })

    it('set() is a no-op and does not throw', async () => {
      await expect(cache.set('nfl', { games: [] })).resolves.toBeUndefined()
    })

    it('getAll() returns {}', async () => {
      expect(await cache.getAll()).toEqual({})
    })
  })

  describe('after connect()', () => {
    it('get() returns parsed JSON on a hit', async () => {
      cache.connect()
      currentFakeRedis().get.mockResolvedValue(JSON.stringify({ league: 'nfl', games: [] }))
      expect(await cache.get('nfl')).toEqual({ league: 'nfl', games: [] })
    })

    it('get() returns null on a miss', async () => {
      cache.connect()
      currentFakeRedis().get.mockResolvedValue(null)
      expect(await cache.get('nfl')).toBeNull()
    })

    it('get() returns null on corrupted JSON', async () => {
      cache.connect()
      currentFakeRedis().get.mockResolvedValue('{not valid json')
      await expect(cache.get('nfl')).resolves.toBeNull()
    })

    it('get() returns null when the client rejects', async () => {
      cache.connect()
      currentFakeRedis().get.mockRejectedValue(new Error('connection lost'))
      await expect(cache.get('nfl')).resolves.toBeNull()
    })

    it('set() serializes with the default TTL', async () => {
      cache.connect()
      await cache.set('nfl', { games: [] })
      expect(currentFakeRedis().set).toHaveBeenCalledWith(
        'scores:nfl',
        JSON.stringify({ games: [] }),
        'EX',
        60
      )
    })

    it('set() honors a custom TTL', async () => {
      cache.connect()
      await cache.set('nfl', { games: [] }, 5)
      expect(currentFakeRedis().set).toHaveBeenCalledWith(
        'scores:nfl',
        expect.any(String),
        'EX',
        5
      )
    })

    it('set() swallows errors (never crashes the poller)', async () => {
      cache.connect()
      currentFakeRedis().set.mockRejectedValue(new Error('write failed'))
      await expect(cache.set('nfl', { games: [] })).resolves.toBeUndefined()
    })

    it('getAll() merges all five league keys, misses as null', async () => {
      cache.connect()
      currentFakeRedis()._pipelineExecImpl = () =>
        Promise.resolve([
          [null, JSON.stringify({ games: ['nfl-game'] })],
          [null, null],
          [null, JSON.stringify({ games: ['nba-game'] })],
          [null, null],
          [null, null],
        ])
      expect(await cache.getAll()).toEqual({
        nfl: { games: ['nfl-game'] },
        ncaaf: null,
        nba: { games: ['nba-game'] },
        cbb: null,
        mlb: null,
      })
    })

    it('getAll() treats a per-command error as null without failing others', async () => {
      cache.connect()
      currentFakeRedis()._pipelineExecImpl = () =>
        Promise.resolve([
          [new Error('boom'), null],
          [null, JSON.stringify({ games: ['ncaaf-game'] })],
          [null, null],
          [null, null],
          [null, null],
        ])
      const result = await cache.getAll()
      expect(result.nfl).toBeNull()
      expect(result.ncaaf).toEqual({ games: ['ncaaf-game'] })
    })

    it('getAll() returns {} when pipeline.exec() rejects', async () => {
      cache.connect()
      currentFakeRedis()._pipelineExecImpl = () => Promise.reject(new Error('ECONNREFUSED'))
      await expect(cache.getAll()).resolves.toEqual({})
    })
  })

  it('connect() is idempotent', () => {
    const a = cache.connect()
    const b = cache.connect()
    expect(a).toBe(b)
    expect(redisInstances).toHaveLength(1)
  })

  it('disconnect() allows a fresh client on the next connect()', async () => {
    cache.connect()
    await cache.disconnect()
    cache.connect()
    expect(redisInstances).toHaveLength(2)
  })
})
