import type { ChatMessage } from './types'

export interface ThreadContext {
  messages: ChatMessage[]
}

export class Thread {
  constructor(public ctx: ThreadContext) {}

  addMessage(message: ChatMessage) {
    this.ctx.messages.push(message)
  }

  getMessages() {
    return this.ctx.messages
  }
}
