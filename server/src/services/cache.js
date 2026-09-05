import Redis from 'ioredis'
import { REDIS_URL, CACHE_KEY_PREFIX, CACHE_TTL_SECONDS, LEAGUES } from '../config.js'

// REDIS_URL=memory selects an in-process store: single-replica deployments
// (the k8s sidecar) get TTL caching without running Redis. JSON round-trips
// keep parity with the Redis backend — no shared mutable references.
const memory = REDIS_URL === 'memory' ? new Map() : null
// Redis has maxmemory; the in-process map needs its own ceiling since
// per-team keys are written once and may never be read again
const MAX_MEMORY_ENTRIES = 500

let client = null

export function connect() {
  if (memory) {
    return { connect: async () => {}, quit: async () => {} }
  }
  if (client) return client

  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null
      return Math.min(times * 200, 2000)
    },
    lazyConnect: true,
  })

  client.on('error', (err) => {
    console.error('[cache] Redis error:', err.message)
  })

  client.on('connect', () => {
    console.log('[cache] Connected to Redis')
  })

  return client
}

function cacheKey(league) {
  return `${CACHE_KEY_PREFIX}:${league}`
}

function memoryGet(league) {
  const entry = memory.get(cacheKey(league))
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) {
    memory.delete(cacheKey(league))
    return null
  }
  return JSON.parse(entry.json)
}

export async function get(league) {
  if (memory) return memoryGet(league)
  if (!client) return null
  try {
    const data = await client.get(cacheKey(league))
    return data ? JSON.parse(data) : null
  } catch (err) {
    console.error(`[cache] GET ${league} failed:`, err.message)
    return null
  }
}

// Drop expired entries, then oldest insertions, so the map stays bounded
function memorySweep() {
  const now = Date.now()
  for (const [key, entry] of memory) {
    if (now >= entry.expiresAt) memory.delete(key)
  }
  while (memory.size >= MAX_MEMORY_ENTRIES) {
    memory.delete(memory.keys().next().value)
  }
}

export async function set(league, data, ttl = CACHE_TTL_SECONDS) {
  if (memory) {
    memorySweep()
    memory.set(cacheKey(league), {
      json: JSON.stringify(data),
      expiresAt: Date.now() + ttl * 1000,
    })
    return
  }
  if (!client) return
  try {
    await client.set(cacheKey(league), JSON.stringify(data), 'EX', ttl)
  } catch (err) {
    console.error(`[cache] SET ${league} failed:`, err.message)
  }
}

const LEAGUE_KEYS = LEAGUES.map((l) => l.key)

export async function getAll() {
  if (memory) {
    return Object.fromEntries(LEAGUE_KEYS.map((key) => [key, memoryGet(key)]))
  }
  if (!client) return {}
  try {
    const pipeline = client.pipeline()
    for (const key of LEAGUE_KEYS) {
      pipeline.get(cacheKey(key))
    }
    const results = await pipeline.exec()
    const out = {}
    LEAGUE_KEYS.forEach((key, i) => {
      const [err, val] = results[i]
      out[key] = !err && val ? JSON.parse(val) : null
    })
    return out
  } catch (err) {
    console.error('[cache] getAll failed:', err.message)
    return {}
  }
}

export async function disconnect() {
  if (memory) {
    memory.clear()
    return
  }
  if (client) {
    await client.quit()
    client = null
  }
}
