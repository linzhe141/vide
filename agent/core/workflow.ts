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
import { BASH_TOOL_NAMES } from './tools/bash'
import { AbortError, ToolCallError } from './error'

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
    workflowEvent.emit('workflow-start', { input, ctx: this.runtime.workflowEventCtx })
    return await this.runLoop({ input } as UserInputStepPayload)
  }

  async runLoop(initialPayload: StepPayload) {
    let payload: StepPayload = initialPayload

    while (true) {
      try {
        this.runtime.throwIfAborted()
        const nextStep = await this.runStep(payload)

        // 完成状态
        if (nextStep.state === 'COMPLETED') {
          workflowEvent.emit('workflow-finished', {
            ctx: this.runtime.workflowEventCtx,
          })
          return 'COMPLETED'
        }

        // 等待人工审批
        if (nextStep.state === 'WAIT_HUMAN_APPROVE') {
          workflowEvent.emit('workflow-wait-human-approve', {
            ctx: this.runtime.workflowEventCtx,
            data: nextStep.payload as WaitHumanApprovePayload,
          })
          // 需要 保持 状态，等待人工审批结果
          this.state = nextStep.state
          return 'WAIT_HUMAN_APPROVE'
        }

        // 继续执行下一步
        this.state = nextStep.state
        payload = nextStep.payload
      } catch (error: any) {
        if (error instanceof AbortError) {
          this.runtime.workflowSession.addAbortMessage()
          workflowEvent.emit('workflow-aborted', {
            ctx: this.runtime.workflowEventCtx,
            chunkData: {
              reasoning: this.runtime.assistantReasoningChunk,
              text: this.runtime.assistantChunk,
            },
          })
          return 'ABORTED'
        }
        workflowEvent.emit('workflow-error', { error, ctx: this.runtime.workflowEventCtx })
        return 'ERROR'
      }
    }
  }
  async runStep(payload: StepPayload): Promise<NextStep> {
    switch (this.state) {
      case 'INPUT': {
        return this.stateInput(payload as UserInputStepPayload)
      }
      case 'CALL_LLM': {
        return this.stateCallLLM(payload as CallLLMStepPayload)
      }
      case 'CALL_TOOLS': {
        return this.stateCallTools(payload as CallToolsStepPayload)
      }
      case 'CALL_SINGLE_CALL': {
        return this.stateCallSingleCall(payload as CallToolStepPayload)
      }
      default: {
        throw new Error('Invalid state')
      }
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

    workflowEvent.emit('workflow-llm-start', { ctx: this.runtime.workflowEventCtx, messages })

    for await (const chunk of processLLMStream({
      messages,
      tools: this.tools,
      signal: this.runtime.signal,
      onReasoningStart: () => {
        this.runtime.assistantReasoningChunk = ''
        workflowEvent.emit('workflow-llm-reasoning-start', { ctx: this.runtime.workflowEventCtx })
      },
      onReasoningDelta: (chunk) => {
        this.runtime.assistantReasoningChunk = chunk.content
        workflowEvent.emit('workflow-llm-reasoning-delta', {
          ctx: this.runtime.workflowEventCtx,
          chunk,
        })
      },
      onReasoningEnd: (content) => {
        this.runtime.assistantReasoningChunk = ''
        workflowEvent.emit('workflow-llm-reasoning-end', {
          ctx: this.runtime.workflowEventCtx,
          content,
        })
      },
      onTextStart: () => {
        this.runtime.assistantChunk = ''
        workflowEvent.emit('workflow-llm-text-start', { ctx: this.runtime.workflowEventCtx })
      },
      onTextDelta: (chunk) => {
        this.runtime.assistantChunk = chunk.content
        workflowEvent.emit('workflow-llm-text-delta', { ctx: this.runtime.workflowEventCtx, chunk })
      },
      onTextEnd: (content) => {
        this.runtime.assistantChunk = ''
        workflowEvent.emit('workflow-llm-text-end', { ctx: this.runtime.workflowEventCtx, content })
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
        const autoApprove = this.runtime.rootSession.autoApprove
        workflowEvent.emit('workflow-llm-tool-calls-end', {
          ctx: this.runtime.workflowEventCtx,
          toolCalls: toolCalls.map((t) => {
            return {
              ...t,
              status:
                t.function.name === BASH_TOOL_NAMES.EXECUTE_BASH_COMMAND && autoApprove === false
                  ? 'waiting-human'
                  : 'auto-approved',
            }
          }),
        })
      },
    })) {
      if ('content' in chunk && chunk.content) {
        content = chunk.content
      }

      if ('tool_calls' in chunk && chunk.tool_calls) {
        toolCalls = chunk.tool_calls
      }
    }

    if (this.runtime.signal.aborted) {
      throw new AbortError()
    }
    workflowEvent.emit('workflow-llm-end', { ctx: this.runtime.workflowEventCtx })

    return { content, toolCalls }
  }

  async stateCallLLM(payload: CallLLMStepPayload): Promise<NextStep> {
    // console.log(JSON.stringify(payload.messages, null, 2))
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
    } else {
      return { state: 'COMPLETED', payload: { content } }
    }
  }

  stateCallTools(payload: CallToolsStepPayload): NextStep {
    const toolCalls = payload.toolCalls

    return { state: 'CALL_SINGLE_CALL', payload: { toolCalls, index: 0 } }
  }

  async handleCallTool(toolCall: ToolCall): Promise<ToolResult['reason']> {
    let reason: ToolResult['reason'] = 'call-llm'
    const toolName = toolCall.function.name
    const tool = this.tools.find((t) => t.name === toolName)
    if (!tool) {
      const errorMessage = `Tool not found: ${toolName}`
      throw new ToolCallError(errorMessage)
    }
    let args = {}

    try {
      args = JSON.parse(toolCall.function.arguments)
    } catch (error) {
      console.log()
      console.log(error)
      console.log()

      throw new ToolCallError(
        `Failed to parse tool arguments: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    const startedAt = Date.now()
    workflowEvent.emit('workflow-tool-call-start', {
      ctx: this.runtime.workflowEventCtx,
      toolCall: { id: toolCall.id, toolName, args },
    })
    const toolResult = await tool.executor(args)
    const finishedAt = Date.now()
    reason = toolResult.reason
    const result = toolResult.result
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

    return reason
  }

  async stateCallSingleCall(payload: CallToolStepPayload): Promise<NextStep> {
    const toolCalls = payload.toolCalls
    const index = payload.index
    const toolCall = toolCalls[index]
    const needWaitHumanApprove =
      toolCall.function.name === BASH_TOOL_NAMES.EXECUTE_BASH_COMMAND &&
      this.runtime.rootSession.autoApprove === false
    if (needWaitHumanApprove && !payload.hasApproval) {
      return {
        state: 'WAIT_HUMAN_APPROVE',
        payload: {
          toolCalls,
          index,
        },
      }
    }
    let reason: ToolResult['reason'] = 'call-llm'
    try {
      reason = await this.handleCallTool(toolCall)
    } catch (error: any) {
      console.log(`Error executing tool ${toolCall.function.name}:`, error)
      if (error instanceof ToolCallError) {
        const errorMessage = 'An exception occurred while executing toolCall: ' + error.message
        this.runtime.workflowSession.addMessage({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: errorMessage,
        })

        workflowEvent.emit('workflow-tool-call-error', {
          ctx: this.runtime.workflowEventCtx,
          toolCallResult: {
            id: toolCall.id,
            toolName: toolCall.function.name,
            error: error.message,
          },
        })
        // 由于中间某一个 toolcall 报错了， 跳过后续toolcall
        const pendingToolCalls = toolCalls.slice(index + 1)
        for (const t of pendingToolCalls) {
          this.runtime.workflowSession.addMessage({
            role: 'tool',
            tool_call_id: t.id,
            content: JSON.stringify({
              result: 'Tool call skipped due to previous error',
            }),
          })
        }
        return { state: 'CALL_LLM', payload: { messages: this.buildLLMMessages() } }
      }
    }

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
    } else {
      return { state: 'CALL_LLM', payload: { messages: this.buildLLMMessages() } }
    }
  }

  async approveHumanApprove(payload: WaitHumanApprovePayload) {
    if (this.state !== 'WAIT_HUMAN_APPROVE') {
      return
    }
    this.state = 'CALL_SINGLE_CALL'
    const callToolStepPayload = payload as CallToolStepPayload
    callToolStepPayload.hasApproval = true
    return await this.runLoop(callToolStepPayload)
  }
  async rejectHumanApprove(payload: WaitHumanApprovePayload) {
    if (this.state !== 'WAIT_HUMAN_APPROVE') {
      return
    }
    const { toolCalls, index } = payload
    const toolCall = toolCalls[index]

    // 将拒绝信息添加到会话中
    const rejectMessage = `Human rejected the execution of this tool call.`
    this.runtime.workflowSession.addMessage({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: rejectMessage,
    })

    workflowEvent.emit('workflow-tool-call-error', {
      ctx: this.runtime.workflowEventCtx,
      toolCallResult: {
        id: toolCall.id,
        toolName: toolCall.function.name,
        error: rejectMessage,
      },
    })

    // 如果还有更多工具调用，继续执行下一个
    if (index + 1 < toolCalls.length) {
      this.state = 'CALL_SINGLE_CALL'
      return await this.runLoop({ toolCalls, index: index + 1 })
    } else {
      // 所有工具处理完，回到LLM生成回应
      this.state = 'CALL_LLM'
      return await this.runLoop({ messages: this.buildLLMMessages() })
    }
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
  readonly controller = new AbortController()

  // 这两个只在 llm stream chunk 里用来存储当前的增量内容；为了 abort 进行存储
  assistantChunk = ''
  assistantReasoningChunk = ''
  userInput: string[] = []

  constructor(options: {
    session: Session
    userInput: string
    branchName: string
    parentWorkflowId: string | null
  }) {
    this.rootSession = options.session
    this.workflowId = uuid()
    this.branchName = options.branchName
    this.parentWorkflowId = options.parentWorkflowId
    // During initialization, `userInput` contains only one element.
    this.userInput.push(options.userInput)
    this.workflowSession = new WorkflowSession()
  }
  get signal() {
    return this.controller.signal
  }

  abort() {
    this.controller.abort()
  }

  throwIfAborted() {
    if (this.signal.aborted) {
      throw new AbortError()
    }
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
    }
  }
}

export class WorkflowSession {
  messages: ChatMessage[] = []

  addMessage(message: ChatMessage) {
    this.messages.push(message)
  }

  addAbortMessage() {
    this.messages.push({
      role: 'user',
      content: 'The user aborted this workflow before it completed.',
    })
  }

  getMessages() {
    return this.messages
  }
}
