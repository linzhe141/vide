import { AgentSession } from './agentSession'
import { agentEvent } from './event'

export class Agent {
  constructor() {}

  createSession() {
    const agetnSession = new AgentSession()
    agentEvent.emit('agent-create-session', { sessionId: agetnSession.sessionId })
    return agetnSession
  }
}
