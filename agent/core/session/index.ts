import type { ChatMessage } from '../types'

export interface SessionContext {
  systemPrompt: string
  messages: ChatMessage[]
}

export interface SessionsContext {
  sessions: {
    id: string
    session: Session
  }[]
}

export class SessionsManager {
  constructor(public ctx: SessionsContext) {}

  createNewSession() {
    const newSessionCtx: SessionContext = {
      systemPrompt: '',
      messages: [],
    }
    const sessionId = String('_session_' + Date.now())
    const newSession = new Session(newSessionCtx, sessionId)
    this.ctx.sessions.push({
      id: sessionId,
      session: newSession,
    })

    return newSession
  }

  addSessionMessage(sessionId: string, message: ChatMessage) {
    const target = this.ctx.sessions.find((i) => i.id === sessionId)
    if (!target) {
      throw new Error(`cant find target session:${sessionId}`)
    }
    target.session.addMessage(message)
  }

  getSessionMessages(sessionId: string) {
    const target = this.ctx.sessions.find((i) => i.id === sessionId)
    if (!target) {
      throw new Error(`cant find target session:${sessionId}`)
    }
    target.session.getMessages()
  }

  setSessionSystemPrompt(sessionId: string, newSystemPrompt: string) {
    const target = this.ctx.sessions.find((i) => i.id === sessionId)
    if (!target) {
      throw new Error(`cant find target session:${sessionId}`)
    }
    target.session.setSystemPrompt(newSystemPrompt)
  }
}

export class Session {
  constructor(
    public ctx: SessionContext,
    public id: string
  ) {}

  setSystemPrompt(newSystemPrompt: string) {
    this.ctx.systemPrompt = newSystemPrompt
  }

  addMessage(message: ChatMessage) {
    this.ctx.messages.push(message)
  }

  getMessages() {
    return this.ctx.messages
  }
}
