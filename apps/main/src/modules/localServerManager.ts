import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { logger } from '@/logger'

export type LocalServerRouteResponse = {
  statusCode?: number
  headers?: Record<string, string>
  body?: string
}

export type LocalServerRouteHandler = (requestUrl: URL) => Promise<LocalServerRouteResponse>

export type LocalServerController = {
  init(): Promise<void>
  isListening(): boolean
}

type LocalServerManagerOptions = {
  callbackUrl: string
}

export class LocalServerManager {
  private server: Server | null = null
  private starting: Promise<void> | null = null
  private readonly callbackUrl: URL
  private readonly routeHandlers = new Map<string, LocalServerRouteHandler>()

  constructor(private readonly options: LocalServerManagerOptions) {
    this.callbackUrl = parseLoopbackCallbackUrl(options.callbackUrl)
  }

  registerRoute(pathname: string, handler: LocalServerRouteHandler) {
    this.routeHandlers.set(normalizePathname(pathname), handler)
  }

  async init(): Promise<void> {
    if (this.server?.listening) {
      return
    }

    if (this.starting) {
      await this.starting
      return
    }

    this.starting = new Promise<void>((resolve, reject) => {
      const server = createServer((request, response) => {
        this.handleRequest(request, response).catch((error) => {
          logger.error('local server request handling failed', error)
          if (!response.headersSent) {
            response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
          }
          response.end('Local server request failed.')
        })
      })

      const handleStartupError = (error: Error) => {
        this.server = null
        this.starting = null
        reject(
          new Error(
            `Failed to start local server on ${this.callbackUrl.toString()}: ${error.message}`
          )
        )
      }

      server.once('error', handleStartupError)
      server.listen(Number(this.callbackUrl.port || '80'), this.callbackUrl.hostname, () => {
        server.off('error', handleStartupError)
        server.on('error', (error) => {
          logger.error('local server error', error)
        })

        this.server = server
        this.starting = null
        logger.info('local server listening', this.callbackUrl.toString())
        resolve()
      })
    })

    await this.starting
  }

  isListening(): boolean {
    return !!this.server?.listening
  }

  async dispose(): Promise<void> {
    const server = this.server
    this.server = null
    this.starting = null

    if (!server || !server.listening) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== 'GET') {
      response.writeHead(405, {
        'Content-Type': 'text/plain; charset=utf-8',
        Allow: 'GET',
      })
      response.end('Method Not Allowed')
      return
    }

    const requestUrl = new URL(request.url || '/', this.callbackUrl)
    const routeHandler = this.routeHandlers.get(normalizePathname(requestUrl.pathname))
    if (!routeHandler) {
      response.writeHead(204)
      response.end()
      return
    }

    logger.info('local server request received', requestUrl.toString())

    const result = await routeHandler(requestUrl)
    response.writeHead(result.statusCode ?? 200, result.headers ?? {})
    response.end(result.body ?? '')
  }
}

function parseLoopbackCallbackUrl(rawValue: string): URL {
  const callbackUrl = new URL(rawValue)
  if (callbackUrl.protocol !== 'http:') {
    throw new Error('GitHub OAuth callback URL must use http:// for the local callback server.')
  }

  if (!isLoopbackHost(callbackUrl.hostname)) {
    throw new Error('GitHub OAuth callback URL must point to localhost or 127.x.x.x.')
  }

  return callbackUrl
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname.startsWith('127.')
}

function normalizePathname(pathname: string): string {
  return pathname || '/'
}
