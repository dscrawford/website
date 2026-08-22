import { LEAGUES, POLL_INTERVAL_MS, POLL_STAGGER_MS } from '../config.js'
import { fetchScoreboard } from './espn-client.js'
import { transformScoreboard } from '../transformers/game-transformer.js'
import * as cache from './cache.js'

const timers = []

async function pollLeague(leagueConfig) {
  const { key, sport, league, label } = leagueConfig

  try {
    const raw = await fetchScoreboard(sport, league)
    if (!raw) return

    const games = transformScoreboard(raw)
    await cache.set(key, {
      league: key,
      label,
      games,
      fetchedAt: new Date().toISOString(),
    })

    console.log(`[poller] ${label}: ${games.length} games cached`)
  } catch (err) {
    console.error(`[poller] ${label} poll failed:`, err.message)
  }
}

export function start() {
  LEAGUES.forEach((leagueConfig, index) => {
    const delay = index * POLL_STAGGER_MS

    // Initial poll with stagger
    const initTimer = setTimeout(() => {
      pollLeague(leagueConfig)

      // Recurring poll
      const intervalTimer = setInterval(
        () => pollLeague(leagueConfig),
        POLL_INTERVAL_MS
      )
      timers.push(intervalTimer)
    }, delay)

    timers.push(initTimer)
  })

  console.log(`[poller] Started polling ${LEAGUES.length} leagues every ${POLL_INTERVAL_MS / 1000}s`)
}

export function stop() {
  timers.forEach(clearTimeout)
  timers.forEach(clearInterval)
  timers.length = 0
  console.log('[poller] Stopped')
}
