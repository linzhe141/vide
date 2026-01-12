import type {
  Agent,
  CallLLMStepPayload,
  CallToolStepPayload,
  ToolCall,
  UserInputStepPayload,
} from './agent'

export class Workflow {
  toolCalls: ToolCall[] = []
  constructor(public agent: Agent) {}

  async precessUserInput(input: string) {
    const agent = this.agent
    this.agent.state = 'user-input'
    while (true) {
      switch (agent.state) {
        case 'user-input': {
          const nextState = await agent.runStep({
            input,
          } satisfies UserInputStepPayload)

          if (nextState) {
            agent.state = nextState.state
          }

          break
        }

        case 'call-llm': {
          const nextState = await agent.runStep({
            messages: agent.context.messages,
          } satisfies CallLLMStepPayload)

          if (nextState) {
            agent.state = nextState.state
            // @ts-expect-error ignore
            const newToolCalls: ToolCall[] = nextState.toolCalls as any
            if (newToolCalls?.length) {
              this.toolCalls = newToolCalls
            }
          }
          break
        }

        case 'call-tool': {
          const toolCall = [...this.toolCalls].shift()
          if (toolCall) {
            const nextState = await agent.runStep({
              toolCall,
            } satisfies CallToolStepPayload)

            if (nextState) {
              agent.state = nextState.state
            }
          }

          break
        }

        case 'finished':
          console.log('✅ Workflow finished')
          return
      }
    }
  }
}
