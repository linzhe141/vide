import type { AskUserQuestion } from '../../types'
import { defineTool, ToolProvider } from '../toolProvider'

export const ASK_USER_TOOL_NAMES = {
  GENERATE: `ask-user-question-generate`,
} as const

export class AskUserQuestionTool extends ToolProvider {
  generate = defineTool({
    name: ASK_USER_TOOL_NAMES.GENERATE,
    type: 'function',

    function: {
      name: ASK_USER_TOOL_NAMES.GENERATE,
      description: `
Create a complete user question and pause the workflow for user input.
`,
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['single', 'multiple'],
          },
          title: { type: 'string' },
          description: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                description: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['label', 'value', 'description'],
            },
          },
        },
        required: ['type', 'title', 'description', 'options'],
      },
    },

    executor: async (question: AskUserQuestion) => {
      await this.emit({
        eventName: 'ask-user',
        data: { workflowId: this.runtime.workflowId, question },
      })
      return {
        reason: 'stop',
        result: { question },
      }
    },
  })

  getTools() {
    return [this.generate]
  }
}
