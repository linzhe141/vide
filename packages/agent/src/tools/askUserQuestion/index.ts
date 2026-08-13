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
          title: { type: 'string' },
          description: { type: 'string' },
          options: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['label', 'value'],
            },
          },
        },
        required: ['title', 'options'],
      },
    },

    executor: async (question: any) => {
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
