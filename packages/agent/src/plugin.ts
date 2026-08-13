// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck 先忽略这个文件
import type { WorkflowRuntimeContext } from './workflow'
import type { StepPayload } from './types'

export interface WorkflowPlugin {
  name: string
  beforeWorkflowStart?: (input: string, runtime: WorkflowRuntimeContext) => Promise<string | void>
  beforeWorkflowFinish?: (
    content: string,
    runtime: WorkflowRuntimeContext
  ) => Promise<StepPayload | void>
  afterCallSubAgent?: (content: string, runtime: WorkflowRuntimeContext) => Promise<string | void>
  beforeAIStart?: (runtime: WorkflowRuntimeContext) => Promise<string | void>
  afterAIEnd?: (assistantMessage: string, runtime: WorkflowRuntimeContext) => Promise<string | void>
}
