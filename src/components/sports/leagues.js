// Display order and labels for the leagues the server tracks
// (server/src/config.js LEAGUES); keys double as URL segments
export const LEAGUES = Object.freeze([
  { key: 'nfl', label: 'NFL', short: 'NFL' },
  { key: 'ncaaf', label: 'NCAAF', short: 'NCAAF' },
  { key: 'nba', label: 'NBA', short: 'NBA' },
  { key: 'cbb', label: 'College Basketball', short: 'CBB' },
  { key: 'mlb', label: 'MLB', short: 'MLB' },
])

export const LEAGUE_KEYS = new Set(LEAGUES.map((l) => l.key))

export function leagueLabel(key) {
  return LEAGUES.find((l) => l.key === key)?.label ?? key?.toUpperCase() ?? ''
}

export function teamPath(leagueKey, teamId) {
  return `/sports/teams/${leagueKey}/${teamId}`
}

// Calendar days from the URL: ISO day only, validated as a real date
export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export function isValidDay(value) {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}
