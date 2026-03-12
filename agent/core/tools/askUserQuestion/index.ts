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

This is a WORKFLOW BREAKPOINT tool.

Behavior:
- Calling this tool INTERRUPTS the current workflow.
- The workflow MUST stop immediately after this tool call.
- The system will wait for the user to select one or more options.
- No further reasoning or tool calls should happen after invoking this tool.

Continuation:
- Once the user makes a selection, the system will start a NEW workflow run.
- The user's selection will be provided as new input for the next step.

Use this tool when:
- the workflow requires a human decision
- multiple valid paths exist
- the agent cannot safely continue without user input

Option rules:
- options MUST be clear and actionable
- DO NOT include vague options like "other"
- DO NOT expect free-text input
- every option must represent a real decision

Selection mode:
- "single": user selects one option
- "multiple": user can select multiple options
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
        workflow_state: 'user_input_required',
        reason: 'ask_user_question',
        instruction: 'Stop the current workflow and wait for the user to select an option.',
      }
    },
  }

  getTools() {
    return [this.askUserQuestion]
  }
}
