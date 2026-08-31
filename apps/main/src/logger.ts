import log from 'electron-log'
log.transports.console.format = '[{level}] {text}'

const processStartedAt = Date.now() - Math.round(process.uptime() * 1000)

export const logger = {
  info: (...args: any[]) => log.info('[app]', ...args),
  warn: (...args: any[]) => log.warn('[app]', ...args),
  error: (...args: any[]) => log.error('[app]', ...args),
  debug: (...args: any[]) => log.debug('[app]', ...args),
}

export function getStartupElapsedMs() {
  return Date.now() - processStartedAt
}

export function logStartupStep(step: string, details: Record<string, unknown> = {}) {
  logger.info('[startup]', step, {
    elapsedMs: getStartupElapsedMs(),
    ...details,
  })
}
