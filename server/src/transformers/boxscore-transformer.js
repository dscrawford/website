// ESPN summary payloads are untrusted upstream: this is the trust boundary
// before box scores reach the cache and every visitor's browser
import { str } from './sanitize.js'

const MAX_TEAMS = 2
const MAX_GROUPS = 6
const MAX_PLAYERS = 60
const MAX_COLUMNS = 16

function statCells(values, maxLength = 16) {
  if (!Array.isArray(values)) return []
  return values.slice(0, MAX_COLUMNS).map((v) => str(v, maxLength) ?? '')
}

function transformPlayer(entry) {
  if (!entry || typeof entry !== 'object') return null
  const athlete = entry.athlete || {}
  const name = str(athlete.displayName) || str(athlete.shortName)
  if (!name) return null
  // Position lives on the athlete for most sports, on the entry for MLB
  const position =
    str(athlete.position?.abbreviation, 8) || str(entry.position?.abbreviation, 8)
  return Object.freeze({
    name,
    shortName: str(athlete.shortName) || name,
    position,
    stats: Object.freeze(statCells(entry.stats)),
  })
}

function transformGroup(group) {
  if (!group || typeof group !== 'object') return null
  const athletes = Array.isArray(group.athletes) ? group.athletes : []
  const labels = statCells(group.labels)
  return Object.freeze({
    name: str(group.name, 32) || str(group.type, 32) || 'stats',
    labels: Object.freeze(labels),
    // ESPN's own column names, index-aligned with labels; the client's
    // glossary falls back to these
    descriptions: Object.freeze(statCells(group.descriptions, 64).slice(0, labels.length)),
    totals: Object.freeze(statCells(group.totals)),
    players: Object.freeze(
      athletes.slice(0, MAX_PLAYERS).map(transformPlayer).filter(Boolean)
    ),
  })
}

function transformTeam(teamEntry) {
  if (!teamEntry || typeof teamEntry !== 'object') return null
  const team = teamEntry.team || {}
  const statistics = Array.isArray(teamEntry.statistics) ? teamEntry.statistics : []
  return Object.freeze({
    name: str(team.displayName) || str(team.name) || 'Unknown',
    abbreviation: str(team.abbreviation, 8) || '???',
    groups: Object.freeze(
      statistics.slice(0, MAX_GROUPS).map(transformGroup).filter(Boolean)
    ),
  })
}

export function transformBoxScore(raw) {
  const players = raw?.boxscore?.players
  if (!Array.isArray(players)) return Object.freeze({ teams: [] })
  return Object.freeze({
    teams: Object.freeze(
      players.slice(0, MAX_TEAMS).map(transformTeam).filter(Boolean)
    ),
  })
}
