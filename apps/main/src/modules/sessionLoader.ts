import {
  type Agent,
  Session,
  Workflow,
  WorkflowStream,
  type SessionBranch,
  type SessionWorkflowNode,
} from '@vide/agent'
import type { AgentMessage } from '@vide/ai'
import type { SessionDataDto, SessionWorkflowData } from '@vide/config'
import { SessionRepository } from '@/modules/sessionRepository'

/**
 * 从 SQLite（SessionRepository.loadSessionData）把已持久化的 session 还原成
 * 内存中的 Session + Workflow 图，使 App 重启后 AgentManager 仍能对历史会话
 * 运行 prompt()/abort()/humanApprove()。
 *
 * 约定：DB 只存「原始 agent 数据」（OpenAI 格式的 AgentMessage + workflow 事件日志），
 * 前端在 load session data 后自行派生 UI 态。这里还原的是后端侧可运行的内存图，
 * 而不是 UI 态 —— 两者职责分离，互不耦合。
 *
 * 还原出来的 Workflow 都是「惰性」的（已经终止，仅承载 messages/id/图关系），
 * 不会真正运行；下一个 prompt() 会作为新 commit 追加到 currentBranch.head。
 */
export class SessionLoader {
  static async loadSession(
    sessionId: string,
    agentSettings: Agent['settings']
  ): Promise<Session | null> {
    const data = await SessionRepository.loadSessionData(sessionId)
    if (!data) return null

    const session = new Session(agentSettings)
    session.id = data.id
    session.title = data.title ?? ''
    session.sessionType = data.type
    session.activeBranch = data.activeBranch
    session.autoApprove = data.autoApprove
    session.thinkingMode = data.thinkingMode
    session.workspacePath = data.workspacePath
    session.createdAt = data.createdAt
    session.updatedAt = data.updatedAt

    // 1) 先构建 nodes（含惰性 workflow），再链接 parent/children
    const nodes = new Map<string, SessionWorkflowNode>()
    for (const wf of data.workflows) {
      const workflow = buildInertWorkflow(session, wf)
      nodes.set(wf.id, {
        workflow,
        parent: null,
        children: [],
        stopStatus: toNodeStopStatus(wf.stopStatus),
      })
    }
    for (const wf of data.workflows) {
      const node = nodes.get(wf.id)!
      if (wf.parentWorkflowId && nodes.has(wf.parentWorkflowId)) {
        node.parent = nodes.get(wf.parentWorkflowId)!
        nodes.get(wf.parentWorkflowId)!.children.push(node)
      }
    }

    session.sessionWorkflowNodes = Object.fromEntries(nodes)

    // 2) 还原分支图（head/source 指向对应的 node）
    const branches: Record<string, SessionBranch> = {}
    for (const b of data.branches) {
      branches[b.name] = {
        head: b.headWorkflowId ? nodes.get(b.headWorkflowId) ?? null : null,
        source: b.sourceWorkflowId ? nodes.get(b.sourceWorkflowId) ?? null : null,
      }
    }
    session.branches = branches

    return session
  }
}

/**
 * 构建一个「惰性」Workflow：不真正运行，仅承载持久化下来的 messages 与图关系。
 * context 采用最简占位（tools 为空、流不推事件），供 buildAgentMessages() 读取历史，
 * 以及让后续 prompt() 的图续接（commitWorkflow 只依赖 currentBranch.head）。
 */
function buildInertWorkflow(session: Session, wf: SessionWorkflowData): Workflow {
  const stream = new WorkflowStream()
  const workflow = new Workflow({
    model: { name: '', baseURL: '', apiKey: '' },
    sessionId: session.id,
    tools: [],
    stream,
    thinkingMode: session.thinkingMode,
    getAutoApprove: () => session.autoApprove,
    getSessionAgentMessages: () => session.buildAgentMessages(),
  })
  workflow.id = wf.id
  workflow.messages = decodeAgentMessages(wf)
  return workflow
}

/** 从持久化的 AgentMessage payload 还原 workflow.messages（原始 agent 消息，供 LLM 上下文）。 */
function decodeAgentMessages(wf: SessionWorkflowData): AgentMessage[] {
  const messages: AgentMessage[] = []
  for (const row of wf.agentMessages) {
    if (!row.payload) continue
    try {
      messages.push(JSON.parse(row.payload) as AgentMessage)
    } catch {
      // 忽略无法解析的脏数据
    }
  }
  return messages
}

/**
 * DTO 的 stopStatus（'completed' | 'error' | 'aborted' | 'interrupted' | null）→ 内存 node.stopStatus。
 * interrupted 在 agent 语义上仍是「可恢复的非终态」，故还原为 undefined，让下一次 prompt() 能从该节点续接。
 */
function toNodeStopStatus(
  stopStatus: SessionWorkflowData['stopStatus']
): SessionWorkflowNode['stopStatus'] {
  return stopStatus === 'completed' || stopStatus === 'error' || stopStatus === 'aborted'
    ? stopStatus
    : undefined
}
