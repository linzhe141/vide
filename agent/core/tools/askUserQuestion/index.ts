import type { Tool } from '../../types'
import type { WorkflowRuntimeContext } from '../../workflowRuntimeContext'
import { askUserQuestionEvent } from '../../event'

export type AskUserQuestionOption = {
  label: string
  description?: string
  value: string
}

export type AskUserQuestionDraft = {
  title?: string
  description?: string
  type?: 'single' | 'multiple'
  options: AskUserQuestionOption[]
}
export const ASK_USER_NAMESPACE = 'BUILDIN_ASK_USER_NAMESPACE'

export const ASK_USER_TOOL_NAMES = {
  START_GENERATE: `${ASK_USER_NAMESPACE}_START_GENERATE`,
  SET_TITLE: `${ASK_USER_NAMESPACE}_SET_TITLE`,
  SET_DESCRIPTION: `${ASK_USER_NAMESPACE}_SET_DESCRIPTION`,
  CREATE_OPTION: `${ASK_USER_NAMESPACE}_CREATE_OPTION`,
  COMPLETE_GENERATE: `${ASK_USER_NAMESPACE}_COMPLETE_GENERATE`,
} as const

export class AskUserQuestionTool {
  draft: AskUserQuestionDraft | null = null

  constructor(private runtime: WorkflowRuntimeContext) {}

  startGenerate: Tool = {
    name: ASK_USER_TOOL_NAMES.START_GENERATE,
    type: 'function',

    function: {
      name: ASK_USER_TOOL_NAMES.START_GENERATE,

      description: `
Start generating a user question interactively.

Set the selection type.

single: user selects one option
multiple: user selects multiple options

Use this tool before generating question fields.

After calling this tool you MUST generate:

- title
- description (optional)
- options

Use the dedicated tools to build the question step by step.
`,

      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['single', 'multiple'],
          },
        },
        required: ['type'],
      },
    },

    executor: async (args) => {
      this.draft = {
        type: args.type,
        options: [],
      }

      askUserQuestionEvent.emit('ask-user-start-generate', {
        sessionId: this.runtime.sessionId,
        type: args.type,
      })

      return {
        content: 'Started generating ask user question',
      }
    },
  }

  setTitle: Tool = {
    name: ASK_USER_TOOL_NAMES.SET_TITLE,
    type: 'function',

    function: {
      name: ASK_USER_TOOL_NAMES.SET_TITLE,

      description: `
Set the title of the user question.
`,

      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
        required: ['title'],
      },
    },

    executor: async ({ title }) => {
      if (!this.draft) throw new Error('Question generation not started')

      this.draft.title = title

      askUserQuestionEvent.emit('ask-user-title', {
        sessionId: this.runtime.sessionId,
        title,
      })

      return {
        content: 'Title generated',
      }
    },
  }

  setDescription: Tool = {
    name: ASK_USER_TOOL_NAMES.SET_DESCRIPTION,
    type: 'function',

    function: {
      name: ASK_USER_TOOL_NAMES.SET_DESCRIPTION,

      description: `Set the description of the question.`,

      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string' },
        },
      },
    },

    executor: async ({ description }) => {
      if (!this.draft) throw new Error('Question generation not started')

      this.draft.description = description

      askUserQuestionEvent.emit('ask-user-description', {
        sessionId: this.runtime.sessionId,
        description,
      })

      return { content: 'Description generated' }
    },
  }

  createOption: Tool = {
    name: ASK_USER_TOOL_NAMES.CREATE_OPTION,
    type: 'function',

    function: {
      name: ASK_USER_TOOL_NAMES.CREATE_OPTION,

      description: `
Create an option for the question.

Call this tool multiple times to generate all options.
`,

      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string' },

          description: { type: 'string' },

          value: { type: 'string' },
        },

        required: ['label', 'value'],
      },
    },

    executor: async (args) => {
      if (!this.draft) throw new Error('Question generation not started')

      const option = {
        ...args,
      }

      this.draft.options.push(option)

      askUserQuestionEvent.emit('ask-user-option', {
        sessionId: this.runtime.sessionId,
        option,
      })

      return {
        content: 'Option created',
        option,
      }
    },
  }

  completeGenerate: Tool = {
    name: ASK_USER_TOOL_NAMES.COMPLETE_GENERATE,

    type: 'function',

    function: {
      name: ASK_USER_TOOL_NAMES.COMPLETE_GENERATE,

      description: `
Finish generating the question.

This will interrupt the workflow and wait for user input.
`,
      parameters: {
        type: 'object',
        properties: {},
      },
    },

    executor: async () => {
      if (!this.draft) throw new Error('Question generation not started')

      askUserQuestionEvent.emit('ask-user-complete', {
        sessionId: this.runtime.sessionId,
        question: this.draft,
      })

      return {
        workflow_state: 'user_input_required',
        reason: 'ask_user_question',
        question: this.draft,
      }
    },
  }

  getTools() {
    return [
      this.startGenerate,
      this.setTitle,
      this.setDescription,
      this.createOption,
      this.completeGenerate,
    ]
  }
}
