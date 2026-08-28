import {
  type AgentMessage,
  type AI,
  type AssistantChatMessage,
  type Tool,
  type ToolCall,
  type ToolResult,
} from '@vide/ai'
import type { Agent } from './agent'
import { ToolCallError } from './error'
import { buildAIMessages, callAI, createAIClient, type ModelConfig } from './llm'
import type { WorkflowPlugin } from './plugin'
import type { WorkflowStream } from './stream'

export type StepPayload =
  | InputPayload
  | ContextInputPayload
  | CallLLMPayload
  | CallToolsPayload
  | CompletedPayload
  | InterruptPayload

export type InputPayload = {
  state: 'INPUT'
  input: string
}

export type ContextInputPayload = {
  state: 'CONTEXT_INPUT'
  input: string
}

export type CallLLMPayload = {
  state: 'CALL_LLM'
}

export type CallToolsPayload = {
  state: 'CALL_TOOLS'
  toolCalls: ToolCall[]
  continueToolCallIndex?: number
}

export type CompletedPayload = {
  state: 'COMPLETED'
  result: string
}

export type InterruptPayload = {
  state: 'INTERRUPT'
  context: unknown
}

export type StopReason = 'completed' | 'error' | 'aborted' | 'interrupted'

export interface WorkflowRuntimeContextOptions {
  model: ModelConfig
  sessionId: string
  workspacePath: string | null
  stream: WorkflowStream
  thinkingMode: boolean
  getSessionAgentMessages?: () => AgentMessage[]
  getAutoApprove: () => boolean
  agentSettings: Agent['settings']
  plugins?: WorkflowPlugin[]
}

export class WorkflowRuntimeContext {
  readonly plugins: WorkflowPlugin[]
  workflow: Workflow | null = null
  private messages: AgentMessage[] = []
  private contextMessages = new Map<string, AgentMessage>()

  constructor(private readonly options: WorkflowRuntimeContextOptions) {
    this.plugins = [...(options.plugins ?? [])]
  }

  bindWorkflow(workflow: Workflow) {
    this.workflow = workflow
    this.stream.workflowId = workflow.id
  }

  get model() {
    return this.options.model
  }

  get sessionId() {
    return this.options.sessionId
  }

  get workspacePath() {
    return this.options.workspacePath
  }

  get stream() {
    return this.options.stream
  }

  get thinkingMode() {
    return this.options.thinkingMode
  }

  get signal() {
    return this.options.stream.signal
  }

  get agentSettings() {
    return this.options.agentSettings
  }

  get workflowId() {
    return this.workflow?.id ?? this.stream.workflowId
  }

  getSessionAgentMessages() {
    return this.options.getSessionAgentMessages?.() ?? []
  }

  getAutoApprove() {
    return this.options.getAutoApprove()
  }

  addMessage(message: AgentMessage) {
    this.messages.push(message)
  }

  addContextMessage(type: string, content: string) {
    this.contextMessages.set(type, { role: 'context', type, content })
  }

  removeContextMessage(type: string) {
    this.contextMessages.delete(type)
  }

  getMessages() {
    return [...this.messages, ...this.contextMessages.values()]
  }

  emitCustom(event: { eventName: string; data: unknown }) {
    this.stream.push({
      type: 'workflow.custom',
      eventName: event.eventName,
      data: event.data,
    })
  }

  async runBeforeWorkflowStartHooks(initialPayload: StepPayload) {
    let nextPayload = initialPayload
    for (const plugin of this.plugins) {
      const result = await plugin.beforeWorkflowStart?.(nextPayload, this)
      if (result) {
        nextPayload = result
      }
    }
    return nextPayload
  }

  async runBeforeWorkflowFinishHooks(completedPayload: CompletedPayload) {
    let nextPayload = completedPayload
    for (const plugin of this.plugins) {
      const result = await plugin.beforeWorkflowFinish?.(nextPayload, this)
      if (result) {
        nextPayload = result
      }
    }
    return nextPayload
  }
}

export class Workflow {
  id: string = crypto.randomUUID()
  state: StepPayload['state'] = 'INPUT'
  messages: AgentMessage[] = []
  ai: AI | null = null
  stepPayload: StepPayload | null = null

  constructor(
    public runtime: WorkflowRuntimeContext,
    private readonly tools: Tool[]
  ) {
    this.runtime.bindWorkflow(this)
  }

  get stream() {
    return this.runtime.stream
  }

  get signal() {
    return this.runtime.signal
  }

  abort() {
    this.stream.abort()
  }

  async run(input: string, options?: { inputSource?: 'desktop' | 'wechat-bot' }) {
    this.stream.push({
      type: 'workflow.start',
      input,
      inputSource: options?.inputSource ?? 'desktop',
    })
    const initialPayload = await this.runtime.runBeforeWorkflowStartHooks({ state: 'INPUT', input })
    return await this.runLoop(initialPayload)
  }

  async continueRunLoop(payload: StepPayload) {
    return await this.runLoop(payload)
  }

  async runLoop(initialPayload: StepPayload): Promise<StopReason | void> {
    this.stepPayload = initialPayload
    this.state = initialPayload.state

    while (true) {
      try {
        this.signal.throwIfAborted()
        this.stream.push({ type: 'workflow.step.start', payload: this.stepPayload })

        let nextStep = await this.runStep()

        if (nextStep.state === 'COMPLETED') {
          nextStep = await this.runtime.runBeforeWorkflowFinishHooks(nextStep)
        }

        this.stream.push({ type: 'workflow.step.end', result: nextStep })

        if (nextStep.state === 'COMPLETED') {
          this.stream.push({ type: 'workflow.completed', result: nextStep.result })
          this.stream.end()
          return 'completed'
        }

        if (nextStep.state === 'INTERRUPT') {
          this.stepPayload = nextStep
          this.state = nextStep.state
          this.stream.push({ type: 'workflow.interrupted' })
          return 'interrupted'
        }

        this.stepPayload = nextStep
        this.state = nextStep.state
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          this.stream.push({ type: 'workflow.aborted' })
          this.stream.end()
          return 'aborted'
        }

        this.stream.push({
          type: 'workflow.error',
          error: error instanceof Error ? error.message : String(error),
        })
        this.stream.end()
        return 'error'
      }
    }
  }

  async runStep(): Promise<StepPayload> {
    switch (this.state) {
      case 'INPUT':
        return this.stateInput()
      case 'CONTEXT_INPUT':
        return this.stateContextInput()
      case 'CALL_LLM':
        return this.stateCallLLM()
      case 'CALL_TOOLS':
        return this.stateCallTools()
      default:
        throw new Error('Invalid state')
    }
  }

  async stateInput(): Promise<StepPayload> {
    const payload = this.stepPayload as InputPayload
    this.messages.push({ role: 'user', content: payload.input })
    return { state: 'CALL_LLM' }
  }

  async stateContextInput(): Promise<StepPayload> {
    const payload = this.stepPayload as ContextInputPayload
    this.messages.push({ role: 'user', content: payload.input })
    return { state: 'CALL_LLM' }
  }

  async stateCallLLM(): Promise<StepPayload> {
    const result = await this.handleCallLLM()
    const { content } = result
    const { toolCalls } = result

    const assistantMessage: AssistantChatMessage = {
      role: 'assistant',
      content,
    }
    if (toolCalls.length > 0) {
      assistantMessage.tool_calls = toolCalls
    }

    this.messages.push(assistantMessage)
    this.stream.push({ type: 'workflow.llm.result', result: assistantMessage })

    if (toolCalls.length > 0) {
      return { state: 'CALL_TOOLS', toolCalls }
    }

    return { state: 'COMPLETED', result: content }
  }

  async handleCallLLM() {
    const sessionAgentMessages = this.runtime.getSessionAgentMessages()
    const aiMessages = buildAIMessages([
      ...sessionAgentMessages,
      ...this.runtime.getMessages(),
      ...this.messages,
    ])

    if (!this.ai) {
      if (
        this.runtime.model.apiKey === '' ||
        this.runtime.model.baseURL === '' ||
        this.runtime.model.name === ''
      ) {
        throw new Error('Invalid AI model configuration, check your settings and try again.')
      }
      this.ai = createAIClient(this.runtime.model)
    }

    this.stream.push({ type: 'workflow.llm.start' })
    const result = await callAI({
      model: this.runtime.model.name,
      ai: this.ai,
      messages: aiMessages,
      tools: this.tools,
      signal: this.signal,
      thinkingMode: this.runtime.thinkingMode,
      events: {
        onReasoningStart: () => {
          this.stream.push({ type: 'workflow.llm.reason.start' })
        },
        onReasoningDelta: (chunk) => {
          this.stream.push({ type: 'workflow.llm.reason.delta', chunk: { delta: chunk.delta } })
        },
        onReasoningEnd: (content) => {
          this.stream.push({ type: 'workflow.llm.reason.end', content })
        },
        onTextStart: () => {
          this.stream.push({ type: 'workflow.llm.text.start' })
        },
        onTextDelta: (chunk) => {
          this.stream.push({ type: 'workflow.llm.text.delta', chunk: { delta: chunk.delta } })
        },
        onTextEnd: (content) => {
          this.stream.push({ type: 'workflow.llm.text.end', content })
        },
        onToolCallsStart: () => {
          this.stream.push({ type: 'workflow.llm.tool.call.process' })
        },
        onToolCallsEnd: (toolCalls) => {
          for (const toolCall of toolCalls) {
            if (
              toolCall.function.name === 'execute-bash-command' &&
              !this.runtime.getAutoApprove()
            ) {
              toolCall.status = 'waiting-human'
            } else {
              toolCall.status = 'auto-approved'
            }
          }
          this.stream.push({ type: 'workflow.llm.tool.call.end', toolCall: toolCalls })
        },
      },
    })
    this.stream.push({ type: 'workflow.llm.end' })
    return result
  }

  async stateCallTools(): Promise<StepPayload> {
    const payload = this.stepPayload as CallToolsPayload
    let toolCalls = payload.toolCalls
    if (payload.continueToolCallIndex !== undefined) {
      toolCalls = toolCalls.slice(payload.continueToolCallIndex)
    }

    for (let index = 0; index < toolCalls.length; index++) {
      const toolCall = toolCalls[index]
      if (toolCall.status === 'waiting-human') {
        return {
          state: 'INTERRUPT',
          context: {
            toolCalls: payload.toolCalls,
            continueToolCallIndex: index,
          },
        }
      }

      let reason: ToolResult['reason']
      try {
        reason = await this.handleCallTool(toolCall)
      } catch (error) {
        if (error instanceof ToolCallError) {
          const errorMessage = `An exception occurred while executing toolCall: ${error.message}`
          this.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: errorMessage,
          })

          this.stream.push({
            type: 'workflow.tool.call.error',
            toolCallResult: {
              id: toolCall.id,
              toolName: toolCall.function.name,
              error: error.message,
            },
          })

          for (const pendingToolCall of toolCalls.slice(index + 1)) {
            this.messages.push({
              role: 'tool',
              tool_call_id: pendingToolCall.id,
              content: 'Tool call skipped due to previous error',
            })
            this.stream.push({
              type: 'workflow.tool.call.error',
              toolCallResult: {
                id: pendingToolCall.id,
                toolName: pendingToolCall.function.name,
                error: 'Tool call skipped due to previous error',
              },
            })
          }

          return { state: 'CALL_LLM' }
        }

        throw error
      }

      if (reason === 'stop') {
        return { state: 'COMPLETED', result: 'Tool execution stopped the workflow' }
      }
    }

    return { state: 'CALL_LLM' }
  }

  async handleCallTool(toolCall: ToolCall): Promise<ToolResult['reason']> {
    const tool = this.tools.find((candidate) => candidate.name === toolCall.function.name)
    if (!tool) {
      throw new ToolCallError(`Tool ${toolCall.function.name} not found`)
    }

    let args: Record<string, unknown>
    try {
      args = JSON.parse(toolCall.function.arguments)
    } catch (error) {
      throw new ToolCallError(
        `Failed to parse tool arguments: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    const startedAt = Date.now()
    this.stream.push({
      type: 'workflow.tool.call.start',
      toolCall: { id: toolCall.id, toolName: tool.name, args },
    })

    const toolResult = await tool.executor(args)
    const finishedAt = Date.now()

    this.messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(toolResult.result),
    })

    this.stream.push({
      type: 'workflow.tool.call.success',
      toolCallResult: {
        id: toolCall.id,
        toolName: tool.name,
        result: toolResult,
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt,
      },
    })

    return toolResult.reason
  }
}
