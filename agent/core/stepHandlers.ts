import type { Agent } from './agent'
import type { Session } from './session'
import type {
  CallLLMStepPayload,
  CallToolStepPayload,
  StepResult,
  UserInputStepPayload,
} from './types'

export class AgentStepHandlers {
  constructor(
    private agent: Agent,
    private session: Session
  ) {}

  get ctx() {
    return this.agent.ctx
  }

  get sessionsManager() {
    return this.ctx.agent.sessionsManager
  }

  get llmService() {
    return this.ctx.agent.llmService
  }

  get toolService() {
    return this.ctx.agent.toolService
  }

  async handleUserInput(payload: UserInputStepPayload): Promise<StepResult> {
    this.agent.event.emit('session:user-input', {
      sessionId: this.session.id,
      input: payload.input,
    })

    this.session.addMessage({
      role: 'user',
      content: payload.input,
    })

    const callLLMMessages = this.session.getMessages()
    return {
      state: 'call-llm',
      payload: {
        messages: callLLMMessages,
      },
    }
  }

  async handleCallLLM(payload: CallLLMStepPayload): Promise<StepResult> {
    this.agent.event.emit('llm:request:start', {
      sessionId: this.session.id,
      messages: payload.messages,
    })

    const { content, toolCalls, finishReason } = await this.llmService.call(
      payload.messages
    )

    this.agent.event.emit('llm:request:end', {
      finishReason,
    })

    if (finishReason === 'tool_calls') {
      this.session.addMessage({
        role: 'assistant',
        tool_calls: toolCalls,
        content,
      })
      // todo
      return {
        state: 'call-tool',
        payload: {
          toolCall: toolCalls[0],
        },
      }
    }

    this.session.addMessage({
      role: 'assistant',
      content,
    })
    return {
      state: 'finished',
      payload: { content },
    }
  }

  async handleCallTool(payload: CallToolStepPayload): Promise<StepResult> {
    this.agent.event.emit('tool:call:start', {
      sessionId: this.session.id,
      toolName: payload.toolCall.function.name,
      args: payload.toolCall.function.arguments,
    })

    try {
      const result = await this.toolService.execute(payload.toolCall)

      this.session.addMessage({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: JSON.stringify(result),
      })

      this.agent.event.emit('tool:call:success', {
        sessionId: this.session.id,
        toolName: payload.toolCall.function.name,
        result: result,
      })
    } catch (e) {
      this.session.addMessage({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: 'An exception occurred while executing toolCall: ' + String(e),
      })

      this.agent.event.emit('tool:call:error', {
        sessionId: this.session.id,
        toolName: payload.toolCall.function.name,
        error: e as Error,
      })
    }

    const callLLMMessages = this.session.getMessages()
    return {
      state: 'call-llm',
      payload: {
        messages: callLLMMessages,
      },
    }
  }
}
