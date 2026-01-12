import {
  type ChatCompletionMessageParam,
  type ChatCompletionChunk,
  type ChatCompletionTool,
} from 'openai/resources/chat/completions.mjs'

export type ChatMessage = ChatCompletionMessageParam
export type Tool = ChatCompletionTool & {
  name: string
  executor: (...args: any[]) => any
}

export type FinishReason = ChatCompletionChunk.Choice['finish_reason']

export type ToolCall = {
  function: { arguments: string; name: string }
  id: string
  type: 'function'
}

type AgentState =
  | 'init'
  | 'user-input'
  | 'call-llm'
  | 'call-tool'
  | 'human-approve'
  | 'human-reject'
  | 'finished'

export type UserInputStepPayload = {
  input: string
}

export type CallLLMStepPayload = {
  messages: ChatMessage[]
}

export type CallToolStepPayload = {
  toolCall: ToolCall
}

export type StepPayload =
  | UserInputStepPayload
  | CallLLMStepPayload
  | CallToolStepPayload

interface AgentContext {
  userInput: string | null
  messages: ChatMessage[]
}

export type StreamContentChunk = {
  content: string
  finishReason?: 'stop' | 'tool_calls'
}

export type StreamToolCallsChunk = {
  tool_calls: ToolCall[]
  finishReason: 'tool_calls'
}
export type FnProcessLLMStream = (data: {
  messages: ChatMessage[]
  tools: Tool[]
}) => AsyncGenerator<StreamContentChunk | StreamToolCallsChunk>

export class Agent {
  state: AgentState = 'init'

  context: AgentContext = {
    userInput: null,
    messages: [],
  }

  constructor(
    public processLLMStream: FnProcessLLMStream,
    public tools: Tool[]
  ) {}

  async runStep(payload: StepPayload) {
    switch (this.state) {
      case 'user-input': {
        return this.handleUserInput(payload as UserInputStepPayload)
      }
      case 'call-llm': {
        return this.handleCallLLM(payload as CallLLMStepPayload)
      }

      case 'call-tool': {
        return this.handleCallTool(payload as CallToolStepPayload)
      }
    }
  }

  handleUserInput(payload: UserInputStepPayload) {
    this.context.userInput = payload.input
    console.log('userinput', payload.input)

    this.context.messages.push({
      role: 'user',
      content: payload.input,
    })
    const nextState: {
      state: AgentState
    } = {
      state: 'call-llm',
    }
    return nextState
  }

  async handleCallLLM(payload: CallLLMStepPayload) {
    const llmMessages = payload.messages
    let content = ''
    let toolCalls: ToolCall[] = []
    let finishReason: FinishReason = null
    for await (const chunk of this.processLLMStream({
      messages: llmMessages,
      tools: this.tools,
    })) {
      if ((chunk as StreamContentChunk).content) {
        content = (chunk as StreamContentChunk).content
      } else if ((chunk as StreamToolCallsChunk).tool_calls) {
        toolCalls = (chunk as StreamToolCallsChunk).tool_calls
      }
      if (chunk.finishReason) {
        finishReason = chunk.finishReason
      }
    }
    console.log('llm-content', content)
    console.log('llm-toolCalls', JSON.stringify(toolCalls))
    console.log('llm-finish-reason-->', finishReason)
    finishReason = finishReason ?? 'stop'
    switch (finishReason) {
      case 'stop': {
        this.context.messages.push({
          role: 'assistant',
          content: content,
        })
        const nextState: {
          state: AgentState
          content: string
        } = {
          state: 'finished',
          content,
        }
        return nextState
      }

      case 'tool_calls': {
        this.context.messages.push({
          role: 'assistant',
          tool_calls: toolCalls,
        })
        const nextState: {
          state: AgentState
          toolCalls: ToolCall[]
          content: string
        } = {
          state: 'call-tool',
          toolCalls,
          content,
        }
        return nextState
      }
    }
  }

  async handleCallTool(payload: CallToolStepPayload) {
    const toolName = payload.toolCall.function.name
    const args = payload.toolCall.function.arguments
    console.log('exec tool name', toolName)
    const tool = this.tools.find((i) => i.name === toolName)
    if (!tool) {
      throw new Error('错误')
    }
    try {
      const toolResult = await tool.executor(args)
      console.log('tool result', toolResult)

      this.context.messages.push({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: JSON.stringify(toolResult),
      })
      const nextState: {
        state: AgentState
      } = {
        state: 'call-llm',
      }
      return nextState
    } catch (e) {
      this.context.messages.push({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: 'An exception occurred while executing toolCall.' + String(e),
      })
      const nextState: {
        state: AgentState
      } = {
        state: 'call-llm',
      }
      return nextState
    }
  }
}
