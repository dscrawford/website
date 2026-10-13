import { LEAGUES, DATE_CACHE_TTL_SECONDS, RANKINGS_CACHE_TTL_SECONDS, SEASON_CACHE_TTL_SECONDS } from '../config.js'
import { isValidDate, isPastDate } from './dates.js'
import { fetchScoreboard, fetchSeason, fetchTeams, fetchRankingsIndex, fetchRanking } from './espn-client.js'
import { gridFromCalendar, gridFromSeasonTypes, weekIndexAt } from './season-grid.js'
import { transformRanking, transformTeamIndex } from '../transformers/rankings-transformer.js'
import { dedupe } from './inflight.js'
import * as cache from './cache.js'

const LEAGUE_BY_KEY = new Map(LEAGUES.map((l) => [l.key, l]))
// Polls hold between editions (bowl season, the week before a final poll),
// so this many earlier weeks are searched before giving up on a poll
const LOOKBACK_WEEKS = 4

class UpstreamError extends Error {}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

async function cached(key, ttl, produce) {
  const hit = await cache.get(key)
  if (hit) return hit
  return dedupe(key, async () => {
    const value = await produce()
    if (value) await cache.set(key, value, ttl)
    return value
  })
}

async function getTeamIndex(cfg) {
  const teams = await cached(`teams:${cfg.key}`, SEASON_CACHE_TTL_SECONDS, async () => {
    const raw = await fetchTeams(cfg.sport, cfg.league)
    return raw ? transformTeamIndex(raw) : null
  })
  if (!teams) throw new UpstreamError('team directory unavailable')
  return teams
}

// The season a day belongs to, with its poll weeks laid out as dates.
// The day's scoreboard names the season; football's also carries the
// week calendar, basketball's weeks come from the season's type dates.
async function getSeasonGrid(cfg, day) {
  const scoreboard = await fetchScoreboard(cfg.sport, cfg.league, `limit=1&dates=${day.replaceAll('-', '')}`)
  const year = Number.parseInt(scoreboard?.leagues?.[0]?.season?.year, 10)
  if (!Number.isFinite(year)) return null
  return cached(`grid:${cfg.key}@${year}`, SEASON_CACHE_TTL_SECONDS, async () => {
    if (cfg.weeks === 'calendar') return gridFromCalendar(scoreboard)
    const season = await fetchSeason(cfg.sport, cfg.league, year)
    return season ? gridFromSeasonTypes(season) : null
  })
}

// The wanted polls ESPN lists for one grid week; a week with no index
// (nothing published) is simply empty, a failed fetch is an error
async function pollsForWeek(cfg, year, week, pollIds, teams) {
  const index = await fetchRankingsIndex(cfg.sport, cfg.league, year, week.type, week.week)
  if (!index) throw new UpstreamError(`rankings index ${week.type}/${week.week} unavailable`)
  const items = Array.isArray(index.items) ? index.items : []
  const present = new Set(
    items.map((item) => (typeof item?.$ref === 'string' ? item.$ref.match(/\/rankings\/(\d+)/)?.[1] : null)).filter(Boolean)
  )
  return Promise.all(
    pollIds
      .filter((id) => present.has(id))
      .map(async (id) => {
        const raw = await fetchRanking(cfg.sport, cfg.league, year, week.type, week.week, id)
        const poll = raw ? transformRanking(raw, teams) : null
        if (!poll) throw new UpstreamError(`ranking ${id} unavailable`)
        return poll
      })
  )
}

// Per poll, the latest edition already published by the end of `day`.
// A poll labelled for week N+1 can come out on the last days of week N
// (AP polls land Sunday), so the search starts one week ahead and walks
// back until each poll is found or the lookback runs out.
async function pollsInForce(cfg, grid, day, index, teams) {
  const cutoff = `${day}T23:59:59Z`
  const chosen = new Map()
  const first = Math.min(index + 1, grid.weeks.length - 1)
  const last = Math.max(index - LOOKBACK_WEEKS, 0)
  for (let i = first; i >= last && chosen.size < cfg.polls.length; i--) {
    const missing = cfg.polls.filter((id) => !chosen.has(id))
    const editions = await pollsForWeek(cfg, grid.year, grid.weeks[i], missing, teams)
    for (const poll of editions) {
      if (!poll.date || poll.date > cutoff) continue
      const current = chosen.get(poll.id)
      if (!current || poll.date > current.date) chosen.set(poll.id, poll)
    }
  }
  return cfg.polls.map((id) => chosen.get(id)).filter(Boolean)
}

async function fetchRankings(cfg, day) {
  const grid = await getSeasonGrid(cfg, day)
  if (!grid) throw new UpstreamError('season calendar unavailable')
  const index = weekIndexAt(grid.weeks, day)
  const teams = await getTeamIndex(cfg)
  const polls = await pollsInForce(cfg, grid, day, index, teams)
  return {
    league: cfg.key,
    label: cfg.label,
    date: day,
    season: { year: grid.year, label: grid.label },
    week: index >= 0 ? grid.weeks[index].label : null,
    polls,
    fetchedAt: new Date().toISOString(),
  }
}

// The polls in force on `date` (today when omitted) for a college league;
// null for leagues without polls or when ESPN cannot be reached. Only a
// complete answer is cached: one failed sub-request would otherwise pin a
// half-empty page for hours.
export async function getRankings(leagueKey, date) {
  const cfg = LEAGUE_BY_KEY.get(leagueKey)
  if (!cfg?.polls) return null
  if (date !== undefined && !isValidDate(date)) return null
  const day = date ?? todayISO()
  const ttl = isPastDate(day) ? DATE_CACHE_TTL_SECONDS : RANKINGS_CACHE_TTL_SECONDS
  return cached(`rank:${leagueKey}@${day}`, ttl, () =>
    fetchRankings(cfg, day).catch((err) => {
      console.error(`[rankings] ${cfg.label} ${day} failed:`, err.message)
      return null
    })
  )
}
