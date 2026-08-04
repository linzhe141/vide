import { WorkflowStream } from './stream'
import { Workflow } from './workflow'
import { v4 as uuid } from 'uuid'

export class Session {
  private _workspacePath: string | null = null
  private _autoApprove: boolean = false

  workflowMap: Map<string, Workflow> = new Map()

  id: string = uuid()
  constructor(id?: string) {
    if (id) {
      this.id = id
    }
  }

  set workspacePath(path: string) {
    this._workspacePath = path
  }
  get workspacePath(): string | null {
    return this._workspacePath
  }

  set autoApprove(value: boolean) {
    this._autoApprove = value
  }
  get autoApprove(): boolean {
    return this._autoApprove
  }

  prompt(input: string, options?: { autoApprove?: boolean }) {
    const autoApprove = options?.autoApprove ?? this._autoApprove

    const stream = new WorkflowStream()
    const workflow = new Workflow({
      sessionId: this.id,
      workspacePath: this._workspacePath,
      stream,
      getAutoApprove: () => autoApprove,
      getSessionAgentMessages: () => [],
    })
    workflow.context.stream = stream
    workflow.runLoop({ state: 'INPUT', input })
    return stream
  }
}
