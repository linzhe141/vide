import type { AgentContext } from './context'
import type { Session } from './session'
import type {
  CallLLMStepPayload,
  CallToolStepPayload,
  StepResult,
  UserInputStepPayload,
} from './types'

export class AgentStepHandlers {
  constructor(
    private ctx: AgentContext,
    private session: Session
  ) {}

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
    const { content, toolCalls, finishReason } = await this.llmService.call(
      payload.messages
    )

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
    try {
      const result = await this.toolService.execute(payload.toolCall)

      this.session.addMessage({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: JSON.stringify(result),
      })
    } catch (e) {
      this.session.addMessage({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: 'An exception occurred while executing toolCall: ' + String(e),
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
