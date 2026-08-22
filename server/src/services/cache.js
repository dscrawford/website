import Redis from 'ioredis'
import { REDIS_URL, CACHE_KEY_PREFIX, CACHE_TTL_SECONDS } from '../config.js'

let client = null

export function connect() {
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

export async function get(league) {
  if (!client) return null
  try {
    const data = await client.get(cacheKey(league))
    return data ? JSON.parse(data) : null
  } catch (err) {
    console.error(`[cache] GET ${league} failed:`, err.message)
    return null
  }
}

export async function set(league, data, ttl = CACHE_TTL_SECONDS) {
  if (!client) return
  try {
    await client.set(cacheKey(league), JSON.stringify(data), 'EX', ttl)
  } catch (err) {
    console.error(`[cache] SET ${league} failed:`, err.message)
  }
}

export async function getAll() {
  if (!client) return {}
  try {
    const pipeline = client.pipeline()
    const keys = ['nfl', 'ncaaf', 'nba', 'cbb', 'mlb']
    for (const key of keys) {
      pipeline.get(cacheKey(key))
    }
    const results = await pipeline.exec()
    const out = {}
    keys.forEach((key, i) => {
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
  if (client) {
    await client.quit()
    client = null
  }
}
