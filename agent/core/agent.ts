import { AgentSession } from './agentSession'

export class Agent {
  constructor() {}

  createSession() {
    const agetnSession = new AgentSession()

    return agetnSession
  }
}
