import type { Tool } from '../../types'
import type { WorkflowRuntimeContext } from '../../workflowRuntimeContext'
import { askUserQuestionEvent } from '../../event'
import { ToolProvider } from '../toolProvider'

export type AskUserQuestionOption = {
  label: string
  description: string
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
  CREATE_OPTION: `${ASK_USER_NAMESPACE}_CREATE_OPTION`,
} as const

export class AskUserQuestionTool extends ToolProvider {
  draft: AskUserQuestionDraft | null = null

  constructor(runtime: WorkflowRuntimeContext) {
    super(runtime)
  }

  start: Tool = {
    name: ASK_USER_TOOL_NAMES.START_GENERATE,
    type: 'function',

    function: {
      name: ASK_USER_TOOL_NAMES.START_GENERATE,
      description: `
Start generating a user question.

You MUST call CREATE_OPTION to generate options after this.
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
        },
        required: ['type', 'title', 'description'],
      },
    },

    executor: async ({ type, title, description }) => {
      this.draft = {
        type,
        title,
        description,
        options: [],
      }

      askUserQuestionEvent.emit('ask-user-start-generate', {
        sessionId: this.runtime.sessionId,
        workflowId: this.runtime.workflowId,
        type,
        title,
        description,
      })

      return { reason: 'call-llm', result: { content: 'started' } }
    },
  }

  create: Tool = {
    name: ASK_USER_TOOL_NAMES.CREATE_OPTION,
    type: 'function',

    function: {
      name: ASK_USER_TOOL_NAMES.CREATE_OPTION,
      description: `
Create an option for the question.

Call multiple times to add options.

Set "done=true" when all options are generated.
`,
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          description: { type: 'string' },
          value: { type: 'string' },
          done: { type: 'boolean' },
        },
        required: ['label', 'value'],
      },
    },

    executor: async (args) => {
      if (!this.draft) throw new Error('Question generation not started')

      const { done, ...option } = args

      this.draft.options.push(option)

      // 每个 option 流式发
      askUserQuestionEvent.emit('ask-user-option', {
        sessionId: this.runtime.sessionId,
        workflowId: this.runtime.workflowId,
        option,
      })

      // ✅ 收口逻辑直接内聚
      if (done) {
        askUserQuestionEvent.emit('ask-user-complete', {
          sessionId: this.runtime.sessionId,
          workflowId: this.runtime.workflowId,
          question: this.draft,
        })

        return {
          reason: 'stop',
          result: {
            question: this.draft,
          },
        }
      }

      return {
        reason: 'call-llm',
        result: {
          content: 'option added',
        },
      }
    },
  }

  getTools() {
    return [this.start, this.create]
  }
}
