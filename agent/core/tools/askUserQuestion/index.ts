import type { Tool } from '../../types'
import type { WorkflowRuntimeContext } from '../../workflowRuntimeContext'
import { askUserQuestionEvent } from '../../event'

export type AskUserQuestionOption = {
  id: string
  label: string
  description?: string
  value: string
}

export type AskUserQuestionConfig = {
  id: string
  title: string
  description?: string
  type: 'single' | 'multiple'
  options: AskUserQuestionOption[]
}

export const ASK_USER_NAMESPACE = 'BUILDIN_ASK_USER_NAMESPACE'

export const ASK_USER_TOOL_NAMES = {
  ASK_USER_QUESTION: `${ASK_USER_NAMESPACE}_ASK_USER_QUESTION`,
} as const

export class AskUserQuestionTool {
  constructor(private runtime: WorkflowRuntimeContext) {}

  askUserQuestion: Tool = {
    name: ASK_USER_TOOL_NAMES.ASK_USER_QUESTION,
    type: 'function',

    function: {
      name: ASK_USER_TOOL_NAMES.ASK_USER_QUESTION,

      description: `
Ask the user a structured question that requires selecting from predefined options.

Use this tool when:
- you need the user to make a decision
- the workflow cannot continue without user input
- the user must choose between multiple valid paths

Rules:
- options MUST be meaningful and actionable
- DO NOT include vague options like "other"
- DO NOT expect free-text input
- every option must represent a real choice

After the user selects options, the workflow will continue with the user's selection.
`,

      parameters: {
        type: 'object',

        properties: {
          title: {
            type: 'string',
            description: 'Short title of the question',
          },

          description: {
            type: 'string',
            description: 'Additional explanation for the user',
          },

          type: {
            type: 'string',
            enum: ['single', 'multiple'],
            description: 'Whether the user can select one or multiple options',
          },

          options: {
            type: 'array',

            items: {
              type: 'object',

              properties: {
                label: {
                  type: 'string',
                },

                description: {
                  type: 'string',
                },

                value: {
                  type: 'string',
                },
              },

              required: ['label', 'value'],
            },

            description: 'List of selectable options for the user',
          },
        },

        required: ['title', 'type', 'options'],
      },
    },

    executor: async (args) => {
      const question: AskUserQuestionConfig = {
        ...args,
      }

      askUserQuestionEvent.emit('ask-user-question', {
        sessionId: this.runtime.sessionId,
        question,
      })

      return {
        content:
          'Waiting for user selection before continuing workflow. now need to break current workflow',
        question: question,
      }
    },
  }

  getTools() {
    return [this.askUserQuestion]
  }
}
