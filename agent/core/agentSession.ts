import { v4 as uuid } from 'uuid'
import { Workflow } from './workflow'
import { WorkflowThread } from './workflowThread'
import { agentEvent } from './event'
import { WorkflowRuntimeContext } from './workflowRuntimeContext'

export type SessionBlock = {
  thread: WorkflowThread
}

export const activeSessions: AgentSession[] = []

export class AgentSession {
  sessionId: string = null!
  workflowBlocks: SessionBlock[] = []
  constructor() {
    this.sessionId = uuid()
  }

  async run(userInput: string) {
    try {
      activeSessions.push(this)
      const workflowBlock: SessionBlock = {
        thread: new WorkflowThread({ messages: [] }),
      }

      this.workflowBlocks.push(workflowBlock)

      const runtime = new WorkflowRuntimeContext({
        session: this,
        sessionBlock: workflowBlock,
      })

      const workflow = new Workflow(runtime)

      await workflow.run(userInput)

      agentEvent.emit('agent-session-finished', { sessionId: this.sessionId, userInput })
    } finally {
      const index = activeSessions.findIndex((i) => i === this)
      if (index !== -1) activeSessions.splice(index, 1)
    }
  }
}
