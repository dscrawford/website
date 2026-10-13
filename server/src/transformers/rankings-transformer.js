// ESPN core rankings and team directories are untrusted upstream: this is
// the trust boundary before polls reach the cache and every browser
import { str, safeLogo } from './sanitize.js'

const MAX_TEAMS = 2000
const MAX_RANKS = 50

// Core rankings refer to teams only by URL; the directory fills in the rest
function teamIdFromRef(ref) {
  const match = typeof ref === 'string' ? ref.match(/\/teams\/(\d{1,10})(?:[/?]|$)/) : null
  return match ? match[1] : null
}

function logoOf(team) {
  const logos = Array.isArray(team?.logos) ? team.logos : []
  return safeLogo(logos[0]?.href)
}

// { teamId: { abbreviation, name, logo } } for one league
export function transformTeamIndex(raw) {
  const teams = raw?.sports?.[0]?.leagues?.[0]?.teams
  const index = {}
  for (const entry of Array.isArray(teams) ? teams.slice(0, MAX_TEAMS) : []) {
    const team = entry?.team
    const id = str(team?.id, 16)
    if (!id) continue
    index[id] = Object.freeze({
      abbreviation: str(team.abbreviation, 8) || '???',
      name: str(team.displayName) || str(team.name) || 'Unknown',
      logo: logoOf(team),
    })
  }
  return Object.freeze(index)
}

function count(value) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function transformRank(entry, teams) {
  const id = teamIdFromRef(entry?.team?.$ref) ?? str(entry?.team?.id, 16)
  if (!id) return null
  const known = teams[id]
  return Object.freeze({
    rank: count(entry.current),
    previous: count(entry.previous),
    trend: str(entry.trend, 8) || '-',
    points: count(entry.points),
    firstPlaceVotes: count(entry.firstPlaceVotes),
    record: str(entry.record?.summary, 24) || str(entry.recordSummary, 24) || null,
    team: Object.freeze({
      id,
      abbreviation: known?.abbreviation || str(entry.team?.abbreviation, 8) || '???',
      name: known?.name || str(entry.team?.displayName) || str(entry.team?.nickname) || 'Unknown',
      logo: known?.logo ?? null,
    }),
  })
}

function transformRanks(list, teams) {
  return Object.freeze(
    (Array.isArray(list) ? list : [])
      .slice(0, MAX_RANKS)
      .map((entry) => {
        try {
          return transformRank(entry, teams)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  )
}

// One poll for one week. `ranks` are the Top 25 in order; `others` got
// votes without ranking; `droppedOut` were ranked the week before.
export function transformRanking(raw, teams = {}) {
  if (!raw || typeof raw !== 'object') return null
  const id = str(raw.id, 8)
  const type = str(raw.type, 16)
  if (!id || !type) return null
  const ranks = [...transformRanks(raw.ranks, teams)].sort((a, b) => a.rank - b.rank)
  return Object.freeze({
    id,
    type,
    name: str(raw.name, 48) || 'Rankings',
    shortName: str(raw.shortName, 24) || str(raw.name, 24) || 'Poll',
    headline: str(raw.shortHeadline, 64) || str(raw.headline, 64) || null,
    week: str(raw.occurrence?.displayValue, 24) || null,
    date: str(raw.date, 40),
    ranks: Object.freeze(ranks),
    others: transformRanks(raw.others, teams),
    droppedOut: transformRanks(raw.droppedOut, teams),
  })
}
