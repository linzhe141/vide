import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { WebSocket, WebSocketServer } from 'ws'
import type { SessionEvent } from '@vide/agent/event'
import { logger } from '@/logger'
import type { WorkflowEventWithContext } from '@/ipc/api/channels'

const FLUSH_INTERVAL_MS = 16
const LOOPBACK_HOST = '127.0.0.1'
const MAX_BACKLOG_EVENTS = 2000

export type RendererAgentEvent = SessionEvent | WorkflowEventWithContext

export class RendererEventBridge {
  private server: WebSocketServer | null = null
  private starting: Promise<void> | null = null
  private flushHandle: NodeJS.Timeout | null = null
  private readonly streamPath = `/__vide_agent_events/${randomUUID()}`
  private readonly queuedEvents: RendererAgentEvent[] = []

  async init(): Promise<void> {
    if (this.server) {
      return
    }

    if (this.starting) {
      await this.starting
      return
    }

    this.starting = new Promise<void>((resolve, reject) => {
      const server = new WebSocketServer({
        host: LOOPBACK_HOST,
        port: 0,
        path: this.streamPath,
      })

      const handleListening = () => {
        server.off('error', handleStartupError)
        server.on('error', (error: Error) => {
          logger.error('renderer event bridge server error', error)
        })
        server.on('connection', (socket: WebSocket) => {
          socket.on('error', (error: Error) => {
            logger.error('renderer event bridge client error', error)
          })
          this.flush()
        })

        this.server = server
        this.starting = null
        logger.info('renderer event bridge listening', this.getConnectionUrl())
        resolve()
      }

      const handleStartupError = (error: Error) => {
        server.off('listening', handleListening)
        this.starting = null
        try {
          server.close()
        } catch {
          // ignore close failures during startup rollback
        }
        reject(new Error(`Failed to start renderer event bridge: ${error.message}`))
      }

      server.once('error', handleStartupError)
      server.once('listening', handleListening)
    })

    await this.starting
  }

  publish(event: RendererAgentEvent): void {
    this.queuedEvents.push(event)
    if (this.queuedEvents.length > MAX_BACKLOG_EVENTS) {
      this.queuedEvents.splice(0, this.queuedEvents.length - MAX_BACKLOG_EVENTS)
    }
    this.scheduleFlush()
  }

  async getConnectionInfo(): Promise<{ url: string }> {
    await this.init()
    return { url: this.getConnectionUrl() }
  }

  async dispose(): Promise<void> {
    if (this.flushHandle) {
      clearTimeout(this.flushHandle)
      this.flushHandle = null
    }

    this.queuedEvents.length = 0

    const server = this.server
    this.server = null
    this.starting = null

    if (!server) {
      return
    }

    for (const client of server.clients) {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.close(1001, 'app-dispose')
      }
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }

  private scheduleFlush(): void {
    if (this.flushHandle) {
      return
    }

    this.flushHandle = setTimeout(() => {
      this.flushHandle = null
      this.flush()
    }, FLUSH_INTERVAL_MS)
  }

  private flush(): void {
    if (!this.server || !this.queuedEvents.length) {
      return
    }

    const clients = [...this.server.clients].filter(
      (client) => client.readyState === WebSocket.OPEN
    )
    if (!clients.length) {
      return
    }

    const payload = serializeBatch({
      events: this.queuedEvents.splice(0, this.queuedEvents.length),
    })

    for (const client of clients) {
      try {
        client.send(payload)
      } catch (error) {
        logger.error('renderer event bridge send failed', error)
      }
    }
  }

  private getConnectionUrl(): string {
    const server = this.server
    if (!server) {
      throw new Error('Renderer event bridge is not initialized.')
    }

    const address = server.address() as AddressInfo | string | null
    if (!address || typeof address === 'string') {
      throw new Error('Renderer event bridge address is unavailable.')
    }

    return `ws://${LOOPBACK_HOST}:${address.port}${this.streamPath}`
  }
}

function serializeBatch(batch: { events: RendererAgentEvent[] }): string {
  const seen = new WeakSet<object>()

  return JSON.stringify(batch, (_key, value) => {
    if (value instanceof Error) {
      return serializeError(value)
    }

    if (typeof value === 'bigint') {
      return value.toString()
    }

    if (Buffer.isBuffer(value)) {
      return {
        type: 'Buffer',
        data: value.toString('base64'),
      }
    }

    if (value && typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)
    }

    return value
  })
}

function serializeError(error: Error) {
  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  }

  if (error.stack) {
    serialized.stack = error.stack
  }

  const cause = (error as Error & { cause?: unknown }).cause
  if (cause !== undefined) {
    serialized.cause = cause
  }

  for (const [key, value] of Object.entries(error)) {
    if (!(key in serialized)) {
      serialized[key] = value
    }
  }

  return serialized
}
