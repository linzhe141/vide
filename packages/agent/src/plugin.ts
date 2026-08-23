import type { CompletedPayload, StepPayload, WorkflowRuntimeContext } from './workflow'

export interface WorkflowPlugin {
  name: string
  beforeWorkflowStart?: (
    payload: StepPayload,
    runtime: WorkflowRuntimeContext
  ) => Promise<StepPayload | void>
  beforeWorkflowFinish?: (
    payload: CompletedPayload,
    runtime: WorkflowRuntimeContext
  ) => Promise<CompletedPayload | void>
}
