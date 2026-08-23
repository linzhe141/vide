import type { AgentMessage } from '@vide/ai'
import type { Agent } from './agent'
import {
  LoadedWorkflow,
  Session,
  type SessionBranch,
  type SessionWorkflowNode,
  type SessionType,
  type SessionInputSource,
} from './session'
import type { StopReason } from './workflow'

export type PersistedWorkflowStopStatus = StopReason | null

export type PersistedWorkflowAgentMessage = {
  payload: string | null
}

export type PersistedWorkflowData = {
  id: string
  parentWorkflowId: string | null
  inputSource: SessionInputSource
  stopStatus: PersistedWorkflowStopStatus
  input: string
  agentMessages: PersistedWorkflowAgentMessage[]
}

export type PersistedSessionBranch = {
  name: string
  headWorkflowId: string | null
  sourceWorkflowId: string | null
}

export type PersistedSessionData = {
  id: string
  title: string
  type: SessionType
  activeBranch: string
  autoApprove: boolean
  thinkingMode: boolean
  workspacePath: string | null
  branches: PersistedSessionBranch[]
  workflows: PersistedWorkflowData[]
  createdAt: number
  updatedAt: number
}

/**
 * 从持久化的原始 agent 数据还原 Session + Workflow 图。
 * 仅恢复与继续对话相关的 graph / messages；运行时 stepPayload、流状态等不参与持久化。
 */
export function restoreSessionFromPersistedData(
  data: PersistedSessionData,
  agentSettings: Agent['settings']
): Session {
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

  const nodes = new Map<string, SessionWorkflowNode>()
  for (const wf of data.workflows) {
    const workflow = buildInertWorkflow(wf)
    nodes.set(wf.id, {
      workflow,
      parent: null,
      children: [],
      stopStatus: toNodeStopStatus(wf.stopStatus),
    })
  }

  for (const wf of data.workflows) {
    const node = nodes.get(wf.id)
    if (!node || !wf.parentWorkflowId) continue
    const parent = nodes.get(wf.parentWorkflowId)
    if (!parent) continue
    node.parent = parent
    parent.children.push(node)
  }

  session.sessionWorkflowNodes = Object.fromEntries(nodes)

  const branches: Record<string, SessionBranch> = {}
  for (const branch of data.branches) {
    branches[branch.name] = {
      head: branch.headWorkflowId ? (nodes.get(branch.headWorkflowId) ?? null) : null,
      source: branch.sourceWorkflowId ? (nodes.get(branch.sourceWorkflowId) ?? null) : null,
    }
  }

  session.branches = branches
  session.branches[session.activeBranch] ??= { head: null, source: null }

  return session
}

function buildInertWorkflow(wf: PersistedWorkflowData): LoadedWorkflow {
  return new LoadedWorkflow(wf.id, decodeAgentMessages(wf))
}

function decodeAgentMessages(wf: PersistedWorkflowData): AgentMessage[] {
  const messages: AgentMessage[] = []
  for (const row of wf.agentMessages) {
    if (!row.payload) continue
    try {
      messages.push(JSON.parse(row.payload) as AgentMessage)
    } catch {
      // Ignore malformed persisted rows so the rest of the session can still load.
    }
  }
  return messages
}

function toNodeStopStatus(
  stopStatus: PersistedWorkflowStopStatus
): SessionWorkflowNode['stopStatus'] {
  return stopStatus === 'completed' || stopStatus === 'error' || stopStatus === 'aborted'
    ? stopStatus
    : undefined
}
