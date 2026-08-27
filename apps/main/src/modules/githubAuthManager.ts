import { randomUUID } from 'node:crypto'
import { shell } from 'electron'
import type { GitHubAuthRuntimeStatus } from '@vide/config'
import { ipcMainApi } from '@/ipc/api/ipcMain'
import { logger } from '@/logger'
import devConfig from '../dev.config'
import type { LocalServerController, LocalServerRouteResponse } from './localServerManager'
import { UserRepository } from './userRepository'

const APP_WAKE_URL = 'vide://oauth/callback'
const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const USER_PROFILE_URL = 'https://api.github.com/user'
const USER_EMAILS_URL = 'https://api.github.com/user/emails'
const REQUESTED_SCOPE = 'read:user user:email'

type GitHubOAuthConfig = {
  clientId: string
  clientSecret: string
  callbackUrl: string
}

type GitHubOAuthState = {
  pendingState: string | null
  lastError: string | null
}

type GitHubTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

type GitHubUserResponse = {
  id: number
  login: string
  avatar_url: string | null
  email: string | null
}

type GitHubEmailResponse = {
  email: string
  primary: boolean
  verified: boolean
  visibility: 'public' | 'private' | null
}

export class GitHubAuthManager {
  private authState: GitHubOAuthState = {
    pendingState: null,
    lastError: null,
  }

  private localServerManager: LocalServerController | null = null

  attachLocalServerManager(localServerManager: LocalServerController) {
    this.localServerManager = localServerManager
  }

  async startAuth(): Promise<void> {
    const config = this.getOAuthConfig()
    if (!config.clientId || !config.clientSecret) {
      throw new Error('GitHub OAuth is not configured. Set client id and client secret first.')
    }

    if (!this.localServerManager) {
      throw new Error('Local GitHub OAuth server is not configured.')
    }

    if (!this.localServerManager.isListening()) {
      await this.localServerManager.init()
    }

    const state = randomUUID()

    this.authState.pendingState = state
    this.authState.lastError = null

    const authorizeUrl = new URL(AUTHORIZE_URL)
    authorizeUrl.searchParams.set('client_id', config.clientId)
    authorizeUrl.searchParams.set('redirect_uri', config.callbackUrl)
    authorizeUrl.searchParams.set('scope', REQUESTED_SCOPE)
    authorizeUrl.searchParams.set('state', state)

    logger.info('opening github oauth authorize url', authorizeUrl.toString())
    await shell.openExternal(authorizeUrl.toString())
    await this.broadcastStatus()
  }

  async logout(): Promise<void> {
    await UserRepository.clear()
    this.clearPendingRequest()
    this.authState.lastError = null
    await this.broadcastStatus()
  }

  async dispose(): Promise<void> {
    return Promise.resolve()
  }

  async getRuntimeStatus(): Promise<GitHubAuthRuntimeStatus> {
    const config = this.getOAuthConfig()
    const user = await UserRepository.getCurrentUser()

    return {
      configured: !!config.clientId && !!config.clientSecret,
      authenticated: !!user,
      pending: !!this.authState.pendingState,
      callbackUrl: config.callbackUrl,
      lastError: this.authState.lastError,
      user,
    }
  }

  async handleProtocolUrl(rawUrl: string): Promise<boolean> {
    const parsedUrl = new URL(rawUrl)
    if (parsedUrl.protocol !== 'vide:' || parsedUrl.hostname !== 'oauth') {
      return false
    }

    if (parsedUrl.pathname !== '/callback') {
      return false
    }

    if (parsedUrl.searchParams.get('source') === 'http-callback') {
      logger.info('github oauth wake callback received', rawUrl)
      return true
    }

    await this.completeAuthFromCallback(parsedUrl)

    return true
  }

  getCallbackUrl(): string {
    return this.getOAuthConfig().callbackUrl
  }

  getCallbackPath(): string {
    return normalizePathname(new URL(this.getOAuthConfig().callbackUrl).pathname)
  }

  async handleLocalCallback(callbackUrl: URL): Promise<LocalServerRouteResponse> {
    await this.completeAuthFromCallback(callbackUrl)

    const wakeUrl = new URL(APP_WAKE_URL)
    wakeUrl.searchParams.set('source', 'http-callback')

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
      body: renderWakePage(wakeUrl.toString()),
    }
  }

  private async completeAuthFromCallback(callbackUrl: URL): Promise<void> {
    const error = callbackUrl.searchParams.get('error')?.trim()
    if (error) {
      const description = callbackUrl.searchParams.get('error_description')?.trim()
      this.clearPendingRequest()
      this.authState.lastError = description || error
      await this.broadcastStatus()
      return
    }

    const code = callbackUrl.searchParams.get('code')?.trim()
    if (!code) {
      this.clearPendingRequest()
      this.authState.lastError = 'GitHub OAuth callback is missing the authorization code.'
      await this.broadcastStatus()
      return
    }

    const expectedState = this.authState.pendingState
    const receivedState = callbackUrl.searchParams.get('state')?.trim() ?? null
    if (expectedState && receivedState !== expectedState) {
      this.clearPendingRequest()
      this.authState.lastError = 'GitHub OAuth state validation failed.'
      await this.broadcastStatus()
      return
    }

    try {
      const accessToken = await this.exchangeCodeForToken(code)
      const githubUser = await this.fetchGitHubUser(accessToken)
      const email = githubUser.email ?? (await this.fetchPrimaryEmail(accessToken))

      await UserRepository.upsertGitHubUser({
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        avatarUrl: githubUser.avatar_url,
        email,
        accessToken,
      })

      this.clearPendingRequest()
      this.authState.lastError = null
      await this.broadcastStatus()
    } catch (error) {
      logger.error('github oauth callback failed', error)
      this.clearPendingRequest()
      this.authState.lastError = toErrorMessage(error)
      await this.broadcastStatus()
    }
  }

  private getOAuthConfig(): GitHubOAuthConfig {
    return {
      clientId: devConfig.githubOAuth.clientId.trim(),
      clientSecret: devConfig.githubOAuth.clientSecret.trim(),
      callbackUrl: devConfig.githubOAuth.callbackUrl.trim(),
    }
  }

  private clearPendingRequest() {
    this.authState.pendingState = null
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const config = this.getOAuthConfig()

    const response = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.callbackUrl,
      }),
    })

    if (!response.ok) {
      throw new Error(`GitHub token request failed with status ${response.status}.`)
    }

    const tokenData = (await response.json()) as GitHubTokenResponse
    if (!tokenData.access_token) {
      throw new Error(
        tokenData.error_description || tokenData.error || 'GitHub did not return an access token.'
      )
    }

    return tokenData.access_token
  }

  private async fetchGitHubUser(accessToken: string): Promise<GitHubUserResponse> {
    const response = await fetch(USER_PROFILE_URL, {
      headers: this.createGitHubHeaders(accessToken),
    })

    if (!response.ok) {
      throw new Error(`GitHub user request failed with status ${response.status}.`)
    }

    return (await response.json()) as GitHubUserResponse
  }

  private async fetchPrimaryEmail(accessToken: string): Promise<string | null> {
    const response = await fetch(USER_EMAILS_URL, {
      headers: this.createGitHubHeaders(accessToken),
    })

    if (!response.ok) {
      logger.warn('github email request failed', response.status)
      return null
    }

    const emails = (await response.json()) as GitHubEmailResponse[]
    const primaryEmail = emails.find((item) => item.primary && item.verified)
    if (primaryEmail) return primaryEmail.email

    const fallbackEmail = emails.find((item) => item.verified) ?? emails[0]
    return fallbackEmail?.email ?? null
  }

  private createGitHubHeaders(accessToken: string) {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'vide-desktop',
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  private async broadcastStatus(): Promise<void> {
    ipcMainApi.send('github-auth-status-changed', await this.getRuntimeStatus())
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function normalizePathname(pathname: string): string {
  return pathname || '/'
}

function renderWakePage(wakeUrl: string): string {
  const escapedWakeUrl = escapeHtml(wakeUrl)
  const serializedWakeUrl = JSON.stringify(wakeUrl)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vide GitHub OAuth</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; line-height: 1.5; color: #111827;">
    <h1 style="margin: 0 0 12px; font-size: 22px;">GitHub authentication completed</h1>
    <p style="margin: 0 0 16px;">This page will return to Vide automatically.</p>
    <p style="margin: 0;">
      <a href="${escapedWakeUrl}">Open Vide</a>
    </p>
    <script>
      window.location.replace(${serializedWakeUrl})
    </script>
  </body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
