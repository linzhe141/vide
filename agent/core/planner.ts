import { type AgentSession, type PlanSessionBlock, type PlanStep } from './agentSession'
import { v4 as uuid } from 'uuid'
import { Workflow } from './workflow'
import { plannerEvent } from './event'
import { WorkflowRuntimeContext } from './workflowRuntimeContext'
import type { ChatMessage, Tool, ToolCall } from './types'
import { getModel, llmClient } from './llm'

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

    const plans = await this.callLLM()

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

  async callLLM() {
    const plan: PlanStep[] = []
    let done = false

    const createTaskTool: Tool = {
      name: 'create_plan_step',
      type: 'function',
      function: {
        name: 'create_plan_step',
        description: 'Create a new step in the execution plan',
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Description of the plan step',
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

        plan.push(planStep)
        plannerEvent.emit('planner-step-generate', {
          sessionId: this.session.sessionId,
          plannerId: this.id,
          plan: planStep,
        })
        return {
          content: 'task created successfully',
          plan: planStep,
        }
      },
    }

    const completeGenerate: Tool = {
      name: 'completed_plan_generate',
      type: 'function',
      function: {
        name: 'completed_plan_generate',
        description: 'completed full plan generate',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      executor: async () => {
        done = true
        return {
          content: 'completed full plan generate',
        }
      },
    }

    const tools: Tool[] = [createTaskTool, completeGenerate]
    const messages: ChatMessage[] = [
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
5. Only return a task plan.
6. Each step must follow this exact structure:
7. The steps should be ordered logically.
8. Avoid vague steps like "think more deeply".
9. If the task involves generating a document (e.g., Word report),
   include analysis, data gathering, structuring, drafting, and review phases.
`,
      },
      {
        role: 'user',
        content: this.userInput,
      },
    ]
    while (!done) {
      const completion = await llmClient.chat.completions.create({
        model: getModel(),
        messages,
        tools,
        reasoning_effort: 'minimal',
      })

      const message = completion.choices[0].message

      // push assistant message
      messages.push(message as ChatMessage)

      const toolCalls = message.tool_calls as ToolCall[] | undefined

      if (!toolCalls || toolCalls.length === 0) {
        throw new Error('Planner must call a tool')
      }

      for (const call of toolCalls) {
        console.log('zzzzzzzzzzzzzzzzzz->')
        console.log(call)
        console.log('zzzzzzzzzzzzzzzzzz->')
        const tool = tools.find((t) => t.function.name === call.function.name)

        if (!tool) {
          throw new Error(`Tool not found: ${call.function.name}`)
        }

        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {}

        const result = await tool.executor(args)
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        } as ChatMessage)
      }
    }

    return plan
  }
}
