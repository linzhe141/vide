import {
  type AgentMessage,
  type AI,
  type AssistantChatMessage,
  type ChatMessage,
  type Tool,
  type ToolCall,
  createLLMClient,
  processLLMStream as processStream,
} from '@vide/ai'
import type { WorkflowStream } from './stream'
import { AgentSystemPrompt } from '../prompt/system'
import { AbortError } from '../error'

type StepPayload =
  | InputPayload
  | ContextInputPayload
  | CallLLMPayload
  | CallToolsPayload
  | CompletedPayload
  | InterruptPayload

type InputPayload = {
  state: 'INPUT'
  input: string
}
type ContextInputPayload = {
  state: 'CONTEXT_INPUT'
  input: string
}
type CallLLMPayload = {
  state: 'CALL_LLM'
}
type CallToolsPayload = {
  state: 'CALL_TOOLS'
  toolCalls: ToolCall[]
  // 当 需要human approve 时，并且还是串行 存在这下标，表示需要继续执行的toolCall的下标
  continueToolCallIndex?: number
}
type CompletedPayload = {
  state: 'COMPLETED'
}

type InterruptPayload = {
  state: 'INTERRUPT'
  type: 'HUMAN_APPROVE' | 'HUMAN_REJECT'
  reason: string
  context: any
}

export class Workflow {
  state: StepPayload['state'] = 'INPUT'
  messages: AgentMessage[] = []
  ai: AI | null = null
  stepPayload: StepPayload | null = null
  constructor(
    public context: {
      workspacePath: string | null
      sessionId: string
      tools: Tool[]
      signal: AbortSignal
      stream: WorkflowStream
      getSessionAgentMessages: () => AgentMessage[]
      getAutoApprove: () => boolean
    }
  ) {}

  async runLoop(initialPayload: StepPayload) {
    this.stepPayload = initialPayload
    this.state = initialPayload.state
    while (true) {
      const nextStep = await this.runStep()
      if (nextStep.state === 'COMPLETED') {
        break
      } else if (nextStep.state === 'INTERRUPT') {
        // Handle interrupt logic here
        console.log('Workflow interrupted:', nextStep)
        break
      } else {
        this.stepPayload = nextStep
        this.state = nextStep.state
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
      return { state: 'CALL_LLM' } // or another state based on your logic
    } else {
      return { state: 'COMPLETED' }
    }
  }

  async handleCallLLM() {
    const sessionAgentMessages = this.context.getSessionAgentMessages()
    const aiMessages = buildAIMessages([...sessionAgentMessages, ...this.messages])
    if (!this.ai) {
      this.ai = createAIClient({
        name: 'gpt-4o',
        baseURL: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY || '',
      })
    }
    const result = await callAI({
      model: 'gpt-4o',
      ai: this.ai,
      messages: aiMessages,
      tools: this.context.tools,
      signal: this.context.signal,
      events: {},
    })
    return result
  }

  async stateCallTools(): Promise<StepPayload> {
    const payload = this.stepPayload as CallToolsPayload
    let toolCalls = payload.toolCalls
    if (payload.continueToolCallIndex != undefined) {
      toolCalls = toolCalls.slice(payload.continueToolCallIndex)
    }
    if (this.context.getAutoApprove()) {
      return {
        state: 'INTERRUPT',
        type: 'HUMAN_APPROVE',
        reason: 'Waiting for human approval to continue tool calls',
        context: {
          toolCalls: payload.toolCalls,
          continueToolCallIndex: 0,
        },
      }
    }
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
      if (this.context.getAutoApprove()) {
        return {
          state: 'INTERRUPT',
          type: 'HUMAN_APPROVE',
          reason: 'Waiting for human approval to continue tool calls',
          context: {
            toolCalls: payload.toolCalls,
            continueToolCallIndex: i,
          },
        }
      } else {
        // Simulate tool execution
        const toolResult = { id: toolCall.id, result: 'Tool executed successfully' }
        this.messages.push({
          role: 'tool',
          tool_call_id: toolResult.id,
          content: toolResult.result,
        })
        console.log('Tool result:', toolResult)
      }
    }
    return { state: 'CALL_LLM' } // or another state based on your logic
  }
}

type FnCallAI = (data: {
  ai: AI
  model: string
  messages: ChatMessage[]
  tools: Tool[]
  signal: AbortSignal
  events: {
    onReasoningStart?: () => void
    onReasoningDelta?: (chunk: { delta: string; content: string }) => void
    onReasoningEnd?: (content: string) => void

    onTextStart?: () => void
    onTextDelta?: (chunk: { delta: string; content: string }) => void
    onTextEnd?: (content: string) => void

    onToolCallsStart?: () => void
    onToolCallName?: (data: { id: string; name: string }) => void
    onToolCallArguments?: (data: { id: string; arguments: string }) => void
    onToolCallsEnd?: (toolCalls: ToolCall[]) => void
  }
}) => Promise<{ content: string; toolCalls: ToolCall[] }>

export const callAI: FnCallAI = async function ({ ai, model, messages, tools, signal, events }) {
  try {
    console.log('singal in processLLMStream', signal)
    let content = ''
    let toolCalls: ToolCall[] = []

    const stream = ai.chat.completions.create(
      {
        messages,
        model: model,
        stream: true,
        tools,
        reasoning_effort: 'medium',
      },
      { signal }
    )

    for await (const chunk of processStream(stream as any, events)) {
      if ('content' in chunk && chunk.content) {
        content = chunk.content
      }

      if ('tool_calls' in chunk && chunk.tool_calls) {
        toolCalls = chunk.tool_calls
      }
    }
    return { content, toolCalls }
  } catch (error: any) {
    console.error('Error in processLLMStream:', error)
    if (error.name === 'AbortError') {
      console.error('Stream was aborted by user')
      // 统一抛出 AbortError，方便上层捕获和处理
      throw new AbortError()
    }
    console.error('Error in processLLMStream:', error)
    // 其他错误继续往上抛
    throw error
  }
}

function isChatMessage(msg: AgentMessage): msg is ChatMessage {
  // 排除 ContextMessage 的特征
  return (
    msg.role === 'assistant' || msg.role === 'user' || msg.role === 'tool' || msg.role === 'system'
  )
}
function buildAIMessages(messages: AgentMessage[]) {
  const defaultSystemMessage: AgentMessage = {
    role: 'system',
    content: AgentSystemPrompt,
  }
  return [defaultSystemMessage, ...messages.filter(isChatMessage)]
}

interface ModelConfig {
  name: string
  baseURL: string
  apiKey: string
}
function createAIClient(model: ModelConfig) {
  return createLLMClient({ apiKey: model.apiKey, baseURL: model.baseURL })
}
