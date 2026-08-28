import { ESPN_BASE_URL } from '../config.js'

// ESPN's site API is unofficial and undocumented: no keys, no SLA, and
// endpoints or rate tolerance can change without notice. Requests stay
// polite: fetched lazily on cache miss only, TTL-cached, deduped in-flight
// — see lazy-fetcher.js/config.js.
export async function fetchScoreboard(sport, league) {
  const url = `${ESPN_BASE_URL}/${sport}/${league}/scoreboard`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })

    if (!response.ok) {
      console.error(`[espn] ${league} returned ${response.status}`)
      return null
    }

    if (!response.headers.get('content-type')?.includes('application/json')) {
      console.error(`[espn] ${league} returned non-JSON content type`)
      return null
    }
    const MAX_BYTES = 4 * 1024 * 1024
    if (Number(response.headers.get('content-length') || 0) > MAX_BYTES) {
      console.error(`[espn] ${league} response too large`)
      return null
    }
    const text = await response.text()
    if (text.length > MAX_BYTES) {
      console.error(`[espn] ${league} response too large`)
      return null
    }
    return JSON.parse(text)
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`[espn] ${league} request timed out`)
    } else {
      console.error(`[espn] ${league} fetch failed:`, err.message)
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
}
