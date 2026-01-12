import type { StepPayload } from './types'
import { AgentRuntime } from './runtime'

export class Workflow {
  constructor(private agentRuntime: AgentRuntime) {}

  async start(initialPayload: StepPayload) {
    let payload: StepPayload = initialPayload

    while (true) {
      const nextStepState = await this.agentRuntime.runStep(payload)

      if (nextStepState.state === 'finished') {
        this.agentRuntime.transition('finished')
        // just for debugger
        console.log('finished content', nextStepState.payload)
        return
      }

      this.agentRuntime.transition(nextStepState.state)
      payload = nextStepState.payload as StepPayload
    }
  }
}
