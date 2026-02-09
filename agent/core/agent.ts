import type { Tool, FnProcessLLMStream, ChatMessage } from './types'
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
    agentEvent.emit('agent-create-session', { threadId: agetnSession.thread.id })

    return agetnSession
  }

  restoreSession(threadId: string, messages: ChatMessage[]) {
    return AgentSession.restore(this, threadId, messages)
  }
}

export class AgentSession {
  private currentWorkflow: Workflow = null!
  thread: Thread
  constructor(private agent: Agent) {
    this.thread = this.agent.threadsManager.createNewThread()
  }
  static restore(agent: Agent, threadId: string, messages: ChatMessage[]) {
    const agetnSession = new AgentSession(agent)
    agetnSession.thread.id = threadId
    agetnSession.thread.ctx.messages = messages
    return agetnSession
  }
  async send(input: string) {
    // 每一次user-input 都使用新的一个workflow
    this.currentWorkflow = new Workflow(this.thread, this.agent.llmService, this.agent.toolService)
    const threadId = this.thread.id
    await this.currentWorkflow.start(threadId, { input })
  }

  async humanApprove() {
    this.currentWorkflow.humanApproveToolCall()
  }

  async humanReject(_rejectReason?: string) {
    this.currentWorkflow.humanRejectToolCall()
  }

  setSessionSystemPrompt(prompt: string) {
    this.agent.threadsManager.setThreadSystemPrompt(this.thread.id, prompt)
  }

  abort() {
    this.currentWorkflow.abort()
  }
}
