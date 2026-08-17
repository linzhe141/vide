import { randomUUID } from 'node:crypto'

import type {
  Connector,
  ConnectorAuthQRCode,
  ConnectorAuthStatus,
  ConnectorPullTextResult,
  ConnectorTextInboundMessage,
} from '.'

const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com'
const BOT_TYPE = 3
const CHANNEL_VERSION = '2.2.0'
const ILINK_APP_ID = 'bot'
const ILINK_APP_CLIENT_VERSION = String((2 << 16) | (2 << 8) | 0)

type WechatQRCodeData = {
  qrcode: string
  qrcode_img_content?: string
  url?: string
  expired_at?: number
}

type WechatQRCodeStatus = {
  status?: string
  bot_token?: string
  [k: string]: unknown
}

type WechatInboundMessageItem =
  | { type: 1; text_item?: { text?: string } }
  | { type: number; [k: string]: unknown }

type WechatInboundMessage = {
  from_user_id?: string
  message_type?: number
  context_token?: string
  item_list?: WechatInboundMessageItem[]
  [k: string]: unknown
}

type WechatGetUpdatesResponse = {
  ret?: number
  errcode?: number
  errmsg?: string
  msgs?: WechatInboundMessage[]
  get_updates_buf?: string
}

type WeixinProviderOptions = {
  baseUrl?: string
  token?: string
}

/**
 * Weixin iLink protocol provider.
 *
 * This class is the Weixin-specific implementation of the generic Connector.
 */
export class WeixinProvider implements Connector {
  #baseUrl: string
  #token: string

  constructor(options: WeixinProviderOptions = {}) {
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
    this.#token = options.token ?? ''
  }

  get token(): string {
    return this.#token
  }

  set token(value: string) {
    this.#token = value
  }

  get authenticated(): boolean {
    return !!this.#token
  }

  async requestAuthQRCode(): Promise<ConnectorAuthQRCode> {
    const res = await fetch(this.resolveUrl(`/ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`), {
      method: 'GET',
      headers: this.buildHeaders(),
    })
    if (!res.ok) {
      throw new Error(`get_bot_qrcode HTTP ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as WechatQRCodeData
    if (!data.qrcode) {
      throw new Error(`get_bot_qrcode missing qrcode: ${JSON.stringify(data)}`)
    }
    if (!data.qrcode_img_content) {
      throw new Error(`get_bot_qrcode missing qrcode_img_content: ${JSON.stringify(data)}`)
    }

    const imageUrl = data.qrcode_img_content
    return { qrcode: data.qrcode, imageUrl }
  }

  async checkAuthStatus(qrcode: string): Promise<ConnectorAuthStatus> {
    const res = await fetch(
      this.resolveUrl(`/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`),
      { method: 'GET', headers: this.buildHeaders() }
    )
    if (!res.ok) {
      throw new Error(`get_qrcode_status HTTP ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as WechatQRCodeStatus
    const status = normalizeAuthStatus(data.status)
    return {
      status,
      token: status === 'confirmed' ? data.bot_token : undefined,
      raw: data,
    }
  }

  async pullTextMessages(cursor: string): Promise<ConnectorPullTextResult> {
    const payload = { get_updates_buf: cursor }
    const res = await this.postJson('/ilink/bot/getupdates', payload)
    if (!res.ok) {
      throw new Error(`getupdates HTTP ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as WechatGetUpdatesResponse
    const errcode = data.errcode ?? data.ret ?? 0
    if (errcode !== 0) {
      throw new Error(`getupdates errcode=${errcode}: ${JSON.stringify(data)}`)
    }

    const nextCursor = typeof data.get_updates_buf === 'string' ? data.get_updates_buf : cursor
    const messages = normalizeInboundMessages(data.msgs ?? [])
    return { nextCursor, messages }
  }

  async sendText(targetId: string, text: string, contextToken: string): Promise<void> {
    if (!contextToken) throw new Error('context_token is required')

    const payload = {
      msg: {
        from_user_id: '',
        to_user_id: targetId,
        client_id: randomUUID(),
        message_type: 2,
        message_state: 2,
        context_token: contextToken,
        item_list: [{ type: 1, text_item: { text } }],
      },
    }
    const res = await this.postJson('/ilink/bot/sendmessage', payload)
    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`sendmessage HTTP ${res.status}: ${errorText}`)
    }
    const data = (await res.json()) as { ret?: number; errcode?: number; [k: string]: unknown }
    const errcode = data.errcode ?? data.ret ?? 0
    if (errcode !== 0) {
      throw new Error(`sendmessage errcode=${errcode}: ${JSON.stringify(data)}`)
    }
  }

  private resolveUrl(path: string): string {
    return `${this.#baseUrl}${path}`
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      AuthorizationType: 'ilink_bot_token',
      'X-WECHAT-UIN': randomUin(),
      'iLink-App-Id': ILINK_APP_ID,
      'iLink-App-ClientVersion': ILINK_APP_CLIENT_VERSION,
    }
    if (this.#token) headers.Authorization = `Bearer ${this.#token}`
    return headers
  }

  private postJson(path: string, body: unknown): Promise<Response> {
    const payload = {
      ...(body as Record<string, unknown>),
      base_info: { channel_version: CHANNEL_VERSION },
    }
    return fetch(this.resolveUrl(path), {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    })
  }
}

function normalizeAuthStatus(value: unknown): ConnectorAuthStatus['status'] {
  if (value === 'confirmed') return 'confirmed'
  if (value === 'scanned') return 'scanned'
  if (value === 'expired') return 'expired'
  if (value === 'canceled') return 'canceled'
  return 'pending'
}

function normalizeInboundMessages(messages: WechatInboundMessage[]): ConnectorTextInboundMessage[] {
  const out: ConnectorTextInboundMessage[] = []
  for (const msg of messages) {
    if (msg.message_type !== 1) continue
    const senderId = String(msg.from_user_id ?? '').trim()
    const contextToken = String(msg.context_token ?? '').trim()
    const text = extractText(msg.item_list ?? [])
    if (!senderId || !contextToken || !text) continue
    out.push({ senderId, contextToken, text, raw: msg })
  }
  return out
}

function extractText(items: WechatInboundMessageItem[]): string {
  for (const item of items) {
    const candidate = item as { type?: number; text_item?: { text?: string } }
    if (candidate.type === 1 && typeof candidate.text_item?.text === 'string') {
      const text = candidate.text_item.text.trim()
      if (text) return text
    }
  }
  return ''
}

function randomUin(): string {
  const uint32 = Math.floor(Math.random() * 0xffffffff)
  return Buffer.from(String(uint32), 'utf-8').toString('base64')
}
