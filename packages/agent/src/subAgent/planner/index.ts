import { defineTool } from '../../tools/toolProvider'
import type { PlanStep } from '../../types'
import { SubAgent } from '..'
import { v4 as uuid } from 'uuid'
import { getPrompt } from './prompt'
import type { Tool } from '@vide/ai'
import type { WorkflowRuntimeContext } from '../../workflow'
import { Grep } from '../../tools/grep'
import { Read } from '../../tools/fileRead'
import type { WorkflowPlugin } from '../../plugin'

export const PLANNER_TOOL_NAMES = {
  SUBMIT_PLAN: `submit-plan`,
} as const

export class PlannerAgent extends SubAgent {
  name = 'planner'
  prompt = getPrompt()
  description = 'Creates implementation plans from context and requirements'

  plan: PlanStep[] = []
  executionMode = false

  plugins: WorkflowPlugin[] = [
    {
      name: 'planner-plugin',
      beforeWorkflowStart: async (_input, runtime) => {
        const todos = this.plan.filter((i) => i.status !== 'completed')
        if (todos.length > 0) {
          runtime.workflowMessages.addContextMessage(
            'planner',
            `[EXECUTING PLAN - Full tool access enabled]

Remaining steps:
${todos.map((i, index) => `[${index + 1}] ${i.description}`).join('\n')}

Execute each step in order.
After completing a step, include a [DONE:n] tag in your response.`
          )
        }
      },
      afterWorkflowEnd: async (content, runtime) => {
        if (this.executionMode) {
          const doneTagMatch = content.match(/\[DONE:(\d+)\]/)
          if (doneTagMatch) {
            const doneIndex = parseInt(doneTagMatch[1], 10) - 1
            if (doneIndex >= 0 && doneIndex < this.plan.length) {
              this.plan[doneIndex].status = 'completed'
            }
          }
          const hasCompletedAllSteps = this.plan.every((step) => step.status === 'completed')
          if (hasCompletedAllSteps) {
            this.executionMode = false
            this.plan = []
          } else {
            // start the plan step
            const firstPendingStep = this.plan.find((step) => step.status !== 'completed')
            if (firstPendingStep) {
              firstPendingStep.status = 'pending'
              runtime.workflow.run(firstPendingStep.description)
            }
          }
        }
      },
    },
  ]

  registerTools(workflowRuntimeContext: WorkflowRuntimeContext): Tool[] {
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
      this.executionMode = true
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
