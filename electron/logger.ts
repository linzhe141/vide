import log from 'electron-log'
log.transports.console.format = '[{level}] {text}'

export const logger = {
  info: (...args: any[]) => log.info('[app]', ...args),
  warn: (...args: any[]) => log.warn('[app]', ...args),
  error: (...args: any[]) => log.error('[app]', ...args),
  debug: (...args: any[]) => log.debug('[app]', ...args),
}
