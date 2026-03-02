import { v4 as uuid } from 'uuid'
import { Planner } from './planner'
import { Workflow } from './workflow'
import { generateJSON } from './llm'
import { Thread } from './thread'
import { withRetry } from './utils'

export type PlanStep = {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  description: string
}

export type PlanSessionBlock = {
  type: 'plan'
  plans: PlanStep[]
  thread: Thread
}

export type NormalSessionBlock = {
  type: 'normal'
  thread: Thread
}

export type SessionBlock = PlanSessionBlock | NormalSessionBlock

export const activeSessions: AgentSession[] = []

export class AgentSession {
  sessionId: string = null!
  workflowBlocks: SessionBlock[] = []
  constructor() {
    this.sessionId = uuid()
  }

  async run(userInput: string) {
    try {
      activeSessions.push(this)
      const currentWorkflowType = await this.analyze(userInput)
      if (currentWorkflowType === 'plan') {
        const workflowBlock: PlanSessionBlock = {
          type: 'plan',
          plans: [],
          thread: new Thread({ messages: [] }),
        }
        this.workflowBlocks.push(workflowBlock)
        const planner = new Planner(userInput, workflowBlock)

        const plans = await planner.generatePlan()
        workflowBlock.plans = plans
        await planner.executePlan()
      } else {
        const workflowBlock: NormalSessionBlock = {
          type: 'normal',
          thread: new Thread({ messages: [] }),
        }
        this.workflowBlocks.push(workflowBlock)
        const workflow = new Workflow(workflowBlock)
        await workflow.run(userInput)
      }
    } finally {
      const index = activeSessions.findIndex((i) => i === this)
      if (index !== -1) activeSessions.splice(index, 1)
    }
  }

  private async analyze(userInput: string) {
    const withRetryGenerateJSON = await withRetry(generateJSON)

    const result = (await withRetryGenerateJSON([
      {
        role: 'user',
        content: `Classify task: ${userInput}
Return JSON { "mode": "normal" | "plan" }`,
      },
    ])) as { mode: 'normal' | 'plan' }
    return result.mode
  }

  private generateSessionTitle() {}
}
