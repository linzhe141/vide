import type { Tool, FnProcessLLMStream } from './types'
import { AgentContext } from './context'
import { ToolService } from './services/tool'
import { LLMService } from './services/llm'
import { AgentStepHandlers } from './stepHandlers'
import { AgentRuntime } from './runtime'
import { Workflow } from './workflow'
import { Session, SessionsManager } from './session'
import { AgentEvent } from './event'
import type { AgentEvents } from './event/channels'

export interface CreateAgentOptions {
  processLLMStream: FnProcessLLMStream
  tools: Tool[]
}

export class Agent {
  ctx: AgentContext
  sessionsManager: SessionsManager
  llmService: LLMService
  toolService: ToolService
  event: AgentEvent
  constructor(options: CreateAgentOptions) {
    this.event = new AgentEvent()
    this.ctx = new AgentContext(this)

    const { processLLMStream, tools } = options
    this.llmService = new LLMService(this, processLLMStream, tools)
    this.toolService = new ToolService(this, tools)

    this.sessionsManager = new SessionsManager({
      sessions: [],
    })

    this.event.emit('agent:ready')
  }

  createSession() {
    const agetnSession = new AgentSession(this)
    return agetnSession
  }

  on<K extends keyof AgentEvents>(event: K, handle: AgentEvents[K]) {
    this.event.on(event, handle)
  }
}

export class AgentSession {
  private workflow: Workflow = null!
  session: Session
  constructor(private agent: Agent) {
    this.session = this.agent.sessionsManager.createNewSession()

    const handlers = new AgentStepHandlers(this.agent, this.session)

    const runtime = new AgentRuntime(this.agent, handlers)
    this.workflow = new Workflow(this.agent, runtime)

    this.agent.event.emit('session:created', { sessionId: this.session.id })
  }

  async send(input: string) {
    const sessionId = this.session.id
    await this.workflow.run(sessionId, { input })
  }
}
