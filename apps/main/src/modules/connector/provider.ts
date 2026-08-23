import fs from 'node:fs/promises'
import path from 'node:path'
import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'

import type {
  Connector,
  ConnectorAuthQRCode,
  ConnectorAuthStatus,
  ConnectorPullTextResult,
  ConnectorTextInboundMessage,
} from '.'

const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com'
const DEFAULT_CDN_BASE_URL = 'https://novac2c.cdn.weixin.qq.com/c2c'
const BOT_TYPE = 3
const CHANNEL_VERSION = '2.2.0'
const ILINK_APP_ID = 'bot'
const ILINK_APP_CLIENT_VERSION = String((2 << 16) | (2 << 8) | 0)

const UPLOAD_MEDIA_TYPE = {
  IMAGE: 1,
  VIDEO: 2,
  FILE: 3,
} as const

const MESSAGE_ITEM_TYPE = {
  TEXT: 1,
  IMAGE: 2,
  FILE: 4,
  VIDEO: 5,
} as const

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm'])

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

type WechatUploadUrlResponse = {
  ret?: number
  errcode?: number
  errmsg?: string
  upload_param?: string
  upload_full_url?: string
}

type WechatSendMessageResponse = {
  ret?: number
  errcode?: number
  errmsg?: string
  [k: string]: unknown
}

type WechatMessageItem = {
  type: number
  text_item?: { text: string }
  image_item?: {
    media: { encrypt_query_param: string; aes_key: string; encrypt_type: 1 }
    mid_size: number
  }
  file_item?: {
    media: { encrypt_query_param: string; aes_key: string; encrypt_type: 1 }
    file_name: string
    len: string
  }
  video_item?: {
    media: { encrypt_query_param: string; aes_key: string; encrypt_type: 1 }
    video_size: number
  }
}

type UploadedWeixinMedia = {
  downloadEncryptedQueryParam: string
  aesKey: string
  fileSize: number
  ciphertextSize: number
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

    await this.sendMessageItems(
      targetId,
      [{ type: MESSAGE_ITEM_TYPE.TEXT, text_item: { text } }],
      contextToken
    )
  }

  async sendFile(
    targetId: string,
    filePath: string,
    contextToken: string,
    text = ''
  ): Promise<void> {
    if (!contextToken) throw new Error('context_token is required')

    const mediaKind = detectMediaKind(filePath)
    const uploadType =
      mediaKind === 'image'
        ? UPLOAD_MEDIA_TYPE.IMAGE
        : mediaKind === 'video'
          ? UPLOAD_MEDIA_TYPE.VIDEO
          : UPLOAD_MEDIA_TYPE.FILE
    const uploaded = await this.uploadMediaToCdn(filePath, targetId, uploadType)
    const items: WechatMessageItem[] = []

    if (text.trim()) {
      items.push({ type: MESSAGE_ITEM_TYPE.TEXT, text_item: { text } })
    }
    items.push(this.buildMediaItem(filePath, mediaKind, uploaded))

    await this.sendMessageItems(targetId, items, contextToken)
  }

  private async sendMessageItems(
    targetId: string,
    items: WechatMessageItem[],
    contextToken: string
  ): Promise<void> {
    for (const item of items) {
      const payload = {
        msg: {
          from_user_id: '',
          to_user_id: targetId,
          client_id: randomUUID(),
          message_type: 2,
          message_state: 2,
          context_token: contextToken,
          item_list: [item],
        },
      }
      await this.sendMessagePayload(payload)
    }
  }

  private async sendMessagePayload(payload: unknown): Promise<void> {
    const res = await this.postJson('/ilink/bot/sendmessage', payload)
    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`sendmessage HTTP ${res.status}: ${errorText}`)
    }
    const data = (await res.json()) as WechatSendMessageResponse
    const errcode = data.errcode ?? data.ret ?? 0
    if (errcode !== 0) {
      throw new Error(`sendmessage errcode=${errcode}: ${JSON.stringify(data)}`)
    }
  }

  private async uploadMediaToCdn(
    filePath: string,
    targetId: string,
    mediaType: (typeof UPLOAD_MEDIA_TYPE)[keyof typeof UPLOAD_MEDIA_TYPE]
  ): Promise<UploadedWeixinMedia> {
    const plaintext = await fs.readFile(filePath)
    const fileSize = plaintext.length
    const ciphertextSize = getAesEcbPaddedSize(fileSize)
    const rawfilemd5 = createHash('md5').update(plaintext).digest('hex')
    const filekey = randomBytes(16).toString('hex')
    const aesKey = randomBytes(16)

    const res = await this.postJson('/ilink/bot/getuploadurl', {
      filekey,
      media_type: mediaType,
      to_user_id: targetId,
      rawsize: fileSize,
      rawfilemd5,
      filesize: ciphertextSize,
      no_need_thumb: true,
      aeskey: aesKey.toString('hex'),
    })
    if (!res.ok) {
      throw new Error(`getuploadurl HTTP ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as WechatUploadUrlResponse
    const errcode = data.errcode ?? data.ret ?? 0
    if (errcode !== 0) {
      throw new Error(`getuploadurl errcode=${errcode}: ${JSON.stringify(data)}`)
    }

    const uploadUrl = data.upload_full_url?.trim() || buildCdnUploadUrl(data.upload_param, filekey)
    if (!uploadUrl) {
      throw new Error(`getuploadurl missing upload url: ${JSON.stringify(data)}`)
    }

    const downloadEncryptedQueryParam = await uploadBufferToCdn(uploadUrl, plaintext, aesKey)
    return {
      downloadEncryptedQueryParam,
      aesKey: encodeOutboundMediaAesKey(aesKey),
      fileSize,
      ciphertextSize,
    }
  }

  private buildMediaItem(
    filePath: string,
    mediaKind: ReturnType<typeof detectMediaKind>,
    uploaded: UploadedWeixinMedia
  ): WechatMessageItem {
    const media = {
      encrypt_query_param: uploaded.downloadEncryptedQueryParam,
      aes_key: uploaded.aesKey,
      encrypt_type: 1 as const,
    }

    if (mediaKind === 'image') {
      return {
        type: MESSAGE_ITEM_TYPE.IMAGE,
        image_item: {
          media,
          mid_size: uploaded.ciphertextSize,
        },
      }
    }

    if (mediaKind === 'video') {
      return {
        type: MESSAGE_ITEM_TYPE.VIDEO,
        video_item: {
          media,
          video_size: uploaded.ciphertextSize,
        },
      }
    }

    return {
      type: MESSAGE_ITEM_TYPE.FILE,
      file_item: {
        media,
        file_name: path.basename(filePath),
        len: String(uploaded.fileSize),
      },
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

function detectMediaKind(filePath: string): 'image' | 'video' | 'file' {
  const extension = path.extname(filePath).toLowerCase()
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  return 'file'
}

function buildCdnUploadUrl(uploadParam: string | undefined, filekey: string): string | null {
  if (!uploadParam) return null
  return `${DEFAULT_CDN_BASE_URL}/upload?encrypted_query_param=${encodeURIComponent(uploadParam)}&filekey=${encodeURIComponent(filekey)}`
}

async function uploadBufferToCdn(uploadUrl: string, plaintext: Buffer, aesKey: Buffer) {
  const ciphertext = encryptAesEcb(plaintext, aesKey)
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(ciphertext),
  })
  if (res.status !== 200) {
    const errorText = res.headers.get('x-error-message') ?? (await res.text())
    throw new Error(`CDN upload failed HTTP ${res.status}: ${errorText}`)
  }

  const encryptedParam = res.headers.get('x-encrypted-param')
  if (!encryptedParam) {
    throw new Error('CDN upload response missing x-encrypted-param header')
  }

  return encryptedParam
}

function encryptAesEcb(plaintext: Buffer, key: Buffer): Buffer {
  const cipher = createCipheriv('aes-128-ecb', key, null)
  return Buffer.concat([cipher.update(plaintext), cipher.final()])
}

function encodeOutboundMediaAesKey(aesKey: Buffer): string {
  return Buffer.from(aesKey.toString('hex'), 'ascii').toString('base64')
}

function getAesEcbPaddedSize(plaintextSize: number): number {
  return Math.ceil((plaintextSize + 1) / 16) * 16
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
