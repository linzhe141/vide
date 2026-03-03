import type { AgentSession, SessionBlock } from './agentSession'
import { processLLMStream } from './llm'
import { getNormalizeTime } from './tools/getNormalizeTime'
import { v4 as uuid } from 'uuid'

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
import type { WorkflowEventCtx } from './event/channels'

type WorkflowState = 'INPUT' | 'CALL_LLM' | 'CALL_TOOLS' | 'CALL_SINGLE_CALL' | 'COMPLETED'
type NextStep = {
  state: WorkflowState
  payload: StepPayload
}

export class Workflow {
  state: WorkflowState = 'INPUT'
  tools: Tool[] = [getNormalizeTime]
  id: string = ''
  constructor(
    public ctx: {
      session: AgentSession
      sessionBlock: SessionBlock
    }
  ) {
    this.id = uuid()
  }

  get eventCtx() {
    const eventCtx: WorkflowEventCtx = {
      sessionId: this.ctx.session.sessionId,
      workflowId: this.id,
    }
    if (this.ctx.sessionBlock.type === 'plan') {
      eventCtx.planId = this.ctx.sessionBlock.planId
    }
    return eventCtx
  }

  async run(input: string) {
    try {
      workflowEvent.emit('workflow-start', { input, ctx: this.eventCtx })
      let payload: StepPayload = { input } as UserInputStepPayload
      while (true) {
        const nextStep = await this.runStep(payload)
        if (nextStep.state === 'COMPLETED') {
          workflowEvent.emit('workflow-finished', { ctx: this.eventCtx })

          break
        }

        this.state = nextStep.state
        payload = nextStep.payload
      }
    } catch (error: any) {
      workflowEvent.emit('workflow-error', { error, ctx: this.eventCtx })
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
    this.ctx.sessionBlock.thread.addMessage({ role: 'user', content: payload.input })
    const callLLMMessages = this.ctx.sessionBlock.thread.getMessages()
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
    workflowEvent.emit('workflow-llm-start', { ctx: this.eventCtx, messages })

    for await (const chunk of processLLMStream({
      messages,
      tools: this.tools,
      signal: llmAbortController.signal,
      onTextStart: () => {
        workflowEvent.emit('workflow-llm-text-start', { ctx: this.eventCtx })
      },
      onTextDelta: (chunk) => {
        workflowEvent.emit('workflow-llm-text-delta', { ctx: this.eventCtx, chunk })
      },
      onTextEnd: () => {
        workflowEvent.emit('workflow-llm-text-end', { ctx: this.eventCtx })
      },
      onToolCalls: (toolCalls) => {
        workflowEvent.emit('workflow-llm-tool-calls', { ctx: this.eventCtx, toolCalls })
      },
      onError: (error) => {
        workflowEvent.emit('workflow-llm-error', { ctx: this.eventCtx, error })
      },
    })) {
      if ('content' in chunk && chunk.content) {
        content = chunk.content
      }

      if ('tool_calls' in chunk && chunk.tool_calls) {
        toolCalls = chunk.tool_calls
      }
    }
    workflowEvent.emit('workflow-llm-end', { ctx: this.eventCtx })

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
    this.ctx.sessionBlock.thread.addMessage(assistantMessage)

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
      ctx: this.eventCtx,
      toolCall: { id: toolCall.id, toolName, args },
    })
    const toolResult = await execute()
    if (toolResult.success) {
      this.ctx.sessionBlock.thread.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult.result),
      })

      workflowEvent.emit('workflow-tool-call-success', {
        ctx: this.eventCtx,
        toolCallResult: { id: toolCall.id, toolName, result: toolResult.result },
      })
    } else {
      const error = toolResult.error
      this.ctx.sessionBlock.thread.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: 'An exception occurred while executing toolCall: ' + String(error),
      })

      workflowEvent.emit('workflow-tool-call-error', {
        ctx: this.eventCtx,
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
      const callLLMMessages = this.ctx.sessionBlock.thread.getMessages()

      return { state: 'CALL_LLM', payload: { messages: callLLMMessages } }
    }
  }
}
