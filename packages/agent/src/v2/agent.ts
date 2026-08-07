import { Session } from './session'

export class Agent {
  get settings() {
    return {}
  }

  createSession() {
    const newSession = new Session()
    // 设置默认分支 main 的 head 和 source 为 null
    newSession.branchs[newSession.activeBranch] = { head: null, source: null }
    return newSession
  }
}
