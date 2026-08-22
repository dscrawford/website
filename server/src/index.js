import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { PORT, HOST, ALLOWED_ORIGINS } from './config.js'
import * as cache from './services/cache.js'
import * as poller from './services/poller.js'
import scoresRoutes from './routes/scores.js'

const fastify = Fastify({ logger: { level: 'warn' } })

async function start() {
  await fastify.register(cors, {
    origin: ALLOWED_ORIGINS,
    methods: ['GET'],
    credentials: false,
  })
  await fastify.register(rateLimit, { max: 60, timeWindow: '1 minute' })
  await fastify.register(scoresRoutes)

  const redis = cache.connect()
  try {
    await redis.connect()
  } catch (err) {
    console.error('[server] Redis connection failed:', err.message)
    console.error('[server] Scores will not be cached. Ensure Redis is running.')
  }

  poller.start()

  try {
    await fastify.listen({ port: PORT, host: HOST })
    console.log(`[server] Listening on http://${HOST}:${PORT}`)
  } catch (err) {
    console.error('[server] Failed to start:', err.message)
    process.exit(1)
  }
}

async function shutdown() {
  console.log('[server] Shutting down...')
  poller.stop()
  await cache.disconnect()
  await fastify.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start()
