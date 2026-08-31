import { Agent, Workflow } from '@vide/agent'
import type { Session } from '@vide/agent'
import type { WorkflowEvent } from '@vide/agent'
import type { Tool } from '@vide/ai'
import type { AppManager } from '@/appManager'
import { ipcMainApi } from '@/ipc/api/ipcMain'
import { settingsStore } from '@/modules/settingsStore'
import { logger } from '@/logger'
import { SessionRepository } from '@/modules/sessionRepository'
import { SessionLoader } from '@/modules/sessionLoader'
import { WorkflowPersister } from '@/modules/workflowPersister'
import type { SessionSource } from '@vide/config'
import type { RunningWorkflowReplay } from '@/ipc/api/channels'

type StreamEvent = WorkflowEvent & {
  ctx: { sessionId: string | null; workflowId: string | null }
}

type SessionStopStatus = 'completed' | 'error' | 'aborted'

type PromptObserver = (event: StreamEvent) => void | Promise<void>

type SendUserMessageResult =
  | { kind: 'started-workflow' }
  | { kind: 'queued-steering'; workflowId: string; messageId: string }

export class AgentManager {
  agent: Agent
  sessions = new Map<string, Session>()
  /** 已从 DB 还原过的 session id，避免重复加载。 */
  private loaded = new Set<string>()
  private persister = new WorkflowPersister()

  constructor(private readonly app: AppManager) {
    this.agent = new Agent()
    this.agent.setWebSearchConfig({
      apiKey: settingsStore.get('webSearchConfig').apiKey,
      apiUrl: settingsStore.get('webSearchConfig').searchUrl,
    })
    this.agent.setGenerateImageConfig({
      apiKey: settingsStore.get('generateImageConfig').apiKey,
      baseUrl: settingsStore.get('generateImageConfig').baseUrl,
      model: settingsStore.get('generateImageConfig').model,
    })
  }

  init() {}

  setWebSearchConfig(config: { apiKey: string; apiUrl: string }) {
    this.agent.setWebSearchConfig(config)
  }

  setGenerateImageConfig(config: { apiKey: string; baseUrl: string; model: string }) {
    this.agent.setGenerateImageConfig(config)
  }

  /** 创建并注册一个 agent session，返回 session id。 */
  async createSession(data: {
    workspacePath: string | null
    autoApprove: boolean
    thinkingMode: boolean
    title?: string
    sessionSource?: SessionSource
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
      sessionSource: data.sessionSource ?? 'desktop',
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

    this.app.rendererEventBridge.publish({
      type: 'background-create-session',
      sessionId: session.id,
      title: data.title ?? '',
      sessionSource: data.sessionSource ?? 'desktop',
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

  /**
   * 确保某个 session 已在内存中。若为持久化 session（App 重启后从 DB 还原），
   * 则通过 SessionLoader 重建内存 Session + Workflow 图后注册进 this.sessions。
   * 已加载过或没有 DB 记录的 session 为 no-op。
   */
  async ensureSessionLoaded(sessionId: string): Promise<void> {
    if (this.sessions.has(sessionId) || this.loaded.has(sessionId)) return

    this.loaded.add(sessionId)
    let session: Session | null = null
    try {
      session = await SessionLoader.loadSession(sessionId, this.agent)
    } catch (error) {
      logger.error('agent-manager ensureSessionLoaded error', sessionId, error)
    }
    if (!session) return

    session.setupModel({
      name: settingsStore.get('llmConfig').model,
      baseURL: settingsStore.get('llmConfig').baseUrl,
      apiKey: settingsStore.get('llmConfig').apiKey,
    })
    this.sessions.set(session.id, session)
    logger.info('agent-manager restored-session ', session.id)
  }

  /** 首次拿到用户输入时，用它当 session 标题，并广播给 renderer 更新 history。 */
  private async ensureSessionTitle(session: Session, input: string) {
    if (session.title || !input) return
    session.title = input.trim().slice(0, 60)
    session.updatedAt = Date.now()
    await SessionRepository.setSessionTitle(session.id, session.title)
    this.app.rendererEventBridge.publish({
      type: 'session-title',
      sessionId: session.id,
      title: session.title,
    })
  }

  private async publishSessionUpdated(session: Session) {
    await SessionRepository.touchSession(session.id, session.updatedAt)
    this.app.rendererEventBridge.publish({
      type: 'session-updated',
      sessionId: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    })
  }

  private async queueSteeringMessageIfRunning(
    session: Session,
    input: string,
    inputSource: SessionSource
  ): Promise<Extract<SendUserMessageResult, { kind: 'queued-steering' }> | null> {
    const queued = session.enqueueSteeringMessage({ input, inputSource })
    if (!queued) {
      return null
    }

    await this.publishSessionUpdated(session)
    this.app.rendererEventBridge.publish({
      type: 'session-steering-queued',
      sessionId: session.id,
      workflowId: queued.workflowId,
      messageId: queued.messageId,
      content: queued.input,
      inputSource: queued.inputSource,
      createdAt: queued.createdAt,
    })

    return {
      kind: 'queued-steering',
      workflowId: queued.workflowId,
      messageId: queued.messageId,
    }
  }

  /**
   * 统一处理 workflow stream：
   * - 每个事件广播给 renderer（实时 UI）；
   * - stream 真正结束后，一次性持久化该 workflow 的 agent messages + 完整日志；
   * - 抽取最终文本（workflow.llm.text.end / workflow.completed.result）。
   */
  private async runPrompt(
    session: Session,
    input: string,
    onEvent?: PromptObserver,
    inputSource: SessionSource = 'desktop',
    extraTools?: Tool[]
  ): Promise<string> {
    const branchName = session.activeBranch
    const stream = await session.prompt(input, { inputSource, extraTools })
    const workflowId = stream.workflowId!

    this.persister.markPending(workflowId)
    let finalText = ''
    let stopStatus: SessionStopStatus | null = null

    try {
      for await (const event of stream) {
        const v2Event = event as StreamEvent
        if (onEvent) {
          await onEvent(v2Event)
        }
        this.app.rendererEventBridge.publish(v2Event)

        switch (event.type) {
          case 'workflow.llm.text.end':
            finalText = event.content ?? ''
            break
          case 'workflow.completed':
            stopStatus = 'completed'
            finalText = typeof event.result === 'string' ? event.result : finalText
            break
          case 'workflow.aborted':
            stopStatus = 'aborted'
            break
          case 'workflow.error':
            stopStatus = 'error'
            break
          default:
            break
        }
      }
    } finally {
      try {
        if (stopStatus) {
          await this.persister.persistWorkflow(
            session,
            workflowId,
            branchName,
            input,
            inputSource,
            stopStatus,
            stream.recordedEvents
          )
        }
      } finally {
        this.persister.clearPending(workflowId)
      }
    }

    return finalText
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

  getRunningWorkflowReplays(sessionId: string): RunningWorkflowReplay[] {
    const session = this.sessions.get(sessionId)
    if (!session) return []

    return Object.values(session.sessionWorkflowNodes).flatMap((node) => {
      if (node.stopStatus || !(node.workflow instanceof Workflow)) {
        return []
      }

      const recordedEvents = [...node.workflow.stream.recordedEvents]
      if (!recordedEvents.length) {
        return []
      }

      return [
        {
          workflowId: node.workflow.id,
          recordedEvents,
        },
      ]
    })
  }

  async prompt(
    sessionId: string,
    input: string,
    inputSource: SessionSource = 'desktop',
    extraTools?: Tool[]
  ): Promise<string> {
    await this.ensureSessionLoaded(sessionId)
    const session = this.getSession(sessionId)
    await this.ensureSessionTitle(session, input)
    session.updatedAt = Date.now()
    await this.publishSessionUpdated(session)
    return this.runPrompt(session, input, undefined, inputSource, extraTools)
  }

  async sendUserMessage(
    sessionId: string,
    input: string,
    inputSource: SessionSource = 'desktop'
  ): Promise<SendUserMessageResult> {
    await this.ensureSessionLoaded(sessionId)
    const session = this.getSession(sessionId)

    const queued = await this.queueSteeringMessageIfRunning(session, input, inputSource)
    if (queued) {
      return queued
    }

    this.prompt(sessionId, input, inputSource).catch((error) => {
      logger.error('agent-manager sendUserMessage failed', error)
    })
    return { kind: 'started-workflow' }
  }

  async backgroundPrompt(
    sessionId: string,
    input: string,
    onEvent?: PromptObserver,
    inputSource: SessionSource = 'desktop',
    extraTools?: Tool[]
  ): Promise<string> {
    await this.ensureSessionLoaded(sessionId)
    const session = this.getSession(sessionId)
    const queued = await this.queueSteeringMessageIfRunning(session, input, inputSource)
    if (queued) {
      return '已加入补充消息，当前 workflow 会在本轮工具执行结束或完成前继续处理。'
    }

    await this.ensureSessionTitle(session, input)
    session.updatedAt = Date.now()
    await this.publishSessionUpdated(session)
    ipcMainApi.send('agent-session-background-send', { sessionId })
    return this.runPrompt(session, input, onEvent, inputSource, extraTools)
  }

  listSessionIds(): string[] {
    return [...this.sessions.keys()]
  }

  countRunningSessions(): number {
    const pendingWorkflowIds = new Set(this.persister.getPendingWorkflowIds())
    if (!pendingWorkflowIds.size) return 0

    let count = 0
    for (const session of this.sessions.values()) {
      const hasRunningWorkflow = Object.keys(session.sessionWorkflowNodes).some((workflowId) =>
        pendingWorkflowIds.has(workflowId)
      )
      if (hasRunningWorkflow) {
        count += 1
      }
    }
    return count
  }
}
