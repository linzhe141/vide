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
import type {
  WorkflowEmitEvent,
  WorkflowEventCtx,
  WorkflowRuntimeEventWithCtx,
} from './event/channels'
import { v4 as uuid } from 'uuid'
import { AbortError, ToolCallError } from './error'
import type { WorkflowStream } from './event/stream'
import {
  resolveWorkflowPlugins,
  type WorkflowPlugin,
  type WorkflowToolCallErrorHookPayload,
  type WorkflowToolCallHookPayload,
} from './plugin'

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
    public runtime: WorkflowRuntimeContext,
    registerTools?: () => Tool[]
  ) {
    this.runtime.workflow = this
    this.tools = registerTools ? registerTools() : registorAllTools(this.runtime)
  }

  async run(input: string) {
    await this.runtime.emit({ eventName: 'workflow-start', data: { input } })
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
          await this.runtime.emit({
            eventName: 'workflow-finished',
            data: { content: (nextStep.payload as FinishedStepPayload).content },
          })
          this.runtime.endStream()
          return 'COMPLETED'
        }

        // 等待人工审批
        if (nextStep.state === 'WAIT_HUMAN_APPROVE') {
          await this.runtime.emit({
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

          await this.runtime.emit({
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
        await this.runtime.emit({
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
    await this.runtime.emit({ eventName: 'workflow-llm-start', data: { messages } })
    const result = await callAI({
      workspace: this.runtime.workspacePath,
      messages,
      tools: this.tools,
      signal: this.runtime.signal,
      events: {
        onReasoningStart: async () => {
          this.runtime.assistantReasoningChunk = ''
          await this.runtime.emit({ eventName: 'workflow-llm-reasoning-start' })
        },
        onReasoningDelta: async (chunk) => {
          this.runtime.assistantReasoningChunk = chunk.content
          await this.runtime.emit({
            eventName: 'workflow-llm-reasoning-delta',
            data: {
              chunk,
            },
          })
        },
        onReasoningEnd: async (content) => {
          this.runtime.assistantReasoningChunk = ''
          await this.runtime.emit({
            eventName: 'workflow-llm-reasoning-end',
            data: { content },
          })
        },
        onTextStart: async () => {
          this.runtime.assistantChunk = ''
          await this.runtime.emit({
            eventName: 'workflow-llm-text-start',
          })
        },
        onTextDelta: async (chunk) => {
          this.runtime.assistantChunk = chunk.content
          await this.runtime.emit({
            eventName: 'workflow-llm-text-delta',
            data: { chunk },
          })
        },
        onTextEnd: async (content) => {
          this.runtime.assistantChunk = ''
          await this.runtime.emit({
            eventName: 'workflow-llm-text-end',
            data: { content },
          })
        },
        onToolCallsStart: async () => {
          await this.runtime.emit({
            eventName: 'workflow-llm-tool-calls-start',
          })
        },
        onToolCallName: async (data) => {
          await this.runtime.emit({
            eventName: 'workflow-llm-tool-call-name',
            data: { data },
          })
        },
        onToolCallArguments: async (data) => {
          await this.runtime.emit({
            eventName: 'workflow-llm-tool-call-arguments',
            data: { data },
          })
        },
        onToolCallsEnd: async (toolCalls) => {
          const transformedToolCalls = await this.runtime.transformToolCalls(toolCalls)
          await this.runtime.emit({
            eventName: 'workflow-llm-tool-calls-end',
            data: {
              toolCalls: transformedToolCalls,
            },
          })
          return transformedToolCalls
        },
      },
    })

    if (this.runtime.signal.aborted) {
      throw new AbortError()
    }
    await this.runtime.emit({ eventName: 'workflow-llm-end' })
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

    const beforeToolCallResult = await this.runtime.runBeforeToolCallHooks({
      tool,
      toolCall,
      args,
    })
    const nextToolCall = beforeToolCallResult?.toolCall ?? toolCall
    const nextArgs = beforeToolCallResult?.args ?? args

    const startedAt = Date.now()

    await this.runtime.emit({
      eventName: 'workflow-tool-call-start',
      data: {
        toolCall: { id: nextToolCall.id, toolName, args: nextArgs },
      },
    })

    const toolResult = await tool.executor(nextArgs)
    const finishedAt = Date.now()
    const transformedToolResult = await this.runtime.runToolCallResultHooks({
      tool,
      toolCall: nextToolCall,
      args: nextArgs,
      reason: toolResult.reason,
      result: toolResult.result,
    })
    const reason = transformedToolResult?.reason ?? toolResult.reason
    const result = transformedToolResult?.result ?? toolResult.result
    const toolMessageContent = transformedToolResult?.toolMessageContent ?? JSON.stringify(result)
    this.runtime.workflowMessages.addMessage({
      role: 'tool',
      tool_call_id: nextToolCall.id,
      content: toolMessageContent,
    })

    await this.runtime.emit({
      eventName: 'workflow-tool-call-success',
      data: {
        toolCallResult: {
          id: nextToolCall.id,
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
    const parsedArgs = safeParseToolCallArguments(toolCall.function.arguments)
    const tool = this.runtime.getToolByName(toolCall.function.name)
    const needWaitHumanApprove =
      !!tool &&
      !!parsedArgs &&
      (await this.runtime.shouldWaitForToolCall({ tool, toolCall, args: parsedArgs }))
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
        const tool = this.runtime.getToolByName(toolCall.function.name)
        const parsedArgs = safeParseToolCallArguments(toolCall.function.arguments)
        const transformedError = await this.runtime.runToolCallErrorHooks({
          tool,
          toolCall,
          args: parsedArgs,
          error,
        })
        const nextError = transformedError?.error ?? error
        const errorMessage =
          transformedError?.toolMessageContent ??
          'An exception occurred while executing toolCall: ' +
            (nextError instanceof Error ? nextError.message : String(nextError))
        this.runtime.workflowMessages.addMessage({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: errorMessage,
        })

        await this.runtime.emit({
          eventName: 'workflow-tool-call-error',
          data: {
            toolCallResult: {
              id: toolCall.id,
              toolName: toolCall.function.name,
              error: nextError instanceof Error ? nextError.message : String(nextError),
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

    await this.runtime.emit({
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

export class WorkflowRuntimeContext {
  workspacePath: string | null
  sessionId: string
  workflowId: string
  workflowMessages: WorkflowSession
  plugins: WorkflowPlugin[]

  controller = new AbortController()

  stream: WorkflowStream
  workflow: Workflow = null!
  buildLLMMessages: () => ChatMessage[]

  getAutoApprove: () => boolean
  get autoApprove() {
    return this.getAutoApprove()
  }
  //

  // 这两个只在 llm stream chunk 里用来存储当前的增量内容；为了 abort 进行存储
  assistantChunk = ''
  assistantReasoningChunk = ''

  constructor(options: {
    workspacePath: string | null
    sessionId: string
    getAutoApprove: () => boolean
    stream: WorkflowStream
    buildLLMMessages?: () => ChatMessage[]
    plugins?: WorkflowPlugin[]
  }) {
    this.workspacePath = options.workspacePath
    this.sessionId = options.sessionId
    this.workflowId = uuid()
    this.workflowMessages = new WorkflowMessages()
    this.getAutoApprove = options.getAutoApprove
    this.stream = options.stream
    this.buildLLMMessages = options.buildLLMMessages ?? (() => this.workflowMessages.getMessages())
    this.plugins = resolveWorkflowPlugins(options.plugins)
  }

  emit = async (data: WorkflowEmitEvent) => {
    const event = { eventName: data.eventName } as WorkflowRuntimeEventWithCtx
    if ('data' in data) {
      event.data = {
        ...data.data,
        ctx: this.workflowEventCtx,
      }
    } else {
      event.data = { ctx: this.workflowEventCtx }
    }
    let transformedEvent: WorkflowRuntimeEventWithCtx = event
    for (const plugin of this.plugins) {
      if (!plugin.transformEvent) continue
      const nextEvent = await plugin.transformEvent(transformedEvent, { runtime: this })
      transformedEvent = nextEvent
    }
    if (transformedEvent) {
      this.stream.push(transformedEvent)
    }
  }

  getToolByName(toolName: string) {
    return this.workflow?.tools.find((tool) => tool.name === toolName) ?? null
  }

  async transformToolCalls(toolCalls: ToolCall[]) {
    let currentToolCalls = toolCalls
    for (const plugin of this.plugins) {
      if (!plugin.transformToolCalls) continue
      const nextToolCalls = await plugin.transformToolCalls(currentToolCalls, { runtime: this })
      currentToolCalls = nextToolCalls ?? currentToolCalls
    }
    return currentToolCalls
  }

  async shouldWaitForToolCall(payload: WorkflowToolCallHookPayload) {
    for (const plugin of this.plugins) {
      // TODO
      // plugin应该是针对某一个tool的，而不是所有的tool都要走这个hook
      // 或者可以删除这个 hook，感觉意义不大
      const result = await plugin.shouldWaitForToolCall?.(payload, { runtime: this })
      if (typeof result === 'boolean') {
        return result
      }
    }
    return false
  }

  async runBeforeToolCallHooks(payload: WorkflowToolCallHookPayload) {
    let currentPayload = payload
    for (const plugin of this.plugins) {
      const result = await plugin.beforeToolCall?.(currentPayload, { runtime: this })
      if (!result) continue
      currentPayload = {
        tool: currentPayload.tool,
        toolCall: result.toolCall ?? currentPayload.toolCall,
        args: result.args ?? currentPayload.args,
      }
    }

    if (currentPayload.toolCall === payload.toolCall && currentPayload.args === payload.args) {
      return undefined
    }

    return {
      toolCall: currentPayload.toolCall,
      args: currentPayload.args,
    }
  }

  async runToolCallResultHooks(payload: {
    tool: Tool
    toolCall: ToolCall
    args: Record<string, unknown>
    reason: ToolResult['reason']
    result: ToolResult['result']
  }) {
    let currentPayload = payload
    let toolMessageContent: string | undefined

    for (const plugin of this.plugins) {
      const result = await plugin.transformToolCallResult?.(currentPayload, { runtime: this })
      if (!result) continue
      currentPayload = {
        ...currentPayload,
        reason: result.reason ?? currentPayload.reason,
        result: result.result ?? currentPayload.result,
      }
      if (result.toolMessageContent !== undefined) {
        toolMessageContent = result.toolMessageContent
      }
    }

    if (currentPayload === payload && toolMessageContent === undefined) {
      return undefined
    }

    return {
      reason: currentPayload.reason,
      result: currentPayload.result,
      toolMessageContent,
    }
  }

  async runToolCallErrorHooks(payload: WorkflowToolCallErrorHookPayload) {
    let currentPayload = payload
    let toolMessageContent: string | undefined

    for (const plugin of this.plugins) {
      const result = await plugin.transformToolCallError?.(currentPayload, { runtime: this })
      if (!result) continue
      currentPayload = {
        ...currentPayload,
        error: result.error ?? currentPayload.error,
      }
      if (result.toolMessageContent !== undefined) {
        toolMessageContent = result.toolMessageContent
      }
    }

    if (currentPayload === payload && toolMessageContent === undefined) {
      return undefined
    }

    return {
      error: currentPayload.error,
      toolMessageContent,
    }
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

function safeParseToolCallArguments(argumentsText: string) {
  try {
    return JSON.parse(argumentsText) as Record<string, unknown>
  } catch {
    return null
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
