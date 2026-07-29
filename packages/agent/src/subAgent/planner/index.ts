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

type PlannerTodosUpdatedPayload = {
  planner: {
    id: string
    plan: PlanStep[]
  }
}

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
        runtime.workflowMessages.addMessage({
          role: 'system',
          content: this.prompt,
        })
      },
    },
  ]

  injectMainWorkflowPlugins(): WorkflowPlugin[] {
    return [
      {
        name: 'main-planner-plugin',
        // 如果当前的 main workflow 没有完成，需要在下次对话的时候继续执行剩余的步骤
        // 比如在执行plan的时候 agent ask question，这时就会break main workflow
        // 待用户补充后，会启动新的 main workflow 等到下次对话的时候就需要继续执行剩余的步骤
        beforeWorkflowStart: async (_input, runtime) => {
          const todos = this.plan.filter((i) => i.status !== 'completed')
          if (todos.length > 0 && this.executionMode) {
            const nextStep = todos[0]
            if (nextStep.status !== 'running') {
              nextStep.status = 'running'
              this.emitPlannerTodosUpdated(runtime)
              runtime.workflowMessages.addContextMessage(
                'planner',
                `[EXECUTING PLAN - Full tool access enabled]

Executing step [${this.plan.indexOf(nextStep) + 1}]: ${nextStep.description}
After completing this step, include a [DONE:${this.plan.indexOf(nextStep) + 1}] tag in your response.`
              )
            }
          }
        },

        afterAIEnd: async (assistantMessage, runtime) => {
          if (this.executionMode) {
            const doneRegex = /\[DONE:(\d+)\]/g
            let match
            let hasChanges = false
            while ((match = doneRegex.exec(assistantMessage)) !== null) {
              const stepIndex = parseInt(match[1], 10) - 1
              if (this.plan[stepIndex] && this.plan[stepIndex].status !== 'completed') {
                this.plan[stepIndex].status = 'completed'
                hasChanges = true
              }
            }
            if (hasChanges) {
              this.emitPlannerTodosUpdated(runtime)
            }
            const todos = this.plan.filter((i) => i.status !== 'completed')
            if (todos.length > 0) {
              const nextStep = todos[0]
              if (nextStep.status !== 'running') {
                nextStep.status = 'running'
                this.emitPlannerTodosUpdated(runtime)
                runtime.workflow.state = 'INPUT'
                runtime.workflow.runLoop({
                  input: `[EXECUTING PLAN - Full tool access enabled]

Executing step [${this.plan.indexOf(nextStep) + 1}]: ${nextStep.description}
After completing this step, include a [DONE:${this.plan.indexOf(nextStep) + 1}] tag in your response.`,
                })
              }
            }
          }
        },
        beforeWorkflowFinish: async (_content, runtime) => {
          if (this.executionMode) {
            const hasCompletedAllSteps = this.plan.every((step) => step.status === 'completed')
            if (hasCompletedAllSteps) {
              this.executionMode = false
              this.emitPlannerTodosUpdated(runtime)
              // this.plan = []
            }
          }
        },
      },
    ]
  }

  private emitPlannerTodosUpdated(runtime: WorkflowRuntimeContext) {
    if (!runtime) return
    const plannerId = runtime.stream.mainWorkflowId ?? runtime.workflowId
    const payload: PlannerTodosUpdatedPayload = {
      planner: {
        id: plannerId,
        plan: this.plan.map((step) => ({ ...step })),
      },
    }
    runtime.emitCustom({
      eventName: 'planner-todos-updated',
      data: payload,
    })
  }

  registerTools(workflowRuntimeContext: WorkflowRuntimeContext): Tool[] {
    // only read level tools
    const grep = new Grep(workflowRuntimeContext)
    const read = new Read(workflowRuntimeContext)

    return [grep.search, read.readFile, this.createSubmitPlanTool(workflowRuntimeContext)]
  }

  private createSubmitPlanTool(workflowRuntimeContext: WorkflowRuntimeContext) {
    return defineTool({
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
        this.emitPlannerTodosUpdated(workflowRuntimeContext)
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
}
