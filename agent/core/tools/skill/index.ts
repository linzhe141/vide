import type { Tool } from '../../types'
import type { WorkflowRuntimeContext } from '../../workflowRuntimeContext'

export const SKILL_NAMESPACE = 'BUILDIN_ASK_USER_NAMESPACE'

export const SKILL_TOOL_NAMES = {
  LOAD_SKILL: `${SKILL_NAMESPACE}_LOAD_SKILL`,
} as const

export class SkillTool {
  constructor(private runtime: WorkflowRuntimeContext) {}

  loadSkill: Tool = {
    name: SKILL_TOOL_NAMES.LOAD_SKILL,
    type: 'function',

    function: {
      name: SKILL_TOOL_NAMES.LOAD_SKILL,

      description: `Load a discovered Agent Skill by name.
Use this when a task matches an available skill description and you need the full skill instructions before proceeding.
`,

      parameters: {
        type: 'object',

        properties: {
          name: {
            type: 'string',
            description:
              'The skill name to load, exactly as shown in the available skills catalog.',
          },
        },

        required: ['name'],
      },
    },

    executor: async (_args) => {
      return {
        workflow_state: 'user_input_required',
        reason: 'ask_user_question',
        instruction: 'Stop the current workflow and wait for the user to select an option.',
      }
    },
  }

  getTools() {
    return [this.loadSkill]
  }
}
