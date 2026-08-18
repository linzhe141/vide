import { logger } from '@/logger'
import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '../../api/ipcMain'
import { SessionRepository } from '@/modules/sessionRepository'

/**
 * 桌面端 agent IPC。真正的 session 注册/运行逻辑收敛在 AppManager.agentManager，
 * 微信 Bot 作为另一个入口复用同一套 session，因此本服务与 WeChat 驱动的是同一个
 * agent 会话，UI 事件也由 AgentManager.prompt 统一广播。
 */
export class AgentIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    const agentManager = this.appManager.agentManager

    ipcMainApi.handle('agent-create-session', async (data) => {
      const workspacePath = data.workspacePath ?? null
      await this.appManager.workspaceManager.ensureVideHome(workspacePath)
      const sessionId = await agentManager.createSession({
        workspacePath,
        autoApprove: data.autoApprove,
        thinkingMode: data.thinkingMode,
      })
      logger.info('agent-create-session ', sessionId)
      return sessionId
    })

    ipcMainApi.handle('agent-session-send', async ({ sessionId, input }) => {
      logger.info('agent-session-send ', sessionId, input)
      // fire-and-forget：事件由 AgentManager.prompt 广播到 renderer
      void agentManager.prompt(sessionId, input)
    })

    ipcMainApi.handle('agent-resume-session', async ({ sessionId }) => {
      // 会话数据优先从 SQLite 持久化存储中加载（session/workflow/branch/agent message/log）。
      return SessionRepository.loadSessionData(sessionId)
    })

    ipcMainApi.handle('query-workflow-is-completed', async ({ sessionId, workflowId }) => {
      await agentManager.ensureSessionLoaded(sessionId)
      const session = agentManager.getSession(sessionId)
      const node = session.sessionWorkflowNodes[workflowId]
      return !!node?.stopStatus
    })

    ipcMainApi.handle('resume-running-workflow', async (_data) => {
      // v2 workflow stream runs continuously in-memory; no extra resume logic is required.
    })

    ipcMainApi.handle('agent-session-switch-auto-approve', async ({ sessionId, autoApprove }) => {
      await agentManager.ensureSessionLoaded(sessionId)
      const session = agentManager.getSession(sessionId)
      session.autoApprove = autoApprove
      await SessionRepository.setSessionAutoApprove(sessionId, autoApprove)
    })

    ipcMainApi.handle('agent-session-switch-thinking-mode', async ({ sessionId, thinkingMode }) => {
      await agentManager.ensureSessionLoaded(sessionId)
      const session = agentManager.getSession(sessionId)
      session.thinkingMode = thinkingMode
      await SessionRepository.setSessionThinkingMode(sessionId, thinkingMode)
    })

    ipcMainApi.handle('agent-human-approved', async ({ sessionId, workflowId }) => {
      await agentManager.ensureSessionLoaded(sessionId)
      const session = agentManager.getSession(sessionId)
      session.humanApprove(workflowId)
    })
    ipcMainApi.handle('agent-session-abort', async ({ sessionId }) => {
      await agentManager.ensureSessionLoaded(sessionId)
      const session = agentManager.getSession(sessionId)
      session.abort()
    })

    // 在分支上切换到一个已经存在的工作流节点，重新生成后续的工作流
    ipcMainApi.handle(
      'agent-workflow-regenerate',
      async ({ sessionId, targetWorkflowId, branchName, input }) => {
        logger.info('agent-workflow-regenerate ', sessionId, branchName, targetWorkflowId, input)
        await agentManager.ensureSessionLoaded(sessionId)
        const session = agentManager.getSession(sessionId)
        const targetNode = session.sessionWorkflowNodes[targetWorkflowId]
        if (!targetNode) return

        const parentNode = targetNode.parent
        const sourceWorkflow = parentNode ? parentNode.workflow.id : targetNode.parent?.workflow?.id ?? null

        session.createBranch(branchName, parentNode ?? null)
        session.switchBranch(branchName)

        await SessionRepository.upsertBranch({
          sessionId,
          name: branchName,
          headWorkflowId:
            session.currentBranch?.head?.workflow.id ?? (parentNode?.workflow.id ?? null),
          sourceWorkflowId: sourceWorkflow,
        })
        await SessionRepository.switchBranch(sessionId, branchName)
      }
    )

    ipcMainApi.handle('ask-user-question-submit', async (_data) => {
      // v2 in-memory mode: no persistence side effects.
    })
  }
}

