import type { Tool } from '@vide/ai'
import { WorkflowStream } from '../event/stream'
import type { Session } from '../session'
import { Workflow, WorkflowRuntimeContextNew } from '../workflow'

export abstract class SubAgent {
  abstract name: string
  abstract systemPrompt: string
  abstract Tools: Tool[]

  constructor(public rootSession: Session) {}

  run(input: string) {
    const subAgentStream = new WorkflowStream()
    const workflow = this.createWorkflow(subAgentStream)
    workflow.run(input)
    return subAgentStream
  }

  createWorkflow(stream: WorkflowStream) {
    const workflowRuntimeContext = new WorkflowRuntimeContextNew({
      workspacePath: this.rootSession.workspacePath,
      sessionId: this.rootSession.sessionId,
      autoApprove: this.rootSession.autoApprove,
      stream,
    })
    const workflow = new Workflow(workflowRuntimeContext)
    return workflow
  }
  // only one time user input
}
