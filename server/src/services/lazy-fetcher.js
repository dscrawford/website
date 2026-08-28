import { LEAGUES } from '../config.js'
import { fetchScoreboard } from './espn-client.js'
import { transformScoreboard } from '../transformers/game-transformer.js'
import * as cache from './cache.js'

const LEAGUE_BY_KEY = new Map(LEAGUES.map((l) => [l.key, l]))

// One ESPN request per league at a time: concurrent cache misses share the
// same promise instead of stampeding the upstream
const inflight = new Map()

async function fetchAndCache(cfg) {
  const raw = await fetchScoreboard(cfg.sport, cfg.league)
  if (!raw) return null
  const data = {
    league: cfg.key,
    label: cfg.label,
    games: transformScoreboard(raw),
    fetchedAt: new Date().toISOString(),
  }
  await cache.set(cfg.key, data)
  return data
}

export async function getLeague(key) {
  const cfg = LEAGUE_BY_KEY.get(key)
  if (!cfg) return null

  const cached = await cache.get(key)
  if (cached) return cached

  if (inflight.has(key)) return inflight.get(key)

  const pending = fetchAndCache(cfg)
    .catch((err) => {
      console.error(`[lazy-fetcher] ${cfg.label} fetch failed:`, err.message)
      return null
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, pending)
  return pending
}

export async function getAll() {
  const entries = await Promise.all(
    LEAGUES.map(async (l) => [l.key, await getLeague(l.key)])
  )
  return Object.fromEntries(entries)
}
