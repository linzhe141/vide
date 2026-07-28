import type { WorkflowRuntimeContext } from './workflow'

export interface WorkflowPlugin {
  name: string
  beforeWorkflowStart?: (input: string, runtime: WorkflowRuntimeContext) => Promise<string | void>
  afterWorkflowEnd?: (content: string, runtime: WorkflowRuntimeContext) => Promise<void>
}
