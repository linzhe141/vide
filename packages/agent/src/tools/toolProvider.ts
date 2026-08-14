import type { Tool } from '@vide/ai'
import type { Agent } from '../agent'

export interface ToolRuntime {
  workspacePath: string | null
  signal: AbortSignal
  agentSettings: Agent['settings']
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
