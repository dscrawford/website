export const LEAGUES = Object.freeze([
  { key: 'nfl', sport: 'football', league: 'nfl', label: 'NFL' },
  { key: 'ncaaf', sport: 'football', league: 'college-football', label: 'NCAAF' },
  { key: 'nba', sport: 'basketball', league: 'nba', label: 'NBA' },
  { key: 'cbb', sport: 'basketball', league: 'mens-college-basketball', label: 'College Basketball' },
  { key: 'mlb', sport: 'baseball', league: 'mlb', label: 'MLB' },
])

// ESPN event ids are short numeric strings; reject anything else at the edge
export const GAME_ID_PATTERN = /^\d{1,12}$/
// Fallback ids for events ESPN gave no id: FNV-1a hex of the matchup
export const HASH_ID_PATTERN = /^h[0-9a-f]{8,16}$/

export const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports'

export const POLL_INTERVAL_MS = 45_000
export const POLL_STAGGER_MS = 2_000
export const CACHE_TTL_SECONDS = 60
export const CACHE_KEY_PREFIX = 'scores'

export const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
export const PORT = Number.parseInt(process.env.PORT ?? '3001', 10) || 3001
// Loopback by default: the reverse proxy fronts /api in production
export const HOST = process.env.HOST || '127.0.0.1'
export const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:5173,https://dcraw.net,https://danielcrawford.dev'
).split(',')
