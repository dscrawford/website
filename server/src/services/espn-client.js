import { ESPN_BASE_URL, ESPN_STANDINGS_URL, ESPN_CORE_URL, STANDINGS_MAX_BYTES } from '../config.js'

// ESPN's site API is unofficial and undocumented: no keys, no SLA, and
// endpoints or rate tolerance can change without notice. Requests stay
// polite: fetched lazily on cache miss only, TTL-cached, deduped in-flight
// — see lazy-fetcher.js/config.js.
export async function fetchScoreboard(sport, league, params = '') {
  const query = params ? `?${params}` : ''
  return fetchJson(`${ESPN_BASE_URL}/${sport}/${league}/scoreboard${query}`, league)
}

// Game summary (box score, leaders, injuries); eventId must be pre-validated
export async function fetchSummary(sport, league, eventId) {
  return fetchJson(
    `${ESPN_BASE_URL}/${sport}/${league}/summary?event=${eventId}`,
    `${league} summary`
  )
}

// Full season schedule for one team; teamId and season must be
// pre-validated. No season means the current one.
export async function fetchTeamSchedule(sport, league, teamId, season) {
  const query = season ? `?season=${season}` : ''
  return fetchJson(
    `${ESPN_BASE_URL}/${sport}/${league}/teams/${teamId}/schedule${query}`,
    `${league} schedule`
  )
}

// Every team in a league with its names and logo; the directory that
// resolves the bare team references in core rankings
export async function fetchTeams(sport, league) {
  return fetchJson(`${ESPN_BASE_URL}/${sport}/${league}/teams?limit=1000`, `${league} teams`)
}

// Season object with its type boundaries (pre/regular/post season dates)
export async function fetchSeason(sport, league, year) {
  return fetchJson(`${ESPN_CORE_URL}/${sport}/leagues/${league}/seasons/${year}`, `${league} season`)
}

// The polls published for one week: references only, one per poll id
export async function fetchRankingsIndex(sport, league, year, type, week) {
  return fetchJson(
    `${ESPN_CORE_URL}/${sport}/leagues/${league}/seasons/${year}/types/${type}/weeks/${week}/rankings`,
    `${league} rankings index`
  )
}

export async function fetchRanking(sport, league, year, type, week, pollId) {
  return fetchJson(
    `${ESPN_CORE_URL}/${sport}/leagues/${league}/seasons/${year}/types/${type}/weeks/${week}/rankings/${pollId}`,
    `${league} ranking ${pollId}`
  )
}

// Conference (and at `level` 3, division) standings; season must be
// pre-validated and absent for the current one
export async function fetchStandings(sport, league, level, season) {
  const params = new URLSearchParams()
  if (level) params.set('level', String(level))
  if (season) params.set('season', season)
  const query = params.size > 0 ? `?${params}` : ''
  return fetchJson(`${ESPN_STANDINGS_URL}/${sport}/${league}/standings${query}`, `${league} standings`, {
    maxBytes: STANDINGS_MAX_BYTES,
    timeoutMs: 10000,
  })
}

const DEFAULT_MAX_BYTES = 4 * 1024 * 1024

async function fetchJson(url, label, { maxBytes = DEFAULT_MAX_BYTES, timeoutMs = 5000 } = {}) {

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })

    if (!response.ok) {
      console.error(`[espn] ${label} returned ${response.status}`)
      return null
    }

    if (!response.headers.get('content-type')?.includes('application/json')) {
      console.error(`[espn] ${label} returned non-JSON content type`)
      return null
    }
    if (Number(response.headers.get('content-length') || 0) > maxBytes) {
      console.error(`[espn] ${label} response too large`)
      return null
    }
    const text = await response.text()
    if (text.length > maxBytes) {
      console.error(`[espn] ${label} response too large`)
      return null
    }
    return JSON.parse(text)
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`[espn] ${label} request timed out`)
    } else {
      console.error(`[espn] ${label} fetch failed:`, err.message)
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
}
