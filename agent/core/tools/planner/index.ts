import { uuid } from '@/app/src/lib/uuid'
import type { Tool } from '../../types'
import { plannerEvent } from '../../event'
import type { WorkflowRuntimeContext } from '../../workflowRuntimeContext'
export type PlanStep = {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  description: string
}

export const PLANNER_NAMESPACE = 'BUILDIN_PLANNER_NAMESPACE'
export const PLANNER_TOOL_NAMES = {
  START_PLAN_GENERATE: `${PLANNER_NAMESPACE}_START_PLAN_GENERATE`,
  CREATE_PLAN_ITEM: `${PLANNER_NAMESPACE}_CREATE_PLAN_ITEM_TOOL`,
  COMPLETED_PLAN_GENERATE: `${PLANNER_NAMESPACE}_COMPLETED_PLAN_GENERATE_TOOL`,
  CHANGE_PLAN_ITEM_STATUS: `${PLANNER_NAMESPACE}_CHANGE_PLAN_ITEM_STATUS_TOOL`,
} as const

export class Planner {
  constructor(private runtime: WorkflowRuntimeContext) {}

  start: Tool = {
    name: PLANNER_TOOL_NAMES.START_PLAN_GENERATE,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.START_PLAN_GENERATE,
      description: `
Begin the planning phase for solving a complex user request.

Call this tool when the task cannot be solved in a single step and requires a structured plan.

You SHOULD call this tool when:
- the task requires multiple steps
- the task involves tool usage
- the task requires reasoning or workflow orchestration
- the task needs a clear execution plan before acting

You SHOULD NOT call this tool when:
- the user asks a simple question
- the answer can be given directly without steps

After calling this tool, you must generate plan steps using the planner step tools.

Typical workflow:

1. Call start_plan_generate
2. Generate multiple plan steps
3. Execute the steps sequentially

This tool ONLY marks the beginning of the planning phase.
Do not generate the plan inside the tool call. Generate the plan using planner step tools after this.
`,
    },
    executor: async () => {
      plannerEvent.emit('planner-start-generate', {
        sessionId: this.runtime.sessionId,
      })
      this.runtime.planner = []
      return {
        content: 'Has marked plan is generating',
      }
    },
  }

  create: Tool = {
    name: PLANNER_TOOL_NAMES.CREATE_PLAN_ITEM,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.CREATE_PLAN_ITEM,
      description: `
Add a step to the execution plan.

Use this tool during the planning phase to break down a complex task into clear and executable steps.

Guidelines for creating steps:
- Each step should represent ONE atomic action.
- Steps should be sequential and logically ordered.
- Avoid combining multiple actions in one step.
- Each step should move the task closer to the final goal.

Examples of good steps:
- "Search for relevant documentation about X"
- "Analyze the dataset to identify key trends"
- "Generate a summary of the analysis results"

Continue calling this tool until all required steps for completing the task are defined.
`,
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

      this.runtime.planner!.push(planStep)
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

  completed: Tool = {
    name: PLANNER_TOOL_NAMES.COMPLETED_PLAN_GENERATE,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.COMPLETED_PLAN_GENERATE,
      description: `
Finish the planning phase.

Call this tool AFTER all necessary plan steps have been created.

This signals that:
- The execution plan is complete
- No additional steps will be added
- The plan is ready for execution

Always call this tool after finishing plan generation.
`,
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    executor: async () => {
      return {
        content: 'Plan generation completed, all steps confirmed',
        plan: this.runtime.planner,
      }
    },
  }

  changeStatus: Tool = {
    name: PLANNER_TOOL_NAMES.CHANGE_PLAN_ITEM_STATUS,
    type: 'function',
    function: {
      name: PLANNER_TOOL_NAMES.CHANGE_PLAN_ITEM_STATUS,
      description: `
Update the execution status of the planned steps in sequence.

Use this tool while executing the plan to reflect the current state of each step.

Status meanings:
- pending: the step has not started yet
- running: the step is currently being executed
- completed: the step finished successfully
- failed: the step encountered an error

Typical usage pattern:
1. Set step status to "running" when execution begins
2. Set step status to "completed" when finished
3. Use "failed" if execution cannot succeed
`,
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
      const target = this.runtime.planner!.find((i) => i.id === id)
      if (target) {
        target.status = status

        if (target.status === 'running') {
          plannerEvent.emit('planner-execute-item-start', {
            sessionId: this.runtime.sessionId,
            plan: target,
          })
        }
        if (target.status === 'completed') {
          plannerEvent.emit('planner-execute-item-success', {
            sessionId: this.runtime.sessionId,
            plan: target,
          })
        }

        if (target.status === 'failed') {
          plannerEvent.emit('planner-execute-item-error', {
            sessionId: this.runtime.sessionId,
            plan: target,
          })
        }
        const planner = this.runtime.planner!
        const summary = {
          planner: planner,
          pending: planner.filter((s) => s.status === 'pending').length,
          in_progress: planner.filter((s) => s.status === 'running').length,
          completed: planner.filter((s) => s.status === 'completed').length,
          failed: planner.filter((s) => s.status === 'failed').length,
        }
        return {
          content:
            `Step ${id} status successfully updated to: ${status}\n` +
            `this is user full input in chat
${this.runtime.userInput
  .map((i, index) => {
    let content = i
    if (index === this.runtime.userInput.length - 1) {
      content = `current workflow user input:` + content
    } else {
      content = `turn(${index + 1}) workflow user input:` + content
    }

    return content
  })
  .join('\n')}

this is current workflow planner summary snapshot
${JSON.stringify(summary, null, 2)}
`,
        }
      }
      return {
        content: `Plan step with ID ${id} not found. Please verify the ID is correct.`,
      }
    },
  }

  getTools() {
    return [this.start, this.create, this.completed, this.changeStatus]
  }
}
