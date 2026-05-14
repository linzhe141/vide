import { v4 as uuid } from 'uuid'
import { agentEvent } from './event'
import type { PlanStep } from './tools/planner'
import type { ChatMessage } from './types'
import { Workflow, WorkflowRuntimeContext } from './workflow'

export interface SessionWorkflowNode {
  id: string
  messages: ChatMessage[]
  parent: SessionWorkflowNode | null
  children: SessionWorkflowNode[]
}

export type SessionBranchHead = SessionWorkflowNode | null

export interface SessionWorkflowSnapshot {
  id: string
  parentWorkflowId: string | null
  messages: ChatMessage[]
}

export interface SessionBranchSnapshot {
  name: string
  headWorkflowId: string | null
}

export interface SessionSnapshot {
  sessionId: string
  activeBranch: string
  workflows: SessionWorkflowSnapshot[]
  branches: SessionBranchSnapshot[]
}

export class Session {
  sessionId: string
  activeBranch = 'main'
  branchs: Record<string, SessionBranchHead> = {}
  planners: SessionPlaner[] = []

  constructor(options?: { sessionId?: string; activeBranch?: string }) {
    this.sessionId = options?.sessionId || uuid()
    this.activeBranch = options?.activeBranch || 'main'
  }

  async run(userInput: string, branchName: string = this.activeBranch) {
    this.activeBranch = branchName

    const { workflow, workflowCommitNode } = this.createWorkflow(userInput)
    const currentBranchCommitNode = this.branchs[this.activeBranch]
    if (!currentBranchCommitNode) {
      this.branchs[this.activeBranch] = workflowCommitNode
    } else {
      workflowCommitNode.parent = currentBranchCommitNode
      currentBranchCommitNode.children.push(workflowCommitNode)
      this.branchs[this.activeBranch] = workflowCommitNode
    }

    await workflow.run(userInput)
    agentEvent.emit('agent-session-finished', { sessionId: this.sessionId, userInput })
  }

  createWorkflow(userInput: string) {
    const parentWorkflowNode = this.branchs[this.activeBranch]
    const workflowRuntimeContext = new WorkflowRuntimeContext({
      session: this,
      userInput,
      branchName: this.activeBranch,
      parentWorkflowId: parentWorkflowNode?.id || null,
    })
    const workflowCommitNode: SessionWorkflowNode = {
      id: workflowRuntimeContext.workflowId,
      messages: workflowRuntimeContext.thread.getMessages(),
      parent: null,
      children: [],
    }
    const workflow = new Workflow(workflowRuntimeContext)
    return {
      workflowCommitNode,
      workflow,
    }
  }

  fork(newBranchName: string, targetCommitNode: SessionWorkflowNode | null) {
    this.activeBranch = newBranchName
    this.branchs[newBranchName] = targetCommitNode
    agentEvent.emit('agent-session-forked', {
      sessionId: this.sessionId,
      branchName: newBranchName,
      sourceWorkflowId: targetCommitNode?.id || null,
    })
  }

  buildLLMMessages() {
    const currentBranchCommitNode = this.branchs[this.activeBranch]
    if (!currentBranchCommitNode) return []

    function traverse(node: SessionWorkflowNode, result: ChatMessage[] = []): ChatMessage[] {
      result.unshift(...node.messages)
      if (node.parent) {
        traverse(node.parent, result)
      }
      return result
    }

    return traverse(currentBranchCommitNode)
  }

  compact() {
    // TODO implement compact to reduce message/token size for long sessions.
  }

  static resume(snapshot: SessionSnapshot) {
    const session = new Session({
      sessionId: snapshot.sessionId,
      activeBranch: snapshot.activeBranch,
    })
    const workflowNodeMap = new Map<string, SessionWorkflowNode>()

    for (const workflow of snapshot.workflows) {
      workflowNodeMap.set(workflow.id, {
        id: workflow.id,
        messages: workflow.messages,
        parent: null,
        children: [],
      })
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
      session.branchs[branch.name] = branch.headWorkflowId
        ? (workflowNodeMap.get(branch.headWorkflowId) ?? null)
        : null
    }

    if (!(session.activeBranch in session.branchs)) {
      session.branchs[session.activeBranch] = null
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
