import type { AgentMessage, Tool } from '@vide/ai'
import { WorkflowStream } from './stream'
import {
  type ContextInputMessage,
  Workflow,
  WorkflowRuntimeContext,
  type CallToolsPayload,
  type InterruptPayload,
  type StopReason,
} from './workflow'
import { v4 as uuid } from 'uuid'
import { getBuildInTools } from './tools/buildinTools'
import { buildSkillsChatMessage } from './tools/skill'
import type { Agent } from './agent'

export type SessionType = 'normal' | 'fork'

export interface SessionOrigin {
  sessionId: string
  workflowId: string | null
}

export class LoadedWorkflow {
  constructor(
    public id: string,
    public messages: AgentMessage[]
  ) {}
}

export type SessionWorkflow = Workflow | LoadedWorkflow

function isRuntimeWorkflow(workflow: SessionWorkflow): workflow is Workflow {
  return workflow instanceof Workflow
}

export interface SessionWorkflowNode {
  stopStatus?: 'completed' | 'error' | 'aborted'
  workflow: SessionWorkflow
  parent: SessionWorkflowNode | null
  children: SessionWorkflowNode[]
}

export interface SessionBranch {
  head: SessionWorkflowNode | null
  source: SessionWorkflowNode | null
}

export type SessionInputSource = 'desktop' | 'wechat-bot'

export interface SessionPromptOptions {
  inputSource?: SessionInputSource
  extraTools?: Tool[]
}

export interface QueuedSteeringMessage extends ContextInputMessage {
  workflowId: string
  createdAt: number
}

interface InterruptedToolContext {
  toolCalls: CallToolsPayload['toolCalls']
  continueToolCallIndex?: number
}

export class Session {
  id: string = uuid()
  model: { name: string; baseURL: string; apiKey: string } | null = null

  // metadata (UI 侧由 historyStore 维护展示，这里仅是后端侧的最小持久/事件来源)
  title: string = ''
  createdAt = Date.now()
  updatedAt = Date.now()

  // config context
  private _workspacePath: string | null = null
  private _autoApprove: boolean = false
  private _thinkingMode: boolean = false

  // workflow graph context
  sessionType: SessionType = 'normal'
  activeBranch = 'main'
  branches: Record<string, SessionBranch> = {}
  sessionWorkflowNodes: Record<string, SessionWorkflowNode> = {}
  // workflowMap: Map<string, Workflow> = new Map()

  // 这里可以存放 等待 human approve 的workflow
  pendingSessionWorkflowNodes: Record<string, SessionWorkflowNode> = {}

  constructor(public agentSettings: Agent['settings']) {}

  get currentBranch() {
    return this.branches[this.activeBranch]
  }

  get workspacePath(): string | null {
    return this._workspacePath
  }
  set workspacePath(path: string | null) {
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

  async prompt(input: string, options?: SessionPromptOptions) {
    if (!this.model) {
      throw new Error('Model is not set for this session.')
    }

    const stream = new WorkflowStream()
    const runtime = new WorkflowRuntimeContext({
      model: this.model,
      sessionId: this.id,
      stream,
      thinkingMode: this.thinkingMode,
      getAutoApprove: () => this._autoApprove,
      getSessionAgentMessages: () => this.buildAgentMessages(),
      workspacePath: this.workspacePath,
      agentSettings: this.agentSettings,
    })
    const workflow = new Workflow(runtime, [
      ...getBuildInTools(runtime),
      ...(options?.extraTools ?? []),
    ])
    stream.sessionId = this.id
    stream.workflowId = workflow.id

    const skillsMessage = await buildSkillsChatMessage(this.workspacePath)
    if (skillsMessage) {
      workflow.messages.push(skillsMessage)
    }

    const workflowCommitNode = this.commitWorkflow(workflow)
    this.sessionWorkflowNodes[workflow.id] = workflowCommitNode

    workflow.run(input, { inputSource: options?.inputSource ?? 'desktop' }).then((stopReason) => {
      this.processWorkflowStopReason(stopReason, workflowCommitNode)
    })

    return stream
  }

  enqueueSteeringMessage(data: {
    input: string
    inputSource: SessionInputSource
    messageId?: string
  }): QueuedSteeringMessage | null {
    const input = data.input.trim()
    if (!input) {
      return null
    }

    const workflowNode = this.currentBranch?.head ?? null
    if (!workflowNode || workflowNode.stopStatus) {
      return null
    }

    const workflow = workflowNode.workflow
    if (!isRuntimeWorkflow(workflow) || !workflow.canAcceptSteeringMessages()) {
      return null
    }

    const messageId = data.messageId ?? uuid()
    const queuedMessage: QueuedSteeringMessage = {
      workflowId: workflow.id,
      messageId,
      input,
      inputSource: data.inputSource,
      createdAt: Date.now(),
    }

    workflow.enqueueSteeringMessage(queuedMessage)
    this.updatedAt = queuedMessage.createdAt
    return queuedMessage
  }

  // 中断当前分支上正在运行的 workflow
  abort() {
    const workflow = this.currentBranch?.head?.workflow
    if (!workflow || !isRuntimeWorkflow(workflow)) {
      return
    }
    workflow.abort()
    //TODO 对于 INTERRUPT workflow，已经不再 while loop了， 需要手动抛出 abort stream event
    if (workflow?.state === 'INTERRUPT') {
      workflow.stream.push({ type: 'workflow.aborted' })
      workflow.stream.end()
    }
  }

  humanApprove(workflowId: string) {
    const workflowCommitNode = this.pendingSessionWorkflowNodes[workflowId]
    if (!workflowCommitNode) {
      throw new Error(`No pending workflow found with ID: ${workflowId}`)
    }
    delete this.pendingSessionWorkflowNodes[workflowId]

    const workflow = workflowCommitNode.workflow
    if (!isRuntimeWorkflow(workflow)) {
      throw new Error(`Workflow ${workflowId} is not resumable`)
    }

    const interruptPayload = workflow.stepPayload as InterruptPayload
    const interruptContext = interruptPayload.context as InterruptedToolContext
    const continuePayload: CallToolsPayload = {
      state: 'CALL_TOOLS',
      toolCalls: interruptContext.toolCalls.map((i) => ({
        ...i,
        status: 'human-approved',
      })),
      continueToolCallIndex: interruptContext.continueToolCallIndex,
    }
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
    if (this.branches[branchName]) {
      console.error(`Branch ${branchName} already exists`)
      return
    }
    this.branches[branchName] = {
      head: source,
      source,
    }
  }

  switchBranch(branchName: string) {
    if (!this.branches[branchName]) {
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
      if (node.stopStatus !== 'error') {
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
