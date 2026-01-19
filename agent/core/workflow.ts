import type {
  WorkflowState,
  CallLLMStepPayload,
  CallToolsStepPayload,
  StepPayload,
  StepResult,
  UserInputStepPayload,
  CallToolStepPayload,
  ToolCall,
} from './types'
import { workflowEvent } from './event'
import type { Thread } from './threads'
import type { LLMService } from './services/llm'
import type { ToolService } from './services/tool'

export class Workflow {
  private state: WorkflowState = 'finished'
  private abortController: AbortController | null = null
  private isAborted: boolean = false
  // for wait human approve to resume workflow
  private nextStep: StepResult | null = null

  constructor(
    private thread: Thread,
    private llmService: LLMService,
    private toolService: ToolService
  ) {}

  // 每一次启动都是由 user-input 驱动
  async start(threadId: string, initialPayload: UserInputStepPayload) {
    if (this.state === 'finished') {
      this.state = 'user-input'
    } else {
      throw new Error('An exception occurred while running workflow')
    }

    // 重置 abort 状态
    this.isAborted = false
    this.abortController = new AbortController()
    workflowEvent.emit('workflow-start', { threadId, input: initialPayload.input })

    this.run(threadId, initialPayload)
  }

  async humanApproveToolCall() {
    if (this.nextStep) {
      this.setState(this.nextStep.state)
      this.run(this.thread.id, this.nextStep.payload)
    } else {
      throw new Error('An exception occurred while running workflow')
    }
  }
  async run(threadId: string, payload: StepPayload) {
    try {
      while (true) {
        if (this.isAborted) {
          this.setState('finished')
          return
        }
        const nextStepState = await this.runStep(payload)

        if (nextStepState.state === 'wait-human-approve') {
          workflowEvent.emit('workflow-wait-human-approve', { threadId })
          return
        }

        if (nextStepState.state === 'finished') {
          workflowEvent.emit('workflow-finished', { threadId })

          this.setState('finished')
          return
        }

        this.setState(nextStepState.state)
        payload = nextStepState.payload as StepPayload
      }
    } catch (error) {
      console.log('Workflow run error:', error)
    }
    this.abortController = null
  }

  async runStep(payload: StepPayload): Promise<StepResult> {
    switch (this.state) {
      case 'user-input':
        return this.stateUserInput(payload as UserInputStepPayload)

      case 'call-llm':
        return this.stateCallLLM(payload as CallLLMStepPayload)

      case 'call-tools':
        return this.stateCallTools(payload as CallToolsStepPayload)

      case 'call-tool':
        return this.stateCallTool(payload as CallToolStepPayload)

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

  async handleCallTool(toolCall: ToolCall) {
    const toolCallRes = await this.toolService.execute(toolCall)

    if (toolCallRes.success) {
      this.thread.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolCallRes.result),
      })
    } else {
      const error = toolCallRes.error
      this.thread.addMessage({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: 'An exception occurred while executing toolCall: ' + String(error),
      })
    }
  }

  async stateCallTool(payload: CallToolStepPayload): Promise<StepResult> {
    const toolCalls = payload.toolCalls
    const index = payload.index
    const toolCall = toolCalls[index]
    const hasApproved = payload.approved

    if (!hasApproved) {
      // 等待用户批准
      // 默认批准当前工具调用
      this.nextStep = { state: 'call-tool', payload: { index, toolCalls, approved: true } }
      return {
        state: 'wait-human-approve',
        payload: {
          nextStep: this.nextStep,
        },
      }
    }
    await this.handleCallTool(toolCall)
    if (index + 1 < toolCalls.length) {
      return {
        state: 'call-tool',
        payload: { index: index + 1, toolCalls },
      }
    } else {
      const callLLMMessages = this.thread.getMessages()
      return { state: 'call-llm', payload: { messages: callLLMMessages } }
    }
  }

  async stateCallTools(payload: CallToolsStepPayload): Promise<StepResult> {
    const toolCalls = payload.toolCalls

    return {
      state: 'call-tool',
      payload: { index: 0, toolCalls, approved: false },
    }
  }

  async abort() {
    console.log('todo abort')
    this.isAborted = true
    if (this.abortController) {
      this.abortController.abort()
      workflowEvent.emit('workflow-aborted', { threadId: this.thread.id })
    }
  }
}
