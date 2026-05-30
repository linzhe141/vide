import type {
  AssistantChatMessage,
  CallLLMStepPayload,
  CallToolsStepPayload,
  CallToolStepPayload,
  ChatMessage,
  StepPayload,
  Tool,
  ToolCall,
  ToolResult,
  UserInputStepPayload,
  WaitHumanApprovePayload,
} from './types'
import { processLLMStream } from './llm'
import { workflowEvent } from './event'
import { registorTools } from './tools/registor'
import type { WorkflowEventCtx } from './event/channels'
import type { Session } from './session'
import { v4 as uuid } from 'uuid'

export type WorkflowState =
  | 'INPUT'
  | 'CALL_LLM'
  | 'CALL_TOOLS'
  | 'WAIT_HUMAN_APPROVE'
  | 'CALL_SINGLE_CALL'
  | 'COMPLETED'

type NextStep = {
  state: WorkflowState
  payload: StepPayload
}

export class Workflow {
  state: WorkflowState = 'INPUT'
  tools: Tool[] = []

  constructor(public runtime: WorkflowRuntimeContext) {
    this.tools = registorTools(this.runtime)
  }

  async run(input: string) {
    try {
      workflowEvent.emit('workflow-start', { input, ctx: this.runtime.workflowEventCtx })
      let payload: StepPayload = { input } as UserInputStepPayload
      while (true) {
        this.runtime.throwIfAborted()
        const nextStep = await this.runStep(payload)
        if (nextStep.state === 'COMPLETED') {
          this.runtime.setStatus('finished')
          workflowEvent.emit('workflow-finished', { ctx: this.runtime.workflowEventCtx })
          break
        }

        this.state = nextStep.state
        payload = nextStep.payload
      }
    } catch (error: any) {
      if (error instanceof WorkflowAbortError) {
        this.runtime.setStatus('aborted')
        workflowEvent.emit('workflow-aborted', { ctx: this.runtime.workflowEventCtx })
        return
      }
      this.runtime.setStatus('error')
      workflowEvent.emit('workflow-error', { error, ctx: this.runtime.workflowEventCtx })
    }
  }

  async runStep(payload: StepPayload): Promise<NextStep> {
    switch (this.state) {
      case 'INPUT':
        return this.stateInput(payload as UserInputStepPayload)
      case 'CALL_LLM':
        return this.stateCallLLM(payload as CallLLMStepPayload)
      case 'CALL_TOOLS':
        return this.stateCallTools(payload as CallToolsStepPayload)
      case 'WAIT_HUMAN_APPROVE':
        return this.stateWaitHumanApprove(payload as WaitHumanApprovePayload)
      case 'CALL_SINGLE_CALL':
        return this.stateCallSingleCall(payload as CallToolStepPayload)
      default:
        throw new Error('Invalid state')
    }
  }

  stateInput(payload: UserInputStepPayload): NextStep {
    this.runtime.workflowSession.addMessage({ role: 'user', content: payload.input })
    return {
      state: 'CALL_LLM',
      payload: {
        messages: this.buildLLMMessages(),
      },
    }
  }

  async handleCallLLM(messages: ChatMessage[]) {
    let content = ''
    let toolCalls: ToolCall[] = []
    const llmAbortController = new AbortController()

    this.runtime.setAbortHandler(() => llmAbortController.abort())
    workflowEvent.emit('workflow-llm-start', { ctx: this.runtime.workflowEventCtx, messages })

    try {
      for await (const chunk of processLLMStream({
        messages,
        tools: this.tools,
        signal: llmAbortController.signal,
        onReasoningStart: () => {
          workflowEvent.emit('workflow-llm-reasoning-start', { ctx: this.runtime.workflowEventCtx })
        },
        onReasoningDelta: (chunk) => {
          workflowEvent.emit('workflow-llm-reasoning-delta', {
            ctx: this.runtime.workflowEventCtx,
            chunk,
          })
        },
        onReasoningEnd: (content) => {
          workflowEvent.emit('workflow-llm-reasoning-end', {
            ctx: this.runtime.workflowEventCtx,
            content,
          })
        },
        onTextStart: () => {
          workflowEvent.emit('workflow-llm-text-start', { ctx: this.runtime.workflowEventCtx })
        },
        onTextDelta: (chunk) => {
          workflowEvent.emit('workflow-llm-text-delta', {
            ctx: this.runtime.workflowEventCtx,
            chunk,
          })
        },
        onTextEnd: (content) => {
          workflowEvent.emit('workflow-llm-text-end', {
            ctx: this.runtime.workflowEventCtx,
            content,
          })
        },
        onToolCallsStart: () => {
          workflowEvent.emit('workflow-llm-tool-calls-start', {
            ctx: this.runtime.workflowEventCtx,
          })
        },
        onToolCallName: (data) => {
          workflowEvent.emit('workflow-llm-tool-call-name', {
            ctx: this.runtime.workflowEventCtx,
            data,
          })
        },
        onToolCallArguments: (data) => {
          workflowEvent.emit('workflow-llm-tool-call-arguments', {
            ctx: this.runtime.workflowEventCtx,
            data,
          })
        },
        onToolCallsEnd: (toolCalls) => {
          workflowEvent.emit('workflow-llm-tool-calls-end', {
            ctx: this.runtime.workflowEventCtx,
            toolCalls,
          })
        },
      })) {
        this.runtime.throwIfAborted()
        if ('content' in chunk && chunk.content) {
          content = chunk.content
        }

        if ('tool_calls' in chunk && chunk.tool_calls) {
          toolCalls = chunk.tool_calls
        }
      }
    } finally {
      this.runtime.setAbortHandler(null)
    }

    workflowEvent.emit('workflow-llm-end', { ctx: this.runtime.workflowEventCtx })
    return { content, toolCalls }
  }

  async stateCallLLM(payload: CallLLMStepPayload): Promise<NextStep> {
    const { content, toolCalls } = await this.handleCallLLM(payload.messages)
    const assistantMessage: AssistantChatMessage = {
      role: 'assistant',
      content,
    }

    if (toolCalls.length) {
      assistantMessage.tool_calls = toolCalls
    }
    this.runtime.workflowSession.addMessage(assistantMessage)

    if (toolCalls.length) {
      return { state: 'CALL_TOOLS', payload: { toolCalls } }
    }
    return { state: 'COMPLETED', payload: { content } }
  }

  stateCallTools(payload: CallToolsStepPayload): NextStep {
    return { state: 'CALL_SINGLE_CALL', payload: { toolCalls: payload.toolCalls, index: 0 } }
  }

  parseToolArgs(toolName: string, toolCall: ToolCall): { ok: true; args: any } | { ok: false } {
    try {
      return { ok: true, args: JSON.parse(toolCall.function.arguments) }
    } catch (error) {
      console.log()
      console.log(error)
      console.log()

      let errorMessage = 'An exception occurred while parsing toolCall argument JSON;'
      const finishedAt = Date.now()

      if (toolName === 'fs_write_file') {
        errorMessage += `
Perhaps the [fs_write_file tool] is writing too much content to the file;
it could be split into modules and written in batches.`
      }
      this.runtime.workflowSession.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: errorMessage,
      })
      workflowEvent.emit('workflow-tool-call-error', {
        ctx: this.runtime.workflowEventCtx,
        toolCallResult: { id: toolCall.id, toolName, error: errorMessage, finishedAt },
      })
      return { ok: false }
    }
  }

  async stateWaitHumanApprove(payload: WaitHumanApprovePayload): Promise<NextStep> {
    const toolName = payload.toolCall.function.name
    const tool = this.tools.find((t) => t.name === toolName)

    this.runtime.beginHumanApproval()
    workflowEvent.emit('workflow-wait-human-approve', {
      ctx: this.runtime.workflowEventCtx,
      toolCall: {
        id: payload.toolCall.id,
        toolName,
        args: payload.args,
        summary: tool?.approval?.summary?.(payload.args) || `Run ${toolName}`,
      },
    })

    while (this.runtime.humanApproval === 'pending') {
      this.runtime.throwIfAborted()
      await sleep(150)
    }

    if (this.runtime.humanApproval === 'rejected') {
      const reject = 'Rejected by user'
      const finishedAt = Date.now()
      this.runtime.workflowSession.addMessage({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: reject,
      })
      workflowEvent.emit('workflow-tool-call-reject', {
        ctx: this.runtime.workflowEventCtx,
        toolCallResult: { id: payload.toolCall.id, toolName, reject },
      })
      workflowEvent.emit('workflow-tool-call-error', {
        ctx: this.runtime.workflowEventCtx,
        toolCallResult: { id: payload.toolCall.id, toolName, error: reject, finishedAt },
      })
      return this.nextToolStep(payload.toolCalls, payload.index, 'call-llm')
    }

    return {
      state: 'CALL_SINGLE_CALL',
      payload: {
        toolCalls: payload.toolCalls,
        index: payload.index,
      },
    }
  }

  async handleCallTool(toolCall: ToolCall, args: any): Promise<ToolResult['reason']> {
    let reason: ToolResult['reason'] = 'call-llm'
    const toolName = toolCall.function.name
    const tool = this.tools.find((t) => t.name === toolName)
    if (!tool) {
      const errorMessage = `Tool not found: ${toolName}`
      const finishedAt = Date.now()
      this.runtime.workflowSession.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: errorMessage,
      })
      workflowEvent.emit('workflow-tool-call-error', {
        ctx: this.runtime.workflowEventCtx,
        toolCallResult: { id: toolCall.id, toolName, error: errorMessage, finishedAt },
      })
      return 'call-llm'
    }

    const execute = async () => {
      try {
        this.runtime.throwIfAborted()
        const result = await tool.executor(args)
        return { success: true, result }
      } catch (error) {
        return { success: false, error }
      }
    }

    const startedAt = Date.now()
    workflowEvent.emit('workflow-tool-call-start', {
      ctx: this.runtime.workflowEventCtx,
      toolCall: { id: toolCall.id, toolName, args },
    })
    const toolResult = await execute()
    const finishedAt = Date.now()

    if (toolResult.success) {
      reason = toolResult.result!.reason
      const result = toolResult.result!.result
      this.runtime.workflowSession.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult.result),
      })
      workflowEvent.emit('workflow-tool-call-success', {
        ctx: this.runtime.workflowEventCtx,
        toolCallResult: {
          id: toolCall.id,
          toolName,
          result,
          startedAt,
          finishedAt,
          durationMs: finishedAt - startedAt,
        },
      })
    } else {
      const error = toolResult.error
      this.runtime.workflowSession.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: 'An exception occurred while executing toolCall: ' + String(error),
      })
      workflowEvent.emit('workflow-tool-call-error', {
        ctx: this.runtime.workflowEventCtx,
        toolCallResult: {
          id: toolCall.id,
          toolName,
          error,
          startedAt,
          finishedAt,
          durationMs: finishedAt - startedAt,
        },
      })
    }

    return reason
  }

  async stateCallSingleCall(payload: CallToolStepPayload): Promise<NextStep> {
    const toolCalls = payload.toolCalls
    const index = payload.index
    const toolCall = toolCalls[index]
    const toolName = toolCall.function.name
    const tool = this.tools.find((t) => t.name === toolName)
    const parsed = this.parseToolArgs(toolName, toolCall)

    if (!parsed.ok) {
      return this.nextToolStep(toolCalls, index, 'call-llm')
    }

    if (tool?.approval?.required && !this.runtime.autoApprove) {
      return {
        state: 'WAIT_HUMAN_APPROVE',
        payload: {
          toolCall,
          args: parsed.args,
          toolCalls,
          index,
        },
      }
    }

    const reason = await this.handleCallTool(toolCall, parsed.args)
    return this.nextToolStep(toolCalls, index, reason)
  }

  nextToolStep(toolCalls: ToolCall[], index: number, reason: ToolResult['reason']): NextStep {
    if (reason === 'stop') {
      return {
        state: 'COMPLETED',
        payload: {
          content: 'Stop the current workflow',
        },
      }
    }

    if (index + 1 < toolCalls.length) {
      return { state: 'CALL_SINGLE_CALL', payload: { toolCalls, index: index + 1 } }
    }
    return { state: 'CALL_LLM', payload: { messages: this.buildLLMMessages() } }
  }

  buildLLMMessages() {
    return this.runtime.rootSession.buildLLMMessages()
  }
}

export class WorkflowRuntimeContext {
  readonly rootSession: Session
  readonly workflowId: string
  readonly workflowSession: WorkflowSession
  readonly branchName: string
  readonly parentWorkflowId: string | null
  readonly autoApprove: boolean
  aborted = false
  humanApproval: 'idle' | 'pending' | 'approved' | 'rejected' = 'idle'
  userInput: string[] = []
  private abortHandler: (() => void) | null = null

  constructor(options: {
    session: Session
    userInput: string
    branchName: string
    parentWorkflowId: string | null
    autoApprove?: boolean
  }) {
    this.rootSession = options.session
    this.workflowId = uuid()
    this.branchName = options.branchName
    this.parentWorkflowId = options.parentWorkflowId
    this.autoApprove = options.autoApprove ?? false
    this.userInput.push(options.userInput)
    this.workflowSession = new WorkflowSession()
  }

  get sessionId() {
    return this.rootSession.sessionId
  }

  get workspacePath() {
    return this.rootSession.workspacePath
  }

  get workflowEventCtx(): WorkflowEventCtx {
    return {
      sessionId: this.sessionId,
      workflowId: this.workflowId,
      branchName: this.branchName,
      parentWorkflowId: this.parentWorkflowId,
      autoApprove: this.autoApprove,
    }
  }

  abort() {
    this.aborted = true
    this.abortHandler?.()
  }

  approve() {
    if (this.humanApproval === 'pending') {
      this.humanApproval = 'approved'
    }
  }

  reject() {
    if (this.humanApproval === 'pending') {
      this.humanApproval = 'rejected'
    }
  }

  beginHumanApproval() {
    this.humanApproval = 'pending'
  }

  setAbortHandler(handler: (() => void) | null) {
    this.abortHandler = handler
  }

  throwIfAborted() {
    if (this.aborted) {
      throw new WorkflowAbortError()
    }
  }

  setStatus(status: 'running' | 'finished' | 'error' | 'aborted') {
    const node = this.rootSession.getWorkflowNode(this.workflowId)
    if (node) {
      node.status = status
    }
  }
}

export class WorkflowSession {
  messages: ChatMessage[] = []

  addMessage(message: ChatMessage) {
    this.messages.push(message)
  }

  getMessages() {
    return this.messages
  }
}

export class WorkflowAbortError extends Error {
  constructor() {
    super('Workflow aborted')
    this.name = 'WorkflowAbortError'
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
