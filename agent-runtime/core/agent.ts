type AgentState =
  | 'init'
  | 'user-input'
  | 'agent-start'
  | 'llm-request'
  | 'llm-stream'
  | 'llm-result'
  | 'tool-pending'
  | 'tool-result'
  | 'human-approve'
  | 'human-reject'

interface AgentContext {
  messages: any[]
}
export class Agent {
  state: AgentState = 'init'
  context: AgentContext = {
    messages: [],
  }

  constructor(private requestLLMHandle: (...args: any[]) => any) {}

  async run(data: any) {
    if (this.state === 'user-input') {
      const llmResult = await this.callLLM(data.currentPayload.messages)
      return {
        data: llmResult,
        status: 'llm-result',
      }
    } else if (this.state === 'tool-result') {
      const llmResult = await this.callLLM(data.currentPayload.messages)
      return {
        data: llmResult,
        status: 'llm-result',
      }
    }
    return {
      status: 'finished',
    }
  }

  async callLLM(messages: any) {
    let content = ''
    let toolCalls = []
    for await (const chunk of await this.requestLLMHandle({
      messages,
    })) {
      if (chunk.content) {
        content = chunk.content
      } else if (chunk.tool_calls) {
        toolCalls = chunk.tool_calls
      }
    }
    return {
      content,
      toolCalls,
    }
  }
  x() {
    return
  }
}
