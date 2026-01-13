import type { Tool, FnProcessLLMStream } from './types'
import { AgentContext } from './context'
import { ToolService } from './services/tool'
import { LLMService } from './services/llm'
import { AgentStepHandlers } from './stepHandlers'
import { AgentRuntime } from './runtime'
import { Workflow } from './workflow'
import { SessionsManager } from './session'

export interface CreateAgentOptions {
  processLLMStream: FnProcessLLMStream
  tools: Tool[]
}

export class Agent {
  ctx: AgentContext = null!
  sessionsManager: SessionsManager
  llmService: LLMService
  toolService: ToolService

  constructor(options: CreateAgentOptions) {
    this.ctx = new AgentContext(this)

    const { processLLMStream, tools } = options
    this.llmService = new LLMService(processLLMStream, tools)
    this.toolService = new ToolService(tools)

    this.sessionsManager = new SessionsManager({
      sessions: [],
    })
  }

  createSession() {
    const agetnSession = new AgentSession(this)
    return agetnSession
  }
}

export class AgentSession {
  private workflow: Workflow = null!
  constructor(private agent: Agent) {
    const session = this.agent.sessionsManager.createNewSession()

    const handlers = new AgentStepHandlers(this.agent.ctx, session)

    const runtime = new AgentRuntime(handlers)
    this.workflow = new Workflow(runtime)
  }

  async send(input: string) {
    await this.workflow.run({ input })
  }
}
