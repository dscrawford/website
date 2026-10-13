// ESPN standings are untrusted upstream: this is the trust boundary before
// they reach the cache and every browser
import { str, safeLogo } from './sanitize.js'

const MAX_GROUPS = 64
const MAX_ENTRIES = 40
const MAX_DEPTH = 3

// The few stats each league's table shows, in column order. `stat` is
// ESPN's name for it on a standings entry.
const col = (key, label, stat, title) => Object.freeze({ key, label, stat, title })
const COLUMNS = Object.freeze({
  nfl: [
    col('w', 'W', 'wins', 'Wins'),
    col('l', 'L', 'losses', 'Losses'),
    col('t', 'T', 'ties', 'Ties'),
    col('pct', 'PCT', 'winPercent', 'Winning percentage'),
    col('pf', 'PF', 'pointsFor', 'Points for'),
    col('pa', 'PA', 'pointsAgainst', 'Points against'),
    col('diff', 'DIFF', 'pointDifferential', 'Point differential'),
    col('div', 'DIV', 'divisionRecord', 'Record within the division'),
    col('conf', 'CONF', 'vs. Conf.', 'Record within the conference'),
    col('strk', 'STRK', 'streak', 'Current streak'),
    col('seed', 'SEED', 'playoffSeed', 'Conference playoff seed'),
  ],
  ncaaf: [
    col('conf', 'CONF', 'vs. Conf.', 'Conference record'),
    col('ovr', 'OVERALL', 'overall', 'Overall record'),
    col('pf', 'PF', 'pointsFor', 'Points for'),
    col('pa', 'PA', 'pointsAgainst', 'Points against'),
    col('diff', 'DIFF', 'pointDifferential', 'Point differential'),
    col('strk', 'STRK', 'streak', 'Current streak'),
  ],
  nba: [
    col('w', 'W', 'wins', 'Wins'),
    col('l', 'L', 'losses', 'Losses'),
    col('pct', 'PCT', 'winPercent', 'Winning percentage'),
    col('gb', 'GB', 'gamesBehind', 'Games behind the division leader'),
    col('ppg', 'PPG', 'avgPointsFor', 'Points per game'),
    col('opp', 'OPP', 'avgPointsAgainst', 'Opponent points per game'),
    col('strk', 'STRK', 'streak', 'Current streak'),
    col('l10', 'L10', 'Last Ten Games', 'Last ten games'),
    col('seed', 'SEED', 'playoffSeed', 'Conference playoff seed'),
  ],
  cbb: [
    col('conf', 'CONF', 'vs. Conf.', 'Conference record'),
    col('ovr', 'OVERALL', 'overall', 'Overall record'),
    col('ppg', 'PPG', 'avgPointsFor', 'Points per game'),
    col('opp', 'OPP', 'avgPointsAgainst', 'Opponent points per game'),
    col('strk', 'STRK', 'streak', 'Current streak'),
  ],
  mlb: [
    col('w', 'W', 'wins', 'Wins'),
    col('l', 'L', 'losses', 'Losses'),
    col('pct', 'PCT', 'winPercent', 'Winning percentage'),
    col('gb', 'GB', 'gamesBehind', 'Games behind the division leader'),
    col('rs', 'RS', 'pointsFor', 'Runs scored'),
    col('ra', 'RA', 'pointsAgainst', 'Runs allowed'),
    col('diff', 'DIFF', 'pointDifferential', 'Run differential'),
    col('strk', 'STRK', 'streak', 'Current streak'),
    col('l10', 'L10', 'Last Ten Games', 'Last ten games'),
    col('seed', 'SEED', 'playoffSeed', 'League playoff seed'),
  ],
})

export function standingsColumns(leagueKey) {
  return COLUMNS[leagueKey] ?? Object.freeze([])
}

// Entries repeat a stat per split (overall, then home, road, ...); the
// overall copy comes first
function firstStat(stats, name) {
  return stats.find((s) => s?.name === name)
}

function logoOf(team) {
  const logos = Array.isArray(team?.logos) ? team.logos : []
  return safeLogo(logos[0]?.href)
}

function seedOf(stats) {
  const value = Number.parseInt(firstStat(stats, 'playoffSeed')?.value, 10)
  return Number.isFinite(value) && value > 0 ? value : null
}

function transformEntry(entry, columns) {
  const team = entry?.team
  const id = str(team?.id, 16)
  if (!id) return null
  const stats = Array.isArray(entry.stats) ? entry.stats : []
  const values = {}
  for (const column of columns) {
    values[column.key] = str(firstStat(stats, column.stat)?.displayValue, 16) || '-'
  }
  return Object.freeze({
    team: Object.freeze({
      id,
      abbreviation: str(team.abbreviation, 8) || '???',
      name: str(team.displayName) || str(team.name) || 'Unknown',
      logo: logoOf(team),
    }),
    seed: seedOf(stats),
    stats: Object.freeze(values),
  })
}

// ESPN lists some leagues' teams alphabetically; the conference seed is
// the standing order when every team has one
function inStandingOrder(entries) {
  if (entries.length === 0 || entries.some((e) => e.seed === null)) return entries
  return [...entries].sort((a, b) => a.seed - b.seed)
}

function transformGroup(group, columns, depth) {
  if (!group || typeof group !== 'object' || depth > MAX_DEPTH) return null
  const name = str(group.name, 48)
  if (!name) return null
  const children = Array.isArray(group.children) ? group.children : []
  const rawEntries = Array.isArray(group.standings?.entries) ? group.standings.entries : []
  const entries = inStandingOrder(
    rawEntries
      .slice(0, MAX_ENTRIES)
      .map((entry) => {
        try {
          return transformEntry(entry, columns)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  )
  const groups = children
    .slice(0, MAX_GROUPS)
    .map((child) => transformGroup(child, columns, depth + 1))
    .filter(Boolean)
  if (entries.length === 0 && groups.length === 0) return null
  return Object.freeze({
    id: str(group.id, 16),
    name,
    abbreviation: str(group.abbreviation, 12) || null,
    ...(groups.length > 0 ? { groups: Object.freeze(groups) } : {}),
    entries: Object.freeze(entries),
  })
}

// Conferences, each with its divisions when ESPN sends them, each
// division's teams in standing order (first place first)
export function transformStandings(raw, leagueKey) {
  const columns = standingsColumns(leagueKey)
  const children = Array.isArray(raw?.children) ? raw.children : []
  const groups = children
    .slice(0, MAX_GROUPS)
    .map((group) => transformGroup(group, columns, 1))
    .filter(Boolean)
  const season = raw?.season || {}
  const year = Number.parseInt(season.year, 10)
  return Object.freeze({
    league: leagueKey,
    season: Object.freeze({
      year: Number.isFinite(year) ? year : null,
      label: str(season.displayName, 16) || (Number.isFinite(year) ? String(year) : null),
    }),
    columns,
    groups: Object.freeze(groups),
  })
}
