import type { Tool, FnProcessLLMStream } from './types'
import { AgentContext } from './context'
import { ToolService } from './services/tool'
import { LLMService } from './services/llm'
import { Workflow } from './workflow'
import { Thread, ThreadsManager } from './threads'
import { agentEvent } from './event'

export interface CreateAgentOptions {
  processLLMStream: FnProcessLLMStream
  tools: Tool[]
}

export class Agent {
  ctx: AgentContext
  threadsManager: ThreadsManager
  llmService: LLMService
  toolService: ToolService
  constructor(options: CreateAgentOptions) {
    this.ctx = new AgentContext(this)

    const { processLLMStream, tools } = options
    this.llmService = new LLMService(processLLMStream, tools)
    this.toolService = new ToolService(tools)

    this.threadsManager = new ThreadsManager({
      threads: [],
    })

    agentEvent.emit('agent-ready')
  }

  createSession() {
    const agetnSession = new AgentSession(this)
    return agetnSession
  }
}

export class AgentSession {
  private workflow: Workflow = null!
  private thread: Thread
  constructor(private agent: Agent) {
    this.thread = this.agent.threadsManager.createNewThread()

    this.workflow = new Workflow(this.thread, this.agent.llmService, this.agent.toolService)
  }

  async send(input: string) {
    const threadId = this.thread.id
    await this.workflow.run(threadId, { input })
  }

  async humanApprove() {
    this.workflow.humanApprove()
  }

  async humanReject(rejectReason: string) {
    this.workflow.humanReject(rejectReason)
  }

  setSessionSystemPrompt(prompt: string) {
    this.agent.threadsManager.setThreadSystemPrompt(this.thread.id, prompt)
  }

  abort() {
    this.workflow.abort()
  }
}
