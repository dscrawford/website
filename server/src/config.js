// College scoreboards default to ~25 featured games; groups=80 (FBS) and
// groups=50 (all D1) with an explicit limit return the full slate
//
// ESPN's ids for the polls a college league publishes
export const POLL = Object.freeze({ AP: '1', COACHES: '2', CFP: '21' })
// Standings grouped down to each division rather than whole conferences
const DIVISION_LEVEL = 3

export const LEAGUES = Object.freeze([
  { key: 'nfl', sport: 'football', league: 'nfl', label: 'NFL', params: '', standingsLevel: DIVISION_LEVEL },
  { key: 'ncaaf', sport: 'football', league: 'college-football', label: 'NCAAF', params: 'groups=80&limit=300', polls: [POLL.AP, POLL.COACHES, POLL.CFP], weeks: 'calendar' },
  { key: 'nba', sport: 'basketball', league: 'nba', label: 'NBA', params: '', standingsLevel: DIVISION_LEVEL },
  { key: 'cbb', sport: 'basketball', league: 'mens-college-basketball', label: 'College Basketball', params: 'groups=50&limit=300', polls: [POLL.AP, POLL.COACHES], weeks: 'uniform' },
  { key: 'mlb', sport: 'baseball', league: 'mlb', label: 'MLB', params: '', standingsLevel: DIVISION_LEVEL },
])

// ESPN event ids are short numeric strings; reject anything else at the edge
export const GAME_ID_PATTERN = /^\d{1,12}$/
// Fallback ids for events ESPN gave no id: FNV-1a hex of the matchup
export const HASH_ID_PATTERN = /^h[0-9a-f]{8,16}$/
// ESPN team ids are short numeric strings; no leading zeros so each team
// has exactly one cache key and upstream URL
export const TEAM_ID_PATTERN = /^(?:0|[1-9]\d{0,9})$/

export const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports'
// Standings live under a different site API root than scoreboards
export const ESPN_STANDINGS_URL = 'https://site.api.espn.com/apis/v2/sports'
// The core API addresses rankings by season year, season type and week,
// which is what makes past weeks reachable at all
export const ESPN_CORE_URL = 'https://sports.core.api.espn.com/v2/sports'

export const POLL_INTERVAL_MS = 45_000
export const POLL_STAGGER_MS = 2_000
export const CACHE_TTL_SECONDS = 60
// Season schedules change at most a few times a day
export const SCHEDULE_CACHE_TTL_SECONDS = 300
// A finished day's scoreboard never changes; the same fetch is reused for
// a browsing session rather than every minute
export const DATE_CACHE_TTL_SECONDS = 6 * 60 * 60
// Polls and standings move a few times a week; the live copy is refreshed
// every ten minutes, past weeks and seasons are held like past days
export const RANKINGS_CACHE_TTL_SECONDS = 600
export const STANDINGS_CACHE_TTL_SECONDS = 600
// Team directories and season week layouts change about once a year
export const SEASON_CACHE_TTL_SECONDS = 24 * 60 * 60
// College standings carry every team's logos and links: ~6MB for CBB
export const STANDINGS_MAX_BYTES = 10 * 1024 * 1024
// ?season= on team schedules: a four-digit year, from ESPN's earliest
// box scores up to next season
export const SEASON_PATTERN = /^\d{4}$/
export const MIN_SEASON = 2000
// Calendar dates from the ?date= query: ISO day only
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const CACHE_KEY_PREFIX = 'scores'

export const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
export const PORT = Number.parseInt(process.env.PORT ?? '3001', 10) || 3001
// Loopback by default: the reverse proxy fronts /api in production
export const HOST = process.env.HOST || '127.0.0.1'
export const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:5173,https://dcraw.net,https://danielcrawford.dev'
).split(',')
