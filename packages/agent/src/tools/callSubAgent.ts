import { defineTool, ToolProvider } from './toolProvider'
import { PlannerAgent } from '../subAgent/planner'
import type { SubAgent } from '../subAgent'
import type { WorkflowRuntimeContext } from '../workflow'

const ToolName = 'call-sub-agent'

export class CallSubAgent extends ToolProvider<WorkflowRuntimeContext> {
  subAgents: SubAgent[] = []
  private callSubAgentTool

  constructor(runtime: WorkflowRuntimeContext) {
    super(runtime)

    this.registerSubAgent()
    this.callSubAgentTool = this.createCallSubAgentTool()
  }

  registerSubAgent() {
    const subAgentsConfig = {
      model: this.runtime.model,
      sessionId: this.runtime.sessionId,
      workspacePath: this.runtime.workspacePath,
      thinkingMode: this.runtime.thinkingMode,
      getAutoApprove: () => this.runtime.getAutoApprove(),
      getMainWorkflowId: () => this.runtime.workflowId,
      agentSettings: this.runtime.agentSettings,
    }

    const plannerAgent = new PlannerAgent(subAgentsConfig)
    this.subAgents = [plannerAgent]
  }

  get subAgentDescription() {
    return this.subAgents.map((agent) => `${agent.name}: ${agent.description}`).join('\n')
  }

  private get availableAgentNames() {
    return this.subAgents.map((agent) => agent.name)
  }

  private createCallSubAgentTool() {
    return defineTool({
      name: ToolName,
      type: 'function',
      function: {
        name: ToolName,
        description: `Call a sub-agent to handle specific tasks. Available sub-agents:
${this.subAgentDescription}

Use this tool to delegate tasks to specialized agents.
If the task has access to files, provide file paths in the context parameter. Do not provide file content directly because the sub-agent can read files itself.`,
        parameters: {
          type: 'object',
          properties: {
            agentName: {
              type: 'string',
              enum: this.availableAgentNames,
              description: `Name of the sub-agent to call. Available agents: ${this.availableAgentNames.join(', ')}`,
            },
            task: {
              type: 'string',
              description: 'The task description to delegate to the sub-agent',
            },
            context: {
              type: 'object',
              description:
                'Additional context data for the sub-agent, Example: { "file1": "path/to/file" }',
              additionalProperties: true,
            },
          },
          required: ['agentName', 'task'],
        },
      },
      executor: async (args: any = {}) => {
        const { agentName, task, context = {} } = args

        const agent = this.subAgents.find((a) => a.name === agentName)

        if (!agent) {
          throw new Error(
            `Sub-agent "${agentName}" not found. Available agents: ${this.subAgents.map((a) => a.name).join(', ')}`
          )
        }

        try {
          const stream = agent.run(JSON.stringify({ task, context }))
          let result = ''
          for await (const event of stream) {
            this.runtime.emitCustom({
              eventName: 'sub-agent.event',
              data: event,
            })

            if (event.type === 'workflow.completed') {
              result = event.result
            }

            if (event.type === 'workflow.error') {
              throw new Error(String(event.error))
            }
          }

          return {
            reason: 'call-llm',
            result: {
              agentName,
              success: true,
              output: result,
            },
          }
        } catch (error: any) {
          return {
            reason: 'call-llm',
            result: {
              agentName,
              success: false,
              error: error.message || 'Failed to execute sub-agent',
            },
          }
        }
      },
    })
  }

  getTools() {
    return [this.callSubAgentTool]
  }
}
