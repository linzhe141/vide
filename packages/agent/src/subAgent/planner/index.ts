import { randomUUID } from 'node:crypto'
import { SessionPlaner } from '../../session'
import { defineTool, ToolProvider } from '../toolProvider'
import { ToolCallError } from '../../error'
import type { PlanStep } from '../../types'
import { SubAgent } from './subAgent'
import type { Tool } from '@vide/ai'
import { WorkflowStream } from '../event/stream'
import { Workflow, WorkflowRuntimeContextNew } from '../workflow'

export const PLANNER_TOOL_NAMES = {
  SUBMIT_PLAN: `submit-plan`,
  UPDATE_PLAN_STEP: `update-plan-step`,
} as const

export class PlannerAgent extends SubAgent {
  name = 'planner'
  systemPrompt = `
You are a planning agent that helps break down complex tasks into sequential steps.

When given a task:
1. Analyze the task complexity
2. If it requires multiple steps or tools, create a detailed plan using ${PLANNER_TOOL_NAMES.SUBMIT_PLAN}
3. Execute each step sequentially using ${PLANNER_TOOL_NAMES.UPDATE_PLAN_STEP}
4. For simple tasks answerable in one response, you may respond directly without planning

Important rules:
- Each step should be atomic and sequential
- Steps must move the task toward the final goal
- Use status: 'running' before starting, 'completed' when done, 'failed' if error occurs
- Always return the plannerId from submit-plan to track execution
  `

  get Tools(): Tool[] {
    return [this.submitPlanTool, this.updatePlanStepTool]
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
      this.rootSession.planners.push(sessionPlaner)

      // Emit events through the root session's stream if available
      this.rootSession.stream?.emit({
        eventName: 'planner-end-generate',
        data: { plannerId: sessionPlaner.id, plans: planSteps },
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

  private updatePlanStepTool = defineTool({
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
      const planner = this.rootSession.planners.find((item) => item.id === plannerId)
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

      this.rootSession.stream?.emit({
        eventName,
        data: { plannerId: planner.id, plan: target },
      })

      return {
        reason: 'call-llm',
        result: { content: `Step ${id} -> ${status}` },
      }
    },
  })

  // Convenience method to run the planner as a sub-agent
  run(input: string) {
    const subAgentStream = new WorkflowStream()
    const workflow = this.createWorkflow(subAgentStream)

    // Set up event forwarding from the workflow to the root session
    if (this.rootSession.stream) {
      subAgentStream.on('data', (data) => {
        this.rootSession.stream?.emit(data.eventName, data.data)
      })
    }

    workflow.run(input)
    return subAgentStream
  }

  private createWorkflow(stream: WorkflowStream) {
    const workflowRuntimeContext = new WorkflowRuntimeContextNew({
      workspacePath: this.rootSession.workspacePath,
      sessionId: this.rootSession.sessionId,
      autoApprove: this.rootSession.autoApprove,
      stream,
    })
    const workflow = new Workflow(workflowRuntimeContext)
    return workflow
  }
}

// Keep the original Planner class for backward compatibility if needed
export class Planner extends ToolProvider {
  // ... original implementation
}
