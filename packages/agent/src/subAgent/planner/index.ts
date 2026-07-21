import { defineTool } from '../../tools/toolProvider'
import type { PlanStep } from '../../types'
import { SubAgent } from '..'
import { v4 as uuid } from 'uuid'
import { prompt } from './prompt'
import type { Tool } from '@vide/ai'
import type { WorkflowRuntimeContextNew } from '../../workflow'
import { Grep } from '../../tools/grep'
import { Read } from '../../tools/fileRead'

export const PLANNER_TOOL_NAMES = {
  SUBMIT_PLAN: `submit-plan`,
} as const

export class PlannerAgent extends SubAgent {
  name = 'planner'
  prompt = prompt()
  description = 'Creates implementation plans from context and requirements'

  plan: PlanStep[] = []

  registerTools(workflowRuntimeContext: WorkflowRuntimeContextNew): Tool[] {
    // only read level tools
    const grep = new Grep(workflowRuntimeContext)
    const read = new Read(workflowRuntimeContext)

    return [grep.search, read.readFile, this.submitPlanTool]
  }

  private submitPlanTool = defineTool({
    name: PLANNER_TOOL_NAMES.SUBMIT_PLAN,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.SUBMIT_PLAN,
      description: `
Submit a complete execution plan in ONE call.

Use this when the task requires multiple sequential steps or tool usage.
Do NOT use for simple questions answerable in a single step.

Each step should be ONE atomic, sequential action that moves the task toward the goal.

Returns a plannerId and the created steps (with ids).
`,
      parameters: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            description: 'Ordered list of step descriptions. Each item is one atomic action.',
            items: { type: 'string' },
          },
        },
        required: ['steps'],
      },
    },
    executor: async (args) => {
      const steps: string[] = Array.isArray(args?.steps) ? args.steps : []
      const planSteps: PlanStep[] = steps.map((description) => ({
        id: uuid(),
        status: 'pending',
        description,
      }))

      this.plan = planSteps

      return {
        reason: 'call-llm',
        result: {
          content: `Plan submitted. plan steps=${planSteps.length}`,
          plans: planSteps,
        },
      }
    },
  })
}
