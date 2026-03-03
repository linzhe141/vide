import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import type { AssistantChatMessage, ChatMessage, ToolChatMessage } from '@/agent/core/types'
import { Agent } from '@/agent/core/agent'
import { onAgentEvent, onPalnnervent, onWorkflowEvent } from '@/agent/core/apiEvent'
import { logger } from '@/electron/logger'
import { threadMessages } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@/electron/databaseManager'
import type { ThreadMessageRowDto } from '../../api/channels'
import { ThreadMessageRole } from '@/types'
import { activeLatestThreadWorkflowMap } from '@/agent/core/workflow.old'
import type { AgentSession } from '@/agent/core/agentSession'
import type {
  WorkflowEvents,
  PlannerEvents,
  AgentLifecycleEvents,
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

    ipcMainApi.handle('agent-human-approved', () => {
      logger.info('agent-human-approved ')

      this.session!.humanApprove()
    })

    ipcMainApi.handle('agent-human-rejected', () => {
      logger.info('agent-human-rejected ')

      this.session!.humanReject()
    })

    ipcMainApi.handle('agent-workflow-abort', () => {
      logger.info('agent-workflow-abort')

      this.session!.abort()
    })

    ipcMainApi.handle('agent-change-session', async ({ threadId }) => {
      // TODO
      // if no restore

      const toLLMmessages: ChatMessage[] = []
      const rows = (await db
        .select()
        .from(threadMessages)
        .where(eq(threadMessages.threadId, threadId))) as ThreadMessageRowDto[]

      let assistantMessage: AssistantChatMessage | null = null
      for (const i of rows) {
        switch (i.role) {
          case ThreadMessageRole.User: {
            toLLMmessages.push({
              role: 'user',
              content: i.content!,
            })
            break
          }
          case ThreadMessageRole.AssistantText: {
            assistantMessage = {
              role: 'assistant',
              content: i.content!,
            }
            toLLMmessages.push(assistantMessage)
            break
          }

          case ThreadMessageRole.ToolCalls: {
            const toolCalls = JSON.parse(i.payload!).toolCalls.filter(
              (i: any) => i.result
            ) as Array<ToolCall & { result: ToolChatMessage }>
            if (assistantMessage && toolCalls.length) {
              assistantMessage.tool_calls = toolCalls.map((i) => ({
                function: i.function,
                id: i.id,
                type: i.type,
              }))

              for (const toolCall of toolCalls) {
                const toolMessage: ToolChatMessage = {
                  role: 'tool',
                  content: JSON.stringify(toolCall.result),
                  tool_call_id: toolCall.id,
                }
                toLLMmessages.push(toolMessage)
              }
            }

            break
          }
        }
      }
      this.session = this.agent.restoreSession(threadId, toLLMmessages)
      const maybeActiveWorkflow = activeLatestThreadWorkflowMap.get(threadId)
      return !!maybeActiveWorkflow
    })
  }

  // 只是转发到renderer
  registerIpcMainSenders() {
    const agentEventNames = Array.from(
      new Set([
        'agent-create-session',
        'agent-session-start-analyze-input',
        'agent-session-end-analyze-input',
      ])
    ) satisfies (keyof AgentLifecycleEvents)[]
    agentEventNames.forEach((eventName) => {
      onAgentEvent(eventName, (data: any) => {
        ipcMainApi.send(eventName, data)
      })
    })

    const plannerEventNames = Array.from(
      new Set([
        'planner-start-generate',
        'planner-end-generate',
        'planner-execute-item-start',
        'planner-execute-item-success',
        'planner-execute-item-error',
      ])
    ) satisfies (keyof PlannerEvents)[]
    plannerEventNames.forEach((eventName) => {
      onPalnnervent(eventName, (data: any) => {
        ipcMainApi.send(eventName, data)
      })
    })

    const workflowEventNames = Array.from(
      new Set([
        'workflow-start',
        'workflow-finished',
        'workflow-wait-human-approve',
        'workflow-error',

        'workflow-llm-start',
        'workflow-llm-reasoning-start',
        'workflow-llm-reasoning-delta',
        'workflow-llm-reasoning-end',

        'workflow-llm-text-start',
        'workflow-llm-text-delta',
        'workflow-llm-text-end',

        'workflow-llm-tool-calls-start',
        'workflow-llm-tool-call-name',
        'workflow-llm-tool-call-arguments',
        'workflow-llm-tool-calls-end',

        'workflow-llm-end',
        'workflow-llm-result',
        'workflow-llm-error',

        'workflow-tool-call-start',
        'workflow-tool-call-success',
        'workflow-tool-call-error',
        'workflow-tool-call-reject',
      ])
    ) satisfies (keyof WorkflowEvents)[]
    workflowEventNames.forEach((eventName) => {
      onWorkflowEvent(eventName, (data: any) => {
        ipcMainApi.send(eventName, data)
      })
    })
  }
}
