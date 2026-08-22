import * as cache from '../services/cache.js'
import { LEAGUES } from '../config.js'

const VALID_KEYS = new Set(LEAGUES.map((l) => l.key))

export default async function scoresRoutes(fastify) {
  fastify.get('/api/scores', async () => {
    const allData = await cache.getAll()
    return {
      success: true,
      data: { leagues: allData },
      error: null,
    }
  })

  fastify.get('/api/scores/:league', async (request, reply) => {
    const { league } = request.params

    if (!VALID_KEYS.has(league)) {
      reply.code(404)
      return {
        success: false,
        data: null,
        error: `Unknown league: ${league}. Valid: ${[...VALID_KEYS].join(', ')}`,
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
