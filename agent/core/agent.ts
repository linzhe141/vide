import type { Tool, FnProcessLLMStream } from './types'
import { AgentContext } from './context'
import { ToolService } from './services/tool'
import { LLMService } from './services/llm'
import { Workflow } from './workflow'
import { Session, SessionsManager } from './session'
import { agentEvent } from './event'

export interface CreateAgentOptions {
  processLLMStream: FnProcessLLMStream
  tools: Tool[]
}

export class Agent {
  ctx: AgentContext
  sessionsManager: SessionsManager
  llmService: LLMService
  toolService: ToolService
  event = agentEvent
  constructor(options: CreateAgentOptions) {
    this.ctx = new AgentContext(this)

    const { processLLMStream, tools } = options
    this.llmService = new LLMService(processLLMStream, tools)
    this.toolService = new ToolService(tools)

    this.sessionsManager = new SessionsManager({
      sessions: [],
    })

    this.event.emit('agent:ready')
  }

  createSession() {
    const agetnSession = new AgentSession(this)
    return agetnSession
  }
}

export class AgentSession {
  private workflow: Workflow = null!
  session: Session
  constructor(private agent: Agent) {
    this.session = this.agent.sessionsManager.createNewSession()

    this.workflow = new Workflow(
      this.session,
      this.agent.llmService,
      this.agent.toolService
    )
  }

  async send(input: string) {
    const sessionId = this.session.id
    await this.workflow.run(sessionId, { input })
  }
}
