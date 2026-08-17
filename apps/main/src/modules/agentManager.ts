import { Agent } from '@vide/agent'
import type { Session } from '@vide/agent'
import type { WorkflowEvent } from '@vide/agent'
import type { AppManager } from '@/appManager'
import { ipcMainApi } from '@/ipc/api/ipcMain'
import { settingsStore } from '@/modules/settingsStore'
import { logger } from '@/logger'
import { SessionRepository } from '@/modules/sessionRepository'

export class AgentManager {
  agent: Agent
  sessions = new Map<string, Session>()

  constructor(private app: AppManager) {
    this.agent = new Agent()
    this.agent.setWebSearchConfig({
      apiKey: settingsStore.get('webSearchConfig').apiKey,
      apiUrl: settingsStore.get('webSearchConfig').searchUrl,
    })
  }

  init() {}

  /** 创建并注册一个 agent session，返回 session id。 */
  async createSession(data: {
    workspacePath: string | null
    autoApprove: boolean
    thinkingMode: boolean
    title?: string
  }) {
    const session = this.agent.createSession({
      workspacePath: data.workspacePath,
      autoApprove: data.autoApprove,
      thinkingMode: data.thinkingMode,
    })
    session.setupModel({
      name: settingsStore.get('llmConfig').model,
      baseURL: settingsStore.get('llmConfig').baseUrl,
      apiKey: settingsStore.get('llmConfig').apiKey,
    })
    this.sessions.set(session.id, session)
    logger.info('agent-manager create-session ', session.id)

    await SessionRepository.ensureSession({
      id: session.id,
      title: data.title ?? '',
      type: session.sessionType ?? 'normal',
      workspacePath: session.workspacePath,
      autoApprove: session.autoApprove,
      thinkingMode: session.thinkingMode,
    })
    await SessionRepository.upsertBranch({
      sessionId: session.id,
      name: session.activeBranch,
      headWorkflowId: null,
      sourceWorkflowId: null,
    })

    // 通知 renderer：新增一个 session（前台/后台入口都走这条广播，
    // 前端 useAgentSessionEvent 统一在 sessionStore/historyStore 落盘）
    ipcMainApi.send('background-create-session', {
      type: 'background-create-session',
      sessionId: session.id,
      title: data.title ?? '',
      workspacePath: session.workspacePath,
      autoApprove: session.autoApprove,
      thinkingMode: session.thinkingMode,
      sessionType: session.sessionType ?? 'normal',
      origin: null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    })

    return session.id
  }

  /** 首次拿到用户输入时，用它当 session 标题，并广播给 renderer 更新 history。 */
  private async ensureSessionTitle(session: Session, input: string) {
    if (session.title || !input) return
    session.title = input.trim().slice(0, 60)
    session.updatedAt = Date.now()
    await SessionRepository.setSessionTitle(session.id, session.title)
    ipcMainApi.send('session-title', {
      type: 'session-title',
      sessionId: session.id,
      title: session.title,
    })
  }

  /** 统一处理 workflow stream 事件：广播给 renderer + 持久化日志/消息/状态。 */
  private async persistWorkflowEvent(
    session: Session,
    event: WorkflowEvent & { ctx: { sessionId: string | null; workflowId: string | null } }
  ) {
    const workflowId = event.ctx.workflowId
    // 落日志（不含 ctx 的事件载荷）
    const { ctx: _ctx, ...payload } = event
    const node = workflowId ? session.sessionWorkflowNodes[workflowId] : undefined

    if (workflowId && node) {
      try {
        await SessionRepository.appendWorkflowLog(workflowId, event.type, payload)
      } catch (error) {
        logger.error('appendWorkflowLog error', error)
      }
    }

    switch (event.type) {
      case 'workflow.start': {
        if (workflowId && node) {
          const parentId = node.parent?.workflow.id ?? null
          await SessionRepository.createWorkflow({
            workflowId,
            sessionId: session.id,
            parentWorkflowId: parentId,
            input: event.input,
          })
          // 更新活动分支 head（生成新 workflow 后切换 head）
          await SessionRepository.upsertBranch({
            sessionId: session.id,
            name: session.activeBranch,
            headWorkflowId: workflowId,
          })
        }
        break
      }
      case 'workflow.completed':
      case 'workflow.aborted':
      case 'workflow.error': {
        if (workflowId && node) {
          const messageRows = node.workflow.messages
          try {
            await SessionRepository.saveWorkflowMessages(workflowId, messageRows)
          } catch (error) {
            logger.error('saveWorkflowMessages error', error)
          }
          const stopStatus =
            event.type === 'workflow.completed'
              ? ('finished' as const)
              : event.type === 'workflow.aborted'
                ? ('aborted' as const)
                : ('error' as const)
          await SessionRepository.finishWorkflow(workflowId, stopStatus)
        }
        break
      }
      default:
        break
    }
  }

  getSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    return session
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  async prompt(sessionId: string, input: string): Promise<string> {
    const session = this.getSession(sessionId)
    await this.ensureSessionTitle(session, input)
    const stream = session.prompt(input)
    let finalText = ''
    for await (const event of stream) {
      const v2Event = event as WorkflowEvent & {
        ctx: { sessionId: string | null; workflowId: string | null }
      }
      ipcMainApi.send(v2Event.type as any, v2Event as any)
      await this.persistWorkflowEvent(session, v2Event)

      switch (event.type) {
        case 'workflow.llm.text.end':
          finalText = event.content ?? ''
          break
        case 'workflow.completed':
          finalText = typeof event.result === 'string' ? event.result : finalText
          break
        default:
          break
      }
    }
    return finalText
  }

  async backgroundPrompt(sessionId: string, input: string): Promise<string> {
    const session = this.getSession(sessionId)
    await this.ensureSessionTitle(session, input)
    const stream = session.prompt(input)
    ipcMainApi.send('agent-session-background-send', { sessionId })
    let finalText = ''
    for await (const event of stream) {
      const v2Event = event as WorkflowEvent & {
        ctx: { sessionId: string | null; workflowId: string | null }
      }
      ipcMainApi.send(v2Event.type as any, v2Event as any)
      await this.persistWorkflowEvent(session, v2Event)
      switch (event.type) {
        case 'workflow.llm.text.end':
          finalText = event.content ?? ''
          break
        case 'workflow.completed':
          finalText = typeof event.result === 'string' ? event.result : finalText
          break
        default:
          break
      }
    }
    return finalText
  }

  listSessionIds(): string[] {
    return [...this.sessions.keys()]
  }
}
