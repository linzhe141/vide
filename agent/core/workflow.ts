import type {
  WorkflowState,
  CallLLMStepPayload,
  CallToolStepPayload,
  StepPayload,
  StepResult,
  UserInputStepPayload,
} from './types'
import { llmEvent, theadEvent, toolEvent, workflowEvent } from './event'

import type { Thread } from './thread'
import type { LLMService } from './services/llm'
import type { ToolService } from './services/tool'

export class Workflow {
  private state: WorkflowState = 'finished'
  private workflowEvent = workflowEvent
  private llmEvent = llmEvent
  private toolEvent = toolEvent
  private theadEvent = theadEvent

  constructor(
    private thead: Thread,
    private llmService: LLMService,
    private toolService: ToolService
  ) {}

  async run(theadId: string, initialPayload: UserInputStepPayload) {
    this.workflowEvent.emit('workflow:start', {
      theadId,
      input: initialPayload.input,
    })

    let payload: StepPayload = initialPayload
    if (this.state === 'finished') {
      this.state = 'user-input'
    } else {
      throw new Error('An exception occurred while running workflow')
    }
    while (true) {
      const nextStepState = await this.runStep(payload)

      if (nextStepState.state === 'finished') {
        this.transition('finished')
        this.workflowEvent.emit('workflow:finished', {
          theadId,
        })
        return
      }

      this.transition(nextStepState.state)
      payload = nextStepState.payload as StepPayload
    }
  }

  async runStep(payload: StepPayload): Promise<StepResult> {
    switch (this.state) {
      case 'user-input':
        return this.handleUserInput(payload as UserInputStepPayload)

      case 'call-llm':
        return this.handleCallLLM(payload as CallLLMStepPayload)

      case 'call-tool':
        return this.handleCallTool(payload as CallToolStepPayload)

      default:
        throw new Error(`Unknown state: ${this.state}`)
    }
  }

  transition(next: WorkflowState) {
    this.state = next
  }

  async handleUserInput(payload: UserInputStepPayload): Promise<StepResult> {
    this.theadEvent.emit('thead:user-input', {
      theadId: this.thead.id,
      input: payload.input,
    })

    this.thead.addMessage({
      role: 'user',
      content: payload.input,
    })

    const callLLMMessages = this.thead.getMessages()
    return {
      state: 'call-llm',
      payload: {
        messages: callLLMMessages,
      },
    }
  }

  async handleCallLLM(payload: CallLLMStepPayload): Promise<StepResult> {
    this.llmEvent.emit('llm:request:start', {
      theadId: this.thead.id,
      messages: payload.messages,
    })

    const { content, toolCalls, finishReason } = await this.llmService.call(payload.messages)

    this.llmEvent.emit('llm:request:end', {
      finishReason,
    })

    if (finishReason === 'tool_calls') {
      this.thead.addMessage({
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

    this.thead.addMessage({
      role: 'assistant',
      content,
    })
    return {
      state: 'finished',
      payload: { content },
    }
  }

  async handleCallTool(payload: CallToolStepPayload): Promise<StepResult> {
    this.toolEvent.emit('tool:call:start', {
      theadId: this.thead.id,
      toolName: payload.toolCall.function.name,
      args: payload.toolCall.function.arguments,
    })

    try {
      const result = await this.toolService.execute(payload.toolCall)

      this.thead.addMessage({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: JSON.stringify(result),
      })

      this.toolEvent.emit('tool:call:success', {
        theadId: this.thead.id,
        toolName: payload.toolCall.function.name,
        result: result,
      })
    } catch (e) {
      this.thead.addMessage({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: 'An exception occurred while executing toolCall: ' + String(e),
      })

      this.toolEvent.emit('tool:call:error', {
        theadId: this.thead.id,
        toolName: payload.toolCall.function.name,
        error: e as Error,
      })
    }

    const callLLMMessages = this.thead.getMessages()
    return {
      state: 'call-llm',
      payload: {
        messages: callLLMMessages,
      },
    }
  }
}
