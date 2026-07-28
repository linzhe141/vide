import type { Tool } from '@vide/ai'
import { WorkflowStream } from '../event/stream'
import { Workflow, WorkflowRuntimeContext } from '../workflow'

export abstract class SubAgent {
  abstract name: string
  abstract prompt: string
  abstract description: string

  constructor(
    public rootSessionConfig: {
      sessionId: string
      workspacePath: string | null
      getAutoApprove: () => boolean
      // 启动子工作流时的主工作流ID
      mainWorkflowId: string
    }
  ) {}

  run(input: string) {
    const subAgentStream = new WorkflowStream()
    subAgentStream.namespace = this.name
    subAgentStream.mainWorkflowId = this.rootSessionConfig.mainWorkflowId
    const workflow = this.createWorkflow(subAgentStream)
    workflow.run(input)
    return subAgentStream
  }

  createWorkflow(stream: WorkflowStream) {
    const workflowRuntimeContext = new WorkflowRuntimeContext({
      workspacePath: this.rootSessionConfig.workspacePath,
      sessionId: this.rootSessionConfig.sessionId,
      getAutoApprove: () => this.rootSessionConfig.getAutoApprove(),
      stream,
    })

    const workflow = new Workflow(workflowRuntimeContext, () =>
      this.registerTools(workflowRuntimeContext)
    )
    return workflow
  }

  abstract registerTools(workflowRuntimeContext: WorkflowRuntimeContext): Tool[]
}
