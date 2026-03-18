import { v4 as uuid } from 'uuid'
import type { AgentSession } from './agentSession'
import type { WorkflowEventCtx } from './event/channels'
import { WorkflowThread } from './workflowThread'

export class WorkflowRuntimeContext {
  readonly session: AgentSession
  readonly workflowId: string
  readonly thread: WorkflowThread
  userInput: string[] = []
  constructor(options: { session: AgentSession; userInput: string }) {
    this.session = options.session
    this.workflowId = uuid()
    // userInput array ONLY one item
    this.userInput.push(options.userInput)
    this.thread = new WorkflowThread({ messages: [] })
  }

  get sessionId() {
    return this.session.sessionId
  }

  get workflowEventCtx(): WorkflowEventCtx {
    return {
      sessionId: this.sessionId,
      workflowId: this.workflowId,
    }
  }
}
