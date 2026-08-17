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
Create multiple user questions at once and pause the workflow for user input.
Useful when you need to ask several questions in sequence.
`,
      parameters: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            minItems: 1,
            maxItems: 10, // 限制最多10个问题
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Unique identifier for this question',
                },
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
              required: ['id', 'title', 'options'],
            },
          },
        },
        required: ['questions'],
      },
    },

    executor: async (params: { questions: any[] }) => {
      // 批量返回所有问题
      return {
        reason: 'stop',
        result: {
          questions: params.questions,
          total: params.questions.length,
        },
      }
    },
  })

  getTools() {
    return [this.generate]
  }
}
