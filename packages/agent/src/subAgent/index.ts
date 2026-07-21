import type { Tool } from '@vide/ai'
import { WorkflowStream } from '../event/stream'
import { Workflow, WorkflowRuntimeContextNew } from '../workflow'

export abstract class SubAgent {
  abstract name: string
  abstract prompt: string
  abstract description: string

  constructor(
    public rootSessionConfig: {
      sessionId: string
      workspacePath: string | null
      autoApprove: boolean
    }
  ) {}

  run(input: string) {
    const subAgentStream = new WorkflowStream()
    subAgentStream.namespace = this.name
    const workflow = this.createWorkflow(subAgentStream)
    workflow.run(input)
    return subAgentStream
  }

  createWorkflow(stream: WorkflowStream) {
    const workflowRuntimeContext = new WorkflowRuntimeContextNew({
      workspacePath: this.rootSessionConfig.workspacePath,
      sessionId: this.rootSessionConfig.sessionId,
      autoApprove: this.rootSessionConfig.autoApprove,
      stream,
    })

    const workflow = new Workflow(workflowRuntimeContext, () =>
      this.registerTools(workflowRuntimeContext)
    )
    return workflow
  }

  abstract registerTools(workflowRuntimeContext: WorkflowRuntimeContextNew): Tool[]
}
