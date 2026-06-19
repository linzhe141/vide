import type { Tool } from '../types'
import type { WorkflowRuntimeContext } from '../workflow'

export abstract class ToolProvider {
  protected runtime: WorkflowRuntimeContext

  constructor(runtime: WorkflowRuntimeContext) {
    this.runtime = runtime
  }

  abstract getTools(): Tool[]
}

export function defineTool(tool: Tool) {
  return tool
}
