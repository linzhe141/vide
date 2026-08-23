import type { Tool } from '@vide/ai'
import { v4 as uuid } from 'uuid'
import { SubAgent } from '..'
import { getPrompt } from './prompt'
import type { CompletedPayload, WorkflowRuntimeContext } from '../../workflow'
import type { WorkflowPlugin } from '../../plugin'
import { Grep } from '../../tools/grep'
import { Read } from '../../tools/fileRead'
import { defineTool } from '../../tools/toolProvider'

export interface PlanStep {
  id: string
  description: string
}

export const PLANNER_TOOL_NAMES = {
  SUBMIT_PLAN: `submit-plan`,
} as const

export class PlannerAgent extends SubAgent {
  name = 'planner'
  prompt = getPrompt()
  description = 'Explores context with read-only tools and returns a concrete execution plan'

  plan: PlanStep[] = []
  planText = ''

  plugins: WorkflowPlugin[] = [
    {
      name: 'planner-system-prompt',
      beforeWorkflowStart: async (payload, runtime) => {
        runtime.addMessage({
          role: 'system',
          content: this.prompt,
        })
        return payload
      },
      beforeWorkflowFinish: async (payload) => {
        return this.overrideCompletedResult(payload)
      },
    },
  ]

  private buildPlanText() {
    return [
      'Planner execution plan:',
      ...this.plan.map((step, index) => `${index + 1}. ${step.description}`),
    ].join('\n')
  }

  private overrideCompletedResult(payload: CompletedPayload) {
    if (!this.planText.trim()) {
      return payload
    }

    return {
      state: 'COMPLETED' as const,
      result: this.planText,
    }
  }

  registerTools(workflowRuntimeContext: WorkflowRuntimeContext): Tool[] {
    const grep = new Grep(workflowRuntimeContext)
    const read = new Read(workflowRuntimeContext)

    return [grep.search, read.readFile, this.createSubmitPlanTool()]
  }

  private createSubmitPlanTool() {
    return defineTool({
      name: PLANNER_TOOL_NAMES.SUBMIT_PLAN,
      type: 'function',
      function: {
        name: PLANNER_TOOL_NAMES.SUBMIT_PLAN,
        description: `
Submit a complete execution plan in one call.

Use this after you have explored enough context with the read-only tools.
Each step must be atomic, sequential, and executable by the main agent.
        `.trim(),
        parameters: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              description: 'Ordered list of plan step descriptions.',
              items: { type: 'string' },
            },
          },
          required: ['steps'],
        },
      },
      executor: async (args: { steps?: unknown } = {}) => {
        const stepDescriptions = Array.isArray(args.steps)
          ? args.steps.filter(
              (step): step is string => typeof step === 'string' && step.trim().length > 0
            )
          : []

        const planSteps: PlanStep[] = stepDescriptions.map((description) => ({
          id: uuid(),
          description: description.trim(),
        }))

        this.plan = planSteps
        this.planText = this.buildPlanText()

        return {
          reason: 'call-llm',
          result: {
            content: this.planText,
            plan: this.plan.map((step) => ({ ...step })),
          },
        }
      },
    })
  }
}
