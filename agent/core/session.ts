import { agentEvent } from './event'
import type { PlanStep } from './tools/planner'
import type { ChatMessage } from './types'
import { Workflow, WorkflowRuntimeContext } from './workflow'
import { v4 as uuid } from 'uuid'

// 一个 workflow 为一个 node，因为在中间切换没有任何意义
export interface SessionWorkflowNode {
  // 同 workflow
  id: string
  messages: ChatMessage[]
  parent: SessionWorkflowNode | null
  children: SessionWorkflowNode[]
}

export class Session {
  sessionId: string
  // branch
  activeBranch: string = 'main'
  branchs: Record<string, SessionWorkflowNode> = {}
  // planners
  planners: SessionPlaner[] = []

  constructor() {
    this.sessionId = uuid()
  }

  async run(userInput: string, branchName: string = 'main') {
    this.activeBranch = branchName

    const { workflow, workflowCommitNode } = this.createWorkflow(userInput)
    // 保证数据一致性，因为workflow run 会修改 messages
    // TODO 后续实现一个commit的逻辑，保证数据的完整性和可追溯性 是否有必要
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
    const workflowRuntimeContext = new WorkflowRuntimeContext({
      session: this,
      userInput,
    })
    const workflowCommitNode: SessionWorkflowNode = {
      id: workflowRuntimeContext.workflowId,
      // 使用同一个 message, 保证一致性
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

  fork(newBranchName: string, targetCommitNode: SessionWorkflowNode) {
    this.activeBranch = newBranchName
    this.branchs[newBranchName] = targetCommitNode
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
    // TODO 实现 compact 的逻辑，合并 messages，减少Token 数量
  }
}

export class SessionPlaner {
  id: string
  constructor(public plans: PlanStep[]) {
    this.id = uuid()
  }
}
