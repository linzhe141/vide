import type { SessionBlock } from './agentSession'
import { processLLMStream } from './llm'
import { getNormalizeTime } from './tools/getNormalizeTime'
import type {
  AssistantChatMessage,
  CallLLMStepPayload,
  CallToolsStepPayload,
  CallToolStepPayload,
  ChatMessage,
  StepPayload,
  Tool,
  ToolCall,
  UserInputStepPayload,
} from './types'

type WorkflowState = 'INPUT' | 'CALL_LLM' | 'CALL_TOOLS' | 'CALL_SINGLE_CALL' | 'COMPLETED'
type NextStep = {
  state: WorkflowState
  payload: StepPayload
}

export class Workflow {
  state: WorkflowState = 'INPUT'
  tools: Tool[] = [getNormalizeTime]
  constructor(public ctx: SessionBlock) {}

  async run(input: string) {
    let payload: StepPayload = { input }
    while (true) {
      const nextStep = await this.runStep(payload)
      if (nextStep.state === 'COMPLETED') {
        console.log('Workflow completed')
        break
      }

      this.state = nextStep.state
      payload = nextStep.payload
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
    this.ctx.thread.addMessage({ role: 'user', content: payload.input })
    const callLLMMessages = this.ctx.thread.getMessages()
    return {
      state: 'CALL_LLM',
      payload: {
        messages: callLLMMessages,
      },
    }
  }

  async handleCallLLM(messages: ChatMessage[]) {
    let content = ''
    let toolCalls: ToolCall[] = []

    const llmAbortController = new AbortController()

    for await (const chunk of processLLMStream({
      messages,
      tools: this.tools,
      signal: llmAbortController.signal,
    })) {
      if ('content' in chunk && chunk.content) {
        content = chunk.content
      }

      if ('tool_calls' in chunk && chunk.tool_calls) {
        toolCalls = chunk.tool_calls
      }
    }

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
    this.ctx.thread.addMessage(assistantMessage)

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

  async handleCallTool(toolCall: ToolCall) {
    const toolName = toolCall.function.name
    const args = JSON.parse(toolCall.function.arguments || '{}')
    const tool = this.tools.find((t) => t.name === toolName)

    async function execute() {
      if (!tool) {
        return { success: false, error: `Tool not found: ${toolName}` }
      }
      try {
        const result = await tool.executor(args)

        return { success: true, result }
      } catch (error) {
        return { success: false, error }
      }
    }

    const toolResult = await execute()
    if (toolResult.success) {
      this.ctx.thread.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult.result),
      })
    } else {
      const error = toolResult.error
      this.ctx.thread.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: 'An exception occurred while executing toolCall: ' + String(error),
      })
    }
  }

  async stateCallSingleCall(payload: CallToolStepPayload): Promise<NextStep> {
    const toolCalls = payload.toolCalls
    const index = payload.index
    const toolCall = toolCalls[index]
    await this.handleCallTool(toolCall)
    if (index + 1 < toolCalls.length) {
      return { state: 'CALL_SINGLE_CALL', payload: { toolCalls, index: index + 1 } }
    } else {
      const callLLMMessages = this.ctx.thread.getMessages()

      return { state: 'CALL_LLM', payload: { messages: callLLMMessages } }
    }
  }
}
