import { ESPN_BASE_URL } from '../config.js'

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

    return await response.json()
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
