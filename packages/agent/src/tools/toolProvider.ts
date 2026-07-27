import type { Tool } from '@vide/ai'
import type { WorkflowRuntimeContext } from '../workflow'
import type { WorkflowEmitEvent } from '../event/channels'

export abstract class ToolProvider {
  protected runtime: WorkflowRuntimeContext

  constructor(runtime: WorkflowRuntimeContext) {
    this.runtime = runtime
  }

  abstract getTools(): Tool[]

  emit(data: WorkflowEmitEvent) {
    return this.runtime.emit(data)
  }
}

export function defineTool(tool: Tool) {
  return tool
}
