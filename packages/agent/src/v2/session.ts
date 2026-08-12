import type { AgentMessage } from '@vide/ai'
import { WorkflowStream } from './stream'
import { Workflow, type StepPayload, type StopReason } from './workflow'
import { v4 as uuid } from 'uuid'
import { Time } from '../tools/time'
import { AskUserQuestionTool } from '../tools/askUserQuestion'
import { WebSearch } from '../tools/websearch'

export type SessionType = 'normal' | 'fork'

export interface SessionOrigin {
  sessionId: string
  workflowId: string | null
}

export interface SessionWorkflowNode {
  stopStatus?: 'completed' | 'error' | 'aborted'
  workflow: Workflow
  parent: SessionWorkflowNode | null
  children: SessionWorkflowNode[]
}

export interface SessionBranch {
  head: SessionWorkflowNode | null
  source: SessionWorkflowNode | null
}

export class Session {
  id: string = uuid()
  model: { name: string; baseURL: string; apiKey: string } | null = null

  // config context
  private _workspacePath: string | null = null
  private _autoApprove: boolean = false
  private _thinkingMode: boolean = false

  // workflow graph context
  sessionType: SessionType = 'normal'
  activeBranch = 'main'
  branchs: Record<string, SessionBranch> = {}
  sessionWorkflowNodes: Record<string, SessionWorkflowNode> = {}
  // workflowMap: Map<string, Workflow> = new Map()

  // 这里可以存放 等待 human approve 的workflow
  pendingSessionWorkflowNodes: Record<string, SessionWorkflowNode> = {}

  get currentBranch() {
    return this.branchs[this.activeBranch]
  }

  get workspacePath(): string | null {
    return this._workspacePath
  }
  set workspacePath(path: string) {
    this._workspacePath = path
  }

  get autoApprove(): boolean {
    return this._autoApprove
  }
  set autoApprove(value: boolean) {
    this._autoApprove = value
  }

  get thinkingMode(): boolean {
    return this._thinkingMode
  }
  set thinkingMode(value: boolean) {
    this._thinkingMode = value
  }

  setupModel(model: { name: string; baseURL: string; apiKey: string }) {
    this.model = model
  }

  prompt(input: string) {
    if (!this.model) {
      throw new Error('Model is not set for this session.')
    }

    const stream = new WorkflowStream()
    const workflow = new Workflow({
      model: this.model,
      sessionId: this.id,
      tools: [
        ...new Time({} as any).getTools(),
        ...new WebSearch({} as any).getTools(),
        ...new AskUserQuestionTool({} as any).getTools(),
      ],
      stream,
      thinkingMode: this.thinkingMode,
      getAutoApprove: () => this._autoApprove,
      getSessionAgentMessages: () => this.buildAgentMessages(),
    })
    workflow.context.stream = stream
    stream.sessionId = this.id
    stream.workflowId = workflow.id

    const workflowCommitNode = this.commitWorkflow(workflow)
    this.sessionWorkflowNodes[workflow.id] = workflowCommitNode

    workflow.run(input).then((stopReason) => {
      this.processWorkflowStopReason(stopReason, workflowCommitNode)
    })

    return stream
  }

  humanApprove(workflowId: string, continuePayload: StepPayload) {
    const workflowCommitNode = this.pendingSessionWorkflowNodes[workflowId]
    if (!workflowCommitNode) {
      throw new Error(`No pending workflow found with ID: ${workflowId}`)
    }
    delete this.pendingSessionWorkflowNodes[workflowId]

    const workflow = workflowCommitNode.workflow

    workflow.stepPayload = continuePayload
    workflow.continueRunLoop(workflow.stepPayload!).then((stopReason) => {
      this.processWorkflowStopReason(stopReason, workflowCommitNode)
    })
  }

  processWorkflowStopReason(stopReason: StopReason | void, workflowNode: SessionWorkflowNode) {
    if (stopReason === 'interrupted') {
      // 这里是可恢复的中断
      this.pendingSessionWorkflowNodes[workflowNode.workflow.id] = workflowNode
    }
    if (stopReason === 'completed' || stopReason === 'error' || stopReason === 'aborted') {
      // 这里才是真正的结束了
      workflowNode.stopStatus = stopReason
    }
  }

  // 将 workflow 作为一个整体 commit node 添加到当前分支的 workflow graph 中
  commitWorkflow(workflow: Workflow) {
    const workflowCommitNode: SessionWorkflowNode = {
      workflow,
      parent: null,
      children: [],
    }
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
    return workflowCommitNode
  }

  createBranch(branchName: string, source: SessionWorkflowNode | null) {
    if (this.branchs[branchName]) {
      console.error(`Branch ${branchName} already exists`)
      return
    }
    this.branchs[branchName] = {
      head: source,
      source,
    }
  }

  switchBranch(branchName: string) {
    if (!this.branchs[branchName]) {
      console.error(`Branch ${branchName} does not exist`)
      return
    }
    this.activeBranch = branchName
  }

  buildAgentMessages() {
    const currentHead = this.currentBranch?.head ?? null
    if (!currentHead) return []
    // 不需要正在运行的 workflow 的 messages， 因为它还没有完成，可能还会有新的 messages
    // running workflow 自行 拼接
    const targetWorkflow = currentHead.stopStatus == undefined ? currentHead.parent : currentHead
    if (!targetWorkflow) return []

    function traverse(node: SessionWorkflowNode, result: AgentMessage[] = []): AgentMessage[] {
      if (node.stopStatus !== 'aborted' && node.stopStatus !== 'error') {
        result.unshift(...node.workflow.messages)
      }
      if (node.parent) {
        traverse(node.parent, result)
      }
      return result
    }

    return traverse(targetWorkflow)
  }
}
