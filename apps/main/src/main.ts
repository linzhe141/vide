import { app } from 'electron'
import { start } from './bootstrap'
import { logger } from './logger'

process.on('uncaughtExceptionMonitor', (error, origin) => {
  logger.error('uncaught exception', { origin, error })
})

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled rejection', reason)
})

start().catch((error) => {
  logger.error('fatal app startup failure', error)
  app.exit(1)
})
