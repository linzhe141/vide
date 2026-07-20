import type { Tool } from '@vide/ai'
import type { WorkflowRuntimeContextNew } from '../workflow'
import type { WorkflowEvent } from '../event/channels'

export abstract class ToolProvider {
  protected runtime: WorkflowRuntimeContextNew

  constructor(runtime: WorkflowRuntimeContextNew) {
    this.runtime = runtime
  }

  abstract getTools(): Tool[]

  emit(data: WorkflowEvent) {
    this.runtime.emit(data)
  }
}

export function defineTool(tool: Tool) {
  return tool
}
