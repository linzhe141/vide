import type { Tool } from '@vide/ai'
import type { Agent } from '../agent'
import type { ModelConfig } from '../llm'
import type { WorkflowPlugin } from '../plugin'
import { WorkflowStream } from '../stream'
import { Workflow, WorkflowRuntimeContext } from '../workflow'

export interface SubAgentRuntimeConfig {
  model: ModelConfig
  sessionId: string
  workspacePath: string | null
  thinkingMode: boolean
  getAutoApprove: () => boolean
  getMainWorkflowId: () => string | null
  agentSettings: Agent['settings']
}

export abstract class SubAgent {
  abstract name: string
  abstract prompt: string
  abstract description: string
  abstract plugins: WorkflowPlugin[]

  constructor(public rootSessionConfig: SubAgentRuntimeConfig) {}

  run(input: string) {
    const subAgentStream = new WorkflowStream()
    subAgentStream.namespace = this.name
    subAgentStream.mainWorkflowId = this.rootSessionConfig.getMainWorkflowId()
    const workflow = this.createWorkflow(subAgentStream)
    workflow.run(input)
    return subAgentStream
  }

  createWorkflow(stream: WorkflowStream) {
    const workflowRuntimeContext = new WorkflowRuntimeContext({
      model: this.rootSessionConfig.model,
      workspacePath: this.rootSessionConfig.workspacePath,
      sessionId: this.rootSessionConfig.sessionId,
      thinkingMode: this.rootSessionConfig.thinkingMode,
      getAutoApprove: () => this.rootSessionConfig.getAutoApprove(),
      stream,
      agentSettings: this.rootSessionConfig.agentSettings,
      plugins: this.plugins ?? [],
    })

    const workflow = new Workflow(
      workflowRuntimeContext,
      this.registerTools(workflowRuntimeContext)
    )
    return workflow
  }

  abstract registerTools(workflowRuntimeContext: WorkflowRuntimeContext): Tool[]
}
