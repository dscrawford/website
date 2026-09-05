import { LEAGUES, GAME_ID_PATTERN, TEAM_ID_PATTERN, SCHEDULE_CACHE_TTL_SECONDS } from '../config.js'
import { fetchScoreboard, fetchSummary, fetchTeamSchedule } from './espn-client.js'
import { transformScoreboard } from '../transformers/game-transformer.js'
import { transformBoxScore } from '../transformers/boxscore-transformer.js'
import { transformSchedule } from '../transformers/schedule-transformer.js'
import * as cache from './cache.js'

const LEAGUE_BY_KEY = new Map(LEAGUES.map((l) => [l.key, l]))

// One ESPN request per league at a time: concurrent cache misses share the
// same promise instead of stampeding the upstream
const inflight = new Map()

async function fetchAndCache(cfg) {
  const raw = await fetchScoreboard(cfg.sport, cfg.league, cfg.params ?? '')
  if (!raw) return null
  const data = {
    league: cfg.key,
    sport: cfg.sport,
    label: cfg.label,
    games: transformScoreboard(raw, cfg.key),
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

export async function getBoxScore(leagueKey, gameId) {
  const cfg = LEAGUE_BY_KEY.get(leagueKey)
  if (!cfg || typeof gameId !== 'string' || !GAME_ID_PATTERN.test(gameId)) {
    return null
  }

  const cacheKey = `box:${leagueKey}:${gameId}`
  const cached = await cache.get(cacheKey)
  if (cached) return cached

  if (inflight.has(cacheKey)) return inflight.get(cacheKey)

  const pending = (async () => {
    const raw = await fetchSummary(cfg.sport, cfg.league, gameId)
    if (!raw) return null
    const data = {
      gameId,
      ...transformBoxScore(raw),
      fetchedAt: new Date().toISOString(),
    }
    await cache.set(cacheKey, data)
    return data
  })()
    .catch((err) => {
      console.error(`[lazy-fetcher] ${cfg.label} box score ${gameId} failed:`, err.message)
      return null
    })
    .finally(() => inflight.delete(cacheKey))
  inflight.set(cacheKey, pending)
  return pending
}

export async function getTeamSchedule(leagueKey, teamId) {
  const cfg = LEAGUE_BY_KEY.get(leagueKey)
  if (!cfg || typeof teamId !== 'string' || !TEAM_ID_PATTERN.test(teamId)) {
    return null
  }

  const cacheKey = `sched:${leagueKey}:${teamId}`
  const cached = await cache.get(cacheKey)
  if (cached) return cached

  if (inflight.has(cacheKey)) return inflight.get(cacheKey)

  const pending = (async () => {
    const raw = await fetchTeamSchedule(cfg.sport, cfg.league, teamId)
    if (!raw) return null
    const data = {
      ...transformSchedule(raw, teamId),
      fetchedAt: new Date().toISOString(),
    }
    await cache.set(cacheKey, data, SCHEDULE_CACHE_TTL_SECONDS)
    return data
  })()
    .catch((err) => {
      console.error(`[lazy-fetcher] ${cfg.label} schedule ${teamId} failed:`, err.message)
      return null
    })
    .finally(() => inflight.delete(cacheKey))
  inflight.set(cacheKey, pending)
  return pending
}
