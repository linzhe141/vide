import type { ChatMessage } from '../types'

export interface ThreadContext {
  systemPrompt: string
  messages: ChatMessage[]
}

export interface ThreadsContext {
  threads: {
    id: string
    thread: Thread
  }[]
}

export class ThreadsManager {
  constructor(public ctx: ThreadsContext) {}

  createNewThread() {
    const newThreadCtx: ThreadContext = {
      systemPrompt: '',
      messages: [],
    }
    const threadId = String('_thread_' + crypto.randomUUID())
    const newThread = new Thread(newThreadCtx, threadId)
    this.ctx.threads.push({
      id: threadId,
      thread: newThread,
    })

    return newThread
  }

  addThreadMessage(threadId: string, message: ChatMessage) {
    const target = this.ctx.threads.find((i) => i.id === threadId)
    if (!target) {
      throw new Error(`cant find target thread:${threadId}`)
    }
    target.thread.addMessage(message)
  }

  getThreadMessages(threadId: string) {
    const target = this.ctx.threads.find((i) => i.id === threadId)
    if (!target) {
      throw new Error(`cant find target thread:${threadId}`)
    }
    target.thread.getMessages()
  }

  setThreadSystemPrompt(threadId: string, newSystemPrompt: string) {
    const target = this.ctx.threads.find((i) => i.id === threadId)
    if (!target) {
      throw new Error(`cant find target thread:${threadId}`)
    }
    target.thread.setSystemPrompt(newSystemPrompt)
  }
}

export class Thread {
  constructor(
    public ctx: ThreadContext,
    public id: string
  ) {}

  setSystemPrompt(newSystemPrompt: string) {
    this.ctx.systemPrompt = newSystemPrompt
  }

  addMessage(message: ChatMessage) {
    this.ctx.messages.push(message)
  }

  getMessages() {
    let systemPromptMessage: ChatMessage | null = null
    if (this.ctx.systemPrompt) {
      systemPromptMessage = {
        role: 'system',
        content: this.ctx.systemPrompt,
      }
    }
    return [systemPromptMessage, ...this.ctx.messages].filter(Boolean) as ChatMessage[]
  }
}
