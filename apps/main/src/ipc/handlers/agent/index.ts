import { Agent } from '@vide/agent'
import type { Session } from '@vide/agent'
import type { WorkflowEvent } from '@vide/agent'
import { logger } from '@/logger'
import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '../../api/ipcMain'
import { settingsStore } from '@/modules/settingsStore'
export class AgentIpcMainService implements IpcMainService {
  agent: Agent
  sessions = new Map<string, Session>()

  constructor(private appManager: AppManager) {
    this.agent = new Agent()
  }

  registerIpcMainHandle() {
    ipcMainApi.handle('agent-create-session', async (data) => {
      const workspacePath = data.workspacePath ?? null
      await this.appManager.workspaceManager.ensureVideHome(workspacePath)
      const session = this.agent.createSession({
        workspacePath,
        autoApprove: data.autoApprove,
      })
      session.setupModel({
        name: settingsStore.get('llmConfig').model,
        baseURL: settingsStore.get('llmConfig').baseUrl,
        apiKey: settingsStore.get('llmConfig').apiKey,
      })
      this.sessions.set(session.id, session)

      logger.info('agent-create-session ', session.id)
      return session.id
    })

    ipcMainApi.handle('agent-session-send', async ({ sessionId, input }) => {
      logger.info('agent-session-send ', sessionId, input)
      const session = await this.getSession(sessionId)
      const stream = session.prompt(input)
      for await (const event of stream) {
        const v2Event = event as WorkflowEvent & {
          ctx: { sessionId: string | null; workflowId: string | null }
        }
        ipcMainApi.send(v2Event.type as any, v2Event as any)
      }
    })

    ipcMainApi.handle('agent-resume-session', async ({ sessionId }) => {
      const session = await this.getSession(sessionId)
      return this.buildSessionPayload(session)
    })

    ipcMainApi.handle('query-workflow-is-completed', async ({ sessionId, workflowId }) => {
      const session = await this.getSession(sessionId)
      const node = session.sessionWorkflowNodes[workflowId]
      return !!node?.stopStatus
    })

    ipcMainApi.handle('resume-running-workflow', async (_data) => {
      // v2 workflow stream runs continuously in-memory; no extra resume logic is required.
    })

    ipcMainApi.handle('agent-session-switch-auto-approve', async ({ sessionId, autoApprove }) => {
      const session = await this.getSession(sessionId)
      session.autoApprove = autoApprove
    })

    // 在分支上切换到一个已经存在的工作流节点，重新生成后续的工作流
    //    a
    //   /
    //  b (click regenerate)
    //
    //    a(a`) 在真正启动 工作流之前，先切换到 a`，然后重新生成后续的工作流
    //   / \
    //  b   c (finished a`)
    ipcMainApi.handle(
      'agent-workflow-regenerate',
      async ({ sessionId, targetWorkflowId, branchName, input }) => {
        logger.info('agent-workflow-regenerate ', sessionId, branchName, targetWorkflowId, input)
        const session = await this.getSession(sessionId)
        const targetNode = session.sessionWorkflowNodes[targetWorkflowId]
        if (!targetNode) return

        const parentNode = targetNode.parent

        session.createBranch(branchName, parentNode!)
        session.switchBranch(branchName)
      }
    )

    ipcMainApi.handle('ask-user-question-submit', async (_data) => {
      // v2 in-memory mode: no persistence side effects.
    })
  }

  private async getSession(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    return session
  }

  private buildSessionPayload(session: Session) {
    const branches = Object.entries(session.branchs).map(([name, branch]) => ({
      name,
      headWorkflowId: branch.head?.workflow.id ?? null,
      sourceWorkflowId: branch.source?.workflow.id ?? null,
    }))

    const workflowData = Object.values(session.sessionWorkflowNodes).map((node) => ({
      id: node.workflow.id,
      userInput:
        node.workflow.messages.find((message) => message.role === 'user')?.content?.toString() ??
        '',
      parentWorkflowId: node.parent?.workflow.id ?? null,
      stopStatus: (node.stopStatus ?? 'finished') as 'finished' | 'aborted' | 'error',
      feedback: null,
      messages: [],
      askUserSubmitValue: undefined,
    }))

    return {
      sessionType: 'normal' as const,
      title: '',
      origin: null,
      activeBranch: session.activeBranch,
      branches,
      planner: [],
      workflowData,
      autoApprove: session.autoApprove,
      artifacts: [],
    }
  }
}
