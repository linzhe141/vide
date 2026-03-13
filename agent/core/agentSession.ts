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
    console.log('userInput--->', userInput)
    try {
      activeSessions.push(this)
      const workflowBlock: SessionBlock = {
        thread: new WorkflowThread({ messages: [] }),
      }

      // todo 保留前面的planner 到新一轮的runtime里面，包括ui
      const prevRuntime = this.workflowBlocks.at(-1)
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
