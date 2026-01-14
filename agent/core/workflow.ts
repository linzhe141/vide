import type {
  WorkflowState,
  CallLLMStepPayload,
  CallToolsStepPayload,
  StepPayload,
  StepResult,
  UserInputStepPayload,
  CallToolStepPayload,
} from './types'
import { workflowEvent } from './event'
import type { Thread } from './threads'
import type { LLMService } from './services/llm'
import type { ToolService } from './services/tool'

type ResolveType =
  | { status: 'approved' }
  | { status: 'rejected'; rejectReason: string }
  | { status: 'aborted' }

export class Workflow {
  private state: WorkflowState = 'finished'
  private abortController: AbortController | null = null
  private isAborted: boolean = false

  constructor(
    private thread: Thread,
    private llmService: LLMService,
    private toolService: ToolService
  ) {}

  // 每一次启动都是由 user-input 驱动
  async run(threadId: string, initialPayload: UserInputStepPayload) {
    // 重置 abort 状态
    this.isAborted = false
    this.abortController = new AbortController()

    workflowEvent.emit('workflow-start', { threadId, input: initialPayload.input })

    let payload: StepPayload = initialPayload
    if (this.state === 'finished') {
      this.state = 'user-input'
    } else {
      throw new Error('An exception occurred while running workflow')
    }

    try {
      while (true) {
        // 检查是否已被中止
        if (this.isAborted) {
          workflowEvent.emit('workflow-aborted', { threadId })
          this.setState('finished')
          return
        }

        const nextStepState = await this.runStep(payload)

        if (nextStepState.state === 'finished') {
          workflowEvent.emit('workflow-finished', { threadId })

          this.setState('finished')
          return
        }

        this.setState(nextStepState.state)
        payload = nextStepState.payload as StepPayload
      }
    } catch (error) {
      console.log('wrokflow-error', error)
      if (this.isAborted) {
        workflowEvent.emit('workflow-aborted', { threadId })
        this.setState('finished')
        return
      }
      throw error
    } finally {
      this.abortController = null
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
    this.thread.addMessage({
      role: 'user',
      content: payload.input,
    })

    const callLLMMessages = this.thread.getMessages()
    return { state: 'call-llm', payload: { messages: callLLMMessages } }
  }

  async stateCallLLM(payload: CallLLMStepPayload): Promise<StepResult> {
    const { content, toolCalls, finishReason } = await this.llmService.call(
      payload.messages,
      this.abortController!.signal
    )

    if (finishReason === 'tool_calls') {
      this.thread.addMessage({ role: 'assistant', tool_calls: toolCalls, content })
      return { state: 'call-tools', payload: { toolCalls } }
    }

    this.thread.addMessage({ role: 'assistant', content })
    return { state: 'finished', payload: { content } }
  }

  async handleCallTool(payload: CallToolStepPayload) {
    const toolCallRes = await this.toolService.execute(payload.toolCall)

    if (toolCallRes.success) {
      this.thread.addMessage({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: JSON.stringify(toolCallRes.result),
      })
    } else {
      const error = toolCallRes.error
      this.thread.addMessage({
        role: 'tool',
        tool_call_id: payload.toolCall.id,
        content: 'An exception occurred while executing toolCall: ' + String(error),
      })
    }
  }

  async stateCallTools(payload: CallToolsStepPayload): Promise<StepResult> {
    const toolCalls = payload.toolCalls
    for (const toolCall of toolCalls) {
      const approveResult = await this.waitHumanApprove(toolCall)

      if (approveResult.status === 'aborted') {
        throw new Error('Workflow aborted by user')
      }

      if (approveResult.status === 'rejected') {
        continue
      }

      await this.handleCallTool({ toolCall })
    }

    const callLLMMessages = this.thread.getMessages()
    return { state: 'call-llm', payload: { messages: callLLMMessages } }
  }

  private _resolve: ((data: ResolveType) => void) | null = null

  async humanApprove() {
    this._resolve!({ status: 'approved' })
    this._resolve = null
  }

  async humanReject(rejectReason: string) {
    this._resolve!({ status: 'rejected', rejectReason })
    this._resolve = null
  }

  async waitHumanApprove(data: any): Promise<ResolveType> {
    return new Promise((resolve) => {
      this._resolve = resolve
      workflowEvent.emit('workflow-wait-human-approve', data)
    })
  }

  async abort() {
    this.isAborted = true
    if (this.abortController) {
      this.abortController.abort()
    }

    // 中止人工审批等待
    if (this._resolve) {
      this._resolve({ status: 'aborted' })
    }
  }
}
