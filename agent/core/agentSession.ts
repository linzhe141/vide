import { v4 as uuid } from 'uuid'
import { Workflow } from './workflow'
import { WorkflowThread } from './workflowThread'
import { agentEvent } from './event'
import { WorkflowRuntimeContext } from './workflowRuntimeContext'

export type SessionBlock = {
  thread: WorkflowThread
  runtime: WorkflowRuntimeContext
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

      const workflowBlock = this.buildWorlflowBlock(userInput)
      //  保留前面的planner 到新一轮的runtime里面，包括ui
      const prevRuntime = this.workflowBlocks.at(-1)?.runtime
      if (prevRuntime) {
        workflowBlock.runtime.userInput = [
          ...prevRuntime.userInput,
          ...workflowBlock.runtime.userInput,
        ]
        console.log('full user chat message', workflowBlock.runtime.userInput)
      }
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
    const workflowBlock: SessionBlock = {
      thread: new WorkflowThread({ messages: [] }),
      runtime: null!,
    }
    const runtime = new WorkflowRuntimeContext({
      session: this,
      sessionBlock: workflowBlock,
      userInput,
    })
    workflowBlock.runtime = runtime
    return workflowBlock
  }
}
