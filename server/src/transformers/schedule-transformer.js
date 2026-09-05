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
    teamScore,
    opponentScore,
    result: completed ? result(us, them, teamScore, opponentScore) : null,
    state,
    detail: str(statusType.shortDetail, 32) || str(statusType.detail, 32) || '',
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
  const games = sortByDate(
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
  )
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
