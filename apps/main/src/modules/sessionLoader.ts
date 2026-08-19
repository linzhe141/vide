import { type Agent, restoreSessionFromPersistedData } from '@vide/agent'
import { SessionRepository } from '@/modules/sessionRepository'

/**
 * main 侧只负责从存储层取出原始 agent 数据；具体 Session/Workflow 图恢复由 agent lib 负责。
 */
export class SessionLoader {
  static async loadSession(sessionId: string, agent: Agent) {
    const data = await SessionRepository.loadSessionData(sessionId)
    if (!data) return null
    return restoreSessionFromPersistedData(data, agent.settings)
  }
}
