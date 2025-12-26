/**
 * Server Entry Point for Multi-Tenant SaaS
 * Initializes database and starts HTTP server
 */
import app from './app.js'
import { initDatabase } from './lib/database.js'
import logger from './lib/logger.js'

const PORT = parseInt(process.env.PORT || '8081', 10)
const HOST = process.env.HOST || '0.0.0.0'

async function startServer() {
  try {
    // Initialize database
    logger.info('Initializing database...')
    initDatabase()
    logger.info('Database initialized successfully')

    // Start HTTP server
    app.listen(PORT, HOST, () => {
      logger.info('PTAR SaaS Server started', {
        port: PORT,
        host: HOST,
        env: process.env.NODE_ENV || 'development',
        url: `http://localhost:${PORT}`
      })

      // Banner for development
      if (process.env.NODE_ENV !== 'production') {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║   🚀 PTAR SaaS Server Running                              ║
║   Local:     http://localhost:${PORT}                       ║
║   Network:   http://${HOST}:${PORT}                         ║
╚════════════════════════════════════════════════════════════╝
        `)
      }
    })

    // Graceful shutdown
    const shutdown = (signal: string) => {
      logger.info('Shutting down gracefully...', { signal })
      process.exit(0)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

  } catch (error) {
    logger.error('Failed to start server', {}, error as Error)
    process.exit(1)
  }
}

startServer()
