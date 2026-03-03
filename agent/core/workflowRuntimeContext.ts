import { v4 as uuid } from 'uuid'
import type { AgentSession, SessionBlock } from './agentSession'
import type { WorkflowEventCtx } from './event/channels'
import { Thread } from './thread'

export class WorkflowRuntimeContext {
  readonly session: AgentSession
  readonly workflowId: string
  readonly plannerId?: string
  readonly planId?: string

  readonly sessionBlock: SessionBlock
  readonly thread: Thread

  constructor(options: { session: AgentSession; sessionBlock: SessionBlock; plannerId?: string }) {
    this.session = options.session
    this.sessionBlock = options.sessionBlock
    this.plannerId = options.plannerId
    this.workflowId = uuid()

    if (options.sessionBlock.type === 'plan') {
      this.planId = options.sessionBlock.planId
    }

    this.thread = options.sessionBlock.thread
  }

  get sessionId() {
    return this.session.sessionId
  }

  get workflowEventCtx(): WorkflowEventCtx {
    return {
      sessionId: this.sessionId,
      workflowId: this.workflowId,
      planId: this.planId,
    }
  }
}
