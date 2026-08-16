import type {
  WechatBotConfig,
  WechatBotRuntimeStatus,
  WechatBotSessionRecord,
  WechatQRCodeStatus,
} from '@vide/config'
import type { AgentManager } from '@/modules/agentManager'
import { shell } from 'electron'
import { logger } from '@/logger'
import { settingsStore } from '@/modules/settingsStore'

/**
 * 微信 ClawBot / iLink Bot 客户端。
 *
 * 微信只是 agent 的**额外入口**：驱动的是 AgentManager 里的同一套 Session，
 * 运行事件由 AgentManager.prompt 统一广播到 renderer，因此桌面 UI 与微信会话
 * 保持同步更新。本模块只负责微信登录、长轮询收发、以及把消息路由到 agent。
 *
 * 不依赖任何第三方 npm 包，全部使用 Node 原生 fetch 调用微信官方 HTTP API：
 *   https://ilinkai.weixin.qq.com/ilink/bot/*
 *
 * 协议要点（参考 weixin-bot-api.md）：
 *  - GET  get_bot_qrcode?bot_type=3          获取登录二维码
 *  - GET  get_qrcode_status?qrcode=xxx       长轮询扫码状态
 *  - POST getupdates                         长轮询收消息（最多 hold 35s）
 *  - POST sendmessage                        发送消息（回复时必须带 context_token）
 *  - POST sendtyping / getconfig             发送"正在输入"等状态
 *
 * 请求头套路：
 *  {
 *    "Content-Type": "application/json",
 *    "AuthorizationType": "ilink_bot_token",
 *    "X-WECHAT-UIN": base64(String(randomUint32())),   // 每次随机，防重放
 *    "Authorization": `Bearer ${bot_token}`
 *  }
 */

export type WechatQRCodeData = {
  qrcode: string
  qrcode_img_content?: string
  url?: string
  expired_at?: number
}

export type WechatInboundMessageItem =
  | { type: 1; text_item?: { text?: string } }
  | { type: number; [k: string]: unknown }

export type WechatInboundMessage = {
  from_user_id: string
  to_user_id: string
  message_type?: number
  message_state?: number
  context_token?: string
  item_list?: WechatInboundMessageItem[]
  timestamp?: number
  [k: string]: unknown
}

const BASE_URL = 'https://ilinkai.weixin.qq.com'
/** 登录二维码场景类型（文档/源码硬编码 bot_type=3） */
const BOT_TYPE = 3
/** 微信端实时 agent 工具调用默认自动审批 */
const AUTO_APPROVE = true
/** 默认关闭思考模式 */
const THINKING_MODE = false
/** 最多保留的微信侧会话数量 */
const MAX_WECHAT_SESSIONS = 30

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

/** 识别到的微信指令 */
type WechatCommand = { kind: 'reply'; text: string } | { kind: 'agent' }

export class WechatBot {
  /** 微信用到的 agent 会话元数据（Session 本体在 AgentManager。keyed by sessionId） */
  private recordMap = new Map<string, WechatBotSessionRecord>()
  private activeSessionId: string | null = null

  // --- 登录态 ---
  private botToken = ''
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

  private readonly onChanged: () => void

  constructor(
    private readonly agentManager: AgentManager,
    onChanged?: () => void
  ) {
    this.onChanged = onChanged ?? (() => {})
    // 恢复上次登录态与激活会话
    const saved = settingsStore.get('wechatBotConfig')
    if (saved?.botToken) this.botToken = saved.botToken
    if (saved?.activeSessionId) this.activeSessionId = saved.activeSessionId
  }

  // ============================================================
  // 公开 API
  // ============================================================

  /**
   * 登录：获取二维码，并用用户的默认浏览器打开。
   *  - get_bot_qrcode 返回 qrcode 与 qrcode_img_content（后者是二维码链接）
   *  - 用 shell.openExternal 在默认浏览器打开该链接，用户扫码
   * 之后由后端发起一次 get_qrcode_status 长轮询等待扫码，确认后自动启动，
   * 并通过 onChanged 推送"认证成功"到前端（全程 IPC，前端无轮询）。
   */
  async getQRCode(): Promise<{ ok: true }> {
    const res = await fetch(
      `${BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`,
      this.buildHeaders()
    )
    if (!res.ok) {
      throw new Error(`get_bot_qrcode HTTP ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as WechatQRCodeData
    logger.info('get_bot_qrcode response:', data)

    if (!data.qrcode) {
      throw new Error(`get_bot_qrcode 未返回 qrcode: ${JSON.stringify(data)}`)
    }
    this.qrcode = data.qrcode

    // qrcode_img_content 是二维码（链接），用默认浏览器打开
    if (!data.qrcode_img_content) {
      throw new Error(`get_bot_qrcode 未返回 qrcode_img_content 二维码：${JSON.stringify(data)}`)
    }
    const qrUrl = /^https?:\/\//i.test(data.qrcode_img_content)
      ? data.qrcode_img_content
      : `${BASE_URL}${data.qrcode_img_content}`
    await shell.openExternal(qrUrl)
    logger.info('opened wechat qrcode in default browser:', qrUrl)

    // 后端等待用户扫码确认（单个长轮询请求，非轮询）
    void this.waitForScan()
    return { ok: true }
  }

  /**
   * 后端单次等待扫码确认。成功后保存 token、自动启动 Bot，并通知前端。
   * 该请求由 iLink 服务端 hold 住，直到用户扫码确认 / 过期。
   */
  private async waitForScan(): Promise<void> {
    if (!this.qrcode) return
    try {
      const res = await fetch(
        `${BASE_URL}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(this.qrcode)}`,
        this.buildHeaders()
      )
      const data = (await res.json()) as WechatQRCodeStatus
      if (data.status === 'confirmed') {
        this.botToken = data.bot_token ?? this.botToken
        settingsStore.set('wechatBotConfig', {
          botToken: this.botToken,
          activeSessionId: this.lastPersistedActiveSessionId(),
        })
        logger.info('wechat scan confirmed, starting bot')
        this.start()
        this.notifyChanged()
      } else {
        // 过期/取消：清空 qrcode，前端可重新获取
        this.qrcode = ''
        logger.info('wechat scan status:', data.status)
        this.notifyChanged()
      }
    } catch (err) {
      this.lastError = String(err)
      logger.warn('wechat waitForScan error:', this.lastError)
      this.notifyChanged()
    }
  }

  /** 启动长轮询监听。要求已经登录（有 botToken）。 */
  start(): void {
    if (!this.botToken) {
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
    logger.info('wechat bot started', BASE_URL)
  }

  /** 停止长轮询监听。 */
  async stop(): Promise<void> {
    this.polling = false
    this.stopPolling = true
    if (this.pollPromise) {
      // wait 最多 2s 让进行中的请求退出
      await Promise.race([this.pollPromise, new Promise((r) => setTimeout(r, 2000))])
    }
    this.getUpdatesBuf = ''
    logger.info('wechat bot stopped')
  }

  /** 登出：清空 token、会话与运行状态。 */
  async logout(): Promise<void> {
    await this.stop()
    this.botToken = ''
    this.qrcode = ''
    this.recordMap.clear()
    this.activeSessionId = null
    this.lastError = null
    this.messageCount = 0
    this.lastMessageAt = null
    this.notifyChanged()
    logger.info('wechat bot logged out')
  }

  /** 同步获取运行时状态（供 IPC/前端展示）。 */
  getRuntimeStatus(): WechatBotRuntimeStatus {
    return {
      connected: this.polling,
      authenticated: !!this.botToken,
      activeSessionId: this.activeSessionId,
      lastError: this.lastError,
      lastMessageAt: this.lastMessageAt,
      messageCount: this.messageCount,
    }
  }

  /** 获取最近会话列表（ranked by lastUsedAt desc）。 */
  getRecentSessions(limit = 20): WechatBotSessionRecord[] {
    return [...this.recordMap.values()].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, limit)
  }

  getSessionCount() {
    return this.recordMap.size
  }

  // ============================================================
  // 内部：消息处理
  // ============================================================

  private async pollLoop(): Promise<void> {
    while (this.polling && !this.stopPolling) {
      try {
        const body = {
          get_updates_buf: this.getUpdatesBuf,
          base_info: { channel_version: '1.0.2' },
        }
        const res = await this.postJson('/ilink/bot/getupdates', body)
        if (!res.ok) {
          throw new Error(`getupdates HTTP ${res.status}: ${await res.text()}`)
        }
        const data = (await res.json()) as {
          ret?: number
          msgs?: WechatInboundMessage[]
          get_updates_buf?: string
        }
        if (data.ret !== undefined && data.ret !== 0) {
          throw new Error(`getupdates ret=${data.ret}: ${JSON.stringify(data)}`)
        }
        this.getUpdatesBuf =
          typeof data.get_updates_buf === 'string' ? data.get_updates_buf : this.getUpdatesBuf
        for (const msg of data.msgs ?? []) {
          await this.handleInbound(msg)
        }
      } catch (err) {
        this.lastError = String(err)
        logger.warn('wechat getupdates error:', this.lastError)
        if (this.stopPolling) break
        // 出错后稍等再重试
        await sleep(1000)
      }
    }
  }

  private async handleInbound(msg: WechatInboundMessage): Promise<void> {
    // 只处理用户消息 (message_type === 1)
    if (msg.message_type !== 1) {
      logger.debug('ignoring non-user message, type:', msg.message_type)
      return
    }

    // 提取文本内容
    let text: string | undefined
    for (const item of msg.item_list ?? []) {
      const candidate = item as { type?: number; text_item?: { text?: string } }
      if (candidate.type === 1 && typeof candidate.text_item?.text === 'string') {
        text = candidate.text_item.text
        break
      }
    }
    const from = msg.from_user_id
    const contextToken = msg.context_token
    this.lastMessageAt = Date.now()
    this.messageCount++

    if (!text || !from || !contextToken) {
      logger.warn('handleInbound: missing required fields', {
        text: !!text,
        from: !!from,
        contextToken: !!contextToken,
      })
      return
    }

    logger.info('wechat received message', {
      from,
      textLength: text.length,
      hasContextToken: !!contextToken,
    })

    // 先判断是不是本地指令
    const cmd = this.handleCommand(text)
    if (cmd.kind === 'reply') {
      try {
        await this.sendText(from, cmd.text, contextToken)
      } catch (err) {
        logger.error('wechat sendText error (command reply):', err)
      }
      return
    }

    // agent 路径：先立刻回"思考中"，再跑 agent，结束后一次性回完整正文
    try {
      await this.sendText(from, '🧠 思考中…', contextToken)
    } catch (err) {
      logger.error('wechat sendText thinking error:', err)
    }

    const finalText = await this.runAgent(text)
    if (finalText) {
      try {
        await this.sendText(from, finalText, contextToken)
      } catch (err) {
        logger.error('wechat sendText agent result error:', err)
      }
    }
  }

  /**
   * 处理本地指令。返回 { kind: 'reply', text } 表示直接回复文本；
   * 返回 { kind: 'agent' } 表示需要交给 agent 处理。
   */
  private handleCommand(text: string): WechatCommand {
    const cmd = normalizeCommand(text)

    if (cmd === 'help' || cmd === '/help' || cmd === '帮助') {
      return { kind: 'reply', text: HELP_TEXT }
    }

    if (cmd === 'recently sessions' || cmd === '/sessions' || cmd === 'recently') {
      return { kind: 'reply', text: this.buildRecentSessionsText() }
    }

    if (cmd === 'new session' || cmd === '/new' || cmd === '新建会话') {
      const sessionId = this.createAgentSession()
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
      settingsStore.set('wechatBotConfig', {
        botToken: this.botToken,
        activeSessionId: found.sessionId,
      })
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

  // ============================================================
  // 内部：agent 交互（复用 AgentManager 的同一套 session）
  // ============================================================

  /** 创建微信侧会话（Session 注册到 AgentManager，UI 可见）。返回 session id。 */
  private createAgentSession(): string {
    // 清理超过上限的微信侧会话记录
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

    const sessionId = this.agentManager.createSession({
      workspacePath: null,
      autoApprove: AUTO_APPROVE,
      thinkingMode: THINKING_MODE,
    })
    this.recordMap.set(sessionId, {
      sessionId,
      label: 'session',
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    })
    settingsStore.set('wechatBotConfig', { botToken: this.botToken, activeSessionId: sessionId })
    return sessionId
  }

  /** 取当前激活的微信会话，不存在则创建。 */
  private getOrCreateActiveSessionId(): string {
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
    const sessionId = this.createAgentSession()
    this.activeSessionId = sessionId
    this.notifyChanged()
    return sessionId
  }

  /**
   * 把文本交给当前激活的 agent 会话。返回 agent 最终文本（用于回发微信）。
   * 运行事件由 AgentManager.prompt 统一广播到 renderer，桌面 UI 同步更新。
   */
  private async runAgent(input: string): Promise<string> {
    const sessionId = this.getOrCreateActiveSessionId()
    try {
      const finalText = await this.agentManager.prompt(sessionId, input)
      if (!finalText) {
        return '🤖 agent 没有返回文本内容。'
      }
      return finalText
    } catch (err) {
      logger.error('wechat runAgent error', err)
      return `⚠️ 调用 agent 失败：${String(err)}`
    }
  }

  // ============================================================
  // 微信 HTTP 收发
  // ============================================================

  private async sendText(toUserId: string, text: string, contextToken?: string): Promise<void> {
    if (!contextToken) {
      throw new Error('context_token 是必填字段，不能为空')
    }

    const payload = {
      msg: {
        to_user_id: toUserId,
        message_type: 2,
        message_state: 2,
        context_token: contextToken,
        item_list: [{ type: 1, text_item: { text } }],
      },
    }

    logger.info('wechat sendText', {
      toUserId,
      textLength: text.length,
      hasContextToken: !!contextToken,
    })

    const res = await this.postJson('/ilink/bot/sendmessage', payload)
    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`sendmessage HTTP ${res.status}: ${errorText}`)
    }
    const data = (await res.json()) as { ret?: number; [k: string]: unknown }
    if (data.ret !== undefined && data.ret !== 0) {
      throw new Error(`sendmessage ret=${data.ret}: ${JSON.stringify(data)}`)
    }
    logger.info('wechat sendText success')
  }

  // ============================================================
  // 辅助
  // ============================================================

  private loadConfig(): WechatBotConfig {
    const cfg = settingsStore.get('wechatBotConfig')
    if (!cfg) {
      return { botToken: '', activeSessionId: null }
    }
    return cfg
  }

  /** 当前持久化配置中的 activeSessionId（用于认证成功时保留会话字段） */
  private lastPersistedActiveSessionId(): string | null {
    return this.loadConfig().activeSessionId
  }

  private resolveUrl(path: string): string {
    return `${BASE_URL}${path}`
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      AuthorizationType: 'ilink_bot_token',
      'X-WECHAT-UIN': randomUin(),
    }
    if (this.botToken) headers.Authorization = `Bearer ${this.botToken}`
    return headers
  }

  private async postJson(path: string, body: unknown): Promise<Response> {
    return fetch(this.resolveUrl(path), {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    })
  }

  private notifyChanged() {
    this.onChanged()
  }
}

// ============================================================
// 工具函数
// ============================================================

/** 每次请求都变化的随机 UIN（防重放），base64(String(randomUint32)) */
function randomUin(): string {
  const uint32 = Math.floor(Math.random() * 0xffffffff)
  return base64Encode(String(uint32))
}

/** Node 18+ / Electron main 环境下可用的 base64 编码函数 */
function base64Encode(value: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'utf-8').toString('base64')
  if (typeof btoa === 'function') return btoa(value)
  // 兜底实现
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
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
