import type { AgentContext } from './context'
import type { LLMService } from './llmService'
import type { ToolService } from './toolService'
import type {
  CallLLMStepPayload,
  CallToolStepPayload,
  StepResult,
  UserInputStepPayload,
} from './types'

export class AgentStepHandlers {
  constructor(
    private ctx: AgentContext,
    private llmService: LLMService,
    private toolService: ToolService
  ) {}

  async handleUserInput(payload: UserInputStepPayload): Promise<StepResult> {
    this.ctx.userInput = payload.input
    this.ctx.messages.push({
      role: 'user',
      content: payload.input,
    })

    return {
      state: 'call-llm',
      payload: {
        messages: this.ctx.messages,
      },
    }
  }

  async handleCallLLM(payload: CallLLMStepPayload): Promise<StepResult> {
    const { content, toolCalls, finishReason } = await this.llmService.call(
      payload.messages
    )

    if (finishReason === 'tool_calls') {
      this.ctx.messages.push({
        role: 'assistant',
        tool_calls: toolCalls,
      })

      return {
        state: 'call-tool',
        payload: {
          toolCall: toolCalls[0],
        },
      }
    }

    this.ctx.messages.push({
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

      this.ctx.messages.push({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: JSON.stringify(result),
      })
    } catch (e) {
      this.ctx.messages.push({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: 'An exception occurred while executing toolCall: ' + String(e),
      })
    }

    return {
      state: 'call-llm',
      payload: {
        messages: this.ctx.messages,
      },
    }
  }
}
