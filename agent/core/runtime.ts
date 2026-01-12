import type {
  AgentState,
  StepPayload,
  StepResult,
  UserInputStepPayload,
  CallLLMStepPayload,
  CallToolStepPayload,
} from './types'
import { AgentStepHandlers } from './stepHandlers'

export class AgentRuntime {
  state: AgentState = 'user-input'

  constructor(private handlers: AgentStepHandlers) {}

  async runStep(payload: StepPayload): Promise<StepResult> {
    switch (this.state) {
      case 'user-input':
        return this.handlers.handleUserInput(payload as UserInputStepPayload)

      case 'call-llm':
        return this.handlers.handleCallLLM(payload as CallLLMStepPayload)

      case 'call-tool':
        return this.handlers.handleCallTool(payload as CallToolStepPayload)

      case 'finished':
        return { state: 'finished' }

      default:
        throw new Error(`Unknown state: ${this.state}`)
    }
  }

  transition(next: AgentState) {
    this.state = next
  }
}
