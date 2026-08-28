import * as lazyFetcher from '../services/lazy-fetcher.js'
import { LEAGUES } from '../config.js'

const VALID_KEYS = new Set(LEAGUES.map((l) => l.key))

export default async function scoresRoutes(fastify) {
  // Short-lived pre-serialized snapshot: bursts of requests reuse one
  // payload instead of re-running the lazy fetch pipeline + stringify
  let snapshot = { body: null, at: 0 }

  fastify.get('/api/scores', async (request, reply) => {
    reply.header('Cache-Control', 'public, max-age=15')
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.type('application/json')
    if (snapshot.body && Date.now() - snapshot.at < 5000) {
      return snapshot.body
    }
    const body = JSON.stringify({
      success: true,
      data: { leagues: await lazyFetcher.getAll() },
      error: null,
    })
    snapshot = { body, at: Date.now() }
    return body
  })

  fastify.get('/api/scores/:league', async (request, reply) => {
    const { league } = request.params

    if (!VALID_KEYS.has(league)) {
      reply.code(404).header('X-Content-Type-Options', 'nosniff')
      return {
        success: false,
        data: null,
        error: `Unknown league. Valid: ${[...VALID_KEYS].join(', ')}`,
      }
    }

    const data = await lazyFetcher.getLeague(league)
    if (!data) {
      return {
        success: true,
        data: { league, label: league.toUpperCase(), games: [], fetchedAt: null },
        error: null,
      }
    }

    return { success: true, data, error: null }
  })
}
