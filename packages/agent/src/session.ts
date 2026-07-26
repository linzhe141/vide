import { v4 as uuid } from 'uuid'
import type { PlanStep, WaitHumanApprovePayload } from './types'
import { Workflow, WorkflowRuntimeContextNew } from './workflow'
import type { ChatMessage } from '@vide/ai'
import { WorkflowStream } from './event/stream'

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
  // config context
  workspacePath: string | null
  autoApprove: boolean

  // workflow graph context
  activeBranch = 'main'
  branchs: Record<string, SessionBranch> = {}
  workflowNodeMap = new Map<string, SessionWorkflowNode>()
  origin: SessionOrigin | null

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

  send(userInput: string) {
    const stream = new WorkflowStream()
    this.runWorkflow(userInput, stream)
    return stream
  }

  createWorkflow(stream: WorkflowStream) {
    const workflowRuntimeContext = new WorkflowRuntimeContextNew({
      sessionId: this.sessionId,
      workspacePath: this.workspacePath,
      getAutoApprove: () => this.autoApprove,
      stream,
      buildLLMMessages: () => this.buildLLMMessages(),
    })
    const workflowCommitNode: SessionWorkflowNode = {
      id: workflowRuntimeContext.workflowId,
      stopStatus: null as any,
      messages: workflowRuntimeContext.workflowMessages.getMessages(),
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

  async runWorkflow(userInput: string, stream: WorkflowStream) {
    try {
      const { workflow, workflowCommitNode } = this.createWorkflow(stream)
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
        this.finishWorkflow(workflow)
      } else if (result === 'WAIT_HUMAN_APPROVE') {
        this.watiHumanWorkflow = workflow
      }
    } finally {
      this.runningWorkflow = null
    }
  }

  finishWorkflow(workflow: Workflow) {
    const workflowNode = this.getWorkflowNode(workflow.runtime.workflowId)
    if (!workflowNode) return
    workflowNode.stopStatus = 'finished'
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

  // 在分支上切换到一个已经存在的工作流节点，重新生成后续的工作流
  //    a
  //   /
  //  b (click regenerate)
  //
  //    a(a`) 在真正启动 工作流之前，先切换到 a`，然后重新生成后续的工作流
  //   / \
  //  b   c (finished a`)
  checkoutRegeneratedWorkflow(branchName: string, source: SessionWorkflowNode) {
    this.activeBranch = branchName
    const parentNode = source.parent
    this.branchs[branchName] = {
      head: parentNode,
      source: parentNode,
    }
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
      const workflow = this.watiHumanWorkflow
      const runtime = workflow.runtime
      this.watiHumanWorkflow = null
      runtime.abort()
      runtime.workflowMessages.addAbortMessage()

      runtime.emit({
        eventName: 'workflow-aborted',
        data: {
          chunkData: {
            reasoning: runtime.assistantReasoningChunk,
            text: runtime.assistantChunk,
          },
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
      this.finishWorkflow(targetWorkflow)
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
      this.finishWorkflow(targetWorkflow)
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
