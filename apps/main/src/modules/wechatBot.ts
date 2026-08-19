import type { WechatBotRuntimeStatus, WechatBotSessionRecord } from '@vide/config'
import type { WorkflowEvent } from '@vide/agent'
import type { AgentManager } from '@/modules/agentManager'
import { shell } from 'electron'
import { logger } from '@/logger'
import { settingsStore } from '@/modules/settingsStore'
import { ipcMainApi } from '@/ipc/api/ipcMain'
import type { Connector } from '@/modules/connector'
import { WeixinProvider } from '@/modules/connector/provider'

/** 微信端实时 agent 工具调用默认自动审批 */
const AUTO_APPROVE = true
/** 默认关闭思考模式 */
const THINKING_MODE = false
/** 最多保留的微信侧会话数量 */
const MAX_WECHAT_SESSIONS = 30
const MAX_TEXT_CHARS_PER_MESSAGE = 1800
const ASK_USER_QUESTION_TOOL_NAME = 'ask-user-question-generate'

/** 允许用户在微信里通过文本触发的指令（大小写不敏感、自动去空格） */
function normalizeCommand(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

const HELP_TEXT = [
  '🤖 *WeChat Agent Bot*',
  '',
  '可用指令：',
  '  - `recently sessions` / `/sessions`   查看最近的会话列表',
  '  - `new session` / `/new`             新建一个会话并切到该会话',
  '  - `switch <id>` / `/switch:<id>`    切换到指定会话',
  '  - `help`                             显示本帮助',
  '',
  '直接发送其它文本，将把内容发送给当前 agent 会话。',
].join('\n')

type WechatCommand = { kind: 'reply'; text: string } | { kind: 'agent' }

export class WechatBot {
  /** 微信用到的 agent 会话元数据（Session 本体在 AgentManager。keyed by sessionId） */
  private recordMap = new Map<string, WechatBotSessionRecord>()
  private activeSessionId: string | null = null

  // --- 登录态 ---
  private qrcode = ''

  // --- 长轮询 ---
  private getUpdatesBuf = ''
  private polling = false
  private stopPolling = false
  private pollPromise: Promise<void> | null = null

  // --- 运行时状态 ---
  private lastError: string | null = null
  private lastMessageAt: number | null = null
  private messageCount = 0
  private ipcRegistered = false

  private readonly onChanged: () => void
  private readonly connector: Connector

  constructor(
    private readonly agentManager: AgentManager,
    onChanged?: () => void,
    connector?: Connector
  ) {
    this.onChanged = onChanged ?? (() => {})

    const saved = settingsStore.get('wechatBotConfig')
    this.activeSessionId = saved?.activeSessionId ?? null
    this.connector = connector ?? new WeixinProvider({ token: saved?.botToken ?? '' })

    // App 启动时如果已有 token，默认尝试自动启动微信 Bot。
    if (this.connector.authenticated) {
      this.tryAutoStartOnBoot()
    }
  }

  registerIpcMainHandle(): void {
    if (this.ipcRegistered) return
    this.ipcRegistered = true

    ipcMainApi.handle('wechat-get-qrcode', async () => {
      return this.getQRCode()
    })

    ipcMainApi.handle('wechat-start-bot', () => {
      try {
        this.start()
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: String((err as Error)?.message ?? err) }
      }
    })

    ipcMainApi.handle('wechat-stop-bot', async () => {
      await this.stop()
    })

    ipcMainApi.handle('wechat-logout', async () => {
      await this.logout()
    })

    ipcMainApi.handle('wechat-get-runtime-status', () => {
      return this.getRuntimeStatus()
    })
  }

  async getQRCode(): Promise<{ ok: true }> {
    const data = await this.connector.requestAuthQRCode()
    this.qrcode = data.qrcode
    await shell.openExternal(data.imageUrl)
    logger.info('opened wechat qrcode in default browser:', data.imageUrl)

    void this.waitForScan()
    return { ok: true }
  }

  start(): void {
    if (!this.connector.authenticated) {
      throw new Error('尚未登录微信 Bot，请先扫码并确认后再启动')
    }
    if (this.polling) return
    this.polling = true
    this.stopPolling = false
    this.getUpdatesBuf = ''
    this.pollPromise = this.pollLoop().catch((err) => {
      this.lastError = String(err)
      logger.error('wechat long-poll loop stopped:', err)
    })
    logger.info('wechat bot started')
  }

  async stop(): Promise<void> {
    this.polling = false
    this.stopPolling = true
    if (this.pollPromise) {
      await Promise.race([this.pollPromise, new Promise((r) => setTimeout(r, 2000))])
    }
    this.getUpdatesBuf = ''
    logger.info('wechat bot stopped')
  }

  async logout(): Promise<void> {
    await this.stop()
    this.connector.token = ''
    this.persistConfig({ botToken: '', activeSessionId: null })
    this.qrcode = ''
    this.recordMap.clear()
    this.activeSessionId = null
    this.lastError = null
    this.messageCount = 0
    this.lastMessageAt = null
    this.notifyChanged()
    logger.info('wechat bot logged out')
  }

  getRuntimeStatus(): WechatBotRuntimeStatus {
    return {
      connected: this.polling,
      authenticated: this.connector.authenticated,
      activeSessionId: this.activeSessionId,
      lastError: this.lastError,
      lastMessageAt: this.lastMessageAt,
      messageCount: this.messageCount,
    }
  }

  getRecentSessions(limit = 20): WechatBotSessionRecord[] {
    return [...this.recordMap.values()].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, limit)
  }

  private async waitForScan(): Promise<void> {
    if (!this.qrcode) return
    try {
      const status = await this.connector.checkAuthStatus(this.qrcode)
      if (status.status === 'confirmed') {
        this.connector.token = status.token ?? this.connector.token
        this.persistConfig({
          botToken: this.connector.token,
          activeSessionId: this.activeSessionId,
        })
        logger.info('wechat scan confirmed, starting bot')
        this.start()
        ipcMainApi.send('weixin-bot-auth-success')
        this.notifyChanged()
      } else {
        this.qrcode = ''
        logger.info('wechat scan status:', status.status)
        this.notifyChanged()
      }
    } catch (err) {
      this.lastError = String(err)
      logger.warn('wechat waitForScan error:', this.lastError)
      this.notifyChanged()
    }
  }

  private async pollLoop(): Promise<void> {
    while (this.polling && !this.stopPolling) {
      try {
        const data = await this.connector.pullTextMessages(this.getUpdatesBuf)
        this.getUpdatesBuf = data.nextCursor
        for (const msg of data.messages) {
          await this.handleInbound(msg.senderId, msg.text, msg.contextToken)
        }
      } catch (err) {
        this.lastError = String(err)
        // logger.warn('wechat getupdates error:', this.lastError)
        if (this.stopPolling) break
        await sleep(1000)
      }
    }
  }

  private async handleInbound(senderId: string, text: string, contextToken: string): Promise<void> {
    this.lastMessageAt = Date.now()
    this.messageCount++

    logger.info('wechat received message', {
      from: senderId,
      textLength: text.length,
      hasContextToken: !!contextToken,
    })

    const cmd = await this.handleCommand(text)
    if (cmd.kind === 'reply') {
      try {
        await this.sendText(senderId, cmd.text, contextToken)
      } catch (err) {
        logger.error('wechat sendText error (command reply):', err)
      }
      return
    }

    try {
      await this.sendText(senderId, '🧠 思考中…', contextToken)
    } catch (err) {
      logger.error('wechat sendText thinking error:', err)
    }

    const finalText = await this.runAgent(senderId, contextToken, text)
    if (finalText) {
      try {
        await this.sendText(senderId, finalText, contextToken)
      } catch (err) {
        logger.error('wechat sendText agent result error:', err)
      }
    }
  }

  private async handleCommand(text: string): Promise<WechatCommand> {
    const cmd = normalizeCommand(text)

    if (cmd === 'help' || cmd === '/help' || cmd === '帮助') {
      return { kind: 'reply', text: HELP_TEXT }
    }

    if (cmd === 'recently sessions' || cmd === '/sessions' || cmd === 'recently') {
      return { kind: 'reply', text: this.buildRecentSessionsText() }
    }

    if (cmd === 'new session' || cmd === '/new' || cmd === '新建会话') {
      const sessionId = await this.createAgentSession()
      this.activeSessionId = sessionId
      this.notifyChanged()
      return {
        kind: 'reply',
        text: [
          `✅ 已新建并切换到会话：\`${sessionId}\``,
          '请开始发送消息，或输入 `recently sessions` 查看全部会话。',
        ].join('\n'),
      }
    }

    const switchMatch = cmd.match(/^(?:switch|切换)\s*[：:]?\s*([a-zA-Z0-9_-]+)$/)
    if (switchMatch) {
      const targetName = switchMatch[1]
      const found = [...this.recordMap.values()].find((r) => r.sessionId.startsWith(targetName))
      if (!found) {
        return {
          kind: 'reply',
          text: `⚠️ 未找到匹配的会话：\`${targetName}\`\n请输入 \`recently sessions\` 查看可用会话。`,
        }
      }
      this.activeSessionId = found.sessionId
      found.lastUsedAt = Date.now()
      this.persistConfig({ botToken: this.connector.token, activeSessionId: found.sessionId })
      this.notifyChanged()
      return { kind: 'reply', text: `✅ 已切换到会话：\`${found.sessionId}\`` }
    }

    return { kind: 'agent' }
  }

  private buildRecentSessionsText(): string {
    const records = this.getRecentSessions(20)
    if (!records.length) {
      return '还没有任何会话，发送 `new session` 新建一个。'
    }
    const lines = [`📋 *最近会话（${records.length}）*`, '']
    records.forEach((r, i) => {
      const active = r.sessionId === this.activeSessionId ? ' ◀ 当前' : ''
      const short = r.sessionId.slice(0, 8)
      lines.push(`${i + 1}. \`${short}\`${active}  最近使用 ${formatRelative(r.lastUsedAt)}`)
    })
    lines.push('', '发送 `switch <id>` 切换到对应会话，发送 `new session` 新建会话。')
    return lines.join('\n')
  }

  private async createAgentSession(): Promise<string> {
    if (this.recordMap.size >= MAX_WECHAT_SESSIONS) {
      const oldest = [...this.recordMap.values()].sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0]
      if (oldest) this.recordMap.delete(oldest.sessionId)
    }

    const llm = settingsStore.get('llmConfig')
    if (!llm.model || !llm.baseUrl || !llm.apiKey) {
      throw new Error(
        '尚未配置 LLM（API Key / Base URL / Model）。请在应用的"LLM 设置"里配置后再使用。'
      )
    }

    const sessionId = await this.agentManager.createSession({
      workspacePath: null,
      autoApprove: AUTO_APPROVE,
      thinkingMode: THINKING_MODE,
      sessionSource: 'wechat-bot',
    })
    this.recordMap.set(sessionId, {
      sessionId,
      label: 'session',
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    })
    this.persistConfig({ botToken: this.connector.token, activeSessionId: sessionId })
    return sessionId
  }

  private async getOrCreateActiveSessionId(): Promise<string> {
    if (this.activeSessionId && this.agentManager.hasSession(this.activeSessionId)) {
      const rec = this.recordMap.get(this.activeSessionId)
      if (!rec) {
        this.recordMap.set(this.activeSessionId, {
          sessionId: this.activeSessionId,
          label: 'session',
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
        })
      } else {
        rec.lastUsedAt = Date.now()
      }
      return this.activeSessionId
    }
    const sessionId = await this.createAgentSession()
    this.activeSessionId = sessionId
    this.notifyChanged()
    return sessionId
  }

  private async runAgent(senderId: string, contextToken: string, input: string): Promise<string> {
    const sessionId = await this.getOrCreateActiveSessionId()
    let askQuestionSent = false
    try {
      const finalText = await this.agentManager.backgroundPrompt(
        sessionId,
        input,
        async (event) => {
          const questionText = buildWechatAskQuestionText(event)
          if (!questionText) return
          askQuestionSent = true
          try {
            await this.sendText(senderId, questionText, contextToken)
          } catch (err) {
            logger.error('wechat sendText ask-question error:', err)
          }
        },
        'wechat-bot'
      )
      if (!finalText) {
        if (askQuestionSent) return ''
        return '🤖 agent 没有返回文本内容。'
      }
      return finalText
    } catch (err) {
      logger.error('wechat runAgent error', err)
      return `⚠️ 调用 agent 失败：${String(err)}`
    }
  }

  private async sendText(toUserId: string, text: string, contextToken: string): Promise<void> {
    const chunks = splitTextByLength(text, MAX_TEXT_CHARS_PER_MESSAGE)
    logger.info('wechat sendText', {
      toUserId,
      textLength: text.length,
      chunks: chunks.length,
      hasContextToken: !!contextToken,
    })
    for (const chunk of chunks) {
      await this.connector.sendText(toUserId, chunk, contextToken)
    }
    logger.info('wechat sendText success')
  }

  private persistConfig(value: { botToken: string; activeSessionId: string | null }): void {
    settingsStore.set('wechatBotConfig', value)
  }

  private notifyChanged(): void {
    this.onChanged()
  }

  private tryAutoStartOnBoot(): void {
    try {
      this.start()
      logger.info('wechat bot auto-started from persisted token')
    } catch (err) {
      this.lastError = String(err)
      logger.warn('wechat auto-start failed:', err)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60) return '刚刚'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

function splitTextByLength(text: string, maxLength: number): string[] {
  const value = text.trim()
  if (!value) return ['']
  if (value.length <= maxLength) return [value]

  const out: string[] = []
  for (let i = 0; i < value.length; i += maxLength) {
    out.push(value.slice(i, i + maxLength))
  }
  return out
}

function buildWechatAskQuestionText(event: WorkflowEvent): string | null {
  if (event.type !== 'workflow.llm.tool.call.end') return null

  const blocks = event.toolCall
    .filter((toolCall) => toolCall.function.name === ASK_USER_QUESTION_TOOL_NAME)
    .map((toolCall) => {
      const questions = sanitizeWechatQuestions(
        parseToolArguments(toolCall.function.arguments)?.questions
      )
      if (!questions.length) return null

      return questions
        .map((question, index) => {
          const description = question.description ? `\n${question.description}` : ''
          const options = question.options.map((option) => `  - ${option.label}`).join('\n')
          return `${index + 1}. ${question.title}${description}\n${options}`
        })
        .join('\n\n')
    })
    .filter((block): block is string => block !== null)

  if (!blocks.length) return null

  return ['📝 Agent 需要你补充信息：', '', ...blocks, '', '请直接回复你的答案。'].join('\n')
}

function parseToolArguments(raw: string): { questions?: unknown } | null {
  try {
    return JSON.parse(raw) as { questions?: unknown }
  } catch {
    return null
  }
}

function sanitizeWechatQuestions(questions: unknown): {
  title: string
  description?: string
  options: { label: string; value: string }[]
}[] {
  if (!Array.isArray(questions)) return []

  return questions
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const question = item as {
        title?: unknown
        description?: unknown
        options?: unknown
      }
      const title = typeof question.title === 'string' ? question.title.trim() : ''
      const description =
        typeof question.description === 'string' && question.description.trim()
          ? question.description.trim()
          : undefined
      const options = Array.isArray(question.options)
        ? question.options
            .map((option) => {
              if (!option || typeof option !== 'object') return null
              const label =
                typeof (option as { label?: unknown }).label === 'string'
                  ? (option as { label: string }).label.trim()
                  : ''
              const value =
                typeof (option as { value?: unknown }).value === 'string'
                  ? (option as { value: string }).value.trim()
                  : ''
              if (!label || !value) return null
              return { label, value }
            })
            .filter((option): option is { label: string; value: string } => option !== null)
        : []

      if (!title || !options.length) return null
      return {
        title,
        ...(description ? { description } : {}),
        options,
      }
    })
    .filter(
      (
        question
      ): question is {
        title: string
        description?: string
        options: { label: string; value: string }[]
      } => question !== null
    )
}
