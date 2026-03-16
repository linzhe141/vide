import { v4 as uuid } from 'uuid'
import type { AgentSession, SessionBlock } from './agentSession'
import type { WorkflowEventCtx } from './event/channels'
import { WorkflowThread } from './workflowThread'
import type { PlanStep } from './tools/planner'

export class WorkflowRuntimeContext {
  readonly session: AgentSession
  readonly workflowId: string
  readonly thread: WorkflowThread
  planner: PlanStep[] | null = null
  userInput: string[] = []
  constructor(options: { session: AgentSession; sessionBlock: SessionBlock; userInput: string }) {
    this.session = options.session
    this.workflowId = uuid()
    this.userInput.push(options.userInput)
    this.thread = options.sessionBlock.thread
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
