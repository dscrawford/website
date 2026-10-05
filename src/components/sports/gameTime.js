export function formatDateTime(dateStr, fallback) {
  if (!dateStr) return fallback || 'TBD'
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return fallback || 'TBD'
    const month = d.toLocaleDateString([], { month: 'short' })
    const day = d.getDate()
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `${month} ${day}, ${time}`
  } catch {
    return fallback || 'TBD'
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return ''
    const month = d.toLocaleDateString([], { month: 'short' })
    const day = d.getDate()
    return `${month} ${day}`
  } catch {
    return ''
  }
}

// The calendar day ESPN files a game under. Its scoreboard days roll over
// on US Eastern time, so a 1:00 UTC first pitch belongs to the evening
// before — using the visitor's zone would miss games for anyone west of ET.
export function espnDay(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
}

// Box score URL for a game, carrying what the page needs to find it when
// it is no longer on today's live board
export function gamePath(gameId, leagueKey, dateStr) {
  const day = espnDay(dateStr)
  const params = new URLSearchParams()
  if (leagueKey) params.set('league', leagueKey)
  if (day) params.set('date', day)
  const query = params.toString()
  return `/sports/${gameId}${query ? `?${query}` : ''}`
}
