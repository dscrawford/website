// ESPN's feed is untrusted upstream: everything here is the single trust
// boundary before data reaches Redis and every visitor's browser
import { TEAM_ID_PATTERN } from '../config.js'
import { str } from './sanitize.js'

const LOGO_HOSTS = new Set(['a.espncdn.com', 'a1.espncdn.com'])

function safeLogo(url) {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && LOGO_HOSTS.has(u.hostname) ? u.href : null
  } catch {
    return null
  }
}

function teamId(value) {
  const id = str(value, 16)
  return id && TEAM_ID_PATTERN.test(id) ? id : null
}

function transformCompetitor(competitor) {
  const team = competitor.team || {}
  const score = Number.parseInt(competitor.score ?? '0', 10)
  return Object.freeze({
    id: teamId(team.id),
    name: str(team.displayName) || str(team.name) || 'Unknown',
    abbreviation: str(team.abbreviation, 8) || '???',
    logo: safeLogo(team.logo),
    score: Number.isFinite(score) ? score : 0,
    record: str(competitor.records?.[0]?.summary, 24),
    homeAway:
      competitor.homeAway === 'home' || competitor.homeAway === 'away'
        ? competitor.homeAway
        : null,
  })
}

function extractBroadcasts(competition) {
  if (!Array.isArray(competition.broadcasts)) return []

  return competition.broadcasts
    .flatMap((b) => (Array.isArray(b.names) ? b.names : []))
    .map((name) => str(name, 32))
    .filter(Boolean)
    .slice(0, 4)
}

// FNV-1a: stable, dependency-free fallback id when ESPN omits event.id —
// derived from the matchup, sport and start time so reloads agree on it
function hashId(away, home, sport, startTime) {
  const input = `${away}:${home}:${sport}:${startTime}`
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `h${hash.toString(16).padStart(8, '0')}`
}

// Stadium plus city and region. ESPN sends US states as either "TX" or
// "Ohio" and omits state abroad, so the country stands in for it there
function transformVenue(venue) {
  if (!venue || typeof venue !== 'object') return null
  const name = str(venue.fullName, 80)
  if (!name) return null
  const address = venue.address || {}
  return Object.freeze({
    name,
    city: str(address.city, 48),
    state: str(address.state, 32) || str(address.country, 32),
  })
}

export function transformEvent(event, leagueKey = '') {
  const competition = event.competitions?.[0]
  if (!competition) return null

  const competitors = Array.isArray(competition.competitors)
    ? competition.competitors
    : []
  const home = competitors.find((c) => c.homeAway === 'home')
  const away = competitors.find((c) => c.homeAway === 'away')

  if (!home || !away) return null

  const status = event.status || {}
  const statusType = status.type || {}

  const homeTeamOut = transformCompetitor(home)
  const awayTeamOut = transformCompetitor(away)
  const startTime = str(event.date, 40)

  return Object.freeze({
    id:
      str(event.id, 32) ||
      hashId(awayTeamOut.name, homeTeamOut.name, leagueKey, startTime ?? ''),
    homeTeam: homeTeamOut,
    awayTeam: awayTeamOut,
    status: Object.freeze({
      state: ['pre', 'in', 'post'].includes(statusType.state) ? statusType.state : 'pre',
      period: Number.isFinite(status.period) ? status.period : 0,
      clock: str(status.displayClock, 16) || '0:00',
      detail: str(statusType.shortDetail) || str(statusType.detail) || '',
      completed: statusType.completed === true,
    }),
    broadcasts: Object.freeze(extractBroadcasts(competition)),
    startTime,
    venue: transformVenue(competition.venue),
    neutralSite: competition.neutralSite === true,
  })
}

export function transformScoreboard(rawData, leagueKey = '') {
  if (!rawData?.events) return Object.freeze([])

  if (!Array.isArray(rawData.events)) return Object.freeze([])
  return Object.freeze(
    rawData.events
      .slice(0, 200)
      .map((event) => {
        // One malformed event must not poison the whole league's cycle
        try {
          return transformEvent(event, leagueKey)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  )
}
