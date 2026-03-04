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
import { workflowEvent } from './event'
import type { WorkflowRuntimeContext } from './workflowRuntimeContext'

type WorkflowState = 'INPUT' | 'CALL_LLM' | 'CALL_TOOLS' | 'CALL_SINGLE_CALL' | 'COMPLETED'
type NextStep = {
  state: WorkflowState
  payload: StepPayload
}

export class Workflow {
  state: WorkflowState = 'INPUT'
  tools: Tool[] = [getNormalizeTime]
  constructor(public runtime: WorkflowRuntimeContext) {}

  async run(input: string) {
    try {
      workflowEvent.emit('workflow-start', { input, ctx: this.runtime.workflowEventCtx })
      let payload: StepPayload = { input } as UserInputStepPayload
      while (true) {
        const nextStep = await this.runStep(payload)
        if (nextStep.state === 'COMPLETED') {
          workflowEvent.emit('workflow-finished', { ctx: this.runtime.workflowEventCtx })

          break
        }

        this.state = nextStep.state
        payload = nextStep.payload
      }
    } catch (error: any) {
      workflowEvent.emit('workflow-error', { error, ctx: this.runtime.workflowEventCtx })
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
    this.runtime.thread.addMessage({ role: 'user', content: payload.input })
    const callLLMMessages = this.runtime.thread.getMessages()
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
    workflowEvent.emit('workflow-llm-start', { ctx: this.runtime.workflowEventCtx, messages })

    for await (const chunk of processLLMStream({
      messages,
      tools: this.tools,
      signal: llmAbortController.signal,
      onTextStart: () => {
        workflowEvent.emit('workflow-llm-text-start', { ctx: this.runtime.workflowEventCtx })
      },
      onTextDelta: (chunk) => {
        workflowEvent.emit('workflow-llm-text-delta', { ctx: this.runtime.workflowEventCtx, chunk })
      },
      onTextEnd: () => {
        workflowEvent.emit('workflow-llm-text-end', { ctx: this.runtime.workflowEventCtx })
      },
      onToolCallsEnd: (toolCalls) => {
        workflowEvent.emit('workflow-llm-tool-calls-end', {
          ctx: this.runtime.workflowEventCtx,
          toolCalls,
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
    this.runtime.thread.addMessage(assistantMessage)

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

    const execute = async () => {
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

    workflowEvent.emit('workflow-tool-call-start', {
      ctx: this.runtime.workflowEventCtx,
      toolCall: { id: toolCall.id, toolName, args },
    })
    const toolResult = await execute()
    if (toolResult.success) {
      this.runtime.thread.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult.result),
      })

      workflowEvent.emit('workflow-tool-call-success', {
        ctx: this.runtime.workflowEventCtx,
        toolCallResult: { id: toolCall.id, toolName, result: toolResult.result },
      })
    } else {
      const error = toolResult.error
      this.runtime.thread.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: 'An exception occurred while executing toolCall: ' + String(error),
      })

      workflowEvent.emit('workflow-tool-call-error', {
        ctx: this.runtime.workflowEventCtx,
        toolCallResult: { id: toolCall.id, toolName, error },
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
      const callLLMMessages = this.runtime.thread.getMessages()

      return { state: 'CALL_LLM', payload: { messages: callLLMMessages } }
    }
  }
}
