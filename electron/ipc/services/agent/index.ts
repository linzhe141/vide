import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import { Agent } from '@/agent/core/agent'
import { onAgentEvent, onPalnnervent, onWorkflowEvent } from '@/agent/core/apiEvent'
import { logger } from '@/electron/logger'

import type { AgentSession } from '@/agent/core/agentSession'
import {
  type WorkflowEvents,
  type PlannerEvents,
  type AgentLifecycleEvents,
  agentEventNames,
  plannerEventNames,
  workflowEventNames,
} from '@/agent/core/event/channels'

export class AgentIpcMainService implements IpcMainService {
  agent: Agent = null!
  session: AgentSession = null!
  constructor(private appManager: AppManager) {
    this.agent = new Agent()
    this.registerIpcMainSenders()
  }

  registerIpcMainHandle() {
    ipcMainApi.handle('agent-create-session', async () => {
      this.session = this.agent.createSession()
      logger.info('agent-create-session ', this.session.sessionId)

      const sessionId = this.session.sessionId
      return sessionId
    })

    ipcMainApi.handle('agent-session-send', async ({ input }) => {
      logger.info('agent-session-send ', input)

      this.session!.run(input)
    })
  }

  // 只是转发到renderer
  registerIpcMainSenders() {
    agentEventNames.forEach((eventName) => {
      onAgentEvent(eventName, (data: any) => {
        ipcMainApi.send(eventName, data)
      })
    })

    plannerEventNames.forEach((eventName) => {
      onPalnnervent(eventName, (data: any) => {
        ipcMainApi.send(eventName, data)
      })
    })

    workflowEventNames.forEach((eventName) => {
      onWorkflowEvent(eventName, (data: any) => {
        ipcMainApi.send(eventName, data)
      })
    })
  }
}
