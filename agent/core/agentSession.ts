import { v4 as uuid } from 'uuid'
import { Workflow } from './workflow'
import { agentEvent } from './event'
import { WorkflowRuntimeContext } from './workflowRuntimeContext'

export const activeSessions: AgentSession[] = []

export class AgentSession {
  sessionId: string = null!
  workflowBlocks: SessionWorkflowBlock[] = []
  constructor() {
    this.sessionId = uuid()
  }

  async run(userInput: string) {
    console.log('userInput--->', userInput)
    try {
      activeSessions.push(this)

      const workflowBlock = this.buildWorlflowBlock(userInput)
      const prevRuntime = this.workflowBlocks.at(-1)?.runtime
      if (prevRuntime) {
        // 保留完整的user input 或许效果更好 or not
        workflowBlock.runtime.userInput = [
          ...prevRuntime.userInput,
          ...workflowBlock.runtime.userInput,
        ]
        console.log('full user chat message', workflowBlock.runtime.userInput)
      }
      //  保留前面的planner 到新一轮的runtime里面
      if (
        prevRuntime?.planner &&
        prevRuntime.planner.some((i) => i.status === 'pending' || i.status === 'running')
      ) {
        workflowBlock.runtime.planner = prevRuntime.planner

        console.log('prev workflow planner')
        console.log(JSON.stringify(prevRuntime.planner, null, 2))
      }

      this.workflowBlocks.push(workflowBlock)

      const workflow = new Workflow(workflowBlock.runtime)

      await workflow.run(userInput)

      agentEvent.emit('agent-session-finished', { sessionId: this.sessionId, userInput })
    } finally {
      const index = activeSessions.findIndex((i) => i === this)
      if (index !== -1) activeSessions.splice(index, 1)
    }
  }

  buildWorlflowBlock(userInput: string) {
    return new SessionWorkflowBlock(this, userInput)
  }
}

export class SessionWorkflowBlock {
  runtime: WorkflowRuntimeContext

  constructor(session: AgentSession, userInput: string) {
    this.runtime = new WorkflowRuntimeContext({
      session,
      userInput,
    })
  }
}
