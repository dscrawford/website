import { LEAGUES, DATE_CACHE_TTL_SECONDS, STANDINGS_CACHE_TTL_SECONDS } from '../config.js'
import { isValidSeason, isPastSeason } from './dates.js'
import { fetchStandings } from './espn-client.js'
import { transformStandings } from '../transformers/standings-transformer.js'
import { dedupe } from './inflight.js'
import * as cache from './cache.js'

const LEAGUE_BY_KEY = new Map(LEAGUES.map((l) => [l.key, l]))

// Current standings when `season` is omitted, otherwise that year's final
export async function getStandings(leagueKey, season) {
  const cfg = LEAGUE_BY_KEY.get(leagueKey)
  if (!cfg) return null
  if (season !== undefined && !isValidSeason(season)) return null

  const cacheKey = season ? `stand:${leagueKey}@${season}` : `stand:${leagueKey}`
  const hit = await cache.get(cacheKey)
  if (hit) return hit

  return dedupe(cacheKey, async () => {
    const raw = await fetchStandings(cfg.sport, cfg.league, cfg.standingsLevel, season)
    if (!raw) return null
    const data = { ...transformStandings(raw, leagueKey), fetchedAt: new Date().toISOString() }
    const ttl = season && isPastSeason(season) ? DATE_CACHE_TTL_SECONDS : STANDINGS_CACHE_TTL_SECONDS
    await cache.set(cacheKey, data, ttl)
    return data
  }).catch((err) => {
    console.error(`[standings] ${cfg.label} failed:`, err.message)
    return null
  })
}
