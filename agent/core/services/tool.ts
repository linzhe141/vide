import { toolEvent } from '../event'
import type { Tool, ToolCall } from '../types'

export class ToolService {
  constructor(private tools: Tool[]) {}

  async execute(
    toolCall: ToolCall
  ): Promise<{ success: true; result: any } | { success: false; error: any }> {
    const toolName = toolCall.function.name
    const args = toolCall.function.arguments

    toolEvent.emit('tool-call-start', { toolName, args })

    const tool = this.tools.find((t) => t.name === toolName)
    if (!tool) {
      const error = new Error(`Tool not found: ${toolName}`)

      toolEvent.emit('tool-call-error', { toolName, error })
      return { success: false, error }
    }

    try {
      const result = await tool.executor(args)
      toolEvent.emit('tool-call-success', { toolName, result })

      return { success: true, result }
    } catch (error) {
      toolEvent.emit('tool-call-error', { toolName, error: error })

      return { success: false, error }
    }
  }
}
