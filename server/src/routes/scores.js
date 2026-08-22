import * as cache from '../services/cache.js'
import { LEAGUES } from '../config.js'

const VALID_KEYS = new Set(LEAGUES.map((l) => l.key))

export default async function scoresRoutes(fastify) {
  // Serve a short-lived pre-serialized snapshot: the payload only changes
  // when the poller refreshes, so per-request Redis reads + stringify are
  // wasted work and an amplification aid
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
      data: { leagues: await cache.getAll() },
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

    const data = await cache.get(league)
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
