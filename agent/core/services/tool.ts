import type { Tool, ToolCall } from '../types'

export class ToolService {
  constructor(private tools: Tool[]) {}

  async execute(toolCall: ToolCall) {
    const toolName = toolCall.function.name
    const args = toolCall.function.arguments

    const tool = this.tools.find((t) => t.name === toolName)
    if (!tool) {
      const err = new Error(`Tool not found: ${toolName}`)
      throw err
    }

    const result = await tool.executor(args)
    return result
  }
}
