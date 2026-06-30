import { v4 as uuid } from 'uuid'
import { agentEvent, workflowEvent } from './event'
import type { WaitHumanApprovePayload, PlanStep } from './types'
import { Workflow, WorkflowRuntimeContext } from './workflow'
import type { ChatMessage } from '@vide/ai'

export type SessionType = 'normal' | 'fork'

export interface SessionOrigin {
  sessionId: string
  workflowId: string | null
}

export interface SessionWorkflowNode {
  id: string
  stopStatus: 'finished' | 'error' | 'aborted'
  messages: ChatMessage[]
  parent: SessionWorkflowNode | null
  children: SessionWorkflowNode[]
}

export interface SessionBranch {
  head: SessionWorkflowNode | null
  source: SessionWorkflowNode | null
}

export interface SessionWorkflowSnapshot {
  id: string
  stopStatus: 'finished' | 'error' | 'aborted'
  parentWorkflowId: string | null
  messages: ChatMessage[]
}

export interface SessionBranchSnapshot {
  name: string
  headWorkflowId: string | null
  sourceWorkflowId: string | null
}

export interface SessionSnapshot {
  sessionId: string
  sessionType: SessionType
  origin: SessionOrigin | null
  workspacePath: string | null
  activeBranch: string
  autoApprove: boolean
  workflows: SessionWorkflowSnapshot[]
  branches: SessionBranchSnapshot[]
}

export class Session {
  sessionId: string
  sessionType: SessionType
  origin: SessionOrigin | null
  workspacePath: string | null
  activeBranch = 'main'
  branchs: Record<string, SessionBranch> = {}
  workflowNodeMap = new Map<string, SessionWorkflowNode>()
  autoApprove: boolean
  watiHumanWorkflow: Workflow | null = null
  runningWorkflow: Workflow | null = null
  planners: SessionPlaner[] = []

  constructor(options?: {
    sessionId?: string
    activeBranch?: string
    sessionType?: SessionType
    origin?: SessionOrigin | null
    workspacePath?: string | null
    autoApprove?: boolean
  }) {
    this.sessionId = options?.sessionId || uuid()
    this.activeBranch = options?.activeBranch || 'main'
    this.sessionType = options?.sessionType || 'normal'
    this.origin = options?.origin || null
    this.workspacePath = options?.workspacePath || null
    this.autoApprove = options?.autoApprove || false
  }

  get currentBranch() {
    return this.branchs[this.activeBranch]
  }

  async run(userInput: string) {
    try {
      const { workflow, workflowCommitNode } = this.createWorkflow(userInput)
      this.runningWorkflow = workflow
      const currentHead = this.currentBranch.head
      if (!currentHead) {
        this.currentBranch.head = workflowCommitNode
        if (!this.currentBranch.source) {
          this.currentBranch.source = workflowCommitNode
        }
      } else {
        workflowCommitNode.parent = currentHead
        currentHead.children.push(workflowCommitNode)
        this.currentBranch.head = workflowCommitNode
      }

      const result = await workflow.run(userInput)
      if (result === 'COMPLETED') {
        agentEvent.emit('agent-session-finished', { sessionId: this.sessionId, userInput })
      } else if (result === 'WAIT_HUMAN_APPROVE') {
        this.watiHumanWorkflow = workflow
      }
    } finally {
      this.runningWorkflow = null
    }
  }

  createWorkflow(userInput: string) {
    const parentWorkflowNode = this.currentBranch?.head ?? null
    const workflowRuntimeContext = new WorkflowRuntimeContext({
      session: this,
      userInput,
      branchName: this.activeBranch,
      parentWorkflowId: parentWorkflowNode?.id || null,
    })
    const workflowCommitNode: SessionWorkflowNode = {
      id: workflowRuntimeContext.workflowId,
      stopStatus: null as any,
      messages: workflowRuntimeContext.workflowSession.getMessages(),
      parent: null,
      children: [],
    }
    this.workflowNodeMap.set(workflowCommitNode.id, workflowCommitNode)
    const workflow = new Workflow(workflowRuntimeContext)
    return {
      workflowCommitNode,
      workflow,
    }
  }

  fork(targetCommitNode: SessionWorkflowNode) {
    const forkedSession = new Session({
      sessionType: 'fork',
      origin: {
        sessionId: this.sessionId,
        workflowId: targetCommitNode.id,
      },
      workspacePath: this.workspacePath,
    })
    forkedSession.branchs[forkedSession.activeBranch] = { head: null, source: null }

    const lineage: SessionWorkflowNode[] = []
    let current: SessionWorkflowNode | null = targetCommitNode
    while (current) {
      lineage.unshift(current)
      current = current.parent
    }

    let previousClonedNode: SessionWorkflowNode | null = null
    for (const sourceNode of lineage) {
      const clonedNode: SessionWorkflowNode = {
        id: uuid(),
        stopStatus: sourceNode.stopStatus,
        messages: deepCloneMessages(sourceNode.messages),
        parent: previousClonedNode,
        children: [],
      }
      if (previousClonedNode) {
        previousClonedNode.children.push(clonedNode)
      }
      forkedSession.workflowNodeMap.set(clonedNode.id, clonedNode)
      previousClonedNode = clonedNode
    }

    forkedSession.currentBranch.head = previousClonedNode
    return forkedSession
  }

  regenerateWorkflow(
    branchName: string,
    regenerateWorkflowNode: SessionWorkflowNode,
    input?: string
  ) {
    this.activeBranch = branchName
    const parentNode = regenerateWorkflowNode.parent
    this.branchs[branchName] = {
      head: parentNode,
      source: parentNode,
    }
    agentEvent.emit('agent-workflow-regenerated', {
      sessionId: this.sessionId,
      branchName,
      sourceWorkflowId: parentNode?.id || null,
      input,
    })
  }

  buildLLMMessages() {
    const currentHead = this.currentBranch?.head ?? null
    if (!currentHead) return []

    function traverse(node: SessionWorkflowNode, result: ChatMessage[] = []): ChatMessage[] {
      if (node.stopStatus !== 'aborted' && node.stopStatus !== 'error') {
        result.unshift(...node.messages)
      }
      if (node.parent) {
        traverse(node.parent, result)
      }
      return result
    }

    return traverse(currentHead)
  }

  compact() {
    // TODO implement compact to reduce message/token size for long sessions.
  }

  getWorkflowNode(workflowId: string) {
    return this.workflowNodeMap.get(workflowId) ?? null
  }

  abortWorkflow() {
    console.log('\nabortWorkflow\n')
    if (this.runningWorkflow) {
      const runtime = this.runningWorkflow.runtime
      runtime.abort()
      this.runningWorkflow = null
    }
    if (this.watiHumanWorkflow) {
      const runtime = this.watiHumanWorkflow.runtime
      runtime.abort()
      runtime.workflowSession.addAbortMessage()
      workflowEvent.emit('workflow-aborted', {
        ctx: runtime.workflowEventCtx,
        chunkData: {
          reasoning: runtime.assistantReasoningChunk,
          text: runtime.assistantChunk,
        },
      })
    }
  }

  async humanApprove(workflowId: string, payload: WaitHumanApprovePayload) {
    console.log('humanApprove', workflowId, payload)
    const targetWorkflow = this.watiHumanWorkflow
    if (!targetWorkflow) return
    this.watiHumanWorkflow = null
    const result = await targetWorkflow.approveHumanApprove(payload)
    if (result === 'COMPLETED') {
      agentEvent.emit('agent-session-finished', {
        sessionId: this.sessionId,
        userInput: targetWorkflow.runtime.userInput.at(-1) || '',
      })
    } else if (result === 'WAIT_HUMAN_APPROVE') {
      this.watiHumanWorkflow = targetWorkflow
    }
  }

  async rejectHumanApprove(workflowId: string, payload: WaitHumanApprovePayload) {
    console.log('rejectHumanApprove', workflowId, payload)
    const targetWorkflow = this.watiHumanWorkflow
    if (!targetWorkflow) return
    this.watiHumanWorkflow = null
    const result = await targetWorkflow.rejectHumanApprove(payload)
    if (result === 'COMPLETED') {
      agentEvent.emit('agent-session-finished', {
        sessionId: this.sessionId,
        userInput: targetWorkflow.runtime.userInput.at(-1) || '',
      })
    } else if (result === 'WAIT_HUMAN_APPROVE') {
      this.watiHumanWorkflow = targetWorkflow
    }
  }

  static resume(snapshot: SessionSnapshot) {
    const session = new Session({
      sessionId: snapshot.sessionId,
      activeBranch: snapshot.activeBranch,
      sessionType: snapshot.sessionType,
      origin: snapshot.origin,
      workspacePath: snapshot.workspacePath,
      autoApprove: snapshot.autoApprove,
    })
    const workflowNodeMap = new Map<string, SessionWorkflowNode>()

    for (const workflow of snapshot.workflows) {
      const node = {
        id: workflow.id,
        stopStatus: workflow.stopStatus,
        messages: workflow.messages,
        parent: null,
        children: [],
      }
      workflowNodeMap.set(workflow.id, node)
      session.workflowNodeMap.set(workflow.id, node)
    }

    for (const workflow of snapshot.workflows) {
      if (!workflow.parentWorkflowId) continue
      const node = workflowNodeMap.get(workflow.id)
      const parentNode = workflowNodeMap.get(workflow.parentWorkflowId)
      if (!node || !parentNode) continue
      node.parent = parentNode
      parentNode.children.push(node)
    }

    for (const branch of snapshot.branches) {
      session.branchs[branch.name] = {
        head: branch.headWorkflowId ? (workflowNodeMap.get(branch.headWorkflowId) ?? null) : null,
        source: branch.sourceWorkflowId
          ? (workflowNodeMap.get(branch.sourceWorkflowId) ?? null)
          : null,
      }
    }

    if (!(session.activeBranch in session.branchs)) {
      session.branchs[session.activeBranch] = { head: null, source: null }
    }

    return session
  }
}

export class SessionPlaner {
  id: string

  constructor(public plans: PlanStep[]) {
    this.id = uuid()
  }
}

function deepCloneMessages(messages: ChatMessage[]) {
  return JSON.parse(JSON.stringify(messages)) as ChatMessage[]
}
