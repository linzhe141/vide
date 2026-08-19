import {
  type AgentMessage,
  type AI,
  type AssistantChatMessage,
  type Tool,
  type ToolCall,
  type ToolResult,
} from '@vide/ai'
import type { WorkflowStream } from './stream'
import { buildAIMessages, callAI, createAIClient, type ModelConfig } from './llm'
import { ToolCallError } from './error'

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
  // 当 需要human approve 时，并且还是串行 存在这下标，表示需要继续执行的toolCall的下标
  continueToolCallIndex?: number
}

export type CompletedPayload = {
  state: 'COMPLETED'
  result: string
}

export type InterruptPayload = {
  state: 'INTERRUPT'
  context: any
}

export type StopReason = 'completed' | 'error' | 'aborted' | 'interrupted'
export class Workflow {
  id: string = crypto.randomUUID()
  state: StepPayload['state'] = 'INPUT'
  messages: AgentMessage[] = []
  ai: AI | null = null
  stepPayload: StepPayload | null = null
  constructor(
    public context: {
      model: ModelConfig
      sessionId: string
      tools: Tool[]
      stream: WorkflowStream
      thinkingMode: boolean
      getSessionAgentMessages: () => AgentMessage[]
      getAutoApprove: () => boolean
    }
  ) {}

  get stream() {
    return this.context.stream
  }

  get signal() {
    return this.context.stream.signal
  }

  abort() {
    this.context.stream.abort()
    // 加这个有几率导致toolcall 和result之间插入 user message, 导致openai cient 无反应
    // // 是否需要发送到llm，如果发送是否需要持久化，并且前端是不需要显示
    // this.messages.push({
    //   role: 'user',
    //   content: 'Workflow aborted by user',
    // })
  }

  async run(input: string, options?: { inputSource?: 'desktop' | 'wechat-bot' }) {
    this.stream.push({
      type: 'workflow.start',
      input,
      inputSource: options?.inputSource ?? 'desktop',
    })
    return await this.runLoop({ state: 'INPUT', input })
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
        const nextStep = await this.runStep()
        this.stream.push({ type: 'workflow.step.end', result: nextStep })
        if (nextStep.state === 'COMPLETED') {
          this.stream.push({ type: 'workflow.completed', result: nextStep.result })
          this.stream.end()
          return 'completed'
        } else if (nextStep.state === 'INTERRUPT') {
          // Handle interrupt logic here waiting for continuation
          console.log('Workflow interrupted:', nextStep)
          this.stream.push({ type: 'workflow.interrupted' })
          // not end the stream here, because we might want to continue later
          this.stepPayload = nextStep
          this.state = nextStep.state
          return 'interrupted'
        } else {
          this.stepPayload = nextStep
          this.state = nextStep.state
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          this.stream.push({ type: 'workflow.aborted' })
          this.stream.end()
          return 'aborted'
        } else {
          this.stream.push({
            type: 'workflow.error',
            error: e instanceof Error ? e.message : String(e),
          })
          this.stream.end()
          return 'error'
        }
      }
    }
  }

  // 这里只考虑基本的Agent loop
  async runStep(): Promise<StepPayload> {
    switch (this.state) {
      case 'INPUT': {
        return this.stateInput()
      }
      case 'CONTEXT_INPUT': {
        return this.stateContextInput()
      }
      case 'CALL_LLM': {
        return this.stateCallLLM()
      }
      case 'CALL_TOOLS': {
        return this.stateCallTools()
      }
      default: {
        throw new Error('Invalid state')
      }
    }
  }

  async stateInput(): Promise<StepPayload> {
    const payload = this.stepPayload as InputPayload
    this.messages.push({ role: 'user', content: payload.input })
    return { state: 'CALL_LLM' }
  }

  async stateContextInput(): Promise<StepPayload> {
    const payload = this.stepPayload as ContextInputPayload
    // 将 context input 作为 user message 添加到 messages 中，并重新进入 CALL_LLM 状态
    this.messages.push({ role: 'user', content: payload.input })
    return { state: 'CALL_LLM' }
  }

  async stateCallLLM(): Promise<StepPayload> {
    const result = await this.handleCallLLM()
    const { content, toolCalls } = result
    const assistantMessage: AssistantChatMessage = {
      role: 'assistant',
      content,
    }
    if (toolCalls.length) {
      assistantMessage.tool_calls = toolCalls
    }
    this.messages.push(assistantMessage)
    const hasToolCalls = toolCalls && toolCalls.length > 0
    if (hasToolCalls) {
      // Handle tool calls here
      // For simplicity, we just log them for now
      console.log('Tool calls:', toolCalls)
      return { state: 'CALL_TOOLS', toolCalls } // or another state based on your logic
    } else {
      return { state: 'COMPLETED', result: content }
    }
  }

  async handleCallLLM() {
    const sessionAgentMessages = this.context.getSessionAgentMessages()
    const aiMessages = buildAIMessages([...sessionAgentMessages, ...this.messages])
    if (!this.ai) {
      this.ai = createAIClient(this.context.model)
    }

    this.stream.push({ type: 'workflow.llm.start' })
    const result = await callAI({
      model: this.context.model.name,
      ai: this.ai,
      messages: aiMessages,
      tools: this.context.tools,
      signal: this.signal,
      thinkingMode: this.context.thinkingMode,
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
              !this.context.getAutoApprove()
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
    const { content, toolCalls } = result
    const assistantMessage: AssistantChatMessage = {
      role: 'assistant',
      content,
    }
    if (toolCalls.length) {
      assistantMessage.tool_calls = toolCalls
    }

    this.stream.push({ type: 'workflow.llm.end' })
    this.stream.push({ type: 'workflow.llm.result', result: assistantMessage })
    return result
  }

  async stateCallTools(): Promise<StepPayload> {
    const payload = this.stepPayload as CallToolsPayload
    let toolCalls = payload.toolCalls
    if (payload.continueToolCallIndex != undefined) {
      toolCalls = toolCalls.slice(payload.continueToolCallIndex)
    }
    // if (
    //   toolCalls.find((t) => t.function.name === 'execute-bash-command') &&
    //   !this.context.getAutoApprove()
    // ) {
    //   return {
    //     state: 'INTERRUPT',
    //     context: {
    //       toolCalls: payload.toolCalls,
    //       continueToolCallIndex: 0,
    //     },
    //   }
    // }
    // 并行执行所有toolCalls
    // const promiseOfCallToolResults = toolCalls.map(async (toolCall) => {
    //   // Simulate tool execution
    //   return { id: toolCall.id, result: 'Tool executed successfully' }
    // })
    // const toolResults = await Promise.all(promiseOfCallToolResults)
    // for (const toolResult of toolResults) {
    //   this.messages.push({
    //     role: 'tool',
    //     tool_call_id: toolResult.id,
    //     content: toolResult.result,
    //   })
    // }
    // console.log('Tool results:', toolResults)
    // 串行执行所有toolCalls
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i]
      if (toolCall.status === 'waiting-human') {
        return {
          state: 'INTERRUPT',
          context: {
            toolCalls: payload.toolCalls,
            continueToolCallIndex: i,
          },
        }
      } else {
        let reason: ToolResult['reason']

        try {
          reason = await this.handleCallTool(toolCall)
        } catch (error) {
          // 这种ToolCallError直接让 LLM 尝试原因并 retry
          if (error instanceof ToolCallError) {
            const errorMessage = 'An exception occurred while executing toolCall: ' + error.message
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
            // 由于中间某一个 toolcall 报错了， 跳过后续toolcall
            const pendingToolCalls = toolCalls.slice(i + 1)
            const pendingError = 'Tool call skipped due to previous error'
            for (const t of pendingToolCalls) {
              this.messages.push({
                role: 'tool',
                tool_call_id: t.id,
                content: pendingError,
              })
              this.stream.push({
                type: 'workflow.tool.call.error',
                toolCallResult: {
                  id: t.id,
                  toolName: t.function.name,
                  error: pendingError,
                },
              })
            }
            return { state: 'CALL_LLM' }
          }
          // 其他错误直接抛出
          throw error
        }
        if (reason === 'stop') {
          return { state: 'COMPLETED', result: 'Tool execution stopped the workflow' }
        }
      }
    }
    return { state: 'CALL_LLM' } // or another state based on your logic
  }

  async handleCallTool(toolCall: ToolCall): Promise<ToolResult['reason']> {
    const tool = this.context.tools.find((t) => t.name === toolCall.function.name)
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
