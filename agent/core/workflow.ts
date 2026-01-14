import type {
  WorkflowState,
  CallLLMStepPayload,
  CallToolsStepPayload,
  StepPayload,
  StepResult,
  UserInputStepPayload,
  CallToolStepPayload,
} from './types'
import { llmEvent, theadEvent, toolEvent, workflowEvent } from './event'

import type { Thread } from './thread'
import type { LLMService } from './services/llm'
import type { ToolService } from './services/tool'
type ResolveType = { status: 'approved' } | { status: 'rejected'; rejectReason: string }
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

  // 每一次启动都是由 user-input 驱动
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
        this.setState('finished')
        this.workflowEvent.emit('workflow:finished', {
          theadId,
        })
        return
      }

      this.setState(nextStepState.state)
      payload = nextStepState.payload as StepPayload
    }
  }

  async runStep(payload: StepPayload): Promise<StepResult> {
    switch (this.state) {
      case 'user-input':
        return this.stateUserInput(payload as UserInputStepPayload)

      case 'call-llm':
        return this.stateCallLLM(payload as CallLLMStepPayload)

      case 'call-tools':
        return this.stateCallTools(payload as CallToolsStepPayload)

      default:
        throw new Error(`Unknown state: ${this.state}`)
    }
  }

  setState(next: WorkflowState) {
    this.state = next
  }

  async stateUserInput(payload: UserInputStepPayload): Promise<StepResult> {
    this.theadEvent.emit('thead:user-input', { theadId: this.thead.id, input: payload.input })

    this.thead.addMessage({
      role: 'user',
      content: payload.input,
    })

    const callLLMMessages = this.thead.getMessages()
    return { state: 'call-llm', payload: { messages: callLLMMessages } }
  }

  async stateCallLLM(payload: CallLLMStepPayload): Promise<StepResult> {
    this.llmEvent.emit('llm:request:start', {
      theadId: this.thead.id,
      messages: payload.messages,
    })

    const { content, toolCalls, finishReason } = await this.llmService.call(payload.messages)

    this.llmEvent.emit('llm:request:end', { finishReason })

    if (finishReason === 'tool_calls') {
      this.thead.addMessage({ role: 'assistant', tool_calls: toolCalls, content })
      return { state: 'call-tools', payload: { toolCalls } }
    }

    this.thead.addMessage({ role: 'assistant', content })
    return { state: 'finished', payload: { content } }
  }

  async handleCallTool(payload: CallToolStepPayload) {
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
  }

  async stateCallTools(payload: CallToolsStepPayload): Promise<StepResult> {
    const toolCalls = payload.toolCalls
    for (const toolCall of toolCalls) {
      await this.waitHumanApprove(toolCall)
      await this.handleCallTool({ toolCall })
    }

    const callLLMMessages = this.thead.getMessages()
    return { state: 'call-llm', payload: { messages: callLLMMessages } }
  }

  private _resolve: (data: ResolveType) => void = null!

  async humanApprove() {
    this._resolve({ status: 'approved' })
  }

  async humanReject(rejectReason: string) {
    this._resolve({ status: 'rejected', rejectReason })
  }

  async waitHumanApprove(data: any): Promise<ResolveType> {
    return new Promise((resolve) => {
      this._resolve = resolve
      this.workflowEvent.emit('workflow:wait-human-approve', data)
    })
  }
}
