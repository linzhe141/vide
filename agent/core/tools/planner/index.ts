import { uuid } from '@/app/src/lib/uuid'
import type { Tool } from '../../types'
import { plannerEvent } from '../../event'
import type { WorkflowRuntimeContext } from '../../workflowRuntimeContext'
export type PlanStep = {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  description: string
}
export const PLANNER_TOOL_NAMES = {
  START_PLAN_GENERATE: 'START_PLAN_GENERATE',
  CREATE_PLAN_ITEM: 'CREATE_PLAN_ITEM_TOOL',
  COMPLETED_PLAN_GENERATE: 'COMPLETED_PLAN_GENERATE_TOOL',
  CHANGE_PLAN_ITEM_STATUS: 'CHANGE_PLAN_ITEM_STATUS_TOOL',
  GET_ALL_PLAN_LIST: 'GET_ALL_PLAN_LIST_TOOL',
} as const

export class Planner {
  plan: PlanStep[] = []
  constructor(private runtime: WorkflowRuntimeContext) {}

  startGenernatePlan: Tool = {
    name: PLANNER_TOOL_NAMES.START_PLAN_GENERATE,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.START_PLAN_GENERATE,
      description:
        'Create a new step in the execution plan. Use this tool when you need to mark plan is startd generating plan.',
    },
    executor: async () => {
      plannerEvent.emit('planner-start-generate', {
        sessionId: this.runtime.sessionId,
      })
      return {
        content: 'Has marked plan is generating',
      }
    },
  }

  createTask: Tool = {
    name: PLANNER_TOOL_NAMES.CREATE_PLAN_ITEM,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.CREATE_PLAN_ITEM,
      description:
        'Create a new step in the execution plan. Use this tool when you need to break down a complex task into executable subtasks by adding specific steps to the plan. Each step should represent an atomic, independently executable operation that contributes to the overall goal.',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description:
              'Detailed description of the plan step. Should clearly explain what specific operation needs to be completed and what output is expected. For example: "Analyze the uploaded sales data to extract key trends and outliers"',
          },
        },
        required: ['description'],
      },
    },
    executor: async (args) => {
      const planStep: PlanStep = {
        id: uuid(),
        status: 'pending',
        description: args.description,
      }

      this.plan.push(planStep)
      plannerEvent.emit('planner-step-generate', {
        sessionId: this.runtime.sessionId,
        plan: planStep,
      })
      return {
        content: 'Plan step created successfully',
        plan: planStep,
      }
    },
  }

  completeGenerate: Tool = {
    name: PLANNER_TOOL_NAMES.COMPLETED_PLAN_GENERATE,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.COMPLETED_PLAN_GENERATE,
      description:
        'Mark the completion of the entire plan generation process. Call this tool when all necessary plan steps have been created and you are certain that no more steps need to be added, signaling the end of the planning phase.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    executor: async () => {
      return {
        content: 'Plan generation completed, all steps confirmed',
        plan: this.plan,
      }
    },
  }

  changePlanItemStatus: Tool = {
    name: PLANNER_TOOL_NAMES.CHANGE_PLAN_ITEM_STATUS,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.CHANGE_PLAN_ITEM_STATUS,
      description:
        'Update the execution status of a specific step in the plan. Use this tool when starting to execute a step, when a step completes, or when encountering issues to reflect the latest state changes. Supported statuses include: pending(awaiting execution), in_progress(currently being executed), completed(successfully finished), failed(encountered error), blocked(waiting for dependencies).',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description:
              'The unique identifier (ID) of the plan step whose status needs to be updated.',
          },
          status: {
            type: 'string',
            description:
              'The new status to set. Available options: pending(awaiting execution), in_progress(currently being executed), completed(successfully finished), failed(encountered error), blocked(waiting for dependencies).',
            enum: ['pending', 'running', 'completed', 'failed'],
          },
        },
        required: ['id', 'status'],
      },
    },
    executor: async (args) => {
      const id = args.id
      const status = args.status
      const target = this.plan.find((i) => i.id === id)
      if (target) {
        target.status = status
        return {
          content: `Step ${id} status successfully updated to: ${status}`,
        }
      }
      return {
        content: `Plan step with ID ${id} not found. Please verify the ID is correct.`,
      }
    },
  }

  getAllPlans: Tool = {
    name: PLANNER_TOOL_NAMES.GET_ALL_PLAN_LIST,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.CHANGE_PLAN_ITEM_STATUS,
      description:
        "Retrieve all steps in the current execution plan along with their detailed information. Use this tool when you need to understand the overall progress, check pending tasks, or review previously created steps. Returns comprehensive information including each step's unique ID, current status, and description.",
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    executor: async () => {
      const plan = this.plan
      return {
        content: 'Successfully retrieved all plan steps',
        plans: plan.map((step) => ({
          id: step.id,
          status: step.status,
          description: step.description,
        })),
        summary: {
          total: plan.length,
          pending: plan.filter((s) => s.status === 'pending').length,
          in_progress: plan.filter((s) => s.status === 'running').length,
          completed: plan.filter((s) => s.status === 'completed').length,
          failed: plan.filter((s) => s.status === 'failed').length,
        },
      }
    },
  }

  getTools() {
    return [this.createTask, this.completeGenerate, this.changePlanItemStatus, this.getAllPlans]
  }
}
