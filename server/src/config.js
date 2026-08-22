export const LEAGUES = Object.freeze([
  { key: 'nfl', sport: 'football', league: 'nfl', label: 'NFL' },
  { key: 'ncaaf', sport: 'football', league: 'college-football', label: 'NCAAF' },
  { key: 'nba', sport: 'basketball', league: 'nba', label: 'NBA' },
  { key: 'cbb', sport: 'basketball', league: 'mens-college-basketball', label: 'College Basketball' },
  { key: 'mlb', sport: 'baseball', league: 'mlb', label: 'MLB' },
])

export const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports'

export const POLL_INTERVAL_MS = 45_000
export const POLL_STAGGER_MS = 2_000
export const CACHE_TTL_SECONDS = 60
export const CACHE_KEY_PREFIX = 'scores'

export const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
export const PORT = parseInt(process.env.PORT || '3001', 10)
