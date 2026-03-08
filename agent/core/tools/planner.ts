import type { PlanStep } from '../agentSession'
import { llmClient, getModel } from '../llm'
import { randomUUID } from 'crypto'
import { z } from 'zod'

export async function generatePlan(userInput: string): Promise<PlanStep[]> {
  const model = getModel()

  const completion = await llmClient.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `
You are an AI planning assistant.

Your task:
Break the user request into logical actionable steps.

You MUST call the createPlan tool.
Do NOT respond with text.
`,
      },
      {
        role: 'user',
        content: userInput,
      },
    ],

    tools: [
      {
        type: 'function',
        function: {
          name: 'createPlan',
          description: createPlanTool.description,
          parameters: createPlanTool.parameters,
        },
      },
    ],

    tool_choice: {
      type: 'function',
      function: { name: 'createPlan' },
    },
  })

  const toolCall = completion.choices[0].message.tool_calls?.[0]

  if (!toolCall) {
    throw new Error('Model did not call createPlan')
  }

  const args = JSON.parse(toolCall.function.arguments)

  const result: PlanStep[] = args.steps.map((step: any) => ({
    id: randomUUID(),
    status: 'pending',
    description: step.description,
  }))

  return result
}

export const createPlanTool = {
  name: 'createPlan',
  description: 'Generate an execution plan for a user task',
  parameters: z.object({
    steps: z.array(
      z.object({
        description: z.string().describe('A clear actionable step'),
      })
    ),
  }),
}
