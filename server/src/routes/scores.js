import * as lazyFetcher from '../services/lazy-fetcher.js'
import { LEAGUES, GAME_ID_PATTERN, HASH_ID_PATTERN } from '../config.js'

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

  fastify.get('/api/scores/:league/games/:gameId', async (request, reply) => {
    const { league, gameId } = request.params
    reply.header('X-Content-Type-Options', 'nosniff')

    if (!VALID_KEYS.has(league)) {
      reply.code(404)
      return {
        success: false,
        data: null,
        error: `Unknown league. Valid: ${[...VALID_KEYS].join(', ')}`,
      }
    }
    // Hash-form ids identify games ESPN gave no event id; there is no
    // upstream to query, so they short-circuit to the empty envelope
    if (HASH_ID_PATTERN.test(gameId)) {
      reply.header('Cache-Control', 'public, max-age=300')
      return {
        success: true,
        data: { gameId, teams: [], fetchedAt: null },
        error: null,
      }
    }
    if (!GAME_ID_PATTERN.test(gameId)) {
      reply.code(400)
      return { success: false, data: null, error: 'Invalid game id' }
    }

    reply.header('Cache-Control', 'public, max-age=30')
    const data = await lazyFetcher.getBoxScore(league, gameId)
    if (!data) {
      return {
        success: true,
        data: { gameId, teams: [], fetchedAt: null },
        error: null,
      }
    }
    return { success: true, data, error: null }
  })
}
