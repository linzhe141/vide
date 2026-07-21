import type {
  CallLLMStepPayload,
  CallToolsStepPayload,
  CallToolStepPayload,
  FinishedStepPayload,
  StepPayload,
  UserInputStepPayload,
  WaitHumanApprovePayload,
} from './types'
import type { AssistantChatMessage, ChatMessage, Tool, ToolCall, ToolResult } from '@vide/ai'
import { callAI } from './llm'
import { registorTools as registorAllTools } from './tools/registor'
import type { WorkflowEvent, WorkflowEventCtx, WorkflowEventWithCtx } from './event/channels'
import { v4 as uuid } from 'uuid'
import { BASH_TOOL_NAMES } from './tools/bash'
import { AbortError, ToolCallError } from './error'
import type { WorkflowStream } from './event/stream'

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

  constructor(
    public runtime: WorkflowRuntimeContextNew,
    registerTools?: () => Tool[]
  ) {
    this.tools = registerTools ? registerTools() : registorAllTools(this.runtime)
  }

  async run(input: string) {
    this.runtime.emit({ eventName: 'workflow-start', data: { input } })
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
          this.runtime.emit({
            eventName: 'workflow-finished',
            data: { content: (nextStep.payload as FinishedStepPayload).content },
          })
          this.runtime.endStream()
          return 'COMPLETED'
        }

        // 等待人工审批
        if (nextStep.state === 'WAIT_HUMAN_APPROVE') {
          this.runtime.emit({
            eventName: 'workflow-wait-human-approve',
            data: {
              data: nextStep.payload as WaitHumanApprovePayload,
            },
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
          this.runtime.workflowMessages.addAbortMessage()

          this.runtime.emit({
            eventName: 'workflow-aborted',
            data: {
              chunkData: {
                reasoning: this.runtime.assistantReasoningChunk,
                text: this.runtime.assistantChunk,
              },
            },
          })
          this.runtime.endStream()
          return 'ABORTED'
        }
        this.runtime.emit({
          eventName: 'workflow-error',
          data: { error },
        })
        this.runtime.endStream()
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
    this.runtime.workflowMessages.addMessage({ role: 'user', content: payload.input })
    return {
      state: 'CALL_LLM',
      payload: {
        messages: this.buildLLMMessages(),
      },
    }
  }

  async handleCallLLM(messages: ChatMessage[]) {
    this.runtime.emit({ eventName: 'workflow-llm-start', data: { messages } })
    const result = callAI({
      workspace: this.runtime.workspacePath,
      messages,
      tools: this.tools,
      signal: this.runtime.signal,
      events: {
        onReasoningStart: () => {
          this.runtime.assistantReasoningChunk = ''
          this.runtime.emit({ eventName: 'workflow-llm-reasoning-start' })
        },
        onReasoningDelta: (chunk) => {
          this.runtime.assistantReasoningChunk = chunk.content
          this.runtime.emit({
            eventName: 'workflow-llm-reasoning-delta',
            data: {
              chunk,
            },
          })
        },
        onReasoningEnd: (content) => {
          this.runtime.assistantReasoningChunk = ''
          this.runtime.emit({
            eventName: 'workflow-llm-reasoning-end',
            data: { content },
          })
        },
        onTextStart: () => {
          this.runtime.assistantChunk = ''
          this.runtime.emit({
            eventName: 'workflow-llm-text-start',
          })
        },
        onTextDelta: (chunk) => {
          this.runtime.assistantChunk = chunk.content
          this.runtime.emit({
            eventName: 'workflow-llm-text-delta',
            data: { chunk },
          })
        },
        onTextEnd: (content) => {
          this.runtime.assistantChunk = ''
          this.runtime.emit({
            eventName: 'workflow-llm-text-end',
            data: { content },
          })
        },
        onToolCallsStart: () => {
          this.runtime.emit({
            eventName: 'workflow-llm-tool-calls-start',
          })
        },
        onToolCallName: (data) => {
          this.runtime.emit({
            eventName: 'workflow-llm-tool-call-name',
            data: { data },
          })
        },
        onToolCallArguments: (data) => {
          this.runtime.emit({
            eventName: 'workflow-llm-tool-call-arguments',
            data: { data },
          })
        },
        onToolCallsEnd: (toolCalls) => {
          const autoApprove = this.runtime.autoApprove
          this.runtime.emit({
            eventName: 'workflow-llm-tool-calls-end',
            data: {
              toolCalls: toolCalls.map((t) => {
                return {
                  ...t,
                  status:
                    t.function.name === BASH_TOOL_NAMES.EXECUTE_BASH_COMMAND &&
                    autoApprove === false
                      ? 'waiting-human'
                      : 'auto-approved',
                }
              }),
            },
          })
        },
      },
    })

    if (this.runtime.signal.aborted) {
      throw new AbortError()
    }
    this.runtime.emit({ eventName: 'workflow-llm-end' })
    return result
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
    this.runtime.workflowMessages.addMessage(assistantMessage)

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
    const toolName = toolCall.function.name
    const tool = this.tools.find((t) => t.name === toolName)
    if (!tool) {
      const errorMessage = `Tool not found: ${toolName}`
      throw new ToolCallError(errorMessage)
    }
    let args: Record<string, unknown>

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

    this.runtime.emit({
      eventName: 'workflow-tool-call-start',
      data: {
        toolCall: { id: toolCall.id, toolName, args },
      },
    })

    const toolResult = await tool.executor(args)
    const finishedAt = Date.now()
    const reason = toolResult.reason
    const result = toolResult.result
    this.runtime.workflowMessages.addMessage({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(toolResult.result),
    })

    this.runtime.emit({
      eventName: 'workflow-tool-call-success',
      data: {
        toolCallResult: {
          id: toolCall.id,
          toolName,
          result,
          startedAt,
          finishedAt,
          durationMs: finishedAt - startedAt,
        },
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
      this.runtime.autoApprove === false
    if (needWaitHumanApprove && !payload.hasApproval) {
      return {
        state: 'WAIT_HUMAN_APPROVE',
        payload: {
          toolCalls,
          index,
        },
      }
    }
    let reason: ToolResult['reason']
    try {
      reason = await this.handleCallTool(toolCall)
    } catch (error: any) {
      console.log(`Error executing tool ${toolCall.function.name}:`, error)
      if (error instanceof ToolCallError) {
        const errorMessage = 'An exception occurred while executing toolCall: ' + error.message
        this.runtime.workflowMessages.addMessage({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: errorMessage,
        })

        this.runtime.emit({
          eventName: 'workflow-tool-call-error',
          data: {
            toolCallResult: {
              id: toolCall.id,
              toolName: toolCall.function.name,
              error: error.message,
            },
          },
        })
        // 由于中间某一个 toolcall 报错了， 跳过后续toolcall
        const pendingToolCalls = toolCalls.slice(index + 1)
        for (const t of pendingToolCalls) {
          this.runtime.workflowMessages.addMessage({
            role: 'tool',
            tool_call_id: t.id,
            content: JSON.stringify({
              result: 'Tool call skipped due to previous error',
            }),
          })
        }
        return { state: 'CALL_LLM', payload: { messages: this.buildLLMMessages() } }
      }
      throw error
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
    this.runtime.workflowMessages.addMessage({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: rejectMessage,
    })

    this.runtime.emit({
      eventName: 'workflow-tool-call-error',
      data: {
        toolCallResult: {
          id: toolCall.id,
          toolName: toolCall.function.name,
          error: rejectMessage,
        },
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
    return this.runtime.buildLLMMessages()
  }
}

export class WorkflowRuntimeContextNew {
  workspacePath: string | null
  sessionId: string
  workflowId: string
  workflowMessages: WorkflowSession
  autoApprove: boolean
  controller = new AbortController()

  stream: WorkflowStream
  workflow: Workflow = null!
  buildLLMMessages: () => ChatMessage[]
  //

  // 这两个只在 llm stream chunk 里用来存储当前的增量内容；为了 abort 进行存储
  assistantChunk = ''
  assistantReasoningChunk = ''

  constructor(options: {
    workspacePath: string | null
    sessionId: string
    autoApprove: boolean
    stream: WorkflowStream
    buildLLMMessages?: () => ChatMessage[]
  }) {
    this.workspacePath = options.workspacePath
    this.sessionId = options.sessionId
    this.workflowId = uuid()
    this.workflowMessages = new WorkflowMessages()
    this.autoApprove = options.autoApprove
    this.stream = options.stream
    this.buildLLMMessages = options.buildLLMMessages ?? (() => this.workflowMessages.getMessages())
  }

  emit = (data: WorkflowEvent) => {
    const event = { eventName: data.eventName } as WorkflowEventWithCtx
    if ('data' in data) {
      event.data = {
        ...data.data,
        ctx: this.workflowEventCtx,
      }
    } else {
      event.data = { ctx: this.workflowEventCtx }
    }
    this.stream.push(event)
  }

  endStream() {
    this.stream.end()
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

  get workflowEventCtx(): WorkflowEventCtx {
    return {
      sessionId: this.sessionId,
      workflowId: this.workflowId,
      // parentWorkflowId: this.parentWorkflowId,
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

export class WorkflowMessages {
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
