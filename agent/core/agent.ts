import type { Tool, FnProcessLLMStream } from './types'
import { AgentContext } from './context'
import { ToolService } from './toolService'
import { LLMService } from './llmService'
import { AgentStepHandlers } from './stepHandlers'
import { AgentRuntime } from './runtime'
import { Workflow } from './workflow'

export interface CreateAgentOptions {
  processLLMStream: FnProcessLLMStream
  tools: Tool[]
}

export class Agent {
  private workflow: Workflow

  constructor(options: CreateAgentOptions) {
    const { processLLMStream, tools } = options

    const ctx = new AgentContext()
    const llmService = new LLMService(processLLMStream, tools)
    const toolService = new ToolService(tools)
    const handlers = new AgentStepHandlers(ctx, llmService, toolService)
    const runtime = new AgentRuntime(handlers)
    this.workflow = new Workflow(runtime)
  }

  async run(input: string) {
    await this.workflow.start({ input })
  }
}
