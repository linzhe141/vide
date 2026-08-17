export type ConnectorAuthQRCode = {
  qrcode: string
  imageUrl: string
}

export type ConnectorAuthStatus = {
  status: 'pending' | 'scanned' | 'expired' | 'canceled' | 'confirmed'
  token?: string
  raw?: unknown
}

export type ConnectorTextInboundMessage = {
  senderId: string
  text: string
  contextToken: string
  raw: unknown
}

export type ConnectorPullTextResult = {
  nextCursor: string
  messages: ConnectorTextInboundMessage[]
}

/**
 * Transport connector abstraction.
 *
 * This interface is transport-agnostic and intentionally does not expose
 * platform-specific payload details.
 */
export interface Connector {
  get token(): string
  set token(value: string)
  get authenticated(): boolean

  requestAuthQRCode(): Promise<ConnectorAuthQRCode>
  checkAuthStatus(qrcode: string): Promise<ConnectorAuthStatus>
  pullTextMessages(cursor: string): Promise<ConnectorPullTextResult>
  sendText(targetId: string, text: string, contextToken: string): Promise<void>
}
