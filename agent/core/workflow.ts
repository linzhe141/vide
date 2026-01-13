import type { StepPayload, UserInputStepPayload } from './types'
import { AgentRuntime } from './runtime'
import type { Agent } from './agent'

export class Workflow {
  constructor(
    private agent: Agent,
    private agentRuntime: AgentRuntime
  ) {}

  async run(sessionId: string, initialPayload: UserInputStepPayload) {
    this.agent.event.emit('workflow:start', {
      sessionId,
      input: initialPayload.input,
    })

    let payload: StepPayload = initialPayload
    if (this.agentRuntime.state === 'finished') {
      this.agentRuntime.state = 'user-input'
    } else {
      throw new Error('An exception occurred while running workflow')
    }
    while (true) {
      const nextStepState = await this.agentRuntime.runStep(payload)

      if (nextStepState.state === 'finished') {
        this.agentRuntime.transition('finished')
        this.agent.event.emit('workflow:finished', {
          sessionId,
        })
        return
      }

      this.agentRuntime.transition(nextStepState.state)
      payload = nextStepState.payload as StepPayload
    }
  }
}
