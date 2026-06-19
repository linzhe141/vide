import { randomUUID } from 'node:crypto'
import { plannerEvent } from '../../event'
import { SessionPlaner } from '../../session'
import { defineTool, ToolProvider } from '../toolProvider'
import { ToolCallError } from '../../error'

export type PlanStep = {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  description: string
}

export const PLANNER_TOOL_NAMES = {
  SUBMIT_PLAN: `submit-plan`,
  UPDATE_PLAN_STEP: `update-plan-step`,
} as const

export class Planner extends ToolProvider {
  submitPlan = defineTool({
    name: PLANNER_TOOL_NAMES.SUBMIT_PLAN,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.SUBMIT_PLAN,
      description: `
Submit a complete execution plan in ONE call.

Use this when the task requires multiple sequential steps or tool usage.
Do NOT use for simple questions answerable in a single step.

Each step should be ONE atomic, sequential action that moves the task toward the goal.

Returns a plannerId and the created steps (with ids). Use those step ids with ${PLANNER_TOOL_NAMES.UPDATE_PLAN_STEP} as you execute.
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
        id: randomUUID(),
        status: 'pending',
        description,
      }))

      const sessionPlaner = new SessionPlaner(planSteps)
      this.runtime.rootSession.planners.push(sessionPlaner)

      plannerEvent.emit('planner-end-generate', {
        sessionId: this.runtime.sessionId,
        plannerId: sessionPlaner.id,
        plans: planSteps,
      })

      return {
        reason: 'call-llm',
        result: {
          content: `Plan submitted. plannerId=${sessionPlaner.id}, steps=${planSteps.length}`,
          plannerId: sessionPlaner.id,
          plans: planSteps,
        },
      }
    },
  })

  updatePlanStep = defineTool({
    name: PLANNER_TOOL_NAMES.UPDATE_PLAN_STEP,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.UPDATE_PLAN_STEP,
      description: `
Update one plan step's status while executing the plan.

Set "running" before starting a step, "completed" when it finishes, "failed" if it cannot succeed.
`,
      parameters: {
        type: 'object',
        properties: {
          plannerId: {
            type: 'string',
            description: `The plannerId returned from ${PLANNER_TOOL_NAMES.SUBMIT_PLAN}.`,
          },
          id: { type: 'string', description: 'The plan step id.' },
          status: {
            type: 'string',
            enum: ['running', 'completed', 'failed'],
            description: 'running | completed | failed',
          },
        },
        required: ['plannerId', 'id', 'status'],
      },
    },
    executor: async (args) => {
      const { plannerId, id, status } = args
      const planner = this.runtime.rootSession.planners.find((item) => item.id === plannerId)
      if (!planner) {
        throw new ToolCallError(`Planner ${plannerId} not found.`)
      }
      const target = planner.plans.find((item) => item.id === id)
      if (!target) {
        throw new ToolCallError(`Plan step ${id} not found in planner ${plannerId}.`)
      }

      target.status = status
      const eventName =
        status === 'running'
          ? 'planner-execute-item-start'
          : status === 'completed'
            ? 'planner-execute-item-success'
            : 'planner-execute-item-error'
      plannerEvent.emit(eventName, {
        sessionId: this.runtime.sessionId,
        plannerId: planner.id,
        plan: target,
      })

      return {
        reason: 'call-llm',
        result: { content: `Step ${id} -> ${status}` },
      }
    },
  })

  getTools() {
    return [this.submitPlan, this.updatePlanStep]
  }
}
