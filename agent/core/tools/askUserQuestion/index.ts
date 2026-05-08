import type { WorkflowRuntimeContext } from '../../workflowRuntimeContext'
import { askUserQuestionEvent } from '../../event'
import { defineTool, ToolProvider } from '../toolProvider'

export type AskUserQuestionOption = {
  label: string
  description: string
  value: string
}

export type AskUserQuestion = {
  title: string
  description: string
  type: 'single' | 'multiple'
  options: AskUserQuestionOption[]
}

export const ASK_USER_NAMESPACE = 'BUILDIN_ASK_USER_NAMESPACE'

export const ASK_USER_TOOL_NAMES = {
  GENERATE: `${ASK_USER_NAMESPACE}_GENERATE`,
} as const

export class AskUserQuestionTool extends ToolProvider {
  constructor(runtime: WorkflowRuntimeContext) {
    super(runtime)
  }

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
      askUserQuestionEvent.emit('ask-user', {
        sessionId: this.runtime.sessionId,
        workflowId: this.runtime.workflowId,
        question,
      })

      return {
        reason: 'stop',
        result: {
          question,
        },
      }
    },
  })

  getTools() {
    return [this.generate]
  }
}
