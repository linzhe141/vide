import type { StepPayload } from './types'
import { AgentRuntime } from './runtime'

export class WorkflowEngine {
  constructor(private agent: AgentRuntime) {}

  async start(initialPayload: StepPayload) {
    let payload: StepPayload = initialPayload

    while (true) {
      const result = await this.agent.runStep(payload)

      if (result.state === 'finished') {
        this.agent.transition('finished')
        return
      }

      this.agent.transition(result.state)
      payload = result.payload as StepPayload
    }
  }
}
