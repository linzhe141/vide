import type { ChatMessage } from './types'

export interface WorkflowThreadContext {
  messages: ChatMessage[]
}

export class WorkflowThread {
  constructor(public ctx: WorkflowThreadContext) {}

  addMessage(message: ChatMessage) {
    this.ctx.messages.push(message)
  }

  getMessages() {
    return this.ctx.messages
  }
}
