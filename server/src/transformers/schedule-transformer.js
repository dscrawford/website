// ESPN team schedule payloads are untrusted upstream: this is the trust
// boundary before schedules reach the cache and every visitor's browser
import { str } from './sanitize.js'

const MAX_EVENTS = 250
const STATES = new Set(['pre', 'in', 'post'])

// Schedule scores arrive as { value, displayValue }; scoreboards send strings
function scoreValue(score) {
  const raw = score && typeof score === 'object' ? score.value : score
  const n = typeof raw === 'number' ? raw : Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

function isTeam(competitor, teamId) {
  return str(competitor?.team?.id, 16) === teamId || str(competitor?.id, 16) === teamId
}

// Year-to-date record ESPN attaches to each competitor, as of that game.
// Schedules send record: [{ type, displayValue }]; scoreboards send
// records: [{ summary }]. Prefer the overall ('total') entry.
function espnRecord(competitor) {
  const entries = [competitor?.record, competitor?.records].find(Array.isArray) || []
  const entry = entries.find((r) => r?.type === 'total') || entries[0]
  return str(entry?.displayValue, 24) || str(entry?.summary, 24) || null
}

function result(us, them, teamScore, opponentScore) {
  if (us.winner === true) return 'W'
  if (them.winner === true) return 'L'
  if (teamScore === null || opponentScore === null) return null
  if (teamScore > opponentScore) return 'W'
  if (teamScore < opponentScore) return 'L'
  return 'T'
}

function transformEvent(event, teamId) {
  if (!event || typeof event !== 'object') return null
  const competition = event.competitions?.[0]
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : []
  const us = competitors.find((c) => isTeam(c, teamId))
  const them = competitors.find((c) => c && !isTeam(c, teamId))
  if (!us || !them) return null

  const statusType = competition.status?.type || event.status?.type || {}
  const state = STATES.has(statusType.state) ? statusType.state : 'pre'
  const completed = statusType.completed === true
  const showScore = completed || state === 'in'
  const teamScore = showScore ? scoreValue(us.score) : null
  const opponentScore = showScore ? scoreValue(them.score) : null

  return Object.freeze({
    id: str(event.id, 32),
    date: str(event.date, 40),
    opponent: Object.freeze({
      abbreviation: str(them.team?.abbreviation, 8) || '???',
      name: str(them.team?.displayName) || str(them.team?.name) || 'Unknown',
    }),
    home: us.homeAway === 'home',
    neutral: competition.neutralSite === true,
    teamScore,
    opponentScore,
    result: completed ? result(us, them, teamScore, opponentScore) : null,
    state,
    detail: str(statusType.shortDetail, 32) || str(statusType.detail, 32) || '',
    record: completed ? espnRecord(us) : null,
    opponentRecord: completed ? espnRecord(them) : null,
  })
}

// Record after each completed game, counted from the results in date
// order; fills in when ESPN omits its own year-to-date record. Ties only
// appear once there has been one (W-L, or W-L-T), matching ESPN's format.
function withRunningRecords(games) {
  let wins = 0
  let losses = 0
  let ties = 0
  return games.map((game) => {
    if (!game.result) return game
    if (game.result === 'W') wins += 1
    else if (game.result === 'L') losses += 1
    else ties += 1
    if (game.record) return game
    const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`
    return Object.freeze({ ...game, record })
  })
}

// Unparseable dates sort last
function sortByDate(games) {
  return games
    .map((game) => {
      const time = Date.parse(game.date ?? '')
      return { time: Number.isFinite(time) ? time : Infinity, game }
    })
    .sort((a, b) => a.time - b.time)
    .map(({ game }) => game)
}

export function transformSchedule(raw, teamId) {
  const events = Array.isArray(raw?.events) ? raw.events : []
  const team = raw?.team || {}
  const games = withRunningRecords(sortByDate(
    events
      .slice(0, MAX_EVENTS)
      .map((event) => {
        // One malformed event must not drop the whole season
        try {
          return transformEvent(event, teamId)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  ))
  return Object.freeze({
    teamId,
    team: Object.freeze({
      abbreviation: str(team.abbreviation, 8) || '???',
      name: str(team.displayName) || str(team.name) || 'Unknown',
      // Already formatted per sport by ESPN (W-L, or W-L-T when ties exist)
      record: str(team.recordSummary, 24) || null,
    }),
    season: str(raw?.season?.displayName, 16) || str(raw?.season?.year, 16),
    games: Object.freeze(games),
  })
}
