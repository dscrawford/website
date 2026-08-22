import Fastify from 'fastify'
import cors from '@fastify/cors'
import { PORT } from './config.js'
import * as cache from './services/cache.js'
import * as poller from './services/poller.js'
import scoresRoutes from './routes/scores.js'

const fastify = Fastify({ logger: false })

async function start() {
  await fastify.register(cors, { origin: true })
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
    await fastify.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`[server] Listening on http://localhost:${PORT}`)
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
