import type { Tool } from '@vide/ai'

export interface ToolRuntime {
  workspacePath: string | null
  signal: AbortSignal
}
export abstract class ToolProvider {
  protected runtime: ToolRuntime

  constructor(runtime: ToolRuntime) {
    this.runtime = runtime
  }

  abstract getTools(): Tool[]
}

export function defineTool(tool: Tool) {
  return tool
}
