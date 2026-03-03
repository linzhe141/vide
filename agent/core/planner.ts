import { type AgentSession, type PlanSessionBlock, type PlanStep } from './agentSession'
import { v4 as uuid } from 'uuid'
import { Workflow } from './workflow'
import { generateJSON } from './llm'
import { withRetry } from './utils'
import { plannerEvent } from './event'
import { WorkflowRuntimeContext } from './workflowRuntimeContext'

export class Planner {
  userInput: string
  id: string
  planSteps: PlanStep[] = []
  runtime: WorkflowRuntimeContext
  constructor(
    public session: AgentSession,
    userInput: string,
    workflowBlock: PlanSessionBlock
  ) {
    this.id = uuid()
    this.userInput = userInput
    workflowBlock.planId = this.id

    this.runtime = new WorkflowRuntimeContext({
      session,
      sessionBlock: workflowBlock,
      plannerId: this.id,
    })
  }

  async generatePlan(): Promise<PlanStep[]> {
    plannerEvent.emit('planner-start-generate', {
      sessionId: this.session.sessionId,
      plannerId: this.id,
    })

    const withRetryGenerateJSON = await withRetry(generateJSON)
    const result = (await withRetryGenerateJSON([
      {
        role: 'system',
        content: `
You are a professional AI planning assistant.

Your task:
Based on the user's input, generate a clear, structured execution plan.

Rules:
1. The plan must be broken into logical, atomic steps.
2. Each step must be executable and actionable.
3. Do NOT include explanations.
4. Do NOT include markdown.
5. Only return a JSON array.
6. Each step must follow this exact structure:

{
  "description": string
}

7. The steps should be ordered logically.
8. Avoid vague steps like "think more deeply".
9. If the task involves generating a document (e.g., Word report),
   include analysis, data gathering, structuring, drafting, and review phases.

Output format example:

[
  { "description": "Analyze the user requirements." },
  { "description": "Identify required data sources." },
  { "description": "Draft the report outline." }
]
`,
      },
      {
        role: 'user',
        content: this.userInput,
      },
    ])) as { description: string }[]

    const plans: PlanStep[] = result.map((step) => ({
      id: uuid(),
      status: 'pending',
      description: step.description,
    }))

    plannerEvent.emit('planner-end-generate', {
      sessionId: this.session.sessionId,
      plannerId: this.id,
      plans,
    })

    this.planSteps = plans
    return plans
  }

  async executePlan() {
    for (const plan of this.planSteps) {
      plan.status = 'running'

      plannerEvent.emit('planner-execute-item-start', {
        sessionId: this.session.sessionId,
        plannerId: this.id,
        plan,
      })

      try {
        const workflow = new Workflow(this.runtime)

        await workflow.run(plan.description)

        plan.status = 'completed'

        plannerEvent.emit('planner-execute-item-success', {
          sessionId: this.session.sessionId,
          plannerId: this.id,
          plan,
        })
      } catch (error: any) {
        console.error(`Error executing plan: ${plan.description}`, error)
        plan.status = 'failed'

        plannerEvent.emit('planner-execute-item-error', {
          sessionId: this.session.sessionId,
          plannerId: this.id,
          plan,
        })
      }
    }
  }
}
