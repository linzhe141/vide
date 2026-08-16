import { Agent } from '@vide/agent'
import type { Session } from '@vide/agent'
import type { WorkflowEvent } from '@vide/agent'
import type { AppManager } from '@/appManager'
import { ipcMainApi } from '@/ipc/api/ipcMain'
import { settingsStore } from '@/modules/settingsStore'
import { logger } from '@/logger'

/**
 * Agent 会话注册中心。
 *
 * 桌面端 IPC（AgentIpcMainService）与微信 Bot（WechatBot）共用同一套
 * Agent / Session 实例：微信只是 agent 的另一个入口，创建/驱动的 session
 * 与桌面端是同一个 session，运行事件统一广播到 renderer，从而桌面 UI
 * 与微信会话保持同步更新。
 */
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
  createSession(data: { workspacePath: string | null; autoApprove: boolean; thinkingMode: boolean }) {
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

  /**
   * 向指定 session 发起一次 prompt 并运行到结束。
   *  - 遍历 workflow stream，把每个事件广播到 renderer（桌面 UI 同步更新）
   *  - 收集并返回 agent 的最终文本（供微信等入口回复）
   * @returns agent 最终文本
   */
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

  listSessionIds(): string[] {
    return [...this.sessions.keys()]
  }
}
