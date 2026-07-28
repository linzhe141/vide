import { defineTool, ToolProvider } from './toolProvider'
import { PlannerAgent } from '../subAgent/planner'
import type { SubAgent } from '../subAgent'
import type { WorkflowRuntimeContext } from '../workflow'

const ToolName = 'call-sub-agent'

export class CallSubAgent extends ToolProvider {
  subAgents: SubAgent[] = []

  constructor(runtime: WorkflowRuntimeContext) {
    super(runtime)

    this.registerSubAgent()
  }

  registerSubAgent() {
    const subAgentsConfig = {
      sessionId: this.runtime.sessionId,
      workspacePath: this.runtime.workspacePath,
      getAutoApprove: () => this.runtime.getAutoApprove(),
      mainWorkflowId: this.runtime.workflowId,
    }

    const plannerAgent = new PlannerAgent(subAgentsConfig)
    this.runtime.plugins.push(...plannerAgent.plugins)
    this.subAgents = [plannerAgent]
  }

  get subAgentDescription() {
    return this.subAgents.map((agent) => `${agent.name}: ${agent.description}`).join('\n')
  }

  callSubAgent = defineTool({
    name: ToolName,
    type: 'function',
    function: {
      name: ToolName,
      description: `Call a sub-agent to handle specific tasks. Available sub-agents:
${this.subAgentDescription}

Use this tool to delegate tasks to specialized agents.`,
      parameters: {
        type: 'object',
        properties: {
          agentName: {
            type: 'string',
            description: `Name of the sub-agent to call. Available agents: ${this.subAgents.map((a) => a.name).join(', ')}`,
          },
          task: {
            type: 'string',
            description: 'The task description to delegate to the sub-agent',
          },
          context: {
            type: 'object',
            description: 'Additional context data for the sub-agent',
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
        console.log(`Calling sub-agent "${agentName}" with task:`, task, 'and context:', context)
        const stream = agent.run(JSON.stringify({ task, context }))
        let result = ''
        for await (const event of stream) {
          // proxy the events from the sub-agent to the main workflow
          this.runtime.stream.push(event)

          if (event.eventName === 'workflow-finished') {
            result = event.data.content
          }
        }

        console.log(`Sub-agent "${agentName}" completed with result:`, result)
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

  getTools() {
    return [this.callSubAgent]
  }
}
