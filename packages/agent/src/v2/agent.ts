import { Session } from './session'

export class Agent {
  get settings() {
    return {}
  }

  createSession(data: { workspacePath: string | null; autoApprove: boolean }) {
    const newSession = new Session()
    // 设置默认分支 main 的 head 和 source 为 null
    newSession.branchs[newSession.activeBranch] = { head: null, source: null }
    if (data.workspacePath) {
      newSession.workspacePath = data.workspacePath
    }
    newSession.autoApprove = data.autoApprove
    return newSession
  }
}
