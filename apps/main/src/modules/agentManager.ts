import { Agent } from '@vide/agent'
import type { Session } from '@vide/agent'
import type { WorkflowEvent } from '@vide/agent'
import type { AppManager } from '@/appManager'
import { ipcMainApi } from '@/ipc/api/ipcMain'
import type { LoadedSessionPayload } from '@/ipc/api/channels'
import { settingsStore } from '@/modules/settingsStore'
import { logger } from '@/logger'

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
  createSession(data: {
    workspacePath: string | null
    autoApprove: boolean
    thinkingMode: boolean
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
    return session.id
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
    const stream = session.prompt(input)
    let finalText = ''
    for await (const event of stream) {
      const v2Event = event as WorkflowEvent & {
        ctx: { sessionId: string | null; workflowId: string | null }
      }
      ipcMainApi.send(v2Event.type as any, v2Event as any)

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
    const stream = session.prompt(input)
    ipcMainApi.send('agent-session-background-send', { sessionId })
    let finalText = ''
    for await (const event of stream) {
      const v2Event = event as WorkflowEvent & {
        ctx: { sessionId: string | null; workflowId: string | null }
      }
      ipcMainApi.send(v2Event.type as any, v2Event as any)
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

  /**
   * 把内存中的 agent session 序列化为前端可还原的数据结构，并通过 IPC 返回给 renderer。
   *
   * 这里采用 invoke/return 的 request-response 方式（前端主动调用 load-session 并拿到返回值），
   * 不同于 prompt 里按事件流广播的方式。并且透传的是后端的 workflow messages
   * （AgentMessage，openai chat 格式），与前端 UI 的 SessionMessage 结构不同，
   * 需要由前端 sessionStore.loadSession 统一还原成 UI message。
   */
  loadSession(sessionId: string): LoadedSessionPayload {
    const session = this.getSession(sessionId)

    return {
      sessionId,
      autoApprove: session.autoApprove,
      thinkingMode: session.thinkingMode,
      workspacePath: session.workspacePath,
      activeBranch: session.activeBranch,
      branches: Object.entries(session.branchs).map(([branchName, branch]) => ({
        name: branchName,
        headWorkflowId: branch.head?.workflow.id ?? null,
        sourceWorkflowId: branch.source?.workflow.id ?? null,
      })),
      workflowNodes: Object.values(session.sessionWorkflowNodes).map((node) => ({
        workflow: {
          id: node.workflow.id,
          stopStatus: (node.stopStatus ?? null) as 'finished' | 'error' | 'aborted' | null,
          messages: node.workflow.messages,
        },
        children: node.children.map((child) => child.workflow.id),
        parent: node.parent?.workflow.id ?? null,
      })),
    }
  }
}
